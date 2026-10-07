export type GameStatus = 'lobby' | 'playing' | 'finished' | 'interrupted';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  order: number;
  penalty: number;
}

export interface Card {
  id: string;
  value: string;
}

export interface PlayerPenalty {
  playerId: string;
  letters: number;
}

export interface GameResult {
  winnerId: string | null;
  penalizedPlayerId: string | null;
  reason: 'BURRO completo' | 'abandono' | 'desconexão' | 'cancelamento';
  endedAt: number;
}

export interface Game {
  id: string;
  code: string;
  status: GameStatus;
  hostId: string;
  players: Player[];
  hands: Record<string, Card[]>;
  pendingPasses: Record<string, string>;
  currentPlayerId: string | null;
  round: number;
  startedAt: number | null;
  endedAt: number | null;
  result: GameResult | null;
}

export interface GameHistory extends Game {
  localPlayerId: string;
}

export type MessageType =
  | 'SOLICITACAO_ENTRADA'
  | 'JOGADOR_ENTROU'
  | 'PARTIDA_INICIADA'
  | 'JOGADA'
  | 'JOGADA_REJEITADA'
  | 'ESTADO_PARTIDA'
  | 'TROCA_REALIZADA'
  | 'JOGADOR_COMPLETOU'
  | 'PARTIDA_FINALIZADA'
  | 'JOGADOR_DESCONECTADO'
  | 'RECONEXAO';

export interface BluetoothMessage {
  type: MessageType;
  gameId: string;
  senderId: string;
  timestamp: number;
  payload: unknown;
}