# AI art prompts: 2 island sheets + 8 fossil sheets (10 images instead of 57)

Why sheets: one image per sheet means one style, fewer retries. I slice the sheets into single files (tools/prep-sheet.py).
Trade-off: more items per image means fewer pixels each, and AI tools sometimes mangle one cell. If a cell is wrong, regenerate the whole sheet or just that one animal with the single prompt at the bottom.

Where to save: `art/sheets/islands-1.png`, `islands-2.png`, `fossils-1.png` ... `fossils-8.png` (square, as large as the tool allows, 2048px or more is best).
Check each result before the next: the pose, the anatomy line, and a plain white gap between cells.

---

## A. Island sheets (2 images, 5 islands each)

**Done (M11):** the owner made all ten islands on one sheet instead, `art/sheets/islands-final.png` (5 x 2 grid, reading order =
the era order). `python3 tools/prep-islands.py` cuts it: Real-ESRGAN x4 (cached), connectivity-based white cut that keeps
waterfalls, snow and icicles, root/canopy sky pockets cut, pale rim shaved, 900 px webp with alpha in `art/islands/<era>.webp`.
Contact sheet and the traced ground paths: `games/dino-match/docs/screens/m11/islands-contact.png`, `islands-grid-a/b.png`.
If one island is regenerated, keep the same grid and re-run; re-trace its ground path in `src/data/islandNodes.js`.

Paste this and fill in the five lines.

```
Sheet of 5 separate floating islands for a mobile puzzle-game world map, laid out in a
neat 3 + 2 grid with wide plain pure-white gaps between them. Painterly 3D look, glossy
highlights, rich saturated colours, soft golden light from the upper left, thick rock
cliff undersides with waterfalls and hanging roots. Each island is a different
prehistoric biome and has one large fossil prop on it. Isometric three-quarter view,
same scale and same style for every island. Plain pure white background everywhere
else. No clouds, no path, no numbers, no text, no characters.

1. <island 1 description>
2. <island 2>
3. <island 3>
4. <island 4>
5. <island 5>
```

**Sheet islands-1**
1. CAMBRIAN: glowing turquoise shallow sea with corals, sponges and a stone arch; a giant trilobite fossil in the sand.
2. DEVONIAN: tidal lagoon with mud flats, early plants and warm green water; an armoured fish fossil in the rock.
3. CARBONIFEROUS: dense coal-swamp forest with giant ferns and moss; a giant dragonfly fossil in a log.
4. PERMIAN: red desert canyon with sandstone arches and dust; a sail-backed reptile skeleton in the sand.
5. TRIASSIC: dry rocky plains with horsetails, conifers and a faint volcanic haze; a small dinosaur skeleton half buried.

**Sheet islands-2**
1. JURASSIC: lush conifer and cycad forest with a smoking volcano; a long-necked sauropod ribcage arching over the ground.
2. CRETACEOUS: flowering plants and rock spires at sunset; a huge predator skull partly buried.
3. AGE OF MAMMALS: golden grassland savannah with scattered trees; the skeleton of an early elephant relative.
4. ICE AGE: snowy mountains, frozen waterfalls and pine trees; mammoth tusks sticking out of the snow.
5. EARLY HUMANS: rocky valley with a cave mouth, a campfire glow and hand-print cave paintings.

---

## B. Fossil sheets (8 images, 6 slabs each; the last has 5)

Paste this once per sheet and fill in the six lines. The reference look is the T. rex slab you generated.

```
Sheet of 6 separate fossil display slabs for a mobile paleontology puzzle game, in a
2 x 3 grid (2 columns, 3 rows) with wide plain pure-white gaps between them. Each slab:
a chunk of warm golden sandstone with one complete skeleton of an animal carved in
low relief, bones in ivory and amber with cracks and mineral speckle, soft rim light
from the upper left, rough chiselled slab edges, a small blank brass plaque at the
bottom. Semi-realistic painterly look, same lighting, same scale and same style for
every slab. Each skeleton is shown in clean side view, full body, centred, fills most of
the slab. No text, no letters, no other animals, no plants, no tools. Plain pure white
background.

Anatomy must be correct for each:
1. <animal + anatomy note>
...
6. <animal + anatomy note>
```

### fossils-1 (Cambrian, Devonian)
1. TRILOBITE: three-lobed body, crescent head shield with two eyes, segmented thorax, small tail shield (viewed from above).
2. OPABINIA: five stalked eyes on the head, one long flexible nozzle with a claw at the end, segmented body with side lobes, fan tail.
3. ANOMALOCARIS: two spiny grasping appendages at the front, round plated mouth, two stalked eyes, flexible side flaps along the body, tail fan.
4. ICHTHYOSTEGA: early four-legged animal, flat long skull, four sturdy limbs with 7 or 8 toes, a fish-like tail fin.
5. TIKTAALIK: flat crocodile-like head with eyes on top, fish body with scales, paired fins with wrist bones, no neck.
6. DUNKLEOSTEUS: armoured fish, thick bony head plates, sharp bladed jaws without teeth, plain fish tail behind.

