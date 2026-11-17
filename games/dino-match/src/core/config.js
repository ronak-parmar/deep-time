// Every tunable number for Dino Match lives here. Pure data, no logic.
// v1 is the basic mechanism only: every valid move digs exactly one block.
// The bonus hooks below exist so the rules can be rewired later; they default to OFF.
export const CONFIG = {
  gemKinds: ['red', 'green', 'blue', 'yellow', 'purple', 'amber'],

  // Dig rule (owner feedback, docs/11): progress comes from MATCHES, not moves. Each plaque block has a gem colour and hit points
  // (its type: tar 1, sand 2, stone 3). Clearing gems of that colour hits the block: 3-match = 1 hit, 4 = 2, 5+ = 3.
  // Special blasts hit one block per colour present (hits from the gems cleared of that colour, same table, at least 1).
  dig: {
    hitsByMatchSize: { 3: 1, 4: 2, 5: 3 },   // 5 also covers 6+
    blockTypes: { tar: { hp: 1 }, sand: { hp: 2 }, stone: { hp: 3 } }
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
    gemsPerMove: 2.6,        // collect targets: gems of the wanted colour broken per move, for the move budget
    plannedSlack: 0.25,       // levels with crates or artefacts: the bot (no planning) only has to reach this much less than 1 - target
    moveFactorEasy: 1.4, moveFactorHard: 0.8, minMoveFactor: 1.2, humanMargin: 1.3,   // moves per hit point at target 0 and at the cap (calibrated with the bot)
    historyEvery: 50
  },

  // --- specials (docs/11 phase A): unlock level per kind, chain cap. Shapes/combos are data in specials.js ---
  specials: { unlock: { firecracker: 5, bomb: 15, dynamite: 25, tnt: 35, rainbow: 45 }, chainDepth: 40 },

  // --- obstacles (docs/11 phase B): hit rules are data in obstacles.js; these are the tunables ---
  // unlock = first level a generated level may use the obstacle (the intro level for each is hand authored in level.js)
  obstacles: { crateCoins: 3, lavaTar: 3, spreadEvery: 5, unlock: { tar: 11, rock: 18, sandstone: 25, fossil: 35, bone: 55, artefact: 70, vine: 101, crate: 201, lava: 301 } },

  size: { onboarding: 6, normal: 7 }
};
