// ─── Room Manager ─────────────────────────────────────────────────────────────
// Manages rooms: create, join, leave, disconnect, reconnect.

import { TableController } from './tableController';
import type { ClientTableState } from '../src/shared/protocol';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePlayerId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Room Interface ───────────────────────────────────────────────────────────

export interface Room {
  code: string;
  table: TableController;
  socketToPlayer: Map<string, string>;
  playerToSocket: Map<string, string>;
}

// ─── Room Manager Class ───────────────────────────────────────────────────────

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>();

  createRoom(socketId: string, playerName: string, buyIn?: number): { roomCode: string; playerId: string } {
    // Generate unique room code
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const playerId = generatePlayerId();
    const table = new TableController(code);
    table.addPlayer(playerId, playerName, socketId, buyIn);

    const room: Room = {
      code,
      table,
      socketToPlayer: new Map([[socketId, playerId]]),
      playerToSocket: new Map([[playerId, socketId]]),
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);

    return { roomCode: code, playerId };
  }

  joinRoom(socketId: string, roomCode: string, playerName: string, buyIn?: number): { playerId?: string; error?: string } {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };

    const connectedCount = [...room.table.players.values()].filter(p => p.connected).length;
    if (connectedCount >= 5) return { error: 'Room is full (max 5 players)' };

    // Check if game is mid-round (only allow join in LOBBY or BETTING)
    if (room.table.phase !== 'LOBBY' && room.table.phase !== 'BETTING') {
      return { error: 'Game in progress — wait for next round' };
    }

    const playerId = generatePlayerId();
    room.table.addPlayer(playerId, playerName, socketId, buyIn);
    room.socketToPlayer.set(socketId, playerId);
    room.playerToSocket.set(playerId, socketId);
    this.socketToRoom.set(socketId, code);

    return { playerId };
  }

  leaveRoom(socketId: string): string | null {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const playerId = room.socketToPlayer.get(socketId);
    if (playerId) {
      room.table.removePlayer(playerId);
      room.socketToPlayer.delete(socketId);
      room.playerToSocket.delete(playerId);
    }

    this.socketToRoom.delete(socketId);

    // Cleanup empty rooms
    if (room.table.players.size === 0) {
      this.rooms.delete(roomCode);
      return null;
    }

    return roomCode;
  }

  handleDisconnect(socketId: string): string | null {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const playerId = room.socketToPlayer.get(socketId);
    if (playerId) {
      room.table.setPlayerConnected(playerId, false);
      room.socketToPlayer.delete(socketId);
      room.playerToSocket.delete(playerId);
    }

    this.socketToRoom.delete(socketId);

    // If all players disconnected, cleanup after a delay
    const anyConnected = [...room.table.players.values()].some(p => p.connected);
    if (!anyConnected) {
      // Keep room alive for 60s for reconnection
      setTimeout(() => {
        const r = this.rooms.get(roomCode);
        if (r && ![...r.table.players.values()].some(p => p.connected)) {
          this.rooms.delete(roomCode);
        }
      }, 60_000);
    }

    return roomCode;
  }

  // ─── Lookups ────────────────────────────────────────────────────────────

  getContextForSocket(socketId: string): { room: Room; playerId: string; roomCode: string } | null {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const playerId = room.socketToPlayer.get(socketId);
    if (!playerId) return null;
    return { room, playerId, roomCode };
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  getClientState(roomCode: string, forPlayerId: string): ClientTableState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return room.table.getClientState(forPlayerId);
  }
}
