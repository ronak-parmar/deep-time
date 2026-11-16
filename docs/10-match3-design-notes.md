# Prehistoric Match-3 Adventure --- Game Design Notes

*A practical design reference inspired by the broad progression
structure of Gardenscapes, adapted into an original dinosaur-and-fossil
adventure.*

> **Design/IP note:** Use these notes as a high-level reference for
> familiar match-3 and restoration mechanics. Create original names,
> art, animations, level layouts, story, UI, sound, and progression
> tuning. Do not copy Gardenscapes assets, characters, exact level
> layouts, branding, or proprietary implementation.

------------------------------------------------------------------------

## 1. Game concept

A casual match-3 puzzle game set in a lush prehistoric world. Players
solve board puzzles, earn stars, and spend those stars to excavate
fossils, restore ancient habitats, rebuild ruins, and unlock new areas
of a dinosaur-filled world.

The game has three connected but separately managed systems:

1.  **Puzzle gameplay** --- swap gems, make matches, create power-ups,
    clear obstacles, and complete objectives.
2.  **Star economy** --- earn stars from completed levels and spend them
    on restoration tasks.
3.  **World restoration** --- visibly transform the environment, unlock
    story beats, choose decorations, and open new regions.

The puzzle provides short-term challenge. Stars connect puzzle wins to
progress. The restored world provides long-term motivation.

## 2. Core player loop

1.  Select and play a match-3 level.
2.  Swap adjacent pieces to make matches.
3.  Create power-ups from qualifying match patterns.
4.  Clear level objectives before running out of moves.
5.  Win the level and receive the level reward.
6.  Return to the restoration map or task journal.
7.  Spend stars on a restoration task.
8.  Watch the environment visibly change.
9.  Unlock the next task, story beat, or area.
10. Repeat.

**Recommended economy rule:** Award one star for completing a standard
level. Do not tie the star reward to leftover moves unless the game
deliberately introduces a separate bonus system. Keep the star reward
predictable and easy to understand.

------------------------------------------------------------------------

# PART A --- MATCH-3 GAMEPLAY

## 3. Board and pieces

### 3.1 Board

-   Use a grid of cells, with some cells blocked or occupied by
    obstacles.
-   Each playable cell contains one gem or special piece.
-   Pieces fall into empty cells after matches are cleared.
-   New pieces spawn from the top or from configured entry points.
-   Some levels can use irregular board shapes, split sections, portals,
    or restricted movement areas.

### 3.2 Six standard gem families

Retain the project's existing six-gem visual identity. The game logic
should identify pieces by a stable colour/type ID, not by their artwork.

Suggested data fields: - `pieceId` - `pieceType` - `colourId` - `row` -
`column` - `isSpecial` - `isMatchable` - `isBlocked`

Keep visual assets separate from the board rules so the art can be
refined without changing gameplay code.

### 3.3 Basic swap rules

-   The player selects a gem and swaps it with an orthogonally adjacent
    gem.
-   A swap is valid only if it creates at least one qualifying match or
    triggers a permitted special-piece interaction.
-   If the swap creates no valid match, animate the pieces back to their
    original positions.
-   After a valid move, resolve matches, special effects, falling
    pieces, refills, and cascades until the board is stable.

------------------------------------------------------------------------

## 4. Match detection and combination shapes

A match-3 game needs to detect horizontal and vertical runs, then
combine overlapping runs into connected groups.

### 4.1 Basic runs

-   Three identical matchable pieces in a row or column: normal match.
-   Four in a row or column: candidate for a line-clearing special.
-   Five or more in a row or column: candidate for a stronger special,
    depending on the game's rules.
-   Intersecting horizontal and vertical runs can form T, L, or
    cross-shaped groups.

### 4.2 Important implementation detail

Do not count the same gem twice when horizontal and vertical runs
intersect. Build a set of unique matched cell coordinates, then
calculate the group size and shape.

