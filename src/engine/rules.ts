// ─── Double Down Madness-Specific Rules ───────────────────────────────────────

import { type Card, evaluateHand, isBlackjack, isSuitedBlackjack, isTenValue, isAce } from './deck';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GamePhase =
  | 'BETTING'
  | 'DEALING'
  | 'INSURANCE_OFFERED'
  | 'PEEK_CHECK'
  | 'PLAYER_TURN'
  | 'DEALER_TURN'
  | 'SETTLEMENT';

export type HandResult =
  | 'PLAYER_BLACKJACK_SUITED'
  | 'PLAYER_BLACKJACK'
  | 'PLAYER_WIN'
  | 'DEALER_WIN'
  | 'PUSH'
  | 'PUSH_22'
  | 'DEALER_BLACKJACK';

export interface SettlementResult {
  result: HandResult;
  payout: number; // Net gain/loss (positive = player profit)
  sideBetPayout: number;
  message: string;
}

// ─── Chip Denominations ───────────────────────────────────────────────────────

export const DEFAULT_CHIP_DENOMINATIONS = [1, 5, 25, 100, 500];
export type ChipValue = number;

// ─── Constants ────────────────────────────────────────────────────────────────

export const STARTING_BALANCE = 1000;
export const MAX_BUY_IN = 100_000_000;
export const SIDE_BET_PAYOUT = 11; // 11:1

// ─── Insurance ────────────────────────────────────────────────────────────────

export function shouldOfferInsurance(dealerUpCard: Card): boolean {
  return isAce(dealerUpCard.rank);
}

export function insuranceCost(originalBet: number): number {
  return Math.floor(originalBet / 2);
}

export function insurancePayout(cost: number): number {
  return cost * 2; // 2:1 payout
}

// ─── Dealer Peek ──────────────────────────────────────────────────────────────

export function shouldPeek(dealerUpCard: Card): boolean {
  return isTenValue(dealerUpCard.rank) || isAce(dealerUpCard.rank);
}

export function dealerHasBlackjack(dealerCards: Card[]): boolean {
  if (dealerCards.length !== 2) return false;
  return isBlackjack(dealerCards);
}

// ─── Dealer Play Rules (H17) ─────────────────────────────────────────────────

export function dealerMustHit(dealerCards: Card[]): boolean {
  const hand = evaluateHand(dealerCards);
  if (hand.isBust) return false;
  // Hit on soft 17
  if (hand.best === 17 && hand.isSoft) return true;
  return hand.best < 17;
}

// ─── Double Down Escalation ───────────────────────────────────────────────────

/**
 * Calculate the next double-down wager.
 * First double = original bet.
 * Each subsequent double = 2× the previous double wager.
 */
export function nextDoubleWager(originalBet: number, doubleCount: number): number {
  if (doubleCount === 0) return originalBet;
  return originalBet * Math.pow(2, doubleCount);
}

/**
 * Calculate total wager at risk given original bet and number of doubles.
 * Original + sum of all double wagers.
 */
export function totalWager(originalBet: number, doubleCount: number): number {
  let total = originalBet;
  for (let i = 0; i < doubleCount; i++) {
    total += nextDoubleWager(originalBet, i);
  }
  return total;
}

// ─── Player Action Availability ───────────────────────────────────────────────

export interface AvailableActions {
  hit: boolean;
  stand: boolean;
  double: boolean;
}

export function getAvailableActions(
  playerCards: Card[],
  doubleCount: number,
  originalBet: number,
  balance: number,
  justDoubledOnLoneAce: boolean
): AvailableActions {
  const hand = evaluateHand(playerCards);

  // If bust or standing after doubling on lone ace, no actions
  if (hand.isBust || justDoubledOnLoneAce) {
    return { hit: false, stand: false, double: false };
  }

  // If hand is exactly 21, auto-stand
  if (hand.best === 21) {
    return { hit: false, stand: true, double: false };
  }

  const nextDouble = nextDoubleWager(originalBet, doubleCount);
  const canAffordDouble = balance >= nextDouble;

  return {
    hit: true,
    stand: true,
    double: canAffordDouble,
  };
}

// ─── Push 22 Rule ─────────────────────────────────────────────────────────────

export function isDealerPush22(dealerCards: Card[]): boolean {
  const hand = evaluateHand(dealerCards);
  return hand.isBust && hand.best === 22;
}

