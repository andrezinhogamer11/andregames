import { describe, expect, test } from 'vitest';
import { validateBluetoothMessage } from '@/services/bluetooth/messageValidation';
import type { Game } from '@/types/game';

const game = {
  id: 'g-1', hostId: 'p1', players: [
    { id: 'p1', name: 'Ana', isHost: true, connected: true, order: 0, penalty: 0 },
    { id: 'p2', name: 'Bia', isHost: false, connected: true, order: 1, penalty: 0 },
  ],
} as Pick<Game, 'id' | 'hostId' | 'players'>;

const message = (overrides: Record<string, unknown> = {}) => ({
  type: 'JOGADA', gameId: 'g-1', senderId: 'p1', timestamp: 100,
  payload: { playerId: 'p1', cardId: 'A-1', round: 1 }, ...overrides,
});

describe('Bluetooth message validation', () => {
  test('accepts a well-formed move from a known player', () => {
    expect(validateBluetoothMessage(message(), game)).toBe(true);
  });

  test('rejects wrong game, unknown sender, and host-only actions from guests', () => {
    expect(validateBluetoothMessage(message({ gameId: 'other' }), game)).toBe(false);
    expect(validateBluetoothMessage(message({ senderId: 'ghost' }), game)).toBe(false);
    expect(validateBluetoothMessage(message({ type: 'PARTIDA_INICIADA', senderId: 'p2' }), game)).toBe(false);
  });

  test('rejects malformed payloads and forged player identity', () => {
    expect(validateBluetoothMessage(message({ payload: null }), game)).toBe(false);
    expect(validateBluetoothMessage(message({ payload: { playerId: 'p2', cardId: 'A-1', round: 1 } }), game)).toBe(false);
  });

  test('allows valid host snapshots while rejecting malformed private hands', () => {
    const snapshot = {
      type: 'ESTADO_PARTIDA', gameId: 'g-1', senderId: 'p1', timestamp: 100,
      payload: {
        status: 'playing', players: game.players, currentPlayerId: 'p2', round: 1,
        hand: [{ id: 'A-1', value: 'A' }, { id: 'K-1', value: 'K' }, { id: 'Q-1', value: 'Q' }, { id: 'J-1', value: 'J' }],
      },
    };
    expect(validateBluetoothMessage(snapshot, game)).toBe(true);
    expect(validateBluetoothMessage({ ...snapshot, payload: { ...snapshot.payload, hand: [{ id: 'fake', value: 'A' }] } }, game)).toBe(false);
  });
});