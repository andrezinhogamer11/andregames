import { beforeEach, describe, expect, test } from 'vitest';
import { clearHistory, deleteHistoryEntry, getHistory, saveHistory } from '@/services/storage/history';
import type { GameHistory } from '@/types/game';

const entry = (id: string): GameHistory => ({
  id, code: 'ABCD', status: 'finished', hostId: 'p1',
  players: [{ id: 'p1', name: 'Ana', isHost: true, connected: true, order: 0, penalty: 0 }],
  hands: {}, pendingPasses: {}, currentPlayerId: null, round: 7, startedAt: 10, endedAt: 20,
  result: { winnerId: 'p1', penalizedPlayerId: null, reason: 'BURRO completo', endedAt: 20 }, localPlayerId: 'p1',
});

describe('local game history', () => {
  beforeEach(() => localStorage.clear());

  test('persists across reads and replaces an existing game id', () => {
    saveHistory(entry('one'));
    saveHistory({ ...entry('one'), round: 8 });
    expect(getHistory()).toHaveLength(1);
    expect(getHistory()[0].round).toBe(8);
  });

  test('deletes one game and clears the full history', () => {
    saveHistory(entry('one'));
    saveHistory(entry('two'));
    deleteHistoryEntry('one');
    expect(getHistory().map((game) => game.id)).toEqual(['two']);
    clearHistory();
    expect(getHistory()).toEqual([]);
  });
});