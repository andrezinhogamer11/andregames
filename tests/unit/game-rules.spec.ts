import { describe, expect, test } from 'vitest';
import { createDeck, startGame, submitCardSelection } from '@/services/game/rules';
import type { Game } from '@/types/game';

const lobby: Game = {
  id: 'game-1', code: 'ABCD', status: 'lobby', hostId: 'p1',
  players: [
    { id: 'p1', name: 'Ana', isHost: true, connected: true, order: 0, penalty: 0 },
    { id: 'p2', name: 'Bia', isHost: false, connected: true, order: 1, penalty: 0 },
  ],
  hands: {}, pendingPasses: {}, currentPlayerId: null, round: 0, startedAt: null, endedAt: null, result: null,
};

describe('game rules', () => {
  test('creates a unique deck with four copies of each value', () => {
    const deck = createDeck(2, () => 0.5);
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => card.id)).size).toBe(52);
    expect(deck.filter((card) => card.value === 'A')).toHaveLength(4);
  });

  test('does not start a room with only one player', () => {
    const soloRoom = { ...lobby, players: [lobby.players[0]] };
    expect(() => startGame(soloRoom)).toThrow('pelo menos 2 jogadores');
  });

  test('deals four cards per player and rejects out-of-turn moves', () => {
    const game = startGame(lobby, () => 0.5, 100);
    expect(Object.values(game.hands).map((hand) => hand.length)).toEqual([4, 4]);
    expect(game.currentPlayerId).toBe('p1');
    expect(() => submitCardSelection(game, 'p2', game.hands.p2[0].id)).toThrow('Não é o turno');
  });

  test('keeps hands private-size and passes every selected card around the ring', () => {
    const game = startGame(lobby, () => 0.5, 100);
    const afterFirstSelection = submitCardSelection(game, 'p1', game.hands.p1[0].id);
    expect(afterFirstSelection.hands.p1).toHaveLength(4);
    expect(afterFirstSelection.currentPlayerId).toBe('p2');
    const exchanged = submitCardSelection(afterFirstSelection, 'p2', game.hands.p2[0].id, 200);
    expect(exchanged.hands.p1).toHaveLength(4);
    expect(exchanged.hands.p2).toHaveLength(4);
    expect(exchanged.round).toBe(2);
    expect(exchanged.pendingPasses).toEqual({});
  });

  test('gives BURRO to the next player after a quad and ends at five letters', () => {
    const playing: Game = {
      ...lobby,
      status: 'playing',
      round: 4,
      currentPlayerId: 'p2',
      hands: {
        p1: [
          { id: 'A-0', value: 'A' }, { id: 'A-1', value: 'A' },
          { id: 'A-2', value: 'A' }, { id: 'K-0', value: 'K' },
        ],
        p2: [
          { id: 'A-3', value: 'A' }, { id: 'K-1', value: 'K' },
          { id: 'Q-0', value: 'Q' }, { id: 'J-0', value: 'J' },
        ],
      },
      pendingPasses: { p1: 'K-0' },
      players: lobby.players.map((player) => player.id === 'p2' ? { ...player, penalty: 4 } : player),
    };
    const finished = submitCardSelection(playing, 'p2', 'A-3', 500);
    expect(finished.status).toBe('finished');
    expect(finished.players.find((player) => player.id === 'p2')?.penalty).toBe(5);
    expect(finished.result).toMatchObject({ winnerId: 'p1', penalizedPlayerId: 'p2', reason: 'BURRO completo', endedAt: 500 });
  });
});