export async function sha256HexFromBytes(bytes: Uint8Array): Promise<string> {
  const bufferCopy = new Uint8Array(bytes.byteLength);
  bufferCopy.set(bytes);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', bufferCopy.buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256HexFromText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  return sha256HexFromBytes(encoder.encode(text));
}

export function shortHash(sha256: string): string {
  return sha256.slice(0, 12);
}
