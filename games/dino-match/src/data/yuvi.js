// What Yuvi, the helper dino, says and which pose goes with it. Pure data (no DOM), unit tested in tests/yuvi.test.js.
// Poses are the nine drawn frames in art/mascot/dino-<frame>.webp; ui/yuvi.js maps every action to one of them.
import { INTROS, COMBO_INTROS } from './intros.js';

export const NAME = 'Yuvi';
export const GREETING = "Hi! I'm Yuvi, your dig buddy!";

// First launch (and Settings > Meet Yuvi again, How to play): tap to advance, Skip always there. show = an extra picture.
export const WELCOME = [
  { action: 'wave', say: GREETING },
  { action: 'talk', say: 'We travel back through deep time, island by island, from the Cambrian to the Ice Age.' },
  { action: 'point', say: "Match 3 or more gems to clear them and complete each level's goals.", show: 'gems' },
  { action: 'dig', say: 'Every level you win earns pickaxes. Use them at the dig site to uncover real fossils!' },
  { action: 'point', say: 'Finished fossils go to your museum, with their story.', show: 'museum' },
  { action: 'cheer', say: "Let's dig in!" }
];

export const LINES = {
  win: ['Great dig!', 'Roarsome!', 'Fossil-tastic!', 'You rock!'],
  threeStars: ['Three stars! Roarsome!', 'Perfect dig!'],
  part: ['A fossil part! Dig it out at the dig site!'],
  lose: ['So close! Try again?', 'Use a booster next time!', 'Every dig gets you closer!'],
  nearMiss: ['So close! Grab 5 more moves?'],
  noLives: ['Take a breather. You can dig a fossil while you wait!'],
  digPart: ['Got one!', 'Look at that bone!', 'Careful... nice!'],
  fossil: (name) => `Whoa! A whole ${name}!`,
  shopEmpty: (name) => `Out of ${name}s? Grab more here!`,
  shop: ['Boosters help on tough levels!'],
  island: (era) => [`Whoa! ${era} is open!`, "Let's go and explore!"],
  sad: 'Oh no...'
};

// An intro card's line is its own text (docs/14 keeps it at 130 characters or less, so it fits the bubble).
// Pose: point at the lit element; event cards (hint, shuffle) think it over.
export const lineFor = (entry) => (entry && (entry.yuvi || entry.text)) || '';
export const poseFor = (entry) => (entry && (entry.event || entry.group === 'event') ? 'think' : 'point');
export const comboLine = (c) => c.text;
export const ALL_LINES = () => [...Object.values(INTROS).map(lineFor), ...COMBO_INTROS.map(comboLine)];

// deterministic pick for tests, random in the game
export const pick = (list, r = Math.random()) => list[Math.min(list.length - 1, Math.floor(r * list.length))];
