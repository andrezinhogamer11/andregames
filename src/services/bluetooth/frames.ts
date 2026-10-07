const HEADER_SIZE = 4;
const MAX_FRAME_SIZE = 20;
const CHUNK_SIZE = MAX_FRAME_SIZE - HEADER_SIZE;

export function encodeFrames(message: unknown, transferId: number): Uint8Array[] {
  const bytes = new TextEncoder().encode(JSON.stringify(message));
  const total = Math.ceil(bytes.length / CHUNK_SIZE);
  if (total > 255) throw new Error('A mensagem Bluetooth excede o limite de tamanho.');
  return Array.from({ length: total }, (_, sequence) => {
    const frame = new Uint8Array(HEADER_SIZE + Math.min(CHUNK_SIZE, bytes.length - sequence * CHUNK_SIZE));
    frame[0] = (transferId >> 8) & 0xff;
    frame[1] = transferId & 0xff;
    frame[2] = sequence;
    frame[3] = total;
    frame.set(bytes.subarray(sequence * CHUNK_SIZE, (sequence + 1) * CHUNK_SIZE), HEADER_SIZE);
    return frame;
  });
}

export class FrameAssembler {
  private readonly transfers = new Map<string, { total: number; parts: Map<number, Uint8Array> }>();

  push(peer: string, frame: Uint8Array): unknown | null {
    if (frame.length <= HEADER_SIZE || frame.length > MAX_FRAME_SIZE) return null;
    const transferId = (frame[0] << 8) | frame[1];
    const sequence = frame[2];
    const total = frame[3];
    if (total === 0 || sequence >= total) return null;

    const key = `${peer}:${transferId}`;
    let transfer = this.transfers.get(key);
    if (!transfer) {
      transfer = { total, parts: new Map() };
      this.transfers.set(key, transfer);
    }
    if (transfer.total !== total) {
      this.transfers.delete(key);
      return null;
    }
    transfer.parts.set(sequence, frame.slice(HEADER_SIZE));
    if (transfer.parts.size !== total) return null;

    const length = [...transfer.parts.values()].reduce((sum, part) => sum + part.length, 0);
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (let index = 0; index < total; index += 1) {
      const part = transfer.parts.get(index);
      if (!part) return null;
      bytes.set(part, offset);
      offset += part.length;
    }
    this.transfers.delete(key);
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      return null;
    }
  }

  clearPeer(peer: string): void {
    for (const key of this.transfers.keys()) {
      if (key.startsWith(`${peer}:`)) this.transfers.delete(key);
    }
  }
}