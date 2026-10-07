import { describe, expect, test } from 'vitest';
import { encodeFrames, FrameAssembler } from '@/services/bluetooth/frames';

describe('Bluetooth transport frames', () => {
  test('reassembles a multi-frame message even when frames arrive out of order', () => {
    const message = { body: 'A message long enough to cross several 20-byte BLE packets.', round: 4 };
    const frames = encodeFrames(message, 17);
    const assembler = new FrameAssembler();
    let received: unknown = null;
    for (const frame of [...frames].reverse()) received = assembler.push('peer-a', frame) ?? received;
    expect(frames.every((frame) => frame.length <= 20)).toBe(true);
    expect(received).toEqual(message);
  });

  test('keeps concurrent peers isolated', () => {
    const frame = encodeFrames({ sender: 'a' }, 9)[0];
    const assembler = new FrameAssembler();
    expect(assembler.push('peer-a', frame)).toEqual({ sender: 'a' });
    expect(assembler.push('peer-b', frame)).toEqual({ sender: 'a' });
  });
});