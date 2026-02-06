// ─── Socket.IO Client Singleton ───────────────────────────────────────────────

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/protocol';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
