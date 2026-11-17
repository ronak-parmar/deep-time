// Which board art draws each objective (target) kind. ONE table used by the HUD target plate, the prelevel card, intro cards, the
// result screen and How to play (ui/objectives.js draws it). A test checks every target kind used in the levels has an entry.
// kind: 'gem' (the painted gem sprite of colour key), 'block' (the plaque block tile of type key), 'obstacle' (obstacle sprite key),
//       'artefact'
export const OBJECTIVE_ART = {
  collect: (t) => ({ kind: 'gem', key: t.c }),
  // the level's first plaque block (its tile and the gem badge that digs it) with a small pickaxe: reads as 'dig these'
  dig: (t) => ({ kind: 'block', key: (t.blocks && t.blocks[0] && t.blocks[0].t) || 'sand', badge: t.blocks && t.blocks[0] ? t.blocks[0].c : null, pick: true }),
  stones: () => ({ kind: 'obstacle', key: 'sandstone' }),
  clearAll: (t) => ({ kind: 'obstacle', key: t.k }),
  fossils: () => ({ kind: 'obstacle', key: 'fossil' }),
  skeleton: () => ({ kind: 'obstacle', key: 'bone' }),
  drop: () => ({ kind: 'artefact', key: 'artefact' })
};
export const ART_KINDS = ['gem', 'block', 'obstacle', 'artefact'];
export const objectiveArt = (t) => (OBJECTIVE_ART[t.type] ? OBJECTIVE_ART[t.type](t) : null);
// short goal text for cards: 'Collect 20', 'Dig 8', 'Clear 6'
export const GOAL_VERB = { collect: 'Collect', dig: 'Dig', stones: 'Break', clearAll: 'Clear', fossils: 'Find', skeleton: 'Uncover', drop: 'Drop' };
