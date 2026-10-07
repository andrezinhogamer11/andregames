export interface ParsedAdvertisement {
  serviceUuids: string[];
  localName?: string;
}

function formatUuid(bytes: Uint8Array): string {
  const uuid = [...bytes].reverse().map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

export function parseAdvertisement(bytes: Uint8Array): ParsedAdvertisement {
  const parsed: ParsedAdvertisement = { serviceUuids: [] };
  let offset = 0;

  while (offset < bytes.length) {
    const length = bytes[offset];
    if (length === 0) break;
    const end = offset + 1 + length;
    if (end > bytes.length) break;

    const type = bytes[offset + 1];
    const data = bytes.subarray(offset + 2, end);
    if ((type === 0x06 || type === 0x07) && data.length % 16 === 0) {
      for (let index = 0; index < data.length; index += 16) {
        parsed.serviceUuids.push(formatUuid(data.subarray(index, index + 16)));
      }
    } else if ((type === 0x08 || type === 0x09) && data.length > 0) {
      parsed.localName = new TextDecoder().decode(data);
    }
    offset = end;
  }

  return parsed;
}