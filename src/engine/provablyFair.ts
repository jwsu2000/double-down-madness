// ─── Provably Fair System ─────────────────────────────────────────────────────
// Uses Web Crypto API for SHA-256 and HMAC-SHA256. Fully client-side.

import { TOTAL_CARDS } from './deck';

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Seed Generation ──────────────────────────────────────────────────────────

export function generateSeed(): string {
  const bytes = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(bytes);
  return bufToHex(bytes.buffer);
}

export async function hashSeed(seed: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(seed);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bufToHex(hash);
}

// ─── HMAC-SHA256 Byte Stream ──────────────────────────────────────────────────

async function hmacSHA256(key: string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

/**
 * Generate a deterministic byte stream from seeds.
 * Uses HMAC-SHA256(serverSeed, clientSeed + ":" + nonce + ":" + round)
 * where round increments to produce more bytes as needed.
 */
async function generateByteStream(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  numBytes: number
): Promise<Uint8Array> {
  const result = new Uint8Array(numBytes);
  let offset = 0;
  let round = 0;

  while (offset < numBytes) {
    const message = `${clientSeed}:${nonce}:${round}`;
    const hmac = await hmacSHA256(serverSeed, message);
    const bytes = new Uint8Array(hmac);

    for (let i = 0; i < bytes.length && offset < numBytes; i++, offset++) {
      result[offset] = bytes[i];
    }
    round++;
  }

  return result;
}

// ─── Card Index Derivation (Unbiased Rejection Sampling) ──────────────────────

/**
 * Derive a shuffled sequence of card indices [0..TOTAL_CARDS-1] using
 * the provably fair byte stream. Uses modular rejection sampling for
 * unbiased results.
 */
export async function deriveShoeOrder(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Promise<number[]> {
  // We need enough bytes to generate TOTAL_CARDS indices with rejection sampling.
  // Worst case we may need many more bytes, so generate plenty.
  let byteStream = await generateByteStream(serverSeed, clientSeed, nonce, TOTAL_CARDS * 8);

  const indices: number[] = [];
  const available = Array.from({ length: TOTAL_CARDS }, (_, i) => i);
  let byteOffset = 0;

  // Fisher-Yates style: for each position, pick from remaining using rejection sampling
  for (let i = TOTAL_CARDS; i > 0; i--) {
    // Find the largest multiple of i that fits in a uint32
    const max = Math.floor(0x100000000 / i) * i;

    let rand: number;
    do {
      // Read 4 bytes as uint32
      if (byteOffset + 4 > byteStream.length) {
        // Regenerate a longer deterministic stream when additional bytes are needed.
        byteStream = await generateByteStream(
          serverSeed,
          clientSeed,
          nonce,
          byteStream.length + TOTAL_CARDS * 4,
        );
      }
      rand = ((byteStream[byteOffset] << 24) |
              (byteStream[byteOffset + 1] << 16) |
              (byteStream[byteOffset + 2] << 8) |
              byteStream[byteOffset + 3]) >>> 0;
      byteOffset += 4;
    } while (rand >= max);

    const index = rand % i;
    indices.push(available[index]);
    // Remove the chosen index
    available[index] = available[i - 1];
  }

  return indices;
}

// ─── Verification ─────────────────────────────────────────────────────────────

export interface ProvablyFairState {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  previousServerSeed?: string;
  previousServerSeedHash?: string;
}

export async function initProvablyFair(clientSeed?: string): Promise<ProvablyFairState> {
  const serverSeed = generateSeed();
  const serverSeedHash = await hashSeed(serverSeed);
  return {
    serverSeed,
    serverSeedHash,
    clientSeed: clientSeed || generateSeed().substring(0, 16),
    nonce: 0,
  };
}

export async function rotateServerSeed(
  state: ProvablyFairState
): Promise<ProvablyFairState> {
  const newServerSeed = generateSeed();
  const newHash = await hashSeed(newServerSeed);
  return {
    serverSeed: newServerSeed,
    serverSeedHash: newHash,
    clientSeed: state.clientSeed,
    nonce: state.nonce + 1,
    previousServerSeed: state.serverSeed,
    previousServerSeedHash: state.serverSeedHash,
  };
}

export async function verify(
  serverSeed: string,
  expectedHash: string,
  clientSeed: string,
  nonce: number,
  expectedCards: number[]
): Promise<{ hashMatch: boolean; cardsMatch: boolean }> {
  const actualHash = await hashSeed(serverSeed);
  const hashMatch = actualHash === expectedHash;

  const derivedOrder = await deriveShoeOrder(serverSeed, clientSeed, nonce);
  const cardsMatch = expectedCards.every((c, i) => derivedOrder[i] === c);

  return { hashMatch, cardsMatch };
}
