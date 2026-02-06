// ─── Double Down Madness — Multiplayer Server ─────────────────────────────────

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { existsSync } from 'fs';
import { RoomManager } from './roomManager';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../src/shared/protocol';

// ─── Express + HTTP ───────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

// ─── Socket.IO ────────────────────────────────────────────────────────────────

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
  },
});

const roomManager = new RoomManager();

// ─── Serve Static Files in Production ─────────────────────────────────────────

const distPath = path.join(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log(`Serving static files from ${distPath}`);
}

// ─── Broadcast State to All Players in a Room ─────────────────────────────────

function broadcastState(roomCode: string) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  for (const [playerId, socketId] of room.playerToSocket) {
    const state = room.table.getClientState(playerId);
    io.to(socketId).emit('game_state', state);
  }
}

// ─── Socket.IO Connection Handler ─────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ─── Create Room ──────────────────────────────────────────────────

  socket.on('create_room', async ({ playerName, buyIn }) => {
    try {
      const { roomCode, playerId } = roomManager.createRoom(socket.id, playerName, buyIn);
      socket.join(roomCode);
      socket.emit('room_created', { roomCode, playerId });
      broadcastState(roomCode);
      console.log(`[room:create] ${roomCode} by ${playerName} (${playerId})`);
    } catch (err) {
      socket.emit('error', { message: 'Failed to create room' });
      console.error('[room:create] error', err);
    }
  });

  // ─── Join Room ────────────────────────────────────────────────────

  socket.on('join_room', ({ roomCode, playerName, buyIn }) => {
    const result = roomManager.joinRoom(socket.id, roomCode, playerName, buyIn);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }
    socket.join(roomCode.toUpperCase());
    socket.emit('room_joined', { roomCode: roomCode.toUpperCase(), playerId: result.playerId! });
    broadcastState(roomCode.toUpperCase());
    console.log(`[room:join] ${roomCode} by ${playerName} (${result.playerId})`);
  });

  // ─── Leave Room ───────────────────────────────────────────────────

  socket.on('leave_room', () => {
    const rc = roomManager.leaveRoom(socket.id);
    if (rc) {
      socket.leave(rc);
      broadcastState(rc);
      console.log(`[room:leave] ${rc} by ${socket.id}`);
    }
  });

  // ─── Start Round ──────────────────────────────────────────────────

  socket.on('start_round', async () => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;

    // Only host can start
    if (ctx.playerId !== ctx.room.table.hostId) {
      socket.emit('error', { message: 'Only the host can start' });
      return;
    }

    const table = ctx.room.table;

    // If starting from LOBBY (first round), roll for dealer button
    const isFirstStart = table.phase === 'LOBBY';
    if (isFirstStart && !table.buttonPlayerId) {
      const diceResult = table.rollForDealer();
      if (diceResult) {
        // Emit the dice roll event to all clients in the room
        io.to(ctx.roomCode).emit('dice_roll', diceResult);
      }
    }

    const ok = await table.startRound();
    if (!ok) {
      socket.emit('error', { message: 'Cannot start round now' });
      return;
    }

    // If dice roll happened, delay the state broadcast so clients can animate
    if (isFirstStart) {
      setTimeout(() => broadcastState(ctx.roomCode), 4500);
    } else {
      broadcastState(ctx.roomCode);
    }
  });

  // ─── Place Bet ────────────────────────────────────────────────────

  socket.on('place_bet', ({ amount, sideBet, numHands }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;

    const ok = ctx.room.table.placeBet(ctx.playerId, amount, sideBet, numHands ?? 1);
    if (!ok) {
      socket.emit('error', { message: 'Invalid bet' });
      return;
    }

    // Auto-deal when all bets are placed
    if (ctx.room.table.allBetsPlaced()) {
      ctx.room.table.dealCards();
    }

    broadcastState(ctx.roomCode);
  });

  // ─── Player Action (Hit / Stand / Double) ─────────────────────────

  socket.on('player_action', ({ action }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;

    const ok = ctx.room.table.playerAction(ctx.playerId, action);
    if (!ok) {
      socket.emit('error', { message: `Cannot ${action} right now` });
      return;
    }

    broadcastState(ctx.roomCode);
  });

  // ─── Insurance Decision ───────────────────────────────────────────

  socket.on('insurance_decision', ({ take }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;

    ctx.room.table.playerInsurance(ctx.playerId, take);

    // Auto-resolve when all have decided
    if (ctx.room.table.allInsuranceDecided()) {
      ctx.room.table.resolvePeek();
    }

    broadcastState(ctx.roomCode);
  });

  // ─── Set Client Seed ─────────────────────────────────────────────

  socket.on('set_client_seed', ({ seed }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;

    const ok = ctx.room.table.setClientSeed(seed);
    if (!ok) {
      socket.emit('error', { message: 'Cannot change client seed during a round' });
      return;
    }

    broadcastState(ctx.roomCode);
    console.log(`[seed:set] Room ${ctx.roomCode} new client seed by ${ctx.playerId}`);
  });

  // ─── Toggle Away ──────────────────────────────────────────────────

  socket.on('toggle_away', () => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;

    const ok = ctx.room.table.toggleAway(ctx.playerId);
    if (!ok) return;

    // After toggling away during BETTING, check if all remaining bets are in
    if (ctx.room.table.phase === 'BETTING' && ctx.room.table.allBetsPlaced()) {
      ctx.room.table.dealCards();
    }

    // After toggling away during INSURANCE, check if all decided
    if (ctx.room.table.phase === 'INSURANCE_OFFERED' && ctx.room.table.allInsuranceDecided()) {
      ctx.room.table.resolvePeek();
    }

    // After toggling away during SETTLEMENT, check if all ready
    if (ctx.room.table.phase === 'SETTLEMENT' && ctx.room.table.allReady()) {
      ctx.room.table.prepareNextRound().then(() => broadcastState(ctx.roomCode));
      return;
    }

    broadcastState(ctx.roomCode);
    const player = ctx.room.table.players.get(ctx.playerId);
    console.log(`[away:toggle] ${ctx.playerId} in ${ctx.roomCode} → ${player?.isAway ? 'AWAY' : 'BACK'}`);
  });

  // ─── Chat ──────────────────────────────────────────────────────────

  socket.on('send_chat', ({ text }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;

    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) return;

    const player = ctx.room.table.players.get(ctx.playerId);
    if (!player) return;

    const msg = {
      id: `${Date.now()}-${ctx.playerId}-${Math.random().toString(36).slice(2, 8)}`,
      playerId: ctx.playerId,
      playerName: player.name,
      text: trimmed,
      timestamp: Date.now(),
    };

    // Broadcast to all sockets in the room
    io.to(ctx.roomCode).emit('chat_message', msg);
  });

  // ─── Set Chip Denominations (Host Only) ──────────────────────────

  socket.on('set_chip_denoms', ({ denominations }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;

    const ok = ctx.room.table.setChipDenominations(ctx.playerId, denominations);
    if (!ok) {
      socket.emit('error', { message: 'Cannot change chip denominations' });
      return;
    }

    broadcastState(ctx.roomCode);
    console.log(`[chips:set] ${ctx.roomCode} denoms → [${ctx.room.table.chipDenominations}]`);
  });

  // ─── Ready for Next Round ─────────────────────────────────────────

  socket.on('ready_for_next', async () => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;

    ctx.room.table.playerReady(ctx.playerId);

    // Auto-start next round when all ready
    if (ctx.room.table.allReady()) {
      await ctx.room.table.prepareNextRound();
    }

    broadcastState(ctx.roomCode);
  });

  // ─── Disconnect ───────────────────────────────────────────────────

  socket.on('disconnect', () => {
    const rc = roomManager.handleDisconnect(socket.id);
    if (rc) {
      broadcastState(rc);
    }
    console.log(`[disconnect] ${socket.id}`);
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3001', 10);
httpServer.listen(PORT, () => {
  console.log(`Double Down Madness server running on port ${PORT}`);
});
