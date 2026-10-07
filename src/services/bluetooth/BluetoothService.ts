/// <reference types="cordova-plugin-bluetoothle" />
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { FrameAssembler, encodeFrames } from './frames';
import type { BluetoothMessage, Player } from '@/types/game';

export const GAME_SERVICE_UUID = 'd1e50a00-5f6c-4f3a-8d21-2db5a1500001';
export const GAME_CHARACTERISTIC_UUID = 'd1e50a01-5f6c-4f3a-8d21-2db5a1500001';

export interface NearbyRoom {
  address: string;
  name: string;
  rssi: number;
  gameId: string;
  code: string;
  playerCount: number;
  hostId: string;
  players: Player[];
}

type PluginEvent = BluetoothlePlugin.InitializeResult & { name?: string; rssi?: number; localName?: string };
type MessageHandler = (message: unknown, remoteAddress: string) => void;
type ConnectionHandler = (connected: boolean, address: string) => void;

class BluetoothService {
  private role: 'host' | 'guest' | null = null;
  private remoteAddress = '';
  private readonly peerAddresses = new Map<string, string>();
  private readonly connectedAddresses = new Set<string>();
  private readonly assembler = new FrameAssembler();
  private onMessage: MessageHandler = () => undefined;
  private onConnection: ConnectionHandler = () => undefined;
  private transferId = Math.floor(Math.random() * 0xffff);

  private plugin(): BluetoothlePlugin.Bluetoothle {
    if (Capacitor.getPlatform() !== 'android') {
      throw new Error('Bluetooth multiplayer está disponível somente no Android nesta versão.');
    }
    if (!window.bluetoothle) {
      throw new Error('Plugin Bluetooth nativo ausente. Sincronize e instale o projeto Android.');
    }
    return window.bluetoothle;
  }

  private call<T>(operation: (resolve: (result: T) => void, reject: (error: unknown) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => operation(resolve, reject));
  }

  private async requestPermission(
    check: (resolve: (result: { hasPermission: boolean }) => void) => void,
    request: (resolve: (result: { requestPermission: boolean }) => void, reject: (error: unknown) => void) => void,
    permissionName: string,
  ): Promise<void> {
    const granted = await new Promise<boolean>((resolve) => check((result) => resolve(result.hasPermission)));
    if (granted) return;
    const requested = await new Promise<boolean>((resolve, reject) => request(
      (result) => resolve(result.requestPermission),
      (reason) => reject(new Error(`Permissão ${permissionName} negada. Ative-a nas configurações do Android.`)),
    ));
    if (!requested) throw new Error(`Permissão ${permissionName} negada. Ative-a nas configurações do Android.`);
  }

  private async ensurePermissions(action: 'scan' | 'connect' | 'advertise'): Promise<void> {
    const bluetooth = this.plugin();
    const { androidSDKVersion = 0 } = await Device.getInfo();
    const request = (method: (success: (result: { requestPermission: boolean }) => void) => void) =>
      (resolve: (result: { requestPermission: boolean }) => void, reject: (reason: unknown) => void) => {
        (method as unknown as (success: typeof resolve, error: typeof reject) => void)(resolve, reject);
      };
    if (androidSDKVersion < 31) {
      await this.requestPermission(
        (resolve) => bluetooth.hasPermission(resolve),
        request(bluetooth.requestPermission.bind(bluetooth)),
        'de localização',
      );
    }
    if (action === 'scan' || action === 'connect') {
      await this.requestPermission(
        (resolve) => bluetooth.hasPermissionBtScan(resolve),
        request(bluetooth.requestPermissionBtScan.bind(bluetooth)),
        'de busca Bluetooth',
      );
    }
    if (action === 'connect' || action === 'advertise') {
      await this.requestPermission(
        (resolve) => bluetooth.hasPermissionBtConnect(resolve),
        request(bluetooth.requestPermissionBtConnect.bind(bluetooth)),
        action === 'advertise' ? 'de conexão Bluetooth para hospedar a sala' : 'de conexão Bluetooth',
      );
    }
    if (action === 'advertise') {
      await this.requestPermission(
        (resolve) => bluetooth.hasPermissionBtAdvertise(resolve),
        request(bluetooth.requestPermissionBtAdvertise.bind(bluetooth)),
        'de anúncio Bluetooth',
      );
    }
  }

