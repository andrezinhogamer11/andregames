import type { Card, Game, Player } from '@/types/game';

const CARD_VALUES = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const MAX_PLAYERS = 6;

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export function createDeck(playerCount: number, random: () => number = Math.random): Card[] {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > MAX_PLAYERS) {
    throw new GameRuleError('A partida precisa ter de 2 a 6 jogadores.');
  }

  const deck = CARD_VALUES.flatMap((value) =>
    Array.from({ length: 4 }, (_, copy) => ({ id: `${value}-${copy}`, value })),
  );
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

export function startGame(game: Game, random: () => number = Math.random, now = Date.now()): Game {
  if (game.status !== 'lobby') throw new GameRuleError('A sala não está aguardando jogadores.');
  if (game.players.length < 2) throw new GameRuleError('São necessários pelo menos 2 jogadores.');
  if (game.players.length > MAX_PLAYERS) throw new GameRuleError('O limite é de 6 jogadores.');

  const players = [...game.players].sort((left, right) => left.order - right.order);
  const deck = createDeck(players.length, random);
  const hands: Record<string, Card[]> = Object.fromEntries(players.map((player) => [player.id, []]));
  for (let cardIndex = 0; cardIndex < 4; cardIndex += 1) {
    for (const player of players) hands[player.id].push(deck.pop()!);
  }

  return {
    ...game,
    status: 'playing',
    players,
    hands,
    pendingPasses: {},
    currentPlayerId: players[0].id,
    round: 1,
    startedAt: now,
  };
}

function nextPlayer(players: Player[], playerId: string): Player {
  const ordered = [...players].sort((left, right) => left.order - right.order);
  const currentIndex = ordered.findIndex((player) => player.id === playerId);
  if (currentIndex < 0 || ordered.length < 2) throw new GameRuleError('Jogador inválido para esta partida.');
  return ordered[(currentIndex + 1) % ordered.length];
}

export function submitCardSelection(game: Game, playerId: string, cardId: string, now = Date.now()): Game {
  if (game.status !== 'playing') throw new GameRuleError('A partida não está em andamento.');
  if (game.currentPlayerId !== playerId) throw new GameRuleError('Não é o turno deste jogador.');

  const player = game.players.find((candidate) => candidate.id === playerId);
  const hand = game.hands[playerId];
  if (!player?.connected) throw new GameRuleError('Jogador desconectado não pode jogar.');
  if (!hand || hand.length !== 4 || !hand.some((card) => card.id === cardId)) {
    throw new GameRuleError('A carta não pertence à mão do jogador.');
  }

  const pendingPasses = { ...game.pendingPasses, [playerId]: cardId };
  const orderedPlayers = [...game.players].sort((left, right) => left.order - right.order);
  const currentIndex = orderedPlayers.findIndex((candidate) => candidate.id === playerId);
  const nextTurnPlayer = orderedPlayers[(currentIndex + 1) % orderedPlayers.length];

  if (Object.keys(pendingPasses).length < orderedPlayers.length) {
    return { ...game, pendingPasses, currentPlayerId: nextTurnPlayer.id };
  }

  const nextHands = Object.fromEntries(orderedPlayers.map((candidate) => [candidate.id, [...game.hands[candidate.id]]]));
  for (const candidate of orderedPlayers) {
    const outgoingId = pendingPasses[candidate.id];
    const outgoingIndex = nextHands[candidate.id].findIndex((card) => card.id === outgoingId);
    if (outgoingIndex < 0) throw new GameRuleError('A troca contém uma carta inválida.');
    nextHands[candidate.id].splice(outgoingIndex, 1);
  }
  for (const candidate of orderedPlayers) {
    const receiver = nextPlayer(orderedPlayers, candidate.id);
    const outgoing = game.hands[candidate.id].find((card) => card.id === pendingPasses[candidate.id])!;
    nextHands[receiver.id].push(outgoing);
  }

  const completedPlayer = orderedPlayers.find((candidate) => {
    const handAfterExchange = nextHands[candidate.id];
    return handAfterExchange.every((card) => card.value === handAfterExchange[0].value);
  });
  let players = game.players;
  let status: Game['status'] = game.status;
  let result = game.result;
  let endedAt = game.endedAt;
  let currentPlayerId: string | null = game.currentPlayerId;

  if (completedPlayer) {
    const penalizedPlayer = nextPlayer(orderedPlayers, completedPlayer.id);
    players = game.players.map((candidate) => candidate.id === penalizedPlayer.id
      ? { ...candidate, penalty: candidate.penalty + 1 }
      : candidate);
    if (penalizedPlayer.penalty + 1 >= 5) {
      status = 'finished';
      endedAt = now;
      currentPlayerId = null;
      result = {
        winnerId: completedPlayer.id,
        penalizedPlayerId: penalizedPlayer.id,
        reason: 'BURRO completo',
        endedAt: now,
      };
    }
  }

  return {
    ...game,
    players,
    hands: nextHands,
    pendingPasses: {},
    currentPlayerId,
    round: game.round + 1,
    status,
    endedAt,
    result,
  };
}