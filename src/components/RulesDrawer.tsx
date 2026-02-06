// ─── Rules Drawer ─────────────────────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../hooks/useGameState';

export default function RulesDrawer() {
  const show = useGameStore((s) => s.showRules);
  const toggle = useGameStore((s) => s.toggleRules);

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
            className="fixed left-0 top-0 bottom-0 w-full max-w-lg bg-charcoal border-r border-charcoal-lighter z-50 overflow-y-auto"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-gold font-bold text-lg font-[Georgia]">Game Rules</h2>
                <button
                  onClick={toggle}
                  className="text-cream/50 hover:text-cream p-1 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6 text-sm text-cream/80 leading-relaxed">
                {/* Intro */}
                <p className="text-cream/50 italic">
                  Double Down Madness is a blackjack variant by Light &amp; Wonder. This game uses <Highlight>Version 1</Highlight> rules (suited BJ 2:1, unsuited BJ 3:2) as described on the Wizard of Odds.
                </p>

                {/* Deck & Shoe */}
                <RuleSection title="Deck &amp; Shoe">
                  <ul className="space-y-1.5">
                    <li><Bullet />6 standard 52-card decks (312 cards) shuffled together.</li>
                    <li><Bullet />Card values: 2-10 = face value, J/Q/K = 10, Ace = 1 or 11.</li>
                    <li><Bullet />The shoe is reshuffled when approximately 75% has been dealt.</li>
                  </ul>
                </RuleSection>

                {/* Deal Flow */}
                <RuleSection title="Deal Flow">
                  <ul className="space-y-1.5">
                    <li><Bullet />Player places a bet and receives <Highlight>one card face-up</Highlight>.</li>
                    <li><Bullet />Dealer receives <Highlight>two cards</Highlight> — one face-up, one face-down (hole card).</li>
                    <li><Bullet />The player begins making decisions with only one card.</li>
                  </ul>
                </RuleSection>

                {/* Player Actions */}
                <RuleSection title="Player Actions">
                  <ul className="space-y-2">
                    <li>
                      <ActionLabel>Hit</ActionLabel>
                      Draw another card.
                    </li>
                    <li>
                      <ActionLabel>Stand</ActionLabel>
                      End your turn.
                    </li>
                    <li>
                      <ActionLabel>Double Down</ActionLabel>
                      Add an additional wager and receive one more card. You may then <Highlight>continue hitting, standing, or doubling again</Highlight>.
                    </li>
                    <li>
                      <ActionLabel>Re-Double</ActionLabel>
                      Allowed at any time. Each successive double-down wager is <Highlight>2x the previous double wager</Highlight>, not 2x the original bet.
                    </li>
                  </ul>
                  <div className="mt-3 bg-navy/60 rounded-lg p-3 border border-charcoal-lighter">
                    <div className="text-cream/40 text-xs uppercase tracking-wider mb-2">Double Escalation Example</div>
                    <div className="font-mono text-xs text-gold/90 space-y-0.5">
                      <div>Original bet = $10</div>
                      <div>1st double&nbsp;&nbsp; = $10&nbsp;&nbsp; (total at risk: $20)</div>
                      <div>2nd double&nbsp; = $20&nbsp;&nbsp; (total at risk: $40)</div>
                      <div>3rd double&nbsp; = $40&nbsp;&nbsp; (total at risk: $80)</div>
                      <div>4th double&nbsp; = $80&nbsp;&nbsp; (total at risk: $160)</div>
                    </div>
                  </div>
                </RuleSection>

                {/* Lone Ace Exception */}
                <RuleSection title="Doubling on a Lone Ace">
                  <p>If the player doubles when their only card is an Ace, they receive <Highlight>exactly one card</Highlight> and must stand immediately. No further actions are allowed.</p>
                </RuleSection>

                {/* Insurance */}
                <RuleSection title="Insurance">
                  <ul className="space-y-1.5">
                    <li><Bullet />Offered when the dealer's face-up card is an Ace.</li>
                    <li><Bullet />Costs half the original bet.</li>
                    <li><Bullet />Pays <Highlight>2:1</Highlight> if the dealer has blackjack.</li>
                  </ul>
                </RuleSection>

                {/* Dealer Peek */}
                <RuleSection title="Dealer Peek">
                  <ul className="space-y-1.5">
                    <li><Bullet />If the dealer shows a 10-value or Ace, the hole card is checked for blackjack.</li>
                    <li><Bullet />If the dealer has blackjack, it's revealed immediately before players act.</li>
                    <li><Bullet /><Highlight>All player bets lose</Highlight> against a dealer blackjack, including if the player holds a 10 or ace.</li>
                  </ul>
                </RuleSection>

                {/* Dealer Play */}
                <RuleSection title="Dealer Play">
                  <ul className="space-y-1.5">
                    <li><Bullet />Dealer <Highlight>hits on soft 17</Highlight> (H17).</li>
                    <li><Bullet />Dealer draws until reaching hard 17 or higher, or busting.</li>
                  </ul>
                </RuleSection>

                {/* Push 22 — THE rule */}
                <RuleSection title="Push 22 Rule" highlight>
                  <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 mb-2">
                    <p className="text-gold font-medium">This is the signature rule of Double Down Madness.</p>
                  </div>
                  <ul className="space-y-1.5">
                    <li><Bullet />If the dealer busts with <Highlight>exactly 22</Highlight>, all remaining player wagers are a <Highlight>push</Highlight> (tie — bet is returned).</li>
                    <li><Bullet />If the dealer busts with 23 or higher, the player wins as normal.</li>
                  </ul>
                </RuleSection>

                {/* No Splitting */}
                <RuleSection title="Splitting">
                  <p className="text-cream/50">Splitting is <Highlight>never offered</Highlight> in Double Down Madness.</p>
                </RuleSection>

                {/* Payouts */}
                <RuleSection title="Payouts">
                  <div className="overflow-hidden rounded-lg border border-charcoal-lighter">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-navy/60">
                          <th className="text-left px-3 py-2 text-cream/50 font-medium">Result</th>
                          <th className="text-right px-3 py-2 text-cream/50 font-medium">Payout</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-charcoal-lighter">
                        <PayoutRow result="Player wins (non-blackjack)" payout="1:1" />
                        <PayoutRow result="Suited blackjack (same suit A + 10-val)" payout="2:1" highlight />
                        <PayoutRow result="Unsuited blackjack" payout="3:2" />
                        <PayoutRow result="Insurance win" payout="2:1" />
                        <PayoutRow result="Dealer busts with 22" payout="Push" />
                        <PayoutRow result="Dealer busts with 23+" payout="1:1" />
                      </tbody>
                    </table>
                  </div>
                </RuleSection>

                {/* Player Blackjack */}
                <RuleSection title="Player Blackjack">
                  <p>A blackjack is an Ace + a 10-value card in the player's <Highlight>first two cards</Highlight>. Since you start with one card, this is achieved by <Highlight>hitting</Highlight> on your first card. Doubled hands that result in Ace + 10 are treated as a regular 21, paying 1:1. A hand of 21 with 3+ cards also pays 1:1.</p>
                </RuleSection>

                {/* Push 22 Side Bet */}
                <RuleSection title="Push 22 Side Bet">
                  <ul className="space-y-1.5">
                    <li><Bullet />Optional bet placed before the deal.</li>
                    <li><Bullet />Pays <Highlight>11:1</Highlight> if the dealer's final hand totals exactly 22.</li>
                    <li><Bullet />The dealer plays out their full hand even if the player busts, so the side bet can resolve.</li>
                  </ul>
                </RuleSection>

                {/* Keyboard Shortcuts */}
                <RuleSection title="Keyboard Shortcuts">
                  <div className="grid grid-cols-2 gap-2">
                    <ShortcutRow keys="H" action="Hit" />
                    <ShortcutRow keys="S" action="Stand" />
                    <ShortcutRow keys="D" action="Double" />
                    <ShortcutRow keys="Space" action="Deal / Continue" />
                  </div>
                </RuleSection>

                {/* Summary */}
                {/* House Edge */}
                <RuleSection title="House Edge (Version 1)">
                  <ul className="space-y-1.5">
                    <li><Bullet />House edge: <Highlight>0.95%</Highlight> (6 decks, cut card).</li>
                    <li><Bullet />Element of risk: <Highlight>0.61%</Highlight> (accounts for avg final wager of 1.57 units).</li>
                    <li><Bullet />Push 22 side bet house edge: 11.76%.</li>
                  </ul>
                </RuleSection>

                <div className="bg-navy/60 rounded-lg p-4 border border-charcoal-lighter">
                  <h4 className="text-gold font-bold text-xs uppercase tracking-wider mb-2">What Makes DDM Different</h4>
                  <ol className="space-y-1.5 list-decimal list-inside text-cream/70 text-xs">
                    <li>Player starts with <strong className="text-cream">one card</strong> instead of two.</li>
                    <li><strong className="text-cream">Unlimited doubling</strong> with escalating wagers and continued play.</li>
                    <li>Dealer 22 = <strong className="text-cream">push</strong> instead of a bust.</li>
                    <li><strong className="text-cream">No splitting</strong> — ever.</li>
                  </ol>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Helper Sub-components ────────────────────────────────────────────────────

function RuleSection({ title, highlight, children }: {
  title: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className={`font-bold text-sm mb-2 ${highlight ? 'text-gold' : 'text-cream/90'}`}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Bullet() {
  return <span className="text-gold mr-1.5">&#x2022;</span>;
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span className="text-gold-light font-medium">{children}</span>;
}

function ActionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-charcoal-lighter text-cream/90 text-xs font-bold px-2 py-0.5 rounded mr-1.5">
      {children}
    </span>
  );
}

function PayoutRow({ result, payout, highlight }: {
  result: string;
  payout: string;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? 'bg-gold/5' : ''}>
      <td className="px-3 py-2 text-cream/70">{result}</td>
      <td className={`px-3 py-2 text-right font-bold ${highlight ? 'text-gold' : 'text-cream/90'}`}>{payout}</td>
    </tr>
  );
}

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center gap-2">
      <kbd className="bg-navy/80 border border-charcoal-lighter text-cream/70 text-xs px-2 py-0.5 rounded font-mono min-w-[40px] text-center">
        {keys}
      </kbd>
      <span className="text-cream/60 text-xs">{action}</span>
    </div>
  );
}
