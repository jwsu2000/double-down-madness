// ─── Double Down Madness — Multiplayer Server ─────────────────────────────────

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { existsSync } from 'fs';
import { RoomManager } from './roomManager';
import { MAX_BUY_IN } from '../src/engine/rules';
import {
  DEALER_EMOTE_OPTIONS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '../src/shared/protocol';

// ─── Express + HTTP ───────────────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);

function parseAllowedOrigins(envValue: string | undefined): string[] {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const configuredClientOrigins = parseAllowedOrigins(process.env.CLIENT_ORIGIN);
const socketCorsOrigin =
  configuredClientOrigins.length > 0
    ? configuredClientOrigins
    : process.env.NODE_ENV === 'production'
      ? true
      : true;

if (process.env.NODE_ENV === 'production' && configuredClientOrigins.length === 0) {
  console.warn('[cors] CLIENT_ORIGIN not set; allowing all origins for Socket.IO');
}
if (process.env.NODE_ENV !== 'production' && configuredClientOrigins.length === 0) {
  console.warn('[cors] Dev mode with no CLIENT_ORIGIN; allowing all origins (LAN/mobile friendly)');
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();
const DEALER_EMOTE_KINDS = new Set(DEALER_EMOTE_OPTIONS.map((option) => option.kind));

function isValidBuyIn(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_BUY_IN;
}

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

  for (const [participantId, socketId] of room.participantToSocket) {
    const state = room.table.getClientState(participantId);
    io.to(socketId).emit('game_state', state);
  }
}

// ─── Socket.IO Connection Handler ─────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ─── Create Room ──────────────────────────────────────────────────

  socket.on('create_room', async ({ playerName, buyIn }) => {
    if (!isValidBuyIn(buyIn)) {
      socket.emit('error', { message: `Buy-in must be between $1 and $${MAX_BUY_IN.toLocaleString()}` });
      return;
    }

    try {
      const { roomCode, playerId } = roomManager.createRoom(socket.id, playerName, buyIn);
      socket.join(roomCode);
      socket.emit('room_created', { roomCode, playerId });
      broadcastState(roomCode);
      console.log(`[room-create] ${roomCode} by ${playerName} (${playerId})`);
    } catch (err) {
      socket.emit('error', { message: 'Failed to create room' });
      console.error('[room-create] error', err);
    }
  });

  // ─── Join Room ────────────────────────────────────────────────────

  socket.on('join_room', ({ roomCode, playerName, buyIn, asSpectator }) => {
    if (!asSpectator && !isValidBuyIn(buyIn)) {
      socket.emit('error', { message: `Buy-in must be between $1 and $${MAX_BUY_IN.toLocaleString()}` });
      return;
    }

    const normalizedBuyIn = isValidBuyIn(buyIn) ? buyIn : 1;
    const result = roomManager.joinRoom(socket.id, roomCode, playerName, normalizedBuyIn, !!asSpectator);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }
    socket.join(roomCode.toUpperCase());
    socket.emit('room_joined', { roomCode: roomCode.toUpperCase(), playerId: result.playerId! });
    broadcastState(roomCode.toUpperCase());
    console.log(`[room-join] ${roomCode} by ${playerName} (${result.playerId})${asSpectator ? ' [spectator]' : ''}`);
  });

  // ─── Leave Room ───────────────────────────────────────────────────

  socket.on('leave_room', () => {
    const rc = roomManager.leaveRoom(socket.id);
    if (rc) {
      socket.leave(rc);
      broadcastState(rc);
      console.log(`[room-leave] ${rc} by ${socket.id}`);
    }
  });

  // ─── Start Round ──────────────────────────────────────────────────

  socket.on('start_round', async () => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot start rounds' });
      return;
    }

    // Only host can start
    if (ctx.playerId !== ctx.room.table.hostId) {
      socket.emit('error', { message: 'Only the host can start' });
      return;
    }

    const table = ctx.room.table;

    // If starting from LOBBY (first round), roll for dealer button only when
    // host has not pre-selected one.
    const isFirstStart = table.phase === 'LOBBY';
    let diceResult = null;
    if (isFirstStart && !table.buttonPlayerId) {
      diceResult = table.rollForDealer();
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

    // If dice roll happened, delay the state broadcast so clients can animate.
    // If dealer was pre-selected, start immediately.
    if (isFirstStart && diceResult) {
      setTimeout(() => broadcastState(ctx.roomCode), 4500);
    } else {
      broadcastState(ctx.roomCode);
    }
  });

  // ─── Place Bet ────────────────────────────────────────────────────

  socket.on('place_bet', ({ amount, sideBet, numHands }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot place bets' });
      return;
    }

    const normalizedAmount = Math.trunc(Number(amount));
    const normalizedSideBet = Math.trunc(Number(sideBet ?? 0));
    const normalizedHands = Math.trunc(Number(numHands ?? 1));
    const ok = ctx.room.table.placeBet(
      ctx.playerId,
      normalizedAmount,
      normalizedSideBet,
      normalizedHands,
    );
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
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot play hands' });
      return;
    }

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
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot take insurance' });
      return;
    }

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
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot change client seed' });
      return;
    }

    const ok = ctx.room.table.setClientSeed(seed);
    if (!ok) {
      socket.emit('error', { message: 'Cannot change client seed during a round' });
      return;
    }

    broadcastState(ctx.roomCode);
    console.log(`[seed-set] Room ${ctx.roomCode} new client seed by ${ctx.playerId}`);
  });

  // ─── Toggle Away ──────────────────────────────────────────────────

  socket.on('toggle_away', () => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators do not have away status' });
      return;
    }

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
    console.log(`[away-toggle] ${ctx.playerId} in ${ctx.roomCode} -> ${player?.isAway ? 'AWAY' : 'BACK'}`);
  });

  // ─── Chat ──────────────────────────────────────────────────────────

  socket.on('send_chat', ({ text }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;

    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) return;

    const participantName = ctx.room.table.getParticipantName(ctx.playerId);
    if (!participantName) return;

    const msg = {
      id: `${Date.now()}-${ctx.playerId}-${Math.random().toString(36).slice(2, 8)}`,
      playerId: ctx.playerId,
      playerName: participantName,
      text: trimmed,
      timestamp: Date.now(),
    };

    // Broadcast to all sockets in the room
    io.to(ctx.roomCode).emit('chat_message', msg);
  });

  socket.on('send_dealer_emote', ({ emote }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot send emotes' });
      return;
    }

    if (!DEALER_EMOTE_KINDS.has(emote)) return;

    const player = ctx.room.table.players.get(ctx.playerId);
    if (!player) return;

    io.to(ctx.roomCode).emit('dealer_emote', {
      playerId: ctx.playerId,
      playerName: player.name,
      emote,
      timestamp: Date.now(),
    });
  });

  socket.on('add_stack', ({ playerId, amount }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot modify stacks' });
      return;
    }

    const ok = ctx.room.table.addStack(ctx.playerId, playerId, Math.trunc(amount));
    if (!ok) {
      socket.emit('error', { message: 'Cannot add stack right now' });
      return;
    }

    broadcastState(ctx.roomCode);
  });

  socket.on('request_buy_in', ({ amount }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot request buy-ins' });
      return;
    }

    const ok = ctx.room.table.requestBuyIn(ctx.playerId, Math.trunc(amount));
    if (!ok) {
      socket.emit('error', { message: 'Cannot request buy-in right now' });
      return;
    }

    broadcastState(ctx.roomCode);
  });

  socket.on('respond_buy_in_request', ({ playerId, approve }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot respond to buy-ins' });
      return;
    }

    const ok = ctx.room.table.respondBuyInRequest(ctx.playerId, playerId, !!approve);
    if (!ok) {
      socket.emit('error', { message: 'Cannot process buy-in request' });
      return;
    }

    broadcastState(ctx.roomCode);
  });

  // ─── Set Chip Denominations (Host Only) ──────────────────────────

  socket.on('transfer_host', ({ playerId }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot transfer ownership' });
      return;
    }

    const ok = ctx.room.table.transferHost(ctx.playerId, playerId);
    if (!ok) {
      socket.emit('error', { message: 'Cannot transfer host right now' });
      return;
    }

    broadcastState(ctx.roomCode);
  });

  socket.on('set_lobby_dealer', ({ playerId }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot set the dealer' });
      return;
    }

    const ok = ctx.room.table.setLobbyDealer(ctx.playerId, playerId);
    if (!ok) {
      socket.emit('error', { message: 'Cannot set dealer right now' });
      return;
    }

    broadcastState(ctx.roomCode);
  });

  socket.on('set_chip_denoms', ({ denominations }) => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators cannot change chip denominations' });
      return;
    }

    const ok = ctx.room.table.setChipDenominations(ctx.playerId, denominations);
    if (!ok) {
      socket.emit('error', { message: 'Cannot change chip denominations' });
      return;
    }

    broadcastState(ctx.roomCode);
    console.log(`[chips-set] ${ctx.roomCode} denoms -> [${ctx.room.table.chipDenominations}]`);
  });

  // ─── Ready for Next Round ─────────────────────────────────────────

  socket.on('ready_for_next', async () => {
    const ctx = roomManager.getContextForSocket(socket.id);
    if (!ctx) return;
    if (ctx.isSpectator) {
      socket.emit('error', { message: 'Spectators are always observing' });
      return;
    }

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
