import type { BluetoothMessage, Game, MessageType } from '@/types/game';

const MESSAGE_TYPES: MessageType[] = [
  'SOLICITACAO_ENTRADA', 'JOGADOR_ENTROU', 'PARTIDA_INICIADA', 'JOGADA',
  'TROCA_REALIZADA', 'JOGADOR_COMPLETOU', 'PARTIDA_FINALIZADA',
  'JOGADOR_DESCONECTADO', 'RECONEXAO', 'JOGADA_REJEITADA', 'ESTADO_PARTIDA',
];
const HOST_ONLY = new Set<MessageType>([
  'JOGADOR_ENTROU', 'PARTIDA_INICIADA', 'TROCA_REALIZADA', 'JOGADOR_COMPLETOU', 'PARTIDA_FINALIZADA',
  'JOGADA_REJEITADA', 'ESTADO_PARTIDA',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlayerList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) return false;
  const ids = new Set<string>();
  const positions = new Set<number>();
  return value.every((player) => {
    if (!isRecord(player) || typeof player.id !== 'string' || !player.id
      || typeof player.name !== 'string' || !player.name.trim()
      || typeof player.isHost !== 'boolean' || typeof player.connected !== 'boolean'
      || !Number.isInteger(player.order) || (player.order as number) < 0 || (player.order as number) > 5
      || !Number.isInteger(player.penalty) || (player.penalty as number) < 0 || (player.penalty as number) > 5
      || ids.has(player.id) || positions.has(player.order as number)) return false;
    ids.add(player.id);
    positions.add(player.order as number);
    return true;
  });
}

export function validateBluetoothMessage(
  value: unknown,
  game: Pick<Game, 'id' | 'hostId' | 'players'>,
): value is BluetoothMessage {
  if (!isRecord(value)) return false;
  if (!MESSAGE_TYPES.includes(value.type as MessageType)) return false;
  if (value.gameId !== game.id || typeof value.senderId !== 'string' || !value.senderId) return false;
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return false;
  if (!isRecord(value.payload)) return false;

  const type = value.type as MessageType;
  const isJoinRequest = type === 'SOLICITACAO_ENTRADA';
  const senderExists = game.players.some((player) => player.id === value.senderId);
  if (!senderExists && !isJoinRequest) return false;
  if (HOST_ONLY.has(type) && value.senderId !== game.hostId) return false;
  if (isJoinRequest && (typeof value.payload.playerId !== 'string' || value.payload.playerId !== value.senderId
    || typeof value.payload.name !== 'string' || !value.payload.name.trim())) return false;
  if (type === 'JOGADA') {
    if (value.payload.playerId !== value.senderId || typeof value.payload.cardId !== 'string'
      || !Number.isInteger(value.payload.round)) return false;
  }
  if (type === 'RECONEXAO' && value.payload.playerId !== value.senderId) return false;
  if (type === 'JOGADOR_DESCONECTADO' && value.senderId !== game.hostId
    && value.payload.playerId !== value.senderId) return false;
  if (type === 'JOGADA_REJEITADA' && typeof value.payload.message !== 'string') return false;
  if (type === 'JOGADOR_ENTROU') {
    if (typeof value.payload.accepted !== 'boolean') return false;
    if (value.payload.accepted && !isPlayerList(value.payload.players)) return false;
  }
  if (['PARTIDA_INICIADA', 'ESTADO_PARTIDA', 'TROCA_REALIZADA', 'JOGADOR_COMPLETOU', 'PARTIDA_FINALIZADA'].includes(type)) {
    if (!isPlayerList(value.payload.players) || !Array.isArray(value.payload.hand)
      || !Number.isInteger(value.payload.round) || (value.payload.round as number) < 1
      || !['playing', 'finished', 'interrupted'].includes(String(value.payload.status))) return false;
    if (value.payload.hand.some((card) => !isRecord(card) || typeof card.id !== 'string' || typeof card.value !== 'string')) return false;
    if (value.payload.status === 'playing' && value.payload.hand.length !== 4) return false;
    if (value.payload.currentPlayerId !== null && typeof value.payload.currentPlayerId !== 'string') return false;
  }
  return true;
}

export function createBluetoothMessage(
  type: MessageType,
  gameId: string,
  senderId: string,
  payload: unknown,
  timestamp = Date.now(),
): BluetoothMessage {
  return { type, gameId, senderId, timestamp, payload };
}