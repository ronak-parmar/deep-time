// Every tunable number for Dino Match lives here. Pure data, no logic.
// v1 is the basic mechanism only: every valid move digs exactly one block.
// The bonus hooks below exist so the rules can be rewired later; they default to OFF.
export const CONFIG = {
  gemKinds: ['red', 'green', 'blue', 'yellow', 'purple', 'amber'],

  dig: {
    perValidMove: 1,
    // --- hooks, OFF in v1 (read by digForMove in rules.js) ---
    extraBigMatch: 0,        // extra blocks for a 4+ match
    extraPerCascadeStep: 0   // extra blocks per cascade step of 2+
  },

  // --- boosters: inert in v1 (placeholders in the UI) ---
  boosters: { enabled: false, kinds: ['pick', 'burst', 'brush'], start: { pick: 2, burst: 1, brush: 1 } },

  score: { perGem: 10 },
  stars: { two: 0.25, three: 0.5 },     // share of the move budget left for 2 / 3 stars
  coins: { win: 10, perStar: 5 },       // every win pays coins (replays too)

  // --- v1 progression and economy (docs/04 "v1 progression and economy") ---
  economy: { pickaxesPerFirstWin: 1, doubleCoinsMultiplier: 2 },
  lives: { max: 5, regenMinutes: 25, refillCoins: 100 },
  fossils: { parts: 10, pickaxesPerPart: 5, perEra: 2 },
  nearMiss: { blocks: 2, extraMoves: 5, coinCost: 50, maxPerAttempt: 1 },

  levels: {
    perEra: 100,
    eras: 10,
    onboarding: 15,          // hand-authored (docs/03)
    base: 0.10, perEraStep: 0.025, acrossEra: 0.30, cap: 0.80,
    cycleBump: 0.05,         // per full cycle after level 1000
    breatherFactor: 0.5,     // every 5th level and the first of an era
    milestoneBump: 0.10,     // every 10th level
    band: 0.10,              // bot win rate must land in 1 - target +/- band
    sims: 16,
    botSloppy: 0.25,         // chance the bot plays a random valid move
    minMoveRatio: 0.6,       // never fewer moves than this share of N
    maxSlack: 12,            // moves search range above N
    historyEvery: 50
  },

  size: { onboarding: 6, normal: 7 }
};