### fossils-2 (Carboniferous, Permian)
1. HYLONOMUS: small lizard-like reptile, long tail, five toes on each foot, small skull with tiny teeth.
2. ARTHROPLEURA: giant millipede, long body of many armoured segments, many pairs of small legs.
3. MEGANEURA: giant dragonfly, two pairs of long veined wings, long thin abdomen, large head with big eyes.
4. EDAPHOSAURUS: barrel-bodied reptile with a tall sail of spines, each spine with small cross-bars, small head, long tail.
5. HELICOPRION: shark, with a spiral whorl of teeth in the lower jaw, fins and a shark tail.
6. DIMETRODON: large skull with two kinds of teeth, a tall sail of smooth spines (no cross-bars), sprawling legs, long tail.

### fossils-3 (Permian, Triassic)
1. INOSTRANCEVIA: large sabre-toothed mammal-like reptile, long upper canine teeth, long limbs, short tail.
2. EORAPTOR: very small bipedal dinosaur, long tail, five-fingered hands, light delicate build.
3. PLACERIAS: stocky dicynodont, two downward tusks, beaked toothless mouth, barrel body, short tail.
4. POSTOSUCHUS: big-headed predator, powerful tail, strong robust body, walks on four legs.
5. COELOPHYSIS: slender dinosaur, S-curved neck, long tail, three-fingered hands, narrow skull.
6. PLATEOSAURUS: long neck, small head with leaf-shaped teeth, thumb claw, long tail.

### fossils-4 (Triassic, Jurassic)
1. SHONISAURUS: ichthyosaur, long toothy snout, four long flippers, vertical tail fluke, long ribcage.
2. PLESIOSAURUS: small head on a very long neck, four paddle flippers, short tail.
3. DRYOSAURUS: small bipedal plant-eater, beaked mouth, long legs, long stiff tail.
4. ARCHAEOPTERYX: small feathered dinosaur-bird, feather imprints on wings and a long feathered tail, clawed fingers, toothed beak.
5. PTERODACTYLUS: flying reptile, one very long fourth finger supporting a wing membrane, long jaws with teeth, small body, short tail.
6. STEGOSAURUS: two rows of tall alternating bony plates along the back, four spikes on the tail, tiny head.

### fossils-5 (Jurassic, Cretaceous)
1. BRONTOSAURUS: very long neck, small head, pillar-like legs, very long whip tail.
2. BRACHIOSAURUS: front legs longer than the back legs, neck held high, small head with a bump on top, short tail.
3. ALLOSAURUS: large skull with two bony ridges above the eyes, three-fingered claws, powerful bipedal predator.
4. UTAHRAPTOR: large bipedal raptor, one big sickle claw on each foot, three-fingered hands, stiff tail.
5. SPINOSAURUS: tall sail of spines on the back, long crocodile-like snout with conical teeth, strong arms.
6. PTERANODON: toothless long pointed beak, tall backward crest on the head, enormous wings, small body.

### fossils-6 (Cretaceous, Age of Mammals)
1. VELOCIRAPTOR: small bipedal raptor, long low snout, sickle claw on each foot, three-fingered hands, stiff tail.
2. ANKYLOSAURUS: wide low body covered in bony plates and spikes, heavy club at the end of the tail, small head.
3. TRICERATOPS: large bony frill, three horns (two long brow horns, one short nose horn), beak, four sturdy legs.
4. TYRANNOSAURUS REX: huge skull with big teeth, two-fingered tiny arms (exactly two fingers each), bipedal, thick tail.
5. DAWN HORSE (EOHIPPUS): dog-sized early horse, arched back, four toes on the front feet and three on the back feet, long skull.
6. MOERITHERIUM: pig-sized early elephant relative, long low body, short trunk, small tusks, short legs.

### fossils-7 (Age of Mammals, Ice Age)
1. BASILOSAURUS: extremely long snake-like whale, tiny hind legs, two short flippers, toothed skull.
2. PARACERATHERIUM: giant hornless rhino, very long legs and neck, small head, huge body.
3. CAVE BEAR: heavy bear with a high rounded forehead, thick limbs, flat feet.
4. WOOLLY RHINOCEROS: two horns on the nose (the front one larger), thick low body, short legs.
5. GIANT GROUND SLOTH (MEGATHERIUM): huge body rearing on its hind legs, big curved claws, heavy tail used as a prop.
6. IRISH ELK: deer skeleton with enormous wide palm-shaped antlers.

### fossils-8 (Ice Age, Early Humans)  (5 slabs, leave the 6th empty)
1. SABRE-TOOTHED CAT (SMILODON): very long curved upper canine teeth, powerful front legs, short tail.
2. WOOLLY MAMMOTH: long strongly curved tusks, high domed skull, sloping back, small ears.
3. AUSTRALOPITHECUS AFARENSIS: skull only, side view, small braincase, projecting face, no chin.
4. HOMO ERECTUS: skull only, side view, long low skull, heavy brow ridge, no chin.
5. NEANDERTHAL: skull only, side view, large rounded braincase, heavy brow ridge, big nose opening, little chin.

---

## Single-animal fix-up prompt (when one cell is wrong)

```
One fossil display slab for a mobile paleontology puzzle game: a chunk of warm golden
sandstone with a complete skeleton of <ANIMAL + anatomy note> carved in low relief, bones
in ivory and amber with cracks and mineral speckle, soft rim light from the upper left,
rough chiselled slab edges, a small blank brass plaque at the bottom. Semi-realistic
painterly look. Clean side view, full body, centred. Plain pure white background. No
text, no other animals.
```
