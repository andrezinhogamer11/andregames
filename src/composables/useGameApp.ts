import { computed, ref } from 'vue';
import { bluetoothService, type NearbyRoom } from '@/services/bluetooth/BluetoothService';
import { createBluetoothMessage, validateBluetoothMessage } from '@/services/bluetooth/messageValidation';
import { deleteHistoryEntry, getHistory, saveHistory, clearHistory as clearStoredHistory } from '@/services/storage/history';
import { startGame, submitCardSelection } from '@/services/game/rules';
import type { Game, GameHistory, GameResult, Player } from '@/types/game';

type Screen = 'home' | 'identity' | 'choose' | 'search' | 'lobby' | 'game' | 'result' | 'history' | 'details';
interface JoinRequest { id: string; name: string; address: string }

export function useGameApp() {
const screen = ref<Screen>('home');
const playerName = ref(localStorage.getItem('burro-player-name') ?? '');
const playerNameInput = ref(playerName.value);
const localPlayerId = ref('');
const game = ref<Game | null>(null);
const selectedCardId = ref('');
const movePending = ref(false);
const rooms = ref<NearbyRoom[]>([]);
const joinRequests = ref<JoinRequest[]>([]);
const history = ref<GameHistory[]>(getHistory());
const selectedHistory = ref<GameHistory | null>(null);
const busy = ref(false);
const scanning = ref(false);
const connectionLabel = ref('Bluetooth não conectado');
const notice = ref('');
const error = ref('');
const identityError = ref('');
let scanTimeout = 0;

const localPlayer = computed(() => game.value?.players.find((player) => player.id === localPlayerId.value) ?? null);
const localHand = computed(() => game.value?.hands[localPlayerId.value] ?? []);
const activePlayer = computed(() => game.value?.players.find((player) => player.id === game.value?.currentPlayerId) ?? null);
const isHost = computed(() => localPlayer.value?.isHost ?? false);
const isMyTurn = computed(() => game.value?.status === 'playing' && game.value.currentPlayerId === localPlayerId.value);
const nextPlayer = computed(() => {
  if (!game.value || !localPlayer.value) return null;
  const players = [...game.value.players].sort((left, right) => left.order - right.order);
  return players[(players.findIndex((player) => player.id === localPlayerId.value) + 1) % players.length] ?? null;
});
const previousPlayer = computed(() => {
  if (!game.value || !localPlayer.value) return null;
  const players = [...game.value.players].sort((left, right) => left.order - right.order);
  return players[(players.findIndex((player) => player.id === localPlayerId.value) - 1 + players.length) % players.length] ?? null;
});

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function setError(message: unknown): void {
  if (message instanceof Error) {
    error.value = message.message;
    return;
  }
  if (typeof message === 'string' && message.trim()) {
    error.value = message;
    return;
  }
  if (typeof message === 'object' && message !== null) {
    const nativeError = message as { message?: unknown; error?: unknown };
    const detail = [nativeError.message, nativeError.error]
      .filter((part): part is string => typeof part === 'string' && Boolean(part.trim()))
      .join(' · ');
    if (detail) {
      error.value = `Bluetooth: ${detail}`;
      return;
    }
  }
  error.value = 'Não foi possível iniciar o Bluetooth. Confira as permissões e se o aparelho oferece Bluetooth LE.';
}

function rememberHistory(): void {
  if (!game.value || !game.value.endedAt || !game.value.result) return;
  saveHistory({ ...game.value, localPlayerId: localPlayerId.value });
  history.value = getHistory();
}

function currentGameContext(): Game {
  if (!game.value) throw new Error('Nenhuma partida ativa.');
  return game.value;
}

function makeSnapshot(forPlayerId: string): Record<string, unknown> {
  const current = currentGameContext();
  return {
    status: current.status,
    hostId: current.hostId,
    players: current.players,
    currentPlayerId: current.currentPlayerId,
    round: current.round,
    startedAt: current.startedAt,
    endedAt: current.endedAt,
    result: current.result,
    hand: current.hands[forPlayerId] ?? [],
  };
}

function applySnapshot(payload: Record<string, unknown>): void {
  const current = currentGameContext();
  if (!Array.isArray(payload.players) || !Array.isArray(payload.hand)
    || typeof payload.status !== 'string' || typeof payload.round !== 'number') return;
  const players = payload.players as Player[];
  if (!players.some((player) => player.id === localPlayerId.value)
    || !players.some((player) => player.id === current.hostId)) return;
  const ownHand = payload.hand as Game['hands'][string];
  if (ownHand.some((card) => typeof card.id !== 'string' || typeof card.value !== 'string')) return;
  game.value = {
    ...current,
    status: payload.status as Game['status'],
    players,
    hands: { [localPlayerId.value]: ownHand },
    pendingPasses: {},
    currentPlayerId: typeof payload.currentPlayerId === 'string' ? payload.currentPlayerId : null,
    round: payload.round,
    startedAt: typeof payload.startedAt === 'number' ? payload.startedAt : current.startedAt,
    endedAt: typeof payload.endedAt === 'number' ? payload.endedAt : null,
    result: (payload.result as GameResult | null) ?? null,
  };
  movePending.value = false;
  selectedCardId.value = '';
  connectionLabel.value = 'Conectado ao anfitrião';
  if (game.value.status === 'playing') screen.value = 'game';
  if (game.value.status === 'finished' || game.value.status === 'interrupted') {
    rememberHistory();
    screen.value = 'result';
  }
}

async function sendSnapshot(type: 'PARTIDA_INICIADA' | 'ESTADO_PARTIDA' | 'TROCA_REALIZADA' | 'JOGADOR_COMPLETOU' | 'PARTIDA_FINALIZADA'): Promise<void> {
  const current = currentGameContext();
  for (const player of current.players) {
    if (player.id === localPlayerId.value || !player.connected) continue;
    try {
      await bluetoothService.send(
        createBluetoothMessage(type, current.id, localPlayerId.value, makeSnapshot(player.id)),
        player.id,
      );
    } catch {
      player.connected = false;
    }
  }
}

async function receiveMessage(value: unknown, address: string): Promise<void> {
  const current = game.value;
  if (!current || !validateBluetoothMessage(value, current)) return;
  const message = value;
  const registeredPlayerId = bluetoothService.playerForAddress(address);
  if (isHost.value && message.type !== 'SOLICITACAO_ENTRADA' && registeredPlayerId !== message.senderId) return;
  if (!isHost.value && message.senderId !== current.hostId) return;

  if (isHost.value && message.type === 'SOLICITACAO_ENTRADA') {
    const name = (message.payload as { name: string }).name.trim().slice(0, 20);
    if (current.status !== 'lobby' || current.players.length >= 6
      || current.players.some((player) => player.id === message.senderId)
      || joinRequests.value.some((request) => request.id === message.senderId)) return;
    bluetoothService.registerPeer(message.senderId, address);
    joinRequests.value.push({ id: message.senderId, name, address });
    notice.value = `${name} quer entrar na sala.`;
    return;
  }

  if (isHost.value && message.type === 'JOGADA') {
    try {
      const payload = message.payload as { playerId: string; cardId: string; round: number };
      if (payload.round !== current.round) throw new Error('A rodada enviada está desatualizada.');
      if (current.status !== 'playing' || current.currentPlayerId !== message.senderId) throw new Error('Não é o turno deste jogador.');
      const before = current.players.map((player) => player.penalty).join(',');
      game.value = submitCardSelection(current, message.senderId, payload.cardId);
      const penaltyChanged = before !== game.value.players.map((player) => player.penalty).join(',');
      const type = game.value.status === 'finished'
        ? 'PARTIDA_FINALIZADA'
        : game.value.pendingPasses && Object.keys(game.value.pendingPasses).length > 0
          ? 'ESTADO_PARTIDA'
          : penaltyChanged ? 'JOGADOR_COMPLETOU' : 'TROCA_REALIZADA';
      await sendSnapshot(type);
      if (game.value.status === 'finished') {
        rememberHistory();
        screen.value = 'result';
      }
      if (penaltyChanged) notice.value = `${game.value.players.find((player) => player.penalty > (current.players.find((beforePlayer) => beforePlayer.id === player.id)?.penalty ?? 0))?.name ?? 'Um jogador'} recebeu uma letra.`;
    } catch (reason) {
      try {
        await bluetoothService.send(createBluetoothMessage('JOGADA_REJEITADA', current.id, localPlayerId.value, {
          message: reason instanceof Error ? reason.message : 'Jogada inválida.',
        }), message.senderId);
      } catch {
        setError(reason);
      }
    }
    return;
  }

  if (isHost.value && message.type === 'JOGADOR_DESCONECTADO' && current.status === 'playing') {
    current.players = current.players.map((player) => player.id === message.senderId
      ? { ...player, connected: false }
      : player);
    try {
      await bluetoothService.send(createBluetoothMessage('JOGADOR_DESCONECTADO', current.id, localPlayerId.value, {
        playerId: message.senderId,
        message: 'A partida foi interrompida porque um jogador saiu.',
      }));
    } catch { /* Alguns peers podem já ter perdido o link. */ }
    interruptGame('abandono', `${current.players.find((player) => player.id === message.senderId)?.name ?? 'Um jogador'} saiu da partida.`);
    return;
  }

  if (!isHost.value && message.senderId === current.hostId) {
    if (message.type === 'JOGADOR_ENTROU') {
      const payload = message.payload as { accepted?: boolean; hostName?: string; players?: Player[] };
      if (!payload.accepted) {
        connectionLabel.value = 'Solicitação recusada';
        notice.value = 'O anfitrião recusou sua entrada na sala.';
        await bluetoothService.stop();
        screen.value = 'search';
        return;
      }
      if (Array.isArray(payload.players)) current.players = payload.players;
      current.players = current.players.filter((player) => player.id !== localPlayerId.value);
      current.players.push({ id: localPlayerId.value, name: playerName.value, isHost: false, connected: true, order: current.players.length, penalty: 0 });
      connectionLabel.value = 'Conectado ao anfitrião';
      notice.value = 'Entrada aprovada. Aguardando o anfitrião iniciar.';
      return;
    }
    if (message.type === 'PARTIDA_INICIADA' || message.type === 'ESTADO_PARTIDA'
      || message.type === 'TROCA_REALIZADA' || message.type === 'JOGADOR_COMPLETOU'
      || message.type === 'PARTIDA_FINALIZADA') {
      applySnapshot(message.payload as Record<string, unknown>);
      return;
    }
    if (message.type === 'JOGADA_REJEITADA') {
      movePending.value = false;
      setError((message.payload as { message?: string }).message ?? 'A jogada foi recusada pelo anfitrião.');
      return;
    }
    if (message.type === 'JOGADOR_DESCONECTADO') {
      interruptGame('desconexão', 'A partida foi interrompida porque um jogador se desconectou.');
    }
  }
}

async function handleConnection(connected: boolean, address: string): Promise<void> {
  if (connected) {
    connectionLabel.value = 'Dispositivo conectado';
    return;
  }
  if (!address) {
    connectionLabel.value = 'Bluetooth desligado';
    if (game.value?.status === 'playing') interruptGame('desconexão', 'Bluetooth foi desligado. A partida foi interrompida.');
    else notice.value = 'Bluetooth foi desligado. A sala não pode continuar anunciando.';
    return;
  }
  if (!game.value) return;
  const disconnectedId = bluetoothService.playerForAddress(address);
  if (!disconnectedId && !isHost.value) {
    interruptGame('desconexão', 'A conexão com o anfitrião foi perdida.');
    return;
  }
  if (disconnectedId && game.value.status === 'playing') {
    game.value.players = game.value.players.map((player) => player.id === disconnectedId
      ? { ...player, connected: false }
      : player);
    if (isHost.value) {
      try {
        await bluetoothService.send(createBluetoothMessage('JOGADOR_DESCONECTADO', game.value.id, localPlayerId.value, {
          playerId: disconnectedId,
          message: 'A partida foi interrompida porque um jogador perdeu a conexão.',
        }));
      } catch {
        notice.value = 'A conexão caiu; os outros aparelhos serão atualizados ao detectar a interrupção.';
      }
    }
    interruptGame('desconexão', `${game.value.players.find((player) => player.id === disconnectedId)?.name ?? 'Um jogador'} se desconectou.`);
  } else if (disconnectedId) {
    game.value.players = game.value.players.map((player) => player.id === disconnectedId ? { ...player, connected: false } : player);
  }
  connectionLabel.value = 'Conexão perdida';
}

function interruptGame(reason: GameResult['reason'], message: string): void {
  if (!game.value || game.value.status === 'finished' || game.value.status === 'interrupted') return;
  const now = Date.now();
  game.value = {
    ...game.value,
    status: 'interrupted',
    currentPlayerId: null,
    endedAt: now,
    result: { winnerId: null, penalizedPlayerId: null, reason, endedAt: now },
  };
  notice.value = message;
  rememberHistory();
  screen.value = 'result';
}

function continueToIdentity(): void {
  screen.value = 'identity';
  playerNameInput.value = playerName.value;
  error.value = '';
}

function continueToModes(): void {
  const name = playerNameInput.value.trim();
  if (!name) {
    identityError.value = 'Digite seu nome para continuar.';
    return;
  }
  playerName.value = name.slice(0, 20);
  localStorage.setItem('burro-player-name', playerName.value);
  localPlayerId.value = makeId();
  identityError.value = '';
  screen.value = 'choose';
}

async function createRoom(): Promise<void> {
  busy.value = true;
  error.value = '';
  const player: Player = { id: localPlayerId.value, name: playerName.value, isHost: true, connected: true, order: 0, penalty: 0 };
  const now = Date.now();
  game.value = {
    id: makeId(), code: makeCode(), status: 'lobby', hostId: player.id, players: [player],
    hands: {}, pendingPasses: {}, currentPlayerId: null, round: 0, startedAt: null, endedAt: null, result: null,
  };
  try {
    await bluetoothService.startHost({
      gameId: game.value.id,
      code: game.value.code,
      name: playerName.value,
      hostId: player.id,
      players: game.value.players,
    }, receiveMessage, handleConnection);
    connectionLabel.value = 'Anunciando sala via Bluetooth';
    screen.value = 'lobby';
    notice.value = 'Sala criada. Aguardando jogadores próximos.';
  } catch (reason) {
    game.value = null;
    setError(reason);
  } finally {
    busy.value = false;
  }
}

async function findRooms(): Promise<void> {
  rooms.value = [];
  error.value = '';
  notice.value = '';
  scanning.value = true;
  screen.value = 'search';
  try {
    await bluetoothService.scan((room) => {
      if (!rooms.value.some((found) => found.address === room.address)) rooms.value.push(room);
    });
    window.clearTimeout(scanTimeout);
    scanTimeout = window.setTimeout(() => {
      void bluetoothService.stopScan();
      scanning.value = false;
      if (!rooms.value.length) notice.value = 'Nenhuma sala BURRO encontrada por perto.';
    }, 12000);
  } catch (reason) {
    scanning.value = false;
    setError(reason);
  }
}

async function joinRoom(room: NearbyRoom): Promise<void> {
  busy.value = true;
  error.value = '';
  try {
    const discovered = await bluetoothService.connectToRoom(room, receiveMessage, handleConnection);
    game.value = {
      id: discovered.gameId,
      code: discovered.code,
      status: 'lobby',
      hostId: discovered.hostId,
      players: discovered.players,
      hands: {}, pendingPasses: {}, currentPlayerId: null, round: 0,
      startedAt: null, endedAt: null, result: null,
    };
    const request = createBluetoothMessage('SOLICITACAO_ENTRADA', discovered.gameId, localPlayerId.value, {
      playerId: localPlayerId.value,
      name: playerName.value,
    });
    await bluetoothService.send(request);
    connectionLabel.value = 'Conectado, aguardando aprovação';
    notice.value = 'Solicitação enviada. O anfitrião precisa aprovar sua entrada.';
    screen.value = 'lobby';
  } catch (reason) {
    await bluetoothService.stop();
    setError(reason);
  } finally {
    scanning.value = false;
    busy.value = false;
  }
}

async function decideRequest(request: JoinRequest, accepted: boolean): Promise<void> {
  if (!game.value) return;
  const current = game.value;
  joinRequests.value = joinRequests.value.filter((entry) => entry.id !== request.id);
  if (accepted && current.players.length < 6) {
    current.players.push({ id: request.id, name: request.name, isHost: false, connected: true, order: current.players.length, penalty: 0 });
    bluetoothService.registerPeer(request.id, request.address);
  }
  try {
    await bluetoothService.send(createBluetoothMessage('JOGADOR_ENTROU', current.id, localPlayerId.value, {
      accepted,
      hostName: playerName.value,
      players: current.players,
    }), request.id);
    if (accepted) notice.value = `${request.name} entrou na sala.`;
  } catch (reason) {
    setError(reason);
  }
}

async function beginGame(): Promise<void> {
  if (!game.value) return;
  error.value = '';
  try {
    game.value = startGame(game.value);
    screen.value = 'game';
    await sendSnapshot('PARTIDA_INICIADA');
  } catch (reason) {
    setError(reason);
  }
}

function chooseCard(cardId: string): void {
  if (!isMyTurn.value || movePending.value) return;
  selectedCardId.value = cardId;
}

async function confirmCard(): Promise<void> {
  if (!game.value || !selectedCardId.value || !isMyTurn.value || movePending.value) return;
  error.value = '';
  if (isHost.value) {
    try {
      const before = game.value.players.map((player) => player.penalty).join(',');
      game.value = submitCardSelection(game.value, localPlayerId.value, selectedCardId.value);
      const type = game.value.status === 'finished'
        ? 'PARTIDA_FINALIZADA'
        : game.value.pendingPasses && Object.keys(game.value.pendingPasses).length > 0
          ? 'ESTADO_PARTIDA'
          : before !== game.value.players.map((player) => player.penalty).join(',')
            ? 'JOGADOR_COMPLETOU' : 'TROCA_REALIZADA';
      selectedCardId.value = '';
      await sendSnapshot(type);
      if (game.value.status === 'finished') {
        rememberHistory();
        screen.value = 'result';
      }
    } catch (reason) {
      setError(reason);
    }
    return;
  }
  movePending.value = true;
  try {
    await bluetoothService.send(createBluetoothMessage('JOGADA', game.value.id, localPlayerId.value, {
      playerId: localPlayerId.value,
      cardId: selectedCardId.value,
      round: game.value.round,
    }));
    notice.value = 'Jogada enviada. Aguardando validação do anfitrião.';
  } catch (reason) {
    movePending.value = false;
    setError(reason);
  }
}

async function leaveRoom(): Promise<void> {
  if (!game.value) return;
  if (!window.confirm('Tem certeza que deseja sair da sala?')) return;
  if (game.value.status === 'playing') {
    try {
      if (!isHost.value) await bluetoothService.send(createBluetoothMessage('JOGADOR_DESCONECTADO', game.value.id, localPlayerId.value, { playerId: localPlayerId.value }));
    } catch { /* A conexão pode já ter sido encerrada. */ }
    interruptGame('abandono', `${playerName.value} saiu da partida.`);
  } else {
    const now = Date.now();
    game.value.status = 'interrupted';
    game.value.endedAt = now;
    game.value.result = { winnerId: null, penalizedPlayerId: null, reason: 'cancelamento', endedAt: now };
    rememberHistory();
    screen.value = 'home';
  }
  await bluetoothService.stop();
}

function openHistory(): void {
  if (scanning.value) {
    void bluetoothService.stopScan();
    scanning.value = false;
  }
  history.value = getHistory();
  screen.value = 'history';
}

function openDetails(entry: GameHistory): void {
  selectedHistory.value = entry;
  screen.value = 'details';
}

function removeHistoryEntry(entry: GameHistory): void {
  if (!window.confirm(`Apagar a partida de ${new Date(entry.startedAt ?? entry.endedAt ?? Date.now()).toLocaleDateString('pt-BR')} do histórico?`)) return;
  deleteHistoryEntry(entry.id);
  history.value = getHistory();
  if (selectedHistory.value?.id === entry.id) screen.value = 'history';
}

function clearHistory(): void {
  if (!window.confirm('Tem certeza que deseja apagar todo o histórico?')) return;
  clearStoredHistory();
  history.value = [];
}

async function returnHome(): Promise<void> {
  await bluetoothService.stop();
  game.value = null;
  joinRequests.value = [];
  selectedCardId.value = '';
  screen.value = 'home';
  error.value = '';
  notice.value = '';
}

return {
  screen, playerName, playerNameInput, game, localPlayerId, localPlayer, localHand, activePlayer,
  isHost, isMyTurn, nextPlayer, previousPlayer, selectedCardId, movePending, rooms, joinRequests,
  history, selectedHistory, busy, scanning, connectionLabel, notice, error, identityError,
  continueToIdentity, continueToModes, createRoom, findRooms, joinRoom, decideRequest, beginGame,
  chooseCard, confirmCard, leaveRoom, openHistory, openDetails, removeHistoryEntry, clearHistory, returnHome,
};
}