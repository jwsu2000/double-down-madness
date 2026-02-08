// ─── Ledger Drawer — Player Buy-in / Stack / P&L ──────────────────────────────

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, type DepartedPlayer } from '../hooks/useGameState';

export default function LedgerDrawer() {
  const show = useGameStore((s) => s.showLedger);
  const toggle = useGameStore((s) => s.toggleLedger);
  const tableState = useGameStore((s) => s.tableState);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const departedPlayers = useGameStore((s) => s.departedPlayers);
  const addStack = useGameStore((s) => s.addStack);
  const respondBuyInRequest = useGameStore((s) => s.respondBuyInRequest);
  const transferHost = useGameStore((s) => s.transferHost);
  const setHouseBuyIn = useGameStore((s) => s.setHouseBuyIn);
  const addHouseStack = useGameStore((s) => s.addHouseStack);
  const [topUpAmount, setTopUpAmount] = useState(100);
  const [houseAmountInput, setHouseAmountInput] = useState(10000);
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const dealerPlayerId = tableState?.buttonPlayerId ?? null;
  const activePlayers = (tableState?.players ?? []).filter((p) => p.id !== dealerPlayerId);
  const visibleDepartedPlayers = departedPlayers.filter((p) => !p.isDealer);
  const isHost = !!myPlayerId && myPlayerId === tableState?.hostId;
  const isDealer = !!myPlayerId && myPlayerId === dealerPlayerId;
  const canManageHouse = (isHost || isDealer) && (tableState?.phase === 'LOBBY' || tableState?.phase === 'BETTING');
  const canTopUpStacks = isHost && tableState?.phase !== 'LOBBY';
  const canTransferOwnership = isHost && tableState?.phase !== 'LOBBY';
  const normalizedTopUpAmount = Math.max(0, Math.trunc(topUpAmount));
  const normalizedHouseAmount = Math.max(1, Math.trunc(houseAmountInput));
  const canSubmitTopUp = canTopUpStacks && normalizedTopUpAmount > 0;
  const buyInRequests = tableState?.buyInRequests ?? [];
  const houseBuyIn = tableState?.houseBuyIn ?? 0;
  const houseBalance = tableState?.houseBalance ?? 0;
  const houseReserved = tableState?.houseReservedRisk ?? 0;
  const houseAvailable = tableState?.houseAvailableRisk ?? 0;
  const roomCode = tableState?.roomCode ?? '';
  const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteMessage = [
    'Join my Double Down Madness table!',
    `Room code: ${roomCode}`,
    shareUrl ? `Play here: ${shareUrl}` : '',
    'Click "Join Room" and enter the room code.',
  ].filter(Boolean).join('\n');

  useEffect(() => {
    if (inviteStatus === 'idle') return;
    const t = window.setTimeout(() => setInviteStatus('idle'), 2400);
    return () => window.clearTimeout(t);
  }, [inviteStatus]);

  const handleCopyInvite = async () => {
    if (!roomCode) return;

    const copied = await copyToClipboard(inviteMessage);
    setInviteStatus(copied ? 'copied' : 'error');
  };

  // Compute totals across all players (active + departed)
  const totalBuyIn = activePlayers.reduce((sum, p) => sum + p.buyIn, 0)
    + visibleDepartedPlayers.reduce((sum, p) => sum + p.buyIn, 0);
  const activeStack = activePlayers.reduce((sum, p) => sum + p.balance, 0);
  const departedStack = visibleDepartedPlayers.reduce((sum, p) => sum + p.lastBalance, 0);
  const totalStack = activeStack + departedStack;
  const totalPL = totalStack - totalBuyIn;

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggle}
          />
          <motion.div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-lg bg-charcoal border border-charcoal-lighter rounded-2xl z-50 overflow-hidden max-h-[85vh] overflow-y-auto"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-gold font-bold text-lg font-[Georgia]">Ledger</h2>
                    <span className="text-cream/30 text-[10px]">
                      Room {tableState?.roomCode ?? ''} &middot; {activePlayers.length} active
                      {visibleDepartedPlayers.length > 0 && `, ${visibleDepartedPlayers.length} left`}
                    </span>
                  </div>
                </div>
                <button
                  onClick={toggle}
                  className="text-cream/50 hover:text-cream p-1 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 p-3 rounded-lg border border-charcoal-lighter bg-navy/35">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-cream/65 text-xs uppercase tracking-wider font-medium">
                      House Bankroll
                    </p>
                    <p className="text-cream/35 text-[11px] truncate">
                      Caps total house losses to available coverage.
                    </p>
                  </div>
                  <span className="text-[10px] text-cream/35">
                    {isDealer ? 'You are dealer' : isHost ? 'You are host' : 'View only'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <MiniHouseStat label="Buy-in" value={houseBuyIn} tone="neutral" />
                  <MiniHouseStat label="Stack" value={houseBalance} tone={houseBalance > 0 ? 'good' : 'bad'} />
                  <MiniHouseStat label="Reserved" value={houseReserved} tone={houseReserved > 0 ? 'warn' : 'neutral'} />
                  <MiniHouseStat label="Available" value={houseAvailable} tone={houseAvailable >= 0 ? 'good' : 'bad'} />
                </div>
                {canManageHouse && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="text-cream/45 text-xs uppercase tracking-wider">Amount</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gold text-xs">$</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={normalizedHouseAmount || ''}
                        onChange={(e) => {
                          const next = parseInt(e.target.value, 10);
                          setHouseAmountInput(Number.isFinite(next) ? Math.max(1, next) : 1);
                        }}
                        className="w-32 bg-charcoal-light border border-charcoal-lighter rounded px-5 py-1.5
                          text-cream text-sm"
                      />
                    </div>
                    <button
                      onClick={() => setHouseBuyIn(normalizedHouseAmount)}
                      className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors
                        bg-blue-500/20 text-blue-200 hover:bg-blue-500/30"
                      title="Set house bankroll exactly (only before bets are placed)"
                    >
                      Set Buy-In
                    </button>
                    <button
                      onClick={() => addHouseStack(normalizedHouseAmount)}
                      className="px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors
                        bg-gold/20 text-gold hover:bg-gold/30"
                      title="Add to house bankroll"
                    >
                      Add Stack
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-4 p-3 rounded-lg border border-charcoal-lighter bg-navy/35">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-cream/65 text-xs uppercase tracking-wider font-medium">
                      Share Lobby
                    </p>
                    <p className="text-cream/35 text-[11px] truncate">
                      Sends room code {roomCode || '----'} with join link.
                    </p>
                  </div>
                  <button
                    onClick={handleCopyInvite}
                    disabled={!roomCode}
                    className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 ${
                      roomCode
                        ? 'bg-blue-500/20 text-blue-200 hover:bg-blue-500/30'
                        : 'bg-charcoal-lighter text-cream/20 cursor-not-allowed'
                    }`}
                    title={roomCode ? 'Copy invite message' : 'Room code unavailable'}
                  >
                    Copy Invite
                  </button>
                </div>
                {inviteStatus === 'copied' && (
                  <p className="mt-1 text-[10px] text-casino-green">Invite copied to clipboard.</p>
                )}
                {inviteStatus === 'error' && (
                  <p className="mt-1 text-[10px] text-casino-red">Could not copy invite. Try again.</p>
                )}
              </div>

              {isHost && (
                <div className="mb-4 p-3 rounded-lg border border-charcoal-lighter bg-navy/40">
                  <div className="flex items-center justify-between">
                    <span className="text-cream/60 text-xs uppercase tracking-wider font-medium">
                      Host Stack Top-Up
                    </span>
                    <span className="text-[10px] text-cream/35">
                      {canTopUpStacks ? 'Enabled' : 'Available after game starts'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-cream/45 text-xs uppercase tracking-wider">Amount</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gold text-xs">$</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={normalizedTopUpAmount || ''}
                        onChange={(e) => {
                          const next = parseInt(e.target.value, 10);
                          setTopUpAmount(Number.isFinite(next) ? Math.max(0, next) : 0);
                        }}
                        disabled={!canTopUpStacks}
                        className="w-28 bg-charcoal-light border border-charcoal-lighter rounded px-5 py-1.5
                          text-cream text-sm disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isHost && buyInRequests.length > 0 && (
                <div className="mb-4 p-3 rounded-lg border border-charcoal-lighter bg-navy/40">
                  <div className="flex items-center justify-between">
                    <span className="text-cream/60 text-xs uppercase tracking-wider font-medium">
                      Buy-In Requests
                    </span>
                    <span className="text-[10px] text-cream/35">
                      {buyInRequests.length} pending
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {buyInRequests.map((request) => (
                      <div
                        key={request.playerId}
                        className="flex items-center justify-between gap-2 rounded-md border border-charcoal-lighter/70 bg-charcoal-light/40 px-2 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-cream text-xs font-medium truncate">
                            {request.playerName}
                          </div>
                          <div className="text-gold/80 text-xs font-mono">
                            ${request.amount.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => respondBuyInRequest(request.playerId, false)}
                            disabled={!canTopUpStacks}
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              canTopUpStacks
                                ? 'bg-charcoal-lighter text-cream/70 hover:text-cream hover:bg-charcoal-light'
                                : 'bg-charcoal-lighter text-cream/20 cursor-not-allowed'
                            }`}
                          >
                            Deny
                          </button>
                          <button
                            onClick={() => respondBuyInRequest(request.playerId, true)}
                            disabled={!canTopUpStacks}
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              canTopUpStacks
                                ? 'bg-casino-green/25 text-casino-green hover:bg-casino-green/35'
                                : 'bg-charcoal-lighter text-cream/20 cursor-not-allowed'
                            }`}
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Table Header */}
              <div className="grid grid-cols-[1fr_80px_90px_90px] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-cream/30 border-b border-charcoal-lighter">
                <div>Player</div>
                <div className="text-right">Buy-in</div>
                <div className="text-right">Stack</div>
                <div className="text-right">P / L</div>
              </div>

              {/* Active Player Rows */}
              <div className="divide-y divide-charcoal-lighter/50">
                {activePlayers.map((player) => {
                  const pl = player.balance - player.buyIn;
                  const isMe = player.id === myPlayerId;
                  const isCurrentHost = player.id === tableState?.hostId;
                  const canTopUpPlayer = canSubmitTopUp && player.connected;
                  const canTransferToPlayer = canTransferOwnership && !isCurrentHost && player.connected;

                  return (
                    <div
                      key={player.id}
                      className={`grid grid-cols-[1fr_80px_90px_90px] gap-2 px-3 py-3 items-center transition-colors ${
                        isMe ? 'bg-gold/5' : ''
                      }`}
                    >
                      {/* Name */}
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              player.connected ? 'bg-casino-green' : 'bg-cream/20'
                            }`}
                          />
                          <span className="text-cream text-sm font-medium truncate">
                            {player.name}
                          </span>
                          {isMe && (
                            <span className="text-[9px] text-gold/60 bg-gold/10 px-1.5 py-0.5 rounded font-medium shrink-0">
                              YOU
                            </span>
                          )}
                          {isCurrentHost && (
                            <span className="text-[9px] text-blue-300/80 bg-blue-400/10 px-1.5 py-0.5 rounded font-medium shrink-0">
                              HOST
                            </span>
                          )}
                          {player.isAway && (
                            <span className="text-[8px] text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded font-medium shrink-0">
                              AWAY
                            </span>
                          )}
                        </div>
                        {canTopUpStacks && (
                          <button
                            onClick={() => addStack(player.id, normalizedTopUpAmount)}
                            disabled={!canTopUpPlayer}
                            className={`w-fit px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              canTopUpPlayer
                                ? 'bg-gold/20 text-gold hover:bg-gold/30'
                                : 'bg-charcoal-lighter text-cream/20 cursor-not-allowed'
                            }`}
                            title={canTopUpPlayer ? `Add $${normalizedTopUpAmount} to ${player.name}` : 'Unavailable'}
                          >
                            Add ${normalizedTopUpAmount.toLocaleString()}
                          </button>
                        )}
                        {canTransferOwnership && (
                          <button
                            onClick={() => transferHost(player.id)}
                            disabled={!canTransferToPlayer}
                            className={`w-fit px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              canTransferToPlayer
                                ? 'bg-blue-500/20 text-blue-200 hover:bg-blue-500/30'
                                : 'bg-charcoal-lighter text-cream/20 cursor-not-allowed'
                            }`}
                            title={canTransferToPlayer ? `Pass owner role to ${player.name}` : 'Unavailable'}
                          >
                            Make Owner
                          </button>
                        )}
                      </div>

                      {/* Buy-in */}
                      <div className="text-right text-cream/50 text-sm font-mono">
                        ${player.buyIn.toLocaleString()}
                      </div>

                      {/* Current Stack */}
                      <div className="text-right text-cream text-sm font-mono font-medium">
                        ${player.balance.toLocaleString()}
                      </div>

                      {/* P/L */}
                      <PLCell value={pl} />
                    </div>
                  );
                })}
              </div>

              {/* Departed Players */}
              {visibleDepartedPlayers.length > 0 && (
                <>
                  <div className="px-3 pt-4 pb-1">
                    <span className="text-cream/25 text-[10px] uppercase tracking-wider font-medium">
                      Left the Table
                    </span>
                  </div>
                  <div className="divide-y divide-charcoal-lighter/30">
                    {visibleDepartedPlayers.map((dp) => (
                      <DepartedRow key={dp.id} player={dp} />
                    ))}
                  </div>
                </>
              )}

              {/* Totals Row */}
              {(activePlayers.length + visibleDepartedPlayers.length) > 1 && (
                <div className="grid grid-cols-[1fr_80px_90px_90px] gap-2 px-3 py-3 items-center border-t-2 border-gold/20 mt-1">
                  <div className="text-cream/50 text-xs font-bold uppercase tracking-wider">
                    Table Total
                  </div>
                  <div className="text-right text-cream/40 text-sm font-mono">
                    ${totalBuyIn.toLocaleString()}
                  </div>
                  <div className="text-right text-cream/70 text-sm font-mono font-medium">
                    ${totalStack.toLocaleString()}
                  </div>
                  <PLCell value={totalPL} />
                </div>
              )}

              {/* Note */}
              <div className="mt-4 pt-3 border-t border-charcoal-lighter">
                <p className="text-cream/25 text-[10px] text-center">
                  P/L is calculated as current stack minus buy-in.
                  {visibleDepartedPlayers.length > 0 && ' Departed players show their final balance.'}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Departed Player Row ──────────────────────────────────────────────────────

