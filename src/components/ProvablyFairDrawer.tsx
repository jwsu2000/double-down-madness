// ─── Provably Fair Drawer — Full Verification UI ────────────────────────────────

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectProvablyFair, selectPhase } from '../hooks/useGameState';
import { verify } from '../engine/provablyFair';
import { SUITS, RANKS } from '../engine/deck';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function indexToCardName(index: number): string {
  const deckIndex = index % 52;
  const suitIndex = Math.floor(deckIndex / 13);
  const rankIndex = deckIndex % 13;
  const suitSymbols: Record<string, string> = {
    hearts: '\u2665',
    diamonds: '\u2666',
    clubs: '\u2663',
    spades: '\u2660',
  };
  return `${RANKS[rankIndex]}${suitSymbols[SUITS[suitIndex]]}`;
}

function indexToSuitColor(index: number): string {
  const deckIndex = index % 52;
  const suitIndex = Math.floor(deckIndex / 13);
  return suitIndex < 2 ? 'text-red-400' : 'text-cream';
}

// ─── Verification State ───────────────────────────────────────────────────────

interface VerificationResult {
  hashMatch: boolean;
  cardsMatch: boolean;
  verified: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProvablyFairDrawer() {
  const show = useGameStore((s) => s.showProvablyFair);
  const toggle = useGameStore((s) => s.toggleProvablyFair);
  const setClientSeed = useGameStore((s) => s.setClientSeed);
  const pf = useGameStore(selectProvablyFair);
  const phase = useGameStore(selectPhase);

  const [seedInput, setSeedInput] = useState('');
  const [seedEditing, setSeedEditing] = useState(false);
  const [verResult, setVerResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const canChangeSeed = phase === 'LOBBY' || phase === 'BETTING';
  const hasPreviousRound = !!(pf.previousServerSeed && pf.previousServerSeedHash);

  const handleSeedEdit = useCallback(() => {
    setSeedInput(pf.clientSeed);
    setSeedEditing(true);
  }, [pf.clientSeed]);

  const handleSeedSave = useCallback(() => {
    const trimmed = seedInput.trim();
    if (trimmed.length > 0 && trimmed.length <= 64) {
      setClientSeed(trimmed);
    }
    setSeedEditing(false);
  }, [seedInput, setClientSeed]);

  const handleVerify = useCallback(async () => {
    if (
      !pf.previousServerSeed ||
      !pf.previousServerSeedHash ||
      !pf.previousClientSeed ||
      pf.previousNonce === undefined ||
      !pf.previousCardsDealt
    ) {
      return;
    }

    setVerifying(true);
    try {
      const result = await verify(
        pf.previousServerSeed,
        pf.previousServerSeedHash,
        pf.previousClientSeed,
        pf.previousNonce,
        pf.previousCardsDealt,
      );
      setVerResult({ ...result, verified: true });
    } catch {
      setVerResult({ hashMatch: false, cardsMatch: false, verified: true });
    } finally {
      setVerifying(false);
    }
  }, [pf]);

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
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-charcoal border-l border-charcoal-lighter z-50 overflow-y-auto"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <h2 className="text-gold font-bold text-lg font-[Georgia]">Provably Fair</h2>
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

              {/* Status Badge */}
              <div className="mb-6 px-3 py-2 rounded-lg bg-casino-green/10 border border-casino-green/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-casino-green animate-pulse" />
                  <span className="text-casino-green text-xs font-medium uppercase tracking-wider">
                    Provably Fair Active
                  </span>
                </div>
              </div>

              <div className="space-y-6">

                {/* ─── Current Round ───────────────────────────────────── */}
                <section>
                  <SectionHeader title="Current Round" subtitle={`Round #${pf.roundNumber}`} />

                  <div className="space-y-3 mt-3">
                    <Field label="Server Seed Hash (commitment)">
                      <code className="text-[11px] text-cream/80 break-all bg-navy/80 p-2.5 rounded-lg block font-mono leading-relaxed border border-navy">
                        {pf.serverSeedHash || 'Waiting for first round...'}
                      </code>
                      <p className="text-cream/30 text-[10px] mt-1">
                        This hash was committed before the round. The actual seed is hidden until the round ends.
                      </p>
                    </Field>

                    <Field label="Client Seed">
                      {seedEditing ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={seedInput}
                            onChange={(e) => setSeedInput(e.target.value)}
                            maxLength={64}
                            className="flex-1 bg-navy/80 border border-gold/30 rounded-lg px-3 py-2 text-xs text-cream font-mono focus:outline-none focus:border-gold/60 transition-colors"
                            placeholder="Enter your custom seed..."
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSeedSave();
                              if (e.key === 'Escape') setSeedEditing(false);
                            }}
                          />
                          <button
                            onClick={handleSeedSave}
                            className="px-3 py-2 bg-casino-green/20 text-casino-green text-xs rounded-lg hover:bg-casino-green/30 transition-colors font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setSeedEditing(false)}
                            className="px-3 py-2 bg-cream/10 text-cream/60 text-xs rounded-lg hover:bg-cream/20 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-[11px] text-gold break-all bg-navy/80 p-2.5 rounded-lg block font-mono border border-navy">
                            {pf.clientSeed || 'N/A'}
                          </code>
                          {canChangeSeed && (
                            <button
                              onClick={handleSeedEdit}
                              className="shrink-0 px-3 py-2 bg-gold/10 text-gold text-xs rounded-lg hover:bg-gold/20 transition-colors font-medium border border-gold/20"
                            >
                              Change
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-cream/30 text-[10px] mt-1">
                        You can set your own client seed to influence the shuffle. Changeable between rounds.
                      </p>
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Nonce">
                        <code className="text-xs text-cream/80 bg-navy/80 p-2.5 rounded-lg block font-mono border border-navy text-center">
                          {pf.nonce}
                        </code>
                      </Field>
                      <Field label="Round">
                        <code className="text-xs text-cream/80 bg-navy/80 p-2.5 rounded-lg block font-mono border border-navy text-center">
                          {pf.roundNumber}
                        </code>
                      </Field>
                    </div>
                  </div>
                </section>

                {/* ─── Previous Round (Verification) ──────────────────── */}
                <section>
                  <SectionHeader title="Previous Round" subtitle="Verify the last round" />

                  {hasPreviousRound ? (
                    <div className="space-y-3 mt-3">
                      <Field label="Revealed Server Seed">
                        <code className="text-[11px] text-casino-green break-all bg-navy/80 p-2.5 rounded-lg block font-mono leading-relaxed border border-casino-green/20">
                          {pf.previousServerSeed}
                        </code>
                      </Field>

                      <Field label="Server Seed Hash">
                        <code className="text-[11px] text-cream/60 break-all bg-navy/80 p-2.5 rounded-lg block font-mono leading-relaxed border border-navy">
                          {pf.previousServerSeedHash}
                        </code>
                      </Field>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Client Seed Used">
                          <code className="text-[11px] text-gold/80 bg-navy/80 p-2.5 rounded-lg block font-mono border border-navy truncate">
                            {pf.previousClientSeed ?? 'N/A'}
                          </code>
                        </Field>
                        <Field label="Nonce Used">
                          <code className="text-xs text-cream/80 bg-navy/80 p-2.5 rounded-lg block font-mono border border-navy text-center">
                            {pf.previousNonce ?? 'N/A'}
                          </code>
                        </Field>
                      </div>

                      {pf.previousCardsDealt && pf.previousCardsDealt.length > 0 && (
                        <Field label={`Cards Dealt (${pf.previousCardsDealt.length} cards)`}>
                          <div className="flex flex-wrap gap-1.5 bg-navy/80 p-3 rounded-lg border border-navy">
                            {pf.previousCardsDealt.map((cardIdx, i) => (
                              <span
                                key={i}
                                className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-mono font-bold ${indexToSuitColor(cardIdx)} bg-charcoal border border-charcoal-lighter`}
                              >
                                {indexToCardName(cardIdx)}
                              </span>
                            ))}
                          </div>
                        </Field>
                      )}

                      {/* Verify Button */}
                      <div className="pt-2">
                        <button
                          onClick={handleVerify}
                          disabled={verifying}
                          className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all duration-200 bg-gradient-to-r from-gold/20 to-gold/10 text-gold border border-gold/30 hover:from-gold/30 hover:to-gold/20 hover:border-gold/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {verifying ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Verifying...
                            </span>
                          ) : (
                            'Verify Previous Round'
                          )}
                        </button>
                      </div>

                      {/* Verification Result */}
                      {verResult?.verified && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`rounded-lg p-4 border ${
                            verResult.hashMatch && verResult.cardsMatch
                              ? 'bg-casino-green/10 border-casino-green/30'
                              : 'bg-red-500/10 border-red-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            {verResult.hashMatch && verResult.cardsMatch ? (
                              <>
                                <svg className="w-5 h-5 text-casino-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-casino-green font-bold text-sm">Verified - Round was Fair</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-red-400 font-bold text-sm">Verification Failed</span>
                              </>
                            )}
                          </div>
                          <div className="space-y-1.5 text-xs">
                            <CheckItem
                              label="SHA-256 hash matches revealed seed"
                              passed={verResult.hashMatch}
                            />
                            <CheckItem
                              label="Card order matches derived shuffle"
                              passed={verResult.cardsMatch}
                            />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 bg-navy/40 rounded-lg p-4 border border-navy">
                      <p className="text-cream/40 text-xs text-center">
                        No previous round data yet. Complete a round to see verification data.
                      </p>
                    </div>
                  )}
                </section>

                {/* ─── How It Works ────────────────────────────────────── */}
                <section>
                  <SectionHeader title="How It Works" subtitle="Cryptographic fairness guarantee" />

                  <div className="mt-3 space-y-4">
                    <div className="space-y-3">
                      {[
                        {
                          step: '1',
                          title: 'Seed Commitment',
                          desc: 'Before each round, the server generates a random seed and publishes its SHA-256 hash. This commits the server to the seed without revealing it.',
                        },
                        {
                          step: '2',
                          title: 'Combined Entropy',
                          desc: 'The card order is derived from HMAC-SHA256(serverSeed, clientSeed + ":" + nonce). Both server and client seeds contribute to the final outcome.',
                        },
                        {
                          step: '3',
                          title: 'Fisher-Yates Shuffle',
                          desc: 'The HMAC output produces a deterministic byte stream used to perform an unbiased Fisher-Yates shuffle of all 312 cards (6 decks) using rejection sampling.',
                        },
                        {
                          step: '4',
                          title: 'Post-Round Reveal',
                          desc: 'After each round, the server seed is revealed. You can verify: (a) the hash matches the pre-committed hash, and (b) the derived card order matches the cards that were dealt.',
                        },
                        {
                          step: '5',
                          title: 'Client Seed Control',
                          desc: 'You can change the client seed between rounds. Since the server commits to its seed hash before knowing your seed, it cannot manipulate the outcome.',
                        },
                      ].map((item) => (
                        <div key={item.step} className="flex gap-3">
                          <div className="shrink-0 w-6 h-6 rounded-full bg-gold/15 flex items-center justify-center">
                            <span className="text-gold text-xs font-bold">{item.step}</span>
                          </div>
                          <div>
                            <h4 className="text-cream/90 text-xs font-bold">{item.title}</h4>
                            <p className="text-cream/40 text-[11px] leading-relaxed mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Algorithm Box */}
                    <div className="bg-navy/60 rounded-lg p-3 border border-navy">
                      <h4 className="text-gold/70 text-[10px] uppercase tracking-wider font-bold mb-2">Algorithm</h4>
                      <code className="text-[10px] text-cream/50 font-mono leading-relaxed block space-y-1">
                        <span className="block text-cream/70">shuffle = HMAC-SHA256(</span>
                        <span className="block pl-4 text-gold/70">key: serverSeed,</span>
                        <span className="block pl-4 text-casino-green/70">msg: clientSeed + ":" + nonce + ":" + round</span>
                        <span className="block text-cream/70">)</span>
                        <span className="block mt-1 text-cream/70">cardOrder = FisherYates(shuffle, 312 cards)</span>
                        <span className="block text-cream/70">verify: SHA256(serverSeed) === committedHash</span>
                      </code>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between border-b border-charcoal-lighter pb-2">
      <h3 className="text-cream font-bold text-sm">{title}</h3>
      <span className="text-cream/30 text-[10px] uppercase tracking-wider">{subtitle}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-cream/40 text-[10px] uppercase tracking-wider block mb-1.5 font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function CheckItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {passed ? (
        <svg className="w-3.5 h-3.5 text-casino-green shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className={passed ? 'text-casino-green/80' : 'text-red-400/80'}>{label}</span>
    </div>
  );
}
