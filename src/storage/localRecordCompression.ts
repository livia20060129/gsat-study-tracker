import { deflate, Inflate } from 'pako';

const FORMAT = 'gsat-local-record:deflate-v1';
const MAX_BYTES = 32 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export function isCompressedLocalRecord(value: string | null): boolean {
  return value?.startsWith(`["${FORMAT}",`) ?? false;
}

/** JSON arrays were rejected by older record readers, so an old tab cannot overwrite a compressed day. */
export function compressLocalRecord(json: string): string {
  if (json.length < 1024) return json;
  const bytes = encoder.encode(json);
  if (bytes.length > MAX_BYTES) return json;
  const compressed = deflate(bytes);
  let binary = '';
  for (let offset = 0; offset < compressed.length; offset += 8192) {
    binary += String.fromCharCode(...compressed.subarray(offset, offset + 8192));
  }
  const envelope = JSON.stringify([FORMAT, bytes.length, btoa(binary)]);
  if (envelope.length + 128 >= json.length) return json;
  if (JSON.stringify(decompressLocalRecord(JSON.parse(envelope))) !== json) {
    throw new Error('Local record compression verification failed');
  }
  return envelope;
}

/** Decode one bounded, checksummed envelope; malformed/truncated data never becomes an empty record. */
export function decompressLocalRecord(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  if (value.length !== 3 || value[0] !== FORMAT) throw new Error('Unsupported local record');
  const [, size, encoded] = value;
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES || typeof encoded !== 'string'
    || encoded.length > MAX_BYTES * 2) throw new Error('Invalid local record size');
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const chunks: Uint8Array[] = [];
  let length = 0;
  const inflator = new Inflate({ chunkSize: 16384 });
  inflator.onData = chunk => {
    length += chunk.length;
    if (length > size) throw new Error('Invalid local record length');
    chunks.push(chunk);
  };
  if (!inflator.push(bytes, true) || inflator.err || !inflator.ended || length !== size) {
    throw new Error('Incomplete local record');
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  const record: unknown = JSON.parse(decoder.decode(output));
  if (Array.isArray(record)) throw new Error('Nested local record envelope');
  return record;
}