function DepartedRow({ player }: { player: DepartedPlayer }) {
  const pl = player.lastBalance - player.buyIn;
  const timeStr = new Date(player.departedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="grid grid-cols-[1fr_80px_90px_90px] gap-2 px-3 py-3 items-center opacity-60">
      {/* Name */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-2 h-2 rounded-full shrink-0 bg-cream/10" />
        <span className="text-cream/60 text-sm font-medium truncate">
          {player.name}
        </span>
        <span className="text-[8px] text-cream/30 bg-cream/5 px-1.5 py-0.5 rounded font-medium shrink-0">
          LEFT {timeStr}
        </span>
      </div>

      {/* Buy-in */}
      <div className="text-right text-cream/30 text-sm font-mono">
        ${player.buyIn.toLocaleString()}
      </div>

      {/* Final Stack */}
      <div className="text-right text-cream/50 text-sm font-mono font-medium">
        ${player.lastBalance.toLocaleString()}
      </div>

      {/* P/L */}
      <PLCell value={pl} dimmed />
    </div>
  );
}

// ─── P/L Cell ─────────────────────────────────────────────────────────────────

function PLCell({ value, dimmed }: { value: number; dimmed?: boolean }) {
  const color = value > 0
    ? dimmed ? 'text-casino-green/60' : 'text-casino-green'
    : value < 0
    ? dimmed ? 'text-casino-red/60' : 'text-casino-red'
    : 'text-cream/50';

  return (
    <div className={`text-right text-sm font-mono font-bold ${color}`}>
      {value > 0 ? '+' : ''}${value.toLocaleString()}
    </div>
  );
}

function MiniHouseStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-casino-green'
      : tone === 'bad'
        ? 'text-casino-red'
        : tone === 'warn'
          ? 'text-gold'
          : 'text-cream/80';

  return (
    <div className="rounded-md border border-charcoal-lighter/70 bg-charcoal-light/35 px-2 py-1.5">
      <div className="text-cream/35 uppercase tracking-wider text-[9px]">{label}</div>
      <div className={`font-mono font-bold ${toneClass}`}>${value.toLocaleString()}</div>
    </div>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy copy method.
    }
  }

  if (typeof document === 'undefined') return false;

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