For example, a T-shaped group can contain a horizontal run and a
vertical run that share one central cell. The total number of matched
pieces is the number of unique cells, not the sum of the two run
lengths.

### 4.3 Suggested shape classification

After collecting all matched cells, classify the group: -
`StraightHorizontal` - `StraightVertical` - `TShape` - `LShape` -
`CrossShape` - `OtherConnectedGroup`

Also record: - total unique matched pieces - longest horizontal run -
longest vertical run - intersection count - swapped-from cell -
swapped-to cell - whether the group contains a special piece

Use the classification and the swap location to decide where a new
special piece should appear.

------------------------------------------------------------------------

## 5. Creating power-ups from matches

The following is a **proposed tuning table for this game**, not a claim
that every Gardenscapes version uses these exact thresholds or names.
Gardenscapes' exact power-up rules and effects can vary by version and
level. Use this table as a starting point and playtest it.

  -----------------------------------------------------------------------
  Match pattern           Proposed special        Intended role
  ----------------------- ----------------------- -----------------------
  Four in a straight line Firecracker             Small, focused clear

  Five in a T or L shape  Bomb                    Medium area clear

  Six-piece connected     Dynamite                Larger area clear
  group                                           

  Seven or more pieces /  TNT                     High-impact area clear
  special level pattern                           
  -----------------------------------------------------------------------

### 5.1 Firecracker

**Trigger:** Four matching pieces in a straight line.

**Suggested effect:** - Clear a small line or compact area. - Can damage
adjacent breakable obstacles. - Use a short fuse, flash, and satisfying
pop. - Keep the blast readable; do not obscure the whole board.

### 5.2 Bomb

**Trigger:** A qualifying T- or L-shaped group of five unique pieces.

**Suggested effect:** - Explode in a compact radius around its cell. -
Damage or remove eligible nearby obstacles. - Use a heavier impact
animation and slightly larger particle burst than the Firecracker.

### 5.3 Dynamite

**Trigger:** A qualifying six-piece connected group, if this rule is
selected during tuning.

**Suggested effect:** - Clear a larger area than the Bomb. - Add a
stronger shockwave and debris effect. - Ensure the larger blast is still
easy to read on a busy board.

### 5.4 TNT

**Trigger:** A seven-or-more-piece group or a special high-value
pattern, if this rule is selected.

**Suggested effect:** - Create the largest standard explosive clear. -
Use a distinctive object silhouette and sound. - Make its power obvious
before activation.

### 5.5 Avoid ambiguous thresholds

A single straight run of five, a T-shape of five, and a six-piece
connected group are different patterns. Decide explicitly which pattern
creates which special. Do not rely on piece count alone if shape
matters.

A robust rule priority could be: 1. Detect special-piece combinations
first. 2. Detect intersections and high-value shapes. 3. Detect long
straight runs. 4. Apply fallback rules for other connected groups.

The priority must be deterministic so the same board state does not
produce unpredictable results.

------------------------------------------------------------------------

## 6. Power-up placement

When a match creates a special: - Prefer the cell the player moved into,
when it belongs to the matched group. - Otherwise use the intersection
cell for T, L, or cross shapes. - If neither rule applies, use a
documented fallback such as the centre of the longest run. - Keep the
new special on the board while clearing the other matched cells. - Do
not let gravity remove the newly created special before the player can
see it.

This placement rule rewards deliberate moves and makes the result feel
connected to the player's action.

------------------------------------------------------------------------

## 7. Combining existing power-ups

Special-to-special interactions are a major source of surprise and
strategy. Define every pair explicitly in a combination table.

Suggested original-game starting rules:

  -----------------------------------------------------------------------
  Pair                                Suggested result
  ----------------------------------- -----------------------------------
  Firecracker + Firecracker           Two-direction or expanded line
                                      clear

  Firecracker + Bomb                  Larger cross/area blast

  Bomb + Bomb                         Expanded circular blast

  Bomb + Dynamite                     Large combined blast

  Dynamite + TNT                      Very large area clear

  Rainbow + standard gem              Clear all pieces of the selected
                                      colour

  Rainbow + Rainbow                   Clear most or all matchable pieces,
                                      subject to level balance
  -----------------------------------------------------------------------

