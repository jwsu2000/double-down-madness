// ─── Socket.IO Client Singleton ───────────────────────────────────────────────

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/protocol';

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();
const socketBaseUrl = rawSocketUrl ? rawSocketUrl : undefined;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketBaseUrl, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
