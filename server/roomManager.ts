import { TableController } from './tableController';
import type { ClientTableState } from '../src/shared/protocol';

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
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface Room {
  code: string;
  table: TableController;
  socketToParticipant: Map<string, string>;
  participantToSocket: Map<string, string>;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>();

  createRoom(socketId: string, playerName: string, buyIn?: number): { roomCode: string; playerId: string } {
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
      socketToParticipant: new Map([[socketId, playerId]]),
      participantToSocket: new Map([[playerId, socketId]]),
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);

    return { roomCode: code, playerId };
  }

  joinRoom(
    socketId: string,
    roomCode: string,
    playerName: string,
    buyIn?: number,
    asSpectator = false,
  ): { playerId?: string; error?: string } {
    const code = roomCode.toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found' };

    if (!asSpectator) {
      const connectedPlayers = [...room.table.players.values()].filter((p) => p.connected).length;
      if (connectedPlayers >= 5) return { error: 'Room is full (max 5 players)' };

      if (room.table.phase !== 'LOBBY' && room.table.phase !== 'BETTING') {
        return { error: 'Game in progress - join as spectator or wait for next round' };
      }
    }

    const participantId = generatePlayerId();
    if (asSpectator) {
      room.table.addSpectator(participantId, playerName, socketId);
    } else {
      room.table.addPlayer(participantId, playerName, socketId, buyIn);
    }

    room.socketToParticipant.set(socketId, participantId);
    room.participantToSocket.set(participantId, socketId);
    this.socketToRoom.set(socketId, code);

    return { playerId: participantId };
  }

  leaveRoom(socketId: string): string | null {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const participantId = room.socketToParticipant.get(socketId);
    if (participantId) {
      if (room.table.isSpectator(participantId)) {
        room.table.removeSpectator(participantId);
      } else {
        room.table.removePlayer(participantId);
      }
      room.socketToParticipant.delete(socketId);
      room.participantToSocket.delete(participantId);
    }

    this.socketToRoom.delete(socketId);

    if (room.table.players.size === 0 && room.table.spectators.size === 0) {
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

    const participantId = room.socketToParticipant.get(socketId);
    if (participantId) {
      if (room.table.isSpectator(participantId)) {
        room.table.setSpectatorConnected(participantId, false);
      } else {
        room.table.setPlayerConnected(participantId, false);
      }
      room.socketToParticipant.delete(socketId);
      room.participantToSocket.delete(participantId);
    }

    this.socketToRoom.delete(socketId);

    if (room.table.getConnectedParticipantCount() === 0) {
      setTimeout(() => {
        const r = this.rooms.get(roomCode);
        if (r && r.table.getConnectedParticipantCount() === 0) {
          this.rooms.delete(roomCode);
        }
      }, 60_000);
    }

    return roomCode;
  }

  getContextForSocket(socketId: string): { room: Room; playerId: string; roomCode: string; isSpectator: boolean } | null {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const participantId = room.socketToParticipant.get(socketId);
    if (!participantId) return null;
    return {
      room,
      playerId: participantId,
      roomCode,
      isSpectator: room.table.isSpectator(participantId),
    };
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