These are proposed design effects. They are not guaranteed descriptions
of every Gardenscapes build.

### 7.1 Combination implementation

-   Detect the swap of two special pieces before normal match
    resolution.
-   Look up the pair in a data-driven combination table.
-   Trigger one combined effect rather than two unrelated effects where
    appropriate.
-   Prevent the same special from activating repeatedly during one chain
    reaction.
-   Use a chain-resolution queue so effects are processed in a
    predictable order.
-   Apply level-objective damage consistently to every affected cell.

### 7.2 Chain reactions

A blast may activate another special piece. This creates a chain
reaction.

Recommended sequence: 1. Queue the initial special activation. 2.
Determine all affected cells. 3. Damage obstacles and collect
objectives. 4. Add newly hit special pieces to the activation queue. 5.
Resolve queued specials once each. 6. Remove cleared pieces. 7. Apply
gravity and refill. 8. Search for automatic matches. 9. Repeat until the
board is stable.

Add a maximum safety limit for chain depth or activations to prevent
accidental infinite loops.

------------------------------------------------------------------------

## 8. Rainbow / colour-clear special

A colour-clearing special can provide a powerful strategic moment.

Suggested behavior: 1. The player swaps the Rainbow special with a
standard gem. 2. The game identifies the standard gem's colour. 3. All
eligible gems of that colour are cleared. 4. Obstacles affected by those
clears receive damage. 5. Any triggered specials enter the chain queue.
6. Gravity, refill, and cascades resolve.

A second Rainbow special can be designed as a high-impact board clear.
Tune carefully so it does not make difficult levels trivial.

If using a charge meter instead of creating the Rainbow through a match,
define: - what actions add charge - how much charge each action adds -
the charge threshold - whether charge persists between moves or levels -
whether it resets after activation

Do not combine both creation methods unless the rules are clear to the
player.

------------------------------------------------------------------------

## 9. Obstacles and board blockers

Use obstacles to create level variety and force players to think about
where they match.

Suggested prehistoric obstacle families:

  -----------------------------------------------------------------------
  Obstacle                            Suggested behavior
  ----------------------------------- -----------------------------------
  Tar pit                             Occupies cells and may need
                                      adjacent matches or blasts to clear

  Cracked sandstone                   Breaks after one or more hits

  Fossil tile                         Requires clearing nearby pieces to
                                      uncover

  Buried skeleton                     Multi-stage excavation objective

  Vine-covered stone                  Restricts movement or needs
                                      repeated hits

  Ancient crate                       Blocks a cell until damaged

  Lava rock                           Hazard or blocker with a defined
                                      interaction

  Unbreakable rock                    Permanently blocks a cell and
                                      shapes the board
  -----------------------------------------------------------------------

For every obstacle, specify: - whether pieces can occupy it - whether
pieces can move through it - how it receives damage - how many hits it
takes - whether adjacent matches affect it - whether special blasts
affect it - what happens when it is cleared - whether it counts toward
the level objective

Avoid making every obstacle behave identically. A few distinct rules are
more interesting than many cosmetic variants.

------------------------------------------------------------------------

## 10. Level objectives and move limits

Possible objectives: - Collect a target number of fossils. - Clear all
tar. - Break a specified number of stone tiles. - Find dinosaur bones
hidden under tiles. - Drop an artefact to the bottom of the board. -
Clear a path to an excavation item. - Collect a specific gem colour.

Each level should define: - board layout - starting pieces - move
limit - objective types and quantities - obstacle health - special-piece
rules - difficulty target - win and fail conditions

A level is won when all objectives are complete. It is failed when the
move limit is exhausted before completion.

------------------------------------------------------------------------

# PART B --- STARS AND WORLD RESTORATION

## 11. Star reward system

