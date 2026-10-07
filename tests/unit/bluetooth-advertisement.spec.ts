import { describe, expect, test } from 'vitest';
import { parseAdvertisement } from '@/services/bluetooth/advertisement';

describe('Android BLE advertisement parser', () => {
  test('reads a 128-bit service UUID encoded in BLE little-endian order', () => {
    const bytes = new Uint8Array([
      17, 0x07,
      0x01, 0x00, 0x50, 0xa1, 0xb5, 0x2d, 0x21, 0x8d,
      0x3a, 0x4f, 0x6c, 0x5f, 0x00, 0x0a, 0xe5, 0xd1,
    ]);
    expect(parseAdvertisement(bytes).serviceUuids).toEqual([
      'd1e50a00-5f6c-4f3a-8d21-2db5a1500001',
    ]);
  });

  test('reads the local name and ignores truncated structures', () => {
    expect(parseAdvertisement(new Uint8Array([6, 0x09, 66, 85, 82, 82, 79])).localName).toBe('BURRO');
    expect(parseAdvertisement(new Uint8Array([10, 0x07, 1, 2])).serviceUuids).toEqual([]);
  });
});