export function isDealerBust(dealerCards: Card[]): boolean {
  const hand = evaluateHand(dealerCards);
  return hand.isBust && hand.best > 22;
}

// ─── Settlement ───────────────────────────────────────────────────────────────

export function settleHand(
  playerCards: Card[],
  dealerCards: Card[],
  originalBet: number,
  doubleCount: number,
  sideBet: number,
  insuranceBet: number,
  insuranceTaken: boolean,
  dealerHasBJ: boolean
): SettlementResult {
  const playerHand = evaluateHand(playerCards);
  const dealerHand = evaluateHand(dealerCards);
  const wager = totalWager(originalBet, doubleCount);
  const isTwoCardBlackjack = isBlackjack(playerCards);
  const isBlackjackPayoutHand = isTwoCardBlackjack;
  let sideBetPayout = 0;

  // Side bet: pays 11:1 if dealer's hand totals exactly 22
  if (sideBet > 0) {
    if (dealerHand.best === 22 && dealerHand.isBust) {
      sideBetPayout = sideBet * SIDE_BET_PAYOUT;
    } else {
      sideBetPayout = -sideBet;
    }
  }

  // Dealer blackjack
  if (dealerHasBJ) {
    let payout = -wager;
    // Insurance payout
    if (insuranceTaken) {
      payout += insurancePayout(insuranceBet);
    }
    return {
      result: 'DEALER_BLACKJACK',
      payout,
      sideBetPayout,
      message: 'DEALER BLACKJACK',
    };
  }

  // Insurance loss (dealer didn't have BJ but player took insurance)
  let insuranceLoss = 0;
  if (insuranceTaken) {
    insuranceLoss = -insuranceBet;
  }

  // Player bust
  if (playerHand.isBust) {
    return {
      result: 'DEALER_WIN',
      payout: -wager + insuranceLoss,
      sideBetPayout,
      message: 'BUST',
    };
  }

  // Player blackjack (Ace + 10-value in exactly 2 cards).
  // Doubled two-card blackjacks are paid as blackjack per game rule.
  if (isBlackjackPayoutHand) {
    if (isSuitedBlackjack(playerCards)) {
      return {
        result: 'PLAYER_BLACKJACK_SUITED',
        payout: wager * 2 + insuranceLoss, // 2:1 (Version 1)
        sideBetPayout,
        message: 'SUITED BLACKJACK! 2:1 PAYOUT!',
      };
    }
    return {
      result: 'PLAYER_BLACKJACK',
      payout: Math.floor(wager * 1.5) + insuranceLoss, // 3:2 (Version 1)
      sideBetPayout,
      message: 'BLACKJACK!',
    };
  }

  // Push 22 rule
  if (isDealerPush22(dealerCards)) {
    // Blackjack takes priority over the dealer 22 push rule.
    // This prevents a two-card blackjack from being converted to PUSH_22.
    if (isTwoCardBlackjack) {
      if (isSuitedBlackjack(playerCards)) {
        return {
          result: 'PLAYER_BLACKJACK_SUITED',
          payout: wager * 2 + insuranceLoss,
          sideBetPayout,
          message: 'SUITED BLACKJACK! 2:1 PAYOUT!',
        };
      }
      return {
        result: 'PLAYER_BLACKJACK',
        payout: Math.floor(wager * 1.5) + insuranceLoss,
        sideBetPayout,
        message: 'BLACKJACK!',
      };
    }
    return {
      result: 'PUSH_22',
      payout: 0 + insuranceLoss, // Bet returned (net 0)
      sideBetPayout,
      message: 'PUSH 22',
    };
  }

  // Dealer busts 23+
  if (isDealerBust(dealerCards)) {
    return {
      result: 'PLAYER_WIN',
      payout: wager + insuranceLoss,
      sideBetPayout,
      message: 'DEALER BUSTS!',
    };
  }

  // Compare hands
  if (playerHand.best > dealerHand.best) {
    return {
      result: 'PLAYER_WIN',
      payout: wager + insuranceLoss,
      sideBetPayout,
      message: 'YOU WIN!',
    };
  }

  if (playerHand.best < dealerHand.best) {
    return {
      result: 'DEALER_WIN',
      payout: -wager + insuranceLoss,
      sideBetPayout,
      message: 'DEALER WINS',
    };
  }

  // Push (tie)
  return {
    result: 'PUSH',
    payout: 0 + insuranceLoss,
    sideBetPayout,
    message: 'PUSH',
  };
}