Use a simple, predictable reward: - Win a standard level: earn one
star. - Lose a level: no star. - Stars are added to a persistent player
balance. - Stars are spent on restoration tasks.

Keep stars separate from coins, boosters, event tokens, and premium
currency. Each currency should have a distinct purpose and clear UI.

Suggested UI: - Star icon and current balance on the task journal. -
Star cost shown before a task is confirmed. - A clear insufficient-stars
state. - A short reward animation after winning a level. - A visible
confirmation when stars are spent.

Do not make players guess how many stars a task costs.

------------------------------------------------------------------------

## 12. Restoration task system

The player spends stars to improve the prehistoric world.

Possible tasks: - Remove weeds and fallen branches. - Clear rubble from
ancient paths. - Excavate fossils. - Restore dinosaur skeleton
displays. - Repair bridges and stone steps. - Rebuild an archaeological
camp. - Restore a waterfall or pond. - Plant prehistoric ferns and
trees. - Add lamps, benches, signs, and decorations. - Rebuild an
ancient temple or observatory.

Each task should have: - unique task ID - area ID - title and
description - star cost - prerequisite task IDs - before-state visual -
after-state visual - animation or scene transition - reward/unlock -
completion status

### Example task data

``` json
{
  "taskId": "restore_ancient_fountain_01",
  "areaId": "ancient_jungle",
  "title": "Restore the ancient fountain",
  "description": "Clear the rubble and bring the old fountain back to life.",
  "starCost": 1,
  "prerequisites": [],
  "completionReward": "unlock_fountain_designs",
  "status": "available"
}
```

------------------------------------------------------------------------

## 13. Multi-stage restoration

A large object should be restored over several visible steps rather than
in one instant.

### Example: Ancient fountain

  Stage                        Star cost Visible change
  -------------------------- ----------- ----------------------------------------
  1\. Clear the site                   1 Weeds and debris disappear
  2\. Repair the stonework             2 Cracks and missing pieces are repaired
  3\. Restore the water                1 Water begins flowing and plants appear

**Total example cost: 4 stars.**

The player should see a meaningful improvement after every stage. Each
stage can have: - a short camera move - worker/character animation -
dust and debris particles - construction or repair sound - a
before/after transition - a task-complete celebration

The costs above are illustrative. Balance them against the expected
number of levels between tasks.

------------------------------------------------------------------------

## 14. Task journal and task flow

Create a task journal or restoration tablet that lists available work.

Recommended task states: - `Locked` --- prerequisites are incomplete. -
`Available` --- can be started and paid for. - `InProgress` --- a
multi-stage task has started. - `Completed` --- all stages are finished.

Suggested flow: 1. Player opens the task journal. 2. Available tasks are
highlighted. 3. Player selects a task. 4. The task description and star
cost are shown. 5. Player confirms. 6. Stars are deducted once. 7.
Restoration animation plays. 8. Task state is updated. 9. Next task or
reward becomes available.

Prevent duplicate spending if the player taps the confirmation button
more than once.

------------------------------------------------------------------------

## 15. Decoration choice / design mode

Some restoration tasks can offer two or three visual styles.

Example: a restored fossil park bench: - rustic timber - carved
sandstone - dark bronze and wood

Example: an ancient garden statue: - weathered stone - polished
sandstone - moss-covered ruin

Rules: - Offer choices only where the visual difference is meaningful. -
Show the options before confirming. - Save the selected option to the
player's profile. - Allow the player to see the chosen decoration in the
environment. - Decide whether choices can be changed later, and explain
any cost or restriction.

Decoration choices create ownership and make the restored world feel
personal.

------------------------------------------------------------------------

## 16. Areas, chapters, and world progression

Divide the world into themed areas. Each area contains a sequence of
tasks and story beats.

Suggested original areas:

### Area 1 --- Ancient Jungle

-   Clear the overgrown entrance.
-   Restore the stone path.
-   Uncover the first fossil.
-   Rebuild the expedition camp.
-   Restore a small water feature.