  private initialize(): Promise<void> {
    const bluetooth = this.plugin();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('O Bluetooth não respondeu. Verifique as permissões do app.')), 15000);
      bluetooth.initialize((state) => {
        if (state.status === 'disabled') {
          window.clearTimeout(timeout);
          reject(new Error('Bluetooth desligado. Ative o Bluetooth para continuar.'));
        } else {
          window.clearTimeout(timeout);
          resolve();
        }
      }, { request: true, statusReceiver: true });
    });
  }

  private base64(bytes: Uint8Array): string {
    return this.plugin().bytesToEncodedString(bytes);
  }

  private receive(address: string, encoded: string): void {
    const message = this.assembler.push(address, this.plugin().encodedStringToBytes(encoded));
    if (message !== null) this.onMessage(message, address);
  }

  async startHost(
    room: { gameId: string; code: string; name: string; hostId: string; players: Player[] },
    onMessage: MessageHandler,
    onConnection: ConnectionHandler,
  ): Promise<void> {
    const bluetooth = this.plugin();
    await this.ensurePermissions('advertise');
    await this.initialize();
    this.role = 'host';
    this.onMessage = onMessage;
    this.onConnection = onConnection;
    this.peerAddresses.clear();
    this.connectedAddresses.clear();

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('O servidor Bluetooth não inicializou. Feche e abra o app e tente novamente.')), 10000);
      bluetooth.initializePeripheral((event: PluginEvent) => {
        if (event.status === 'disabled') {
          onConnection(false, '');
          window.clearTimeout(timeout);
          reject(new Error('Bluetooth desligado. Ative o Bluetooth para criar uma sala.'));
          return;
        }
        if (event.status === 'enabled') {
          window.clearTimeout(timeout);
          resolve();
        }
        if (event.status === 'connected' && event.address) {
          this.connectedAddresses.add(event.address);
          onConnection(true, event.address);
        }
        if (event.status === 'disconnected' && event.address) {
          this.connectedAddresses.delete(event.address);
          this.assembler.clearPeer(event.address);
          onConnection(false, event.address);
        }
        if (event.status === 'readRequested' && event.address) {
          const value = this.base64(new TextEncoder().encode(JSON.stringify(room)));
          bluetooth.respond(() => undefined, () => undefined, {
            requestId: event.requestId, address: event.address, value,
          });
        }
        if (event.status === 'writeRequested' && event.address && event.value) {
          bluetooth.respond(() => undefined, () => undefined, {
            requestId: event.requestId, address: event.address, value: event.value,
          });
          this.receive(event.address, event.value);
        }
      }, (reason) => {
        window.clearTimeout(timeout);
        reject(reason);
      }, { request: true });
    });

    await this.call((resolve, reject) => bluetooth.addService(resolve, reject, {
      service: GAME_SERVICE_UUID,
      characteristics: [{
        uuid: GAME_CHARACTERISTIC_UUID,
        properties: { read: true, write: true, writeWithoutResponse: false, notify: true },
        permissions: { read: true, write: true },
        descriptors: [{ uuid: '2901' }],
      }],
    }));
    await this.call((resolve, reject) => bluetooth.startAdvertising(resolve, reject, {
      service: GAME_SERVICE_UUID,
      name: `BURRO ${room.code}`,
      includeDeviceName: false,
      includeTxPowerLevel: false,
      connectable: true,
      mode: 'lowLatency',
      timeout: 0,
    } as BluetoothlePlugin.AdvertisingParamsAndroid & { name: string }));
  }

  async scan(onRoom: (room: NearbyRoom) => void): Promise<void> {
    const bluetooth = this.plugin();
    await this.ensurePermissions('scan');
    await this.initialize();
    bluetooth.startScan((event) => {
      if (event.status !== 'scanResult' || !event.address) return;
      const services = typeof event.advertisement === 'object' ? event.advertisement.serviceUuids ?? [] : [];
      if (!services.some((service) => service.toLowerCase() === GAME_SERVICE_UUID)) return;
      onRoom({
        address: event.address,
        name: event.name || (typeof event.advertisement === 'object' ? event.advertisement.localName : '') || 'Sala BURRO',
        rssi: event.rssi ?? -100,
        gameId: '',
        code: '',
        playerCount: 0,
        hostId: '',
        players: [],
      });
    }, () => undefined, { services: [GAME_SERVICE_UUID], scanMode: 2 });
  }

  async stopScan(): Promise<void> {
    const bluetooth = this.plugin();
    await this.call((resolve, reject) => bluetooth.stopScan(resolve, reject));
  }

  async connectToRoom(room: NearbyRoom, onMessage: MessageHandler, onConnection: ConnectionHandler): Promise<NearbyRoom> {
    const bluetooth = this.plugin();
    await this.stopScan();
    await this.ensurePermissions('connect');
    this.role = 'guest';
    this.remoteAddress = room.address;
    this.onMessage = onMessage;
    this.onConnection = onConnection;
    await new Promise<void>((resolve, reject) => {
      let connected = false;
      bluetooth.connect((event) => {
        if (event.status === 'connected' && !connected) {
          connected = true;
          onConnection(true, room.address);
          resolve();
        } else if (event.status === 'disconnected') {
          this.assembler.clearPeer(room.address);
          onConnection(false, room.address);
        }
      }, reject, { address: room.address });
      window.setTimeout(() => {
        if (!connected) reject(new Error('A conexão com a sala expirou. Tente novamente.'));
      }, 20000);
    });
    await this.call((resolve, reject) => bluetooth.discover(resolve, reject, { address: room.address }));
    await new Promise<void>((resolve, reject) => bluetooth.subscribe((event) => {
      if (event.status === 'subscribed') resolve();
      if (event.status === 'subscribedResult' && event.value) this.receive(room.address, event.value);
    }, reject, { address: room.address, service: GAME_SERVICE_UUID, characteristic: GAME_CHARACTERISTIC_UUID }));
    const info = await new Promise<Pick<NearbyRoom, 'gameId' | 'code' | 'name' | 'playerCount' | 'hostId' | 'players'>>((resolve, reject) => {
      bluetooth.read((event) => {
        try {
          resolve(JSON.parse(new TextDecoder().decode(bluetooth.encodedStringToBytes(event.value))));
        } catch {
          reject(new Error('A sala enviou dados inválidos.'));
        }
      }, reject, { address: room.address, service: GAME_SERVICE_UUID, characteristic: GAME_CHARACTERISTIC_UUID });
    });
    return { ...room, ...info };
  }

  registerPeer(playerId: string, address: string): void {
    if (this.role === 'host') this.peerAddresses.set(playerId, address);
  }

  playerForAddress(address: string): string | undefined {
    return [...this.peerAddresses.entries()].find(([, peerAddress]) => peerAddress === address)?.[0];
  }

  async send(message: BluetoothMessage, targetPlayerId?: string): Promise<void> {
    const bluetooth = this.plugin();
    const transferId = (this.transferId = (this.transferId + 1) & 0xffff);
    const frames = encodeFrames(message, transferId);
    if (this.role === 'guest') {
      for (const frame of frames) {
        await this.call((resolve, reject) => bluetooth.write(resolve, reject, {
          address: this.remoteAddress,
          service: GAME_SERVICE_UUID,
          characteristic: GAME_CHARACTERISTIC_UUID,
          value: this.base64(frame),
        }));
      }
      return;
    }

    const recipients = targetPlayerId
      ? [this.peerAddresses.get(targetPlayerId)].filter((address): address is string => Boolean(address))
      : [...this.connectedAddresses];
    if (!recipients.length) throw new Error('Ainda não há jogadores conectados à sala.');
    for (const address of recipients) {
      for (const frame of frames) {
        await this.call((resolve, reject) => bluetooth.notify(resolve, reject, {
          service: GAME_SERVICE_UUID,
          characteristic: GAME_CHARACTERISTIC_UUID,
          address,
          value: this.base64(frame),
        }));
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.role) return;
    const bluetooth = this.plugin();
    if (this.role === 'host') {
      await new Promise<void>((resolve) => bluetooth.stopAdvertising(() => resolve(), () => resolve()));
    } else if (this.remoteAddress) {
      await new Promise<void>((resolve) => bluetooth.close(() => resolve(), () => resolve(), { address: this.remoteAddress }));
    }
    this.role = null;
    this.remoteAddress = '';
    this.connectedAddresses.clear();
    this.peerAddresses.clear();
  }
}

export const bluetoothService = new BluetoothService();