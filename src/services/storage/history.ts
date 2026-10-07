import type { GameHistory } from '@/types/game';

const HISTORY_KEY = 'burro-game-history-v1';

export function getHistory(): GameHistory[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as GameHistory[] : [];
  } catch {
    return [];
  }
}

export function saveHistory(game: GameHistory): void {
  const history = getHistory().filter((entry) => entry.id !== game.id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([game, ...history]));
}

export function deleteHistoryEntry(gameId: string): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(getHistory().filter((entry) => entry.id !== gameId)));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}