### Area 2 --- Fossil Excavation Site

-   Repair excavation platforms.
-   Uncover a dinosaur skeleton.
-   Rebuild specimen storage.
-   Restore the research tent.
-   Open the route to the next region.

### Area 3 --- Lost Waterfall

-   Clear fallen rocks.
-   Repair a bridge.
-   Restore the waterfall basin.
-   Reveal an ancient carving.
-   Unlock a hidden temple route.

### Area 4 --- Ancient Temple

-   Clear the temple entrance.
-   Restore carved pillars.
-   Repair the central chamber.
-   Discover a major prehistoric artefact.

These are example themes and task sequences. Build the actual map around
the game's story and production scope.

------------------------------------------------------------------------

## 17. Story and character progression

Use restoration to reveal story, not just scenery.

Possible story beats: - Meet the expedition team. - Discover a fossil
that changes the team's theory. - Find an old map or inscription. -
Repair a research station. - Introduce a friendly dinosaur companion, if
appropriate to the game's fiction. - Reveal a new location after a major
restoration milestone.

Keep story scenes short enough that players can return to the puzzle
quickly. Let players revisit important dialogue or story moments through
a journal.

------------------------------------------------------------------------

## 18. Day or chapter completion

Group a set of restoration tasks into a chapter, expedition day, or
project milestone.

When all required tasks in the group are complete: - show a completion
scene - award the planned milestone reward - unlock the next group of
tasks - update the world map - introduce the next story beat

Optional convenience feature: if the player has enough stars to pay for
every remaining task in a chapter, offer a clearly priced "Complete
remaining tasks" action. This should be optional and must show the total
star cost before confirmation.

------------------------------------------------------------------------

# PART C --- RETENTION, REWARDS, AND EVENTS

## 19. Supporting progression systems

These are optional systems to consider after the core puzzle and
restoration loops are working.

### Daily rewards

-   Give a small reward for returning.
-   Use a clearly visible calendar or reward track.
-   Avoid making the reward so large that it damages the core economy.

### Limited-time events

-   Add a separate event objective or event board.
-   Use event-specific tokens or progress.
-   Keep event rewards distinct from the permanent star economy.
-   Make start and end times clear.

### Collections

-   Let players collect fossil sets, artefacts, expedition photographs,
    or dinosaur discoveries.
-   Completing a set can unlock cosmetics, story entries, or
    decorations.

### Boosters

-   Offer pre-level boosters and in-level helpers.
-   Explain each booster's effect before use.
-   Keep booster use separate from the star restoration economy.

### Lives / attempts

-   If the game uses a lives system, explain when a life is consumed and
    how recovery works.
-   Avoid confusing players about whether a failed or exited level costs
    a life.

These systems should support the core loop, not overwhelm a new player
with too many currencies and menus.

------------------------------------------------------------------------

# PART D --- TECHNICAL DESIGN

## 20. Keep the systems modular

Recommended high-level modules:

  Module               Responsibility
  -------------------- -----------------------------------------------
  Board Manager        Grid, cells, swaps, movement
  Match Detector       Horizontal/vertical runs and connected groups
  Special Creator      Chooses and places power-ups
  Special Resolver     Activates special effects and combinations
  Obstacle Manager     Obstacle health and damage
  Gravity / Refill     Drops and spawns pieces
  Level Manager        Objectives, moves, win/fail
  Reward Manager       Grants level rewards
  Star Wallet          Stores and spends stars
  Task Manager         Restoration tasks and prerequisites
  Area Manager         Area and chapter unlocks
  Decoration Manager   Saves selected designs
  Story Manager        Dialogue and story progression
  Save Manager         Persistent player progress

### 20.1 Suggested resolution pipeline

