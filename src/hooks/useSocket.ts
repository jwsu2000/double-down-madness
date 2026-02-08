// ─── Socket.IO Client Singleton ───────────────────────────────────────────────

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/protocol';

function normalizeSocketUrl(rawValue: string | undefined): string | undefined {
  const trimmed = rawValue?.trim();
  if (!trimmed) return undefined;

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }
  if (/^wss?:\/\//i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash.replace(/^ws/i, 'http');
  }

  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  if (withoutTrailingSlash.startsWith('//')) {
    return `${protocol}${withoutTrailingSlash}`;
  }

  return `${protocol}//${withoutTrailingSlash.replace(/^\/+/, '')}`;
}

const socketBaseUrl = normalizeSocketUrl(import.meta.env.VITE_SOCKET_URL);

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketBaseUrl, {
  autoConnect: false,
  // Keep realtime gameplay snappy by skipping long-polling fallback.
  transports: ['websocket'],
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
});
