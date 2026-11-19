// What Yuvi, the helper dino, says and which pose goes with it. Pure data (no DOM), unit tested in tests/yuvi.test.js.
// Poses are the nine drawn frames in art/mascot/dino-<frame>.webp; ui/yuvi.js maps every action to one of them.
import { INTROS, COMBO_INTROS } from './intros.js';

export const NAME = 'Yuvi';
// Who he is (store listing): a pint-sized palaeontologist in a too-big explorer hat, with a satchel full of brushes and big dreams
// of finding the greatest fossils on Earth.
export const BIO = 'A pint-sized palaeontologist in a too-big explorer hat, with a satchel full of brushes and big dreams of finding the greatest fossils on Earth.';
export const GREETING = "Hi! I'm Yuvi, a pint-sized palaeontologist!";

// First launch: only two bubbles, on the first island (M8). The rest is taught in context, one thing at a time (COACH below).
export const HELLO = [
  { action: 'wave', say: GREETING },
  { action: 'point', say: 'Help me dig up the greatest fossils on Earth. Tap level 1!', spot: 'node1', wait: 'action' }
];
// Settings > Meet Yuvi again / How to play: the hello plus a mini how-to. Tap to advance; Skip from bubble 2.
export const MEET = [
  { action: 'wave', say: "Hi! I'm Yuvi, a pint-sized palaeontologist." },
  { action: 'talk', say: 'This hat is a bit big, but my dreams are bigger: find every fossil on Earth!' },
  { action: 'talk', say: 'Swap two gems to make a row of 3 or more. Clear the goal before the moves run out.' },
  { action: 'point', say: 'Match 4 or more and you make a special piece. Swap it with any tile to blast!', show: 'gems' },
  { action: 'dig', say: 'Every new level you win earns a pickaxe. Spend them at the dig site to uncover real fossils.' },
  { action: 'point', say: 'Finished fossils go to your museum, with their story.', show: 'museum' },
  { action: 'cheer', say: "Let's dig in!" }
];
export const WELCOME = MEET;   // (old name)

// In-context steps (screens/coach.js, main.js). Each runs once (profile.coach.done), only when it becomes relevant, and waits for
// the player: a tap where it just explains, the real action where one is expected.
export const COACH_STEPS = ['hello', 'goal', 'swap', 'moves', 'combo', 'pickaxe', 'dig', 'museum'];
export const COACH = {
  goal: (n, colour) => `Clear ${n} ${colour} gems to win.`,
  swap: 'Swap two gems to make a row of 3.',
  nice: 'Nice!',
  moves: 'Only 5 moves left! Make them count.',
  special: {
    firecracker: (o) => `You made a Firecracker! Swap it with any tile to blast a whole ${o === 'v' ? 'column' : 'row'}.`,
    bomb: () => 'You made a Bomb! Swap it with any tile to blast everything around it.',
    dynamite: () => 'You made Dynamite! Swap it with any tile for a wide diamond blast.',
    tnt: () => 'You made TNT! Swap it with any tile to blast a huge area.',
    rainbow: () => 'You made a Rainbow gem! Swap it with any gem to clear that whole colour.'
  },
  useIt: (name) => `Your turn: use the ${name}`,
  combo: 'Two specials side by side! Swap them with each other for a giant combo blast.',
  pickaxe: "You earned a pickaxe! Let's use it at the dig site.",
  toDig: 'Tap Dig site.',
  slab: 'This slab hides a fossil. Every dig uncovers one part of it.',
  gift: (have, cost) => `A part takes ${cost} pickaxes. You have ${have}, so here ${cost - have === 1 ? 'is 1 more' : `are ${cost - have} more`} from me!`,
  digTap: 'Tap Dig to swing your pickaxe!',
  museum: 'Finished fossils go to your museum, with their story. Visit it any time.'
};

export const LINES = {
  win: ['Great dig!', 'Roarsome!', 'Fossil-tastic!', 'You rock!', 'Another bone for the museum!', 'Hold on to my hat, that was amazing!'],
  threeStars: ['Three stars! Roarsome!', 'Perfect dig!'],
  part: ['A fossil part! Dig it out at the dig site!'],
  lose: ['So close! Try again?', 'Use a booster next time!', 'Every dig gets you closer!', 'Even the best palaeontologists dig twice!', 'My brush is ready when you are!'],
  nearMiss: ['So close! Grab 5 more moves?'],
  noLives: ['Take a breather. You can dig a fossil while you wait!'],
  digPart: ['Got one!', 'Look at that bone!', 'Careful... nice!', 'Brush, brush... there it is!'],
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