``` text
PLAYER SWAP
    |
    v
CHECK SWAP VALIDITY
    |
    +---- Invalid ----> Animate swap back
    |
    v
DETECT MATCHES
    |
    v
MERGE OVERLAPPING RUNS
    |
    v
CLASSIFY MATCH SHAPE AND SIZE
    |
    v
CHECK SPECIAL-TO-SPECIAL SWAP
    |
    v
CREATE SPECIAL IF QUALIFIED
    |
    v
CLEAR MATCHED CELLS
    |
    v
RESOLVE SPECIAL EFFECT QUEUE
    |
    v
DAMAGE OBSTACLES / UPDATE OBJECTIVES
    |
    v
APPLY GRAVITY AND REFILL
    |
    v
CHECK CASCADE MATCHES
    |
    +---- Matches found ----> Resolve again
    |
    v
CHECK LEVEL WIN / FAIL
    |
    v
GRANT REWARD IF WON
```

### 20.2 Match detection pseudocode

``` csharp
HashSet<Cell> matchedCells = new HashSet<Cell>();

// Scan every row for horizontal runs.
// Scan every column for vertical runs.
// Add every cell in a qualifying run to matchedCells.
// A HashSet prevents intersection cells being counted twice.

var groups = BuildConnectedGroups(matchedCells);

foreach (var group in groups)
{
    var shape = ClassifyShape(group);
    var uniqueCount = group.Count;

    var special = ChooseSpecial(
        shape,
        uniqueCount,
        swappedFrom,
        swappedTo
    );

    if (special != null)
    {
        var spawnCell = ChooseSpecialSpawnCell(
            group,
            shape,
            swappedFrom,
            swappedTo
        );

        QueueSpecialCreation(special, spawnCell);
    }
}
```

This is illustrative pseudocode. `BuildConnectedGroups`,
`ClassifyShape`, `ChooseSpecial`, and `ChooseSpecialSpawnCell` need to
be implemented and tested for the game's board rules.

### 20.3 Star wallet pseudocode

``` csharp
public class StarWallet
{
    public int Balance { get; private set; }

    public void AddStars(int amount)
    {
        if (amount <= 0) return;

        Balance += amount;
        SaveBalance();
    }

    public bool CanAfford(int cost)
    {
        return cost >= 0 && Balance >= cost;
    }

    public bool SpendStars(int cost)
    {
        if (cost <= 0 || Balance < cost)
            return false;

        Balance -= cost;
        SaveBalance();
        return true;
    }

    private void SaveBalance()
    {
        // Persist the updated balance using the game's save system.
    }
}
```

In production, make star spending transactional with task-state updates.
The same purchase must not deduct stars twice if the player taps
repeatedly, loses connection, or reloads during the animation.

------------------------------------------------------------------------

## 21. Data-driven power-up configuration

Keep power-up rules in data rather than hard-coding every effect into
the board controller.

Example configuration:

``` json
{
  "powerUps": [
    {
      "id": "firecracker",
      "displayName": "Firecracker",
      "creationRule": "four_in_line",
      "effectType": "small_area_clear"
    },
    {
      "id": "bomb",
      "displayName": "Bomb",
      "creationRule": "five_t_shape_or_l_shape",
      "effectType": "medium_area_clear"
    },
    {
      "id": "dynamite",
      "displayName": "Dynamite",
      "creationRule": "six_piece_connected_group",
      "effectType": "large_area_clear"
    },
    {
      "id": "tnt",
      "displayName": "TNT",
      "creationRule": "seven_or_more_or_special_pattern",
      "effectType": "very_large_area_clear"
    }
  ]
}
```

This is a starting configuration. Tune creation rules and blast
footprints through playtesting. Make the actual blast cells explicit in
level/game data rather than assuming that a radius behaves correctly
around board edges or blocked cells.

------------------------------------------------------------------------

# PART E --- ART DIRECTION AND FEEDBACK

## 22. Visual direction

Target a **refined, premium fantasy-adventure look**, not an exaggerated
children's cartoon style.

### Environment

-   Natural painted tropical foliage.
-   Layered jungle depth and atmospheric perspective.
-   Dark rock walls, warm sunlight, and restrained volumetric rays.
-   Glowing lava seams in volcanic rocks.
-   Moss, dirt, weathering, and subtle surface variation.

### UI materials

-   Aged wood with believable grain.
-   Carved sandstone and weathered grey stone.
-   Restrained bronze or dark-metal accents.
-   Vines used as framing details, not as decoration on every edge.
-   Soft, realistic shadows and warm highlights.
-   Thick enough outlines for mobile readability, but avoid overly
    inflated cartoon forms.

### Board

-   Cream sandstone tiles with subtle bevels.
-   Dark tar with a wet, textured finish.
-   Cracked stone and fossil reliefs.
-   Clear separation between playable cells and blockers.

### Gems

-   Preserve the existing six-gem visual identity.
-   Use polished jewel-like materials and crisp silhouettes.
-   Keep colour and shape distinct for quick recognition.
-   Do not redesign the gems when refining the surrounding UI.

### Animation and effects

Implement motion in code where possible: - gentle leaf sway -
multi-layer parallax - subtle lava glow and flicker - floating dust and
pollen - restrained gem glints - impact shake for larger explosions -
debris particles for cracked stone - soft highlights around selected
cells

Use animation to communicate gameplay state, not just to decorate the
screen.

------------------------------------------------------------------------

## 23. Feedback and game feel

Every action should have clear feedback.

  -----------------------------------------------------------------------
  Action                  Visual feedback         Audio/feel
  ----------------------- ----------------------- -----------------------
  Select a gem            Soft outline or lift    Light selection tick

  Valid swap              Smooth movement         Gem movement sound

  Invalid swap            Pieces return           Gentle rejection sound

  Normal match            Gem pop and particles   Crisp match sound

  Create special          Brief spotlight and     Distinct creation cue
                          reveal                  

  Activate Bomb           Expanding blast and     Low, satisfying impact
                          debris                  

  Break stone             Cracks progress, then   Stone fracture sound
                          crumble                 

  Collect fossil          Fossil lifts toward     Discovery chime
                          counter                 

  Win level               Board celebration and   Victory cue
                          reward                  

  Earn star               Star flies into counter Reward sparkle

  Restore object          Before/after            Construction and
                          transformation          completion sounds
  -----------------------------------------------------------------------

Keep effects short and legible. Avoid covering important board
information with particles or long animations.

------------------------------------------------------------------------

# PART F --- ECONOMY AND BALANCE

## 24. Star economy planning

Before building many restoration tasks, calculate how quickly players
earn and spend stars.

Track: - average levels completed per session - average time between
restoration tasks - star cost per task - total stars required per area -
expected number of levels per area - whether players can save stars -
how many tasks are available at once

Example economy (illustrative only):

  Item                                     Example value
  ------------------------------------- ----------------
  Stars earned per standard level win                  1
  Small task                                      1 star
  Medium task                                    2 stars
  Large task                                  3--5 stars
  Multi-stage restoration                 4+ stars total

Do not set every task to the same cost. Vary costs based on the
perceived scale of the visual improvement, while keeping the economy
predictable.

## 25. Difficulty and fairness

-   Teach one new obstacle or mechanic at a time.
-   Introduce each special piece in a safe, understandable level.
-   Avoid requiring a rare power-up before teaching how it works.
-   Ensure the board has valid moves.
-   Detect dead boards and reshuffle fairly.
-   Make objective progress visible.
-   Make the move limit understandable.
-   Test levels with and without boosters.
-   Avoid relying on random cascades as the only viable solution.

------------------------------------------------------------------------

# PART G --- MVP IMPLEMENTATION PLAN

## 26. Build order

### Phase 1 --- Core puzzle

-   Six standard gem types.
-   Grid and swap logic.
-   Horizontal and vertical match detection.
-   Overlapping-run merging.
-   Gravity and refill.
-   Move counter.
-   Basic level objectives.
-   Win/fail flow.

### Phase 2 --- Special pieces

-   Four-in-line special.
-   T/L-shape special.
-   Larger-group special rules.
-   Special placement.
-   Special-to-special combinations.
-   Chain reaction queue.
-   Obstacle damage.

### Phase 3 --- Star progression

-   One-star level reward.
-   Persistent star wallet.
-   Star counter UI.
-   Task journal.
-   Star spending and confirmation.
-   Save/load and duplicate-spend protection.

### Phase 4 --- Restoration world

-   One starter area.
-   A sequence of restoration tasks.
-   Multi-stage object restoration.
-   Before/after visual states.
-   Task prerequisites.
-   Area completion.

### Phase 5 --- Personalization and story

-   Decoration choices.
-   Character dialogue.
-   Story milestones.
-   New area unlocks.
-   Collection system.

### Phase 6 --- Live content and polish

-   Daily rewards.
-   Events.
-   Optional boosters.
-   Sound and VFX polish.
-   Analytics and economy balancing.
-   Accessibility and device-performance testing.

------------------------------------------------------------------------

# PART H --- TEST CHECKLIST

## 27. Match and power-up tests

-   [ ] Three-in-line clears normally.
-   [ ] Four-in-line creates the intended special.
-   [ ] T-shape is detected correctly.
-   [ ] L-shape is detected correctly.
-   [ ] Cross/intersection cells are counted once.
-   [ ] Five- and six-piece groups follow the configured rules.
-   [ ] Seven-or-more groups follow the configured rules.
-   [ ] Special spawns in the intended cell.
-   [ ] Special combinations trigger the correct effect.
-   [ ] A special activates at most once per chain.
-   [ ] Chain reactions terminate safely.
-   [ ] Board refills and cascades resolve correctly.
-   [ ] No-match swaps return to their original positions.
-   [ ] No valid moves triggers a fair reshuffle.

## 28. Level tests

-   [ ] Every objective can be completed.
-   [ ] Obstacles receive the correct damage.
-   [ ] Move count decreases at the correct time.
-   [ ] Win condition triggers immediately when objectives are complete.
-   [ ] Fail condition triggers only when appropriate.
-   [ ] Reward is granted once.
-   [ ] Retry and exit behavior are consistent.

## 29. Star and restoration tests

-   [ ] A won level grants exactly the configured reward.
-   [ ] A failed level grants no standard win star.
-   [ ] Star balance persists after restarting.
-   [ ] Insufficient stars prevent task purchase.
-   [ ] Stars are deducted only once.
-   [ ] Task completion persists.
-   [ ] Prerequisites lock and unlock tasks correctly.
-   [ ] Multi-stage restoration resumes at the correct stage.
-   [ ] Decoration choice persists.
-   [ ] Area unlocks happen at the correct milestone.

------------------------------------------------------------------------

# 30. Key design principles

1.  **Keep the puzzle and restoration systems separate but connected by
    stars.**
2.  **Make every special-piece rule deterministic and easy to learn.**
3.  **Count unique matched cells, especially in T, L, and cross
    formations.**
4.  **Use data-driven power-up rules so tuning does not require
    rewriting board logic.**
5.  **Make explosions and chain reactions satisfying but readable.**
6.  **Give every star a visible purpose in the restored world.**
7.  **Show meaningful environmental progress after each restoration
    stage.**
8.  **Use decoration choices to create player ownership.**
9.  **Introduce obstacles and systems gradually.**
10. **Build an original prehistoric identity rather than copying another
    game's presentation.**

## Suggested first playable version

For a focused prototype, build: - one match-3 board - six existing gem
types - normal matches plus four special creation patterns - three
obstacle types: tar, cracked stone, and fossil - 10--20 test levels -
one star for each completed level - one restoration area with 5--8
tasks - one multi-stage restoration object - one optional decoration
choice

This is enough to test whether the core loop --- **solve a puzzle, earn
a star, improve the world** --- is enjoyable before investing in a large
campaign.
