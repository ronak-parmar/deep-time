// THE fossil roster: the one data file the whole fossil system reads (Dig site, museum, cutscenes, era lengths).
// Adding a fossil = adding one entry here (plus a shape recipe; most are one call to an archetype in archetypes.js).
// Nothing else needs to change: era length, level numbering, journey cards and tests derive from this list.
//
//   id        unique, kebab-case                       era    era id (see core/eras.js), entries of an era are CONSECUTIVE
//   name      shown to the player                      sci    scientific name
//   when      short text for the timeline              mya    [from, to] million years ago (to may be a small decimal)
//   facts     2 to 3 short, checked facts (docs/13-fossil-facts.md lists the sources)
//   shape     the 10-part recipe (data/archetypes.js)
//   script    cutscene script (data/cutscene.js): { motion, finale? } and optional beats override
//   parts / pickaxes are global (CONFIG.fossils): 10 parts, 5 pickaxes each, 50 levels per fossil
import { quad, biped, trilobite, lobed, segmented, dragonfly, fish, ichthyo, plesio, serpent, pterosaur, bird, skull } from './archetypes.js';

const F = (id, era, name, sci, when, mya, facts, shape, script = {}) => ({ id, era, name, sci, when, mya, facts, shape, script });

export const ROSTER = [
  // ---- Cambrian (3) ----
  F('cambrian-trilobite', 'cambrian', 'Trilobite', 'Trilobita', 'about 500 million years ago', [521, 252],
    ['A trilobite was an arthropod, in the same big animal group as crabs, insects and spiders.', 'Its name means "three lobes", after the three long sections of its body.', 'Trilobites lived in the sea for more than 250 million years and died out about 252 million years ago.'],
    trilobite(), { motion: 'crawl' }),
  F('cambrian-opabinia', 'cambrian', 'Opabinia', 'Opabinia regalis', 'about 508 million years ago', [508, 505],
    ['Opabinia had five eyes on top of its head.', 'A long, flexible nozzle with a spiny claw at the end probably passed food to its mouth.', 'It was only about 4 to 7 centimetres long and is known from the Burgess Shale in Canada.'],
    lobed({ len: 0.5, h: 0.1, lobes: 7, fan: 3, eyes: 5, front: 'nozzle' }), { motion: 'swim' }),
  F('cambrian-anomalocaris', 'cambrian', 'Anomalocaris', 'Anomalocaris canadensis', 'about 508 million years ago', [508, 505],
    ['Anomalocaris was one of the biggest hunters of the Cambrian seas, up to about a metre long.', 'Its name means "abnormal shrimp": its grasping front arms were first mistaken for the tails of shrimp-like animals.', 'Famous fossils come from the Burgess Shale in Canada and from Chengjiang in China.'],
    lobed({ len: 0.55, h: 0.13, lobes: 7, fan: 3, eyes: 2, front: 'arms' }), { motion: 'swim' }),

  // ---- Devonian (3) ----
  F('devonian-ichthyostega', 'devonian', 'Ichthyostega', 'Ichthyostega', 'about 365 million years ago', [365, 360],
    ['Ichthyostega is one of the first four-limbed animals in the fossil record, found in Greenland.', 'It had seven toes on each back foot.', 'It lived in shallow water and could move on land. Its front legs were strong, but its back legs were smaller.'],
    quad({ sprawl: true, bl: 0.4, bh: 0.1, legH: 0.1, legW: 0.04, toe: 0.04, neckLen: 0.1, neckRise: 0.0, neckW: 0.075, neckW1: 0.07, head: 'croc', hl: 0.22, hh: 0.11, ht: 0.05, tail: 0.38, tailW: 0.06, feat: 'finTail' }), { motion: 'crawl' }),
  F('devonian-tiktaalik', 'devonian', 'Tiktaalik', 'Tiktaalik roseae', 'about 380 million years ago', [385, 375],
    ['Tiktaalik had gills and scales like a fish, but also a neck and strong front fins with wrist-like bones.', 'It was found in 2004 on Ellesmere Island in northern Canada, and named in 2006.', 'Its name comes from an Inuktitut word for a large freshwater fish.'],
    quad({ sprawl: true, bl: 0.38, bh: 0.09, legH: 0.09, legW: 0.045, neckLen: 0.06, neckRise: 0.0, neckW: 0.08, neckW1: 0.08, head: 'croc', hl: 0.27, hh: 0.1, ht: 0.0, tail: 0.3, tailW: 0.06, feat: 'finTail' }), { motion: 'crawl' }),
  F('devonian-dunkleosteus', 'devonian', 'Dunkleosteus', 'Dunkleosteus terrelli', 'about 360 million years ago', [382, 358],
    ['Dunkleosteus was an armoured fish about 4 metres long and a top hunter of its time.', 'It had no true teeth: sharp bony blades in its jaws sliced through prey.', 'Studies suggest it had one of the strongest bites of any fish.'],
    fish({ armour: true }), { motion: 'swim', finale: false }),

  // ---- Carboniferous (3) ----
  F('carboniferous-hylonomus', 'carboniferous', 'Hylonomus', 'Hylonomus lyelli', 'about 318 million years ago', [318, 312],
    ['Hylonomus is one of the earliest known animals on the reptile side of the family tree, a small lizard-like animal about 20 to 25 centimetres long.', 'Its fossils were found in Nova Scotia, Canada, inside the stumps of ancient trees.', 'It probably hunted small animals such as insects and millipedes in the coal-age forests.'],
    quad({ sprawl: true, bl: 0.3, bh: 0.075, legH: 0.08, legW: 0.03, toe: 0.04, neckLen: 0.08, neckRise: 0.0, neckW: 0.05, neckW1: 0.045, head: 'wedge', hl: 0.16, hh: 0.065, ht: 0.0, tail: 0.5, tailW: 0.045, tailLift: -0.02 }), { motion: 'crawl' }),
  F('carboniferous-arthropleura', 'carboniferous', 'Arthropleura', 'Arthropleura', 'about 300 million years ago', [346, 290],
    ['Arthropleura is the largest land invertebrate known, up to about 2.5 metres long.', 'It was a relative of today\'s millipedes, with many legs and a body made of segments.', 'It lived in the forests and floodplains of the coal age, in Europe and North America.'],
    segmented(), { motion: 'crawl' }),
  F('carboniferous-meganeura', 'carboniferous', 'Meganeura', 'Meganeura monyi', 'about 300 million years ago', [307, 299],
    ['Meganeura was a giant insect with a wingspan of about 70 centimetres.', 'It belonged to the same big group as dragonflies.', 'Its fossils were found in France, and it hunted other insects in the air.'],
    dragonfly(), { motion: 'fly' }),

  // ---- Permian (4) ----
  F('permian-edaphosaurus', 'permian', 'Edaphosaurus', 'Edaphosaurus', 'about 290 million years ago', [303, 272],
    ['Edaphosaurus was one of the first big plant-eaters on land.', 'The tall sail on its back was held up by long spines with little crossbars.', 'It was not a dinosaur: it belongs to the synapsids, the group that later led to mammals.'],
    quad({ sprawl: true, bl: 0.4, bh: 0.13, legH: 0.1, legW: 0.045, neckLen: 0.07, neckRise: 0.0, neckW: 0.08, neckW1: 0.07, head: 'tiny', hl: 0.12, hh: 0.075, ht: 0.05, tail: 0.4, tailW: 0.06, feat: 'sail', fo: { h: 0.3 } }), { motion: 'crawl' }),
  F('permian-helicoprion', 'permian', 'Helicoprion', 'Helicoprion', 'about 280 million years ago', [290, 270],
    ['Helicoprion had a spiral of teeth in its lower jaw, like a spiral saw blade.', 'Its skeleton was made of soft cartilage, so mostly the tooth spirals became fossils.', 'It was not a true shark: it belongs to the group of ratfish, but only as a very distant cousin.'],
    fish({ armour: false, whorl: true }), { motion: 'swim' }),
  F('permian-dimetrodon', 'permian', 'Dimetrodon', 'Dimetrodon', 'about 280 million years ago', [294, 271],
    ['Dimetrodon was not a dinosaur: it lived about 40 million years before the first dinosaurs.', 'It belongs to the synapsids, the group that includes mammals.', 'Its name means "two measures of teeth", and its sail was made of long spines of its backbone.'],
    quad({ sprawl: true, bl: 0.4, bh: 0.12, legH: 0.11, legW: 0.045, neckLen: 0.06, neckRise: 0.0, neckW: 0.075, neckW1: 0.07, head: 'wedge', hl: 0.2, hh: 0.095, ht: 0.05, tail: 0.45, tailW: 0.06, feat: 'sail', fo: { h: 0.36 } }), { motion: 'crawl' }),
  F('permian-inostrancevia', 'permian', 'Inostrancevia', 'Inostrancevia', 'about 255 million years ago', [255, 252],
    ['Inostrancevia was a gorgonopsid, a big hunter with long sabre-like teeth.', 'It grew up to about 3.5 metres long.', 'Gorgonopsids died out in the biggest mass extinction ever, about 252 million years ago.'],
    quad({ bl: 0.42, bh: 0.15, legH: 0.2, legW: 0.05, neckLen: 0.1, neckRise: 0.04, neckW: 0.09, neckW1: 0.08, head: 'wedge', hl: 0.27, hh: 0.12, ht: 0.05, tail: 0.18, tailW: 0.045, feat: 'fangs', fo: { len: 1.1 } }), { motion: 'walk' }),

  // ---- Triassic (6) ----
  F('triassic-eoraptor', 'triassic', 'Eoraptor', 'Eoraptor lunensis', 'about 231 million years ago', [231, 228],
    ['Eoraptor is one of the earliest known dinosaurs, about 1.2 metres long.', 'Its name means "dawn plunderer".', 'Its fossils were found in Argentina.'],
    biped({ bl: 0.2, bh: 0.085, legL: 0.27, thigh: 0.06, tail: 0.45, tailW: 0.04, neckLen: 0.1, neckRise: 0.08, neckW: 0.04, head: 'wedge', hl: 0.16, hh: 0.075, arm: 0.07, armW: 0.014, teeth: 6 }), { motion: 'walk' }),
  F('triassic-placerias', 'triassic', 'Placerias', 'Placerias hesternus', 'about 220 million years ago', [230, 215],
    ['Placerias was a stocky plant-eater with a beak and two tusk-like growths on its upper jaw (they were not true teeth).', 'It was a dicynodont, a synapsid (the group that includes mammals), not a dinosaur.', 'More than 1,600 of its bones were found together in one quarry in Arizona, USA.'],
    quad({ bl: 0.38, bh: 0.19, legH: 0.12, legW: 0.06, toe: 0.04, neckLen: 0.06, neckRise: 0.0, neckW: 0.1, neckW1: 0.1, head: 'round', hl: 0.2, hh: 0.13, ht: 0.12, tail: 0.1, tailW: 0.05, feat: 'tusks', fo: { len: 0.14, curl: 0.0 } }), { motion: 'walk' }),
  F('triassic-postosuchus', 'triassic', 'Postosuchus', 'Postosuchus kirkpatricki', 'about 220 million years ago', [228, 210],
    ['Postosuchus was one of the top hunters of its time, about 5 to 6 metres long.', 'It belonged to the crocodile side of the family tree, not to the dinosaurs.', 'Its name means "crocodile from Post", after the Post Quarry in Texas, USA, where it was found.'],
    quad({ bl: 0.38, bh: 0.14, legH: 0.24, legW: 0.05, neckLen: 0.12, neckRise: 0.05, neckW: 0.08, neckW1: 0.07, head: 'croc', hl: 0.3, hh: 0.14, ht: 0.06, tail: 0.5, tailW: 0.07, feat: 'fangs', fo: { len: 0.6 } }), { motion: 'walk' }),
  F('triassic-coelophysis', 'triassic', 'Coelophysis', 'Coelophysis bauri', 'about 210 million years ago', [215, 201],
    ['Coelophysis was a light, fast hunter up to about 3 metres long.', 'Its name means "hollow form".', 'Hundreds of skeletons were found together at Ghost Ranch in New Mexico, USA.'],
    biped({ bl: 0.27, bh: 0.09, legL: 0.3, thigh: 0.06, tail: 0.6, tailW: 0.045, neckLen: 0.2, neckRise: 0.14, neckW: 0.04, head: 'long', hl: 0.2, hh: 0.075, arm: 0.1, armW: 0.014, teeth: 8 }), { motion: 'walk' }),
  F('triassic-plateosaurus', 'triassic', 'Plateosaurus', 'Plateosaurus engelhardti', 'about 210 million years ago', [214, 204],
    ['Plateosaurus was one of the first big plant-eating dinosaurs, up to about 10 metres long.', 'It had a long, flexible neck and large claws on its hands.', 'Many skeletons were found in Germany, Switzerland and France.'],
    biped({ bl: 0.34, bh: 0.15, legL: 0.28, thigh: 0.085, tail: 0.55, tailW: 0.075, neckLen: 0.3, neckRise: 0.2, neckW: 0.055, head: 'tiny', hl: 0.15, hh: 0.075, arm: 0.12, armW: 0.02, teeth: 4, tilt: -0.12 }), { motion: 'walk' }),
  F('triassic-shonisaurus', 'triassic', 'Shonisaurus', 'Shonisaurus popularis', 'about 215 million years ago', [225, 210],
    ['Shonisaurus was an ichthyosaur, a sea reptile (not a dinosaur) up to about 15 metres long.', 'Ichthyosaurs breathed air and gave birth to live young.', 'It is the state fossil of Nevada, USA.'],
    ichthyo(), { motion: 'swim' }),

  // ---- Jurassic (8) ----
  F('jurassic-plesiosaurus', 'jurassic', 'Plesiosaurus', 'Plesiosaurus dolichodeirus', 'about 195 million years ago', [199, 190],
    ['Plesiosaurus was a sea reptile (not a dinosaur) with four flippers and a long, slender neck.', 'It was about 3.5 metres long.', 'Mary Anning found a complete skeleton near Lyme Regis, England, in 1823.'],
    plesio(), { motion: 'swim' }),
  F('jurassic-dryosaurus', 'jurassic', 'Dryosaurus', 'Dryosaurus altus', 'about 150 million years ago', [156, 147],
    ['Dryosaurus was a small, fast plant-eater, up to about 3 metres long, that ran on two long legs.', 'Its name means "tree lizard".', 'Its fossils were found in the Morrison Formation in the western USA.'],
    biped({ bl: 0.22, bh: 0.09, legL: 0.34, thigh: 0.06, tail: 0.5, tailW: 0.05, neckLen: 0.14, neckRise: 0.12, neckW: 0.04, head: 'long', hl: 0.14, hh: 0.065, arm: 0.07, armW: 0.014, teeth: 0, tilt: -0.1 }), { motion: 'walk' }),
  F('jurassic-archaeopteryx', 'jurassic', 'Archaeopteryx', 'Archaeopteryx lithographica', 'about 150 million years ago', [151, 148],
    ['Archaeopteryx had wings with feathers, but also teeth, claws and a long bony tail.', 'The first skeleton was found in Germany in 1861, soon after Darwin\'s book on evolution.', 'It was roughly the size of a raven.'],
    bird(), { motion: 'fly' }),
  F('jurassic-pterodactylus', 'jurassic', 'Pterodactylus', 'Pterodactylus antiquus', 'about 150 million years ago', [151, 148],
    ['Pterodactylus was a pterosaur, a flying reptile. Pterosaurs were not dinosaurs.', 'Its name means "winged finger": its wing was held up by one very long finger.', 'Its wings spanned about a metre, and its fossils are from Germany.'],
    pterosaur({ crest: 0.0, beak: 0.55, span: 0.9 }), { motion: 'fly' }),
  F('jurassic-stegosaurus', 'jurassic', 'Stegosaurus', 'Stegosaurus stenops', 'about 150 million years ago', [155, 150],
    ['Stegosaurus was up to about 9 metres long, with a row of big plates on its back.', 'The spikes on its tail are called the thagomizer, a name from a 1982 Far Side cartoon.', 'It is the state fossil of Colorado, USA.'],
    quad({ bl: 0.42, bh: 0.19, legH: 0.12, hindExtra: 0.1, legW: 0.055, toe: 0.04, neckLen: 0.1, neckRise: -0.03, neckW: 0.08, neckW1: 0.06, head: 'tiny', hl: 0.14, hh: 0.065, ht: 0.35, tail: 0.38, tailW: 0.07, tilt: 0.13, feat: 'plates' }), { motion: 'walk' }),
  F('jurassic-brontosaurus', 'jurassic', 'Brontosaurus', 'Brontosaurus excelsus', 'about 150 million years ago', [156, 146],
    ['Brontosaurus means "thunder lizard" and could reach about 22 metres long.', 'It was named in 1879, later thought to be the same animal as Apatosaurus, and in 2015 scientists said it is a separate genus after all.', 'It lived in the Morrison Formation of the western USA.'],
    quad({ bl: 0.4, bh: 0.17, legH: 0.18, hindExtra: 0.0, legW: 0.06, toe: 0.05, neckLen: 0.46, neckRise: 0.32, neckW: 0.075, neckW1: 0.03, head: 'tiny', hl: 0.1, hh: 0.045, ht: 0.3, tail: 0.5, tailW: 0.08 }), { motion: 'walk' }),
  F('jurassic-brachiosaurus', 'jurassic', 'Brachiosaurus', 'Brachiosaurus altithorax', 'about 150 million years ago', [154, 150],
    ['Brachiosaurus means "arm lizard": its front legs were longer than its back legs.', 'That gave it a giraffe-like stance, and it was roughly 18 to 22 metres long.', 'The first skeleton was found in Colorado, USA, in 1900.'],
    quad({ bl: 0.38, bh: 0.17, legH: 0.2, hindExtra: -0.07, legW: 0.06, toe: 0.05, neckLen: 0.34, neckRise: 0.5, neckW: 0.085, neckW1: 0.03, head: 'round', hl: 0.12, hh: 0.065, ht: 0.3, tail: 0.28, tailW: 0.07, tilt: -0.1 }), { motion: 'walk' }),
  F('jurassic-allosaurus', 'jurassic', 'Allosaurus', 'Allosaurus fragilis', 'about 150 million years ago', [155, 145],
    ['Allosaurus was a top hunter of the Late Jurassic, up to about 9.7 metres long.', 'Its name means "different lizard", because its backbones looked different from others known at the time.', 'It is the state fossil of Utah, USA.'],
    biped({ bl: 0.34, bh: 0.15, legL: 0.34, thigh: 0.09, tail: 0.5, tailW: 0.07, neckLen: 0.13, neckRise: 0.1, neckW: 0.07, head: 'box', hl: 0.3, hh: 0.14, arm: 0.12, armW: 0.02, teeth: 8 }), { motion: 'walk' }),

  // ---- Cretaceous (7), the last one is the finale ----
  F('cretaceous-utahraptor', 'cretaceous', 'Utahraptor', 'Utahraptor ostrommaysorum', 'about 135 million years ago', [139, 134],
    ['Utahraptor is one of the largest known raptors, about 6 to 7 metres long.', 'It had a big curved claw, more than 20 centimetres long, on each foot.', 'Its fossils were found in Utah, USA, and it was named in 1993.'],
    biped({ bl: 0.28, bh: 0.11, legL: 0.3, thigh: 0.07, tail: 0.5, tailW: 0.055, neckLen: 0.1, neckRise: 0.12, neckW: 0.05, head: 'long', hl: 0.22, hh: 0.095, arm: 0.12, armW: 0.016, teeth: 8, sickle: true }), { motion: 'walk' }),
  F('cretaceous-spinosaurus', 'cretaceous', 'Spinosaurus', 'Spinosaurus aegyptiacus', 'about 95 million years ago', [100, 94],
    ['Spinosaurus was one of the biggest meat-eating dinosaurs, up to around 14 metres long.', 'A tall sail of long spines rose from its back.', 'It had a paddle-like tail and may have hunted in water. Its fossils come from Egypt and Morocco.'],
    biped({ bl: 0.36, bh: 0.15, legL: 0.28, thigh: 0.075, tail: 0.5, tailW: 0.08, neckLen: 0.12, neckRise: 0.05, neckW: 0.075, head: 'croc', hl: 0.34, hh: 0.1, arm: 0.12, armW: 0.02, teeth: 9, feat: 'sail', fo: { h: 0.34 } }), { motion: 'walk' }),
  F('cretaceous-pteranodon', 'cretaceous', 'Pteranodon', 'Pteranodon longiceps', 'about 85 million years ago', [86, 84],
    ['Pteranodon was a pterosaur, a flying reptile. Pterosaurs were not dinosaurs.', 'It had no teeth: its name means "wing without teeth". Its wings spanned about 6 metres, and some reached over 7 metres.', 'Its fossils come from Kansas, USA, where a shallow sea once lay.'],
    pterosaur({ crest: 0.34, beak: 0.6, span: 1.1 }), { motion: 'fly' }),
  F('cretaceous-velociraptor', 'cretaceous', 'Velociraptor', 'Velociraptor mongoliensis', 'about 75 million years ago', [75, 71],
    ['Velociraptor was about the size of a turkey, much smaller than in the films.', 'It probably had feathers: a forearm bone shows quill bumps, where feathers attach.', 'A famous fossil from Mongolia shows one locked in a fight with a Protoceratops.'],
    biped({ bl: 0.2, bh: 0.08, legL: 0.25, thigh: 0.05, tail: 0.5, tailW: 0.04, neckLen: 0.09, neckRise: 0.1, neckW: 0.04, head: 'long', hl: 0.18, hh: 0.07, arm: 0.1, armW: 0.014, teeth: 7, sickle: true }), { motion: 'walk' }),
  F('cretaceous-ankylosaurus', 'cretaceous', 'Ankylosaurus', 'Ankylosaurus magniventris', 'about 67 million years ago', [68, 66],
    ['Ankylosaurus was covered in bony armour and had a heavy club at the end of its tail.', 'It was about 6 to 8 metres long.', 'It lived at the very end of the age of dinosaurs in western North America.'],
    quad({ bl: 0.42, bh: 0.19, legH: 0.1, legW: 0.06, toe: 0.045, neckLen: 0.08, neckRise: -0.02, neckW: 0.1, neckW1: 0.09, head: 'wedge', hl: 0.2, hh: 0.12, ht: 0.2, tail: 0.38, tailW: 0.07, feat: 'armour' }), { motion: 'walk' }),
  F('cretaceous-triceratops', 'cretaceous', 'Triceratops', 'Triceratops horridus', 'about 67 million years ago', [69, 66],
    ['Triceratops means "three-horned face".', 'Its skull could be about 2 metres long, among the largest skulls of any land animal.', 'It lived at the very end of the age of dinosaurs in western North America.'],
    quad({ bl: 0.42, bh: 0.18, legH: 0.18, legW: 0.06, toe: 0.045, neckLen: 0.1, neckRise: 0.0, neckW: 0.11, neckW1: 0.1, head: 'beak', hl: 0.3, hh: 0.17, ht: 0.12, tail: 0.28, tailW: 0.07, feat: 'frill', fo: { big: 1.5 } }), { motion: 'walk' }),
  F('cretaceous-tyrannosaurus', 'cretaceous', 'Tyrannosaurus rex', 'Tyrannosaurus rex', 'about 67 million years ago', [69, 66],
    ['Tyrannosaurus rex means "tyrant lizard king".', 'It was about 12 metres long, with the strongest bite of any known land animal.', 'Its biggest tooth found was about 30 centimetres long with the root. The skeleton "Sue" was found in South Dakota, USA, in 1990.'],
    biped({ bl: 0.38, bh: 0.19, legL: 0.3, thigh: 0.11, tail: 0.55, tailW: 0.1, neckLen: 0.09, neckRise: 0.1, neckW: 0.1, head: 'box', hl: 0.4, hh: 0.19, arm: 0.07, armW: 0.018, teeth: 9, tilt: -0.08 }), { motion: 'walk', finale: true }),

  // ---- Age of mammals (4) ----
  F('mammals-eohippus', 'age-of-mammals', 'Dawn horse', 'Eohippus angustidens', 'about 55 million years ago', [56, 48],
    ['Eohippus, the "dawn horse", was one of the earliest members of the horse family.', 'It was a small, fox-sized animal, about 30 centimetres tall at the shoulder.', 'It had four toes on each front foot and three on each back foot.'],
    quad({ bl: 0.3, bh: 0.1, legH: 0.26, legW: 0.028, toe: 0.025, neckLen: 0.14, neckRise: 0.05, neckW: 0.04, neckW1: 0.035, head: 'long', hl: 0.2, hh: 0.06, ht: 0.35, tail: 0.18, tailW: 0.03, feat: 'ears' }), { motion: 'walk' }),
  F('mammals-moeritherium', 'age-of-mammals', 'Moeritherium', 'Moeritherium', 'about 35 million years ago', [37, 30],
    ['Moeritherium was an early relative of elephants, about 70 centimetres tall at the shoulder.', 'It had no real trunk, only a small flexible nose and upper lip, and short tusks.', 'It lived in the swamps and rivers of North Africa; its fossils were found in Egypt.'],
    quad({ bl: 0.34, bh: 0.15, legH: 0.12, legW: 0.045, toe: 0.035, neckLen: 0.07, neckRise: 0.0, neckW: 0.09, neckW1: 0.085, head: 'round', hl: 0.2, hh: 0.11, ht: 0.12, tail: 0.1, tailW: 0.03, feat: 'tusks', fo: { len: 0.1, trunk: 0.14, curl: 0 } }), { motion: 'walk' }),
  F('mammals-basilosaurus', 'age-of-mammals', 'Basilosaurus', 'Basilosaurus isis', 'about 38 million years ago', [41, 34],
    ['Basilosaurus was an early whale up to about 20 metres long, with a long, eel-like body.', 'It still had tiny back legs.', 'Its name means "king lizard", because it was first mistaken for a reptile.'],
    serpent(), { motion: 'swim' }),
  F('mammals-paraceratherium', 'age-of-mammals', 'Paraceratherium', 'Paraceratherium', 'about 30 million years ago', [34, 23],
    ['Paraceratherium was one of the biggest land mammals ever, about 4.8 metres tall at the shoulder.', 'It was a hornless relative of today\'s rhinos.', 'Its fossils are found from China to Europe, and it browsed on leaves and soft plants.'],
    quad({ bl: 0.38, bh: 0.19, legH: 0.3, legW: 0.06, toe: 0.045, neckLen: 0.32, neckRise: 0.13, neckW: 0.1, neckW1: 0.065, head: 'long', hl: 0.22, hh: 0.075, ht: 0.35, tail: 0.1, tailW: 0.035, feat: 'ears' }), { motion: 'walk' }),

  // ---- Ice age (6) ----
  F('iceage-cave-bear', 'ice-age', 'Cave bear', 'Ursus spelaeus', 'about 50,000 years ago', [0.13, 0.024],
    ['The cave bear was as big as the largest bears alive today, but it ate mostly plants.', 'Its bones are often found in caves across Europe, where it slept through the winter.', 'It died out about 24,000 years ago.'],
    quad({ bl: 0.36, bh: 0.2, legH: 0.15, legW: 0.07, toe: 0.045, neckLen: 0.07, neckRise: 0.0, neckW: 0.12, neckW1: 0.11, head: 'round', hl: 0.2, hh: 0.12, ht: 0.18, tail: 0.04, tailW: 0.03, feat: 'ears' }), { motion: 'walk' }),
  F('iceage-woolly-rhino', 'ice-age', 'Woolly rhinoceros', 'Coelodonta antiquitatis', 'about 30,000 years ago', [0.45, 0.014],
    ['The woolly rhinoceros had a thick furry coat and two horns, the front one about a metre long or more.', 'It lived on the cold grasslands of northern Europe and Asia.', 'Cave paintings in France, such as at Chauvet cave, show it.'],
    quad({ bl: 0.38, bh: 0.19, legH: 0.13, legW: 0.06, toe: 0.045, neckLen: 0.08, neckRise: -0.01, neckW: 0.12, neckW1: 0.1, head: 'box', hl: 0.28, hh: 0.1, ht: 0.35, tail: 0.1, tailW: 0.03, feat: 'horns', fo: { h: 0.26, fringe: true } }), { motion: 'walk' }),
  F('iceage-megatherium', 'ice-age', 'Giant ground sloth', 'Megatherium americanum', 'about 20,000 years ago', [2, 0.012],
    ['Megatherium was a giant ground sloth, about 6 metres long and as heavy as an elephant.', 'It could rear up on its back legs to pull down leaves with its long claws.', 'Charles Darwin collected its fossils in South America in the 1830s.'],
    quad({ bl: 0.38, bh: 0.2, legH: 0.12, legW: 0.07, toe: 0.05, neckLen: 0.08, neckRise: 0.02, neckW: 0.1, neckW1: 0.08, head: 'tiny', hl: 0.14, hh: 0.09, ht: 0.3, tail: 0.25, tailW: 0.09, feat: 'claws' }), { motion: 'walk' }),
  F('iceage-irish-elk', 'ice-age', 'Irish elk', 'Megaloceros giganteus', 'about 20,000 years ago', [0.4, 0.0077],
    ['The Irish elk was not an elk but a giant deer, about 2 metres tall at the shoulder.', 'Its antlers could span more than 4 metres.', 'Its skeletons are often found in the bogs of Ireland.'],
    quad({ bl: 0.34, bh: 0.13, legH: 0.3, legW: 0.032, toe: 0.025, neckLen: 0.18, neckRise: 0.14, neckW: 0.06, neckW1: 0.04, head: 'long', hl: 0.2, hh: 0.065, ht: 0.3, tail: 0.04, tailW: 0.025, feat: 'antlers' }), { motion: 'walk' }),
  F('iceage-smilodon', 'ice-age', 'Sabre-toothed cat', 'Smilodon fatalis', 'about 20,000 years ago', [2.5, 0.01],
    ['Smilodon was a big cat with huge sabre-like teeth, up to about 28 centimetres long in the biggest species.', 'It was not a tiger: it had a short tail and a very strong, muscular body.', 'Many thousands of bones were found in the La Brea Tar Pits in Los Angeles. It is the state fossil of California.'],
    quad({ bl: 0.34, bh: 0.15, legH: 0.18, legW: 0.05, toe: 0.04, neckLen: 0.09, neckRise: 0.03, neckW: 0.09, neckW1: 0.08, head: 'box', hl: 0.22, hh: 0.1, ht: 0.12, tail: 0.1, tailW: 0.035, feat: 'fangs', fo: { len: 1.3 } }), { motion: 'walk' }),
  F('iceage-woolly-mammoth', 'ice-age', 'Woolly mammoth', 'Mammuthus primigenius', 'about 20,000 years ago', [0.4, 0.004],
    ['The woolly mammoth had shaggy hair and tusks up to about 4 metres long.', 'Frozen mammoths have been found in the permafrost of Siberia and Alaska.', 'The last small group lived on Wrangel Island until about 4,000 years ago, when the pyramids of Egypt already stood.'],
    quad({ bl: 0.38, bh: 0.22, legH: 0.18, legW: 0.07, toe: 0.05, neckLen: 0.1, neckRise: 0.06, neckW: 0.14, neckW1: 0.12, head: 'round', hl: 0.24, hh: 0.16, ht: 0.2, tail: 0.06, tailW: 0.035, feat: 'tusks', fo: { len: 0.4, trunk: 0.28, curl: 0.35 } }), { motion: 'walk', finale: false }),

  // ---- Early humans (3) ----
  F('humans-australopithecus', 'early-humans', 'Australopithecus afarensis', 'Australopithecus afarensis', 'about 3.2 million years ago', [3.9, 3.0],
    ['"Lucy", found in Ethiopia in 1974, is the most famous Australopithecus afarensis skeleton.', 'She was only about 1.1 metres tall, yet she walked upright on two legs.', 'She had a small brain, like a chimpanzee\'s.'],
    skull({ brow: 0.03, face: 0.32, jaw: 0.2, dome: 0.0 }), { motion: 'sway' }),
  F('humans-homo-erectus', 'early-humans', 'Homo erectus', 'Homo erectus', 'about 1.5 million years ago', [2, 0.1],
    ['Homo erectus means "upright man".', 'It was one of the first human species to spread out of Africa, as far as Asia.', 'It made stone tools such as hand axes and may have used fire.'],
    skull({ brow: 0.07, face: 0.26, jaw: 0.18, dome: 0.15 }), { motion: 'sway' }),
  F('humans-neanderthal', 'early-humans', 'Neanderthal', 'Homo neanderthalensis', 'about 100,000 years ago', [0.24, 0.04],
    ['Neanderthals were close cousins of modern humans.', 'They made tools and used fire. The first fossil recognised as a Neanderthal was found in the Neander Valley in Germany in 1856.', 'People with ancestry from outside Africa carry about 2% Neanderthal DNA.'],
    skull({ brow: 0.08, face: 0.3, jaw: 0.14, dome: 0.3, crest: 0 }), { motion: 'sway', finale: false })
];
