// ============ Frogger Game Engine ============
// Pure functions for deterministic enemy generation and collision detection.
// All clients use the same seed to generate identical enemy patterns.

// =============================================================
// Seeded PRNG (Mulberry32)
// =============================================================

/** Deterministic PRNG - returns values in [0, 1) */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =============================================================
// Types
// =============================================================

export interface FroggerLane {
  direction: 'left' | 'right';
  speed: number;          // pixels per second (at baseSpeed=1 viewport width)
  color: string;
  enemies: FroggerEnemyDef[];
  cycleLength: number;    // in viewport widths (for wrapping)
}

export interface FroggerEnemyDef {
  /** Starting offset in pixels from the spawn edge */
  offset: number;
  /** Width as fraction of viewport width (0.15 - 0.35) */
  widthFrac: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridDimensions {
  viewportWidth: number;
  viewportHeight: number;
  rows: number;         // total rows including safe zones
  rowHeight: number;
}

// =============================================================
// Constants
// =============================================================

export const ENEMY_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#EF4444', '#F59E0B', '#10B981', '#3B82F6'];
export const TOTAL_ROWS = 7;        // bottom safe + 5 lanes + top safe
export const SAFE_ROW_BOTTOM = 0;
export const SAFE_ROW_TOP = 6;

/** Player base size as fraction of row height */
export const PLAYER_BASE_SIZE = 0.6;

// =============================================================
// Lane & Enemy Generation
// =============================================================

/**
 * Generate lane configurations from seed with progressive difficulty.
 * difficulty=0 is very easy (few slow enemies), increases each screen completed.
 * The seed+difficulty combo keeps it deterministic across all clients.
 */
export function generateLanes(seed: number, laneCount: number, baseSpeed: number, difficulty: number = 0): FroggerLane[] {
  // Use seed + difficulty so each level has different but deterministic patterns
  const rng = mulberry32(seed + difficulty * 7919);
  const lanes: FroggerLane[] = [];

  // Progressive scaling (capped)
  const d = Math.min(difficulty, 10);
  // Speed: starts very slow, ramps up gradually
  const speedMin = 0.12 + d * 0.04;           // 0.12 → 0.52
  const speedMax = 0.25 + d * 0.05;           // 0.25 → 0.75
  // Enemy count: starts 1-2, ramps to 3-5
  const enemyMin = 1 + Math.floor(d * 0.2);   // 1 → 3
  const enemyMax = 2 + Math.floor(d * 0.3);   // 2 → 5
  // Enemy width: starts small, grows
  const widthMin = 0.10 + d * 0.01;           // 0.10 → 0.20
  const widthRange = 0.10 + d * 0.01;         // 0.10 → 0.20
  // Cycle length: starts large (lots of gaps), shrinks
  const cycleLength = Math.max(2.5, 4.0 - d * 0.15); // 4.0 → 2.5

  for (let i = 0; i < laneCount; i++) {
    const direction: 'left' | 'right' = rng() > 0.5 ? 'right' : 'left';
    const speedMultiplier = speedMin + rng() * (speedMax - speedMin);
    const speed = baseSpeed * speedMultiplier * 60;

    const color = ENEMY_COLORS[i % ENEMY_COLORS.length];

    const enemyCount = enemyMin + Math.floor(rng() * (enemyMax - enemyMin + 1));
    const enemies: FroggerEnemyDef[] = [];

    const segmentSize = cycleLength / enemyCount;
    for (let j = 0; j < enemyCount; j++) {
      const widthFrac = widthMin + rng() * widthRange;
      const jitter = rng() * segmentSize * 0.5;
      const offset = (j * segmentSize + jitter);
      enemies.push({ offset, widthFrac });
    }

    lanes.push({ direction, speed, color, enemies, cycleLength });
  }

  return lanes;
}

// =============================================================
// Enemy Position Computation
// =============================================================

export interface EnemyPosition {
  laneIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/**
 * Compute all visible enemy positions at a given elapsed time.
 * Enemies wrap around endlessly (modular arithmetic).
 */
export function getEnemyPositions(
  lanes: FroggerLane[],
  elapsedMs: number,
  grid: GridDimensions
): EnemyPosition[] {
  const { viewportWidth, rowHeight } = grid;
  const elapsed = elapsedMs / 1000; // seconds
  const positions: EnemyPosition[] = [];

  for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
    const lane = lanes[laneIdx];
    const laneRow = laneIdx + 1; // row 0 is safe zone, lanes start at row 1
    const y = (TOTAL_ROWS - 1 - laneRow) * rowHeight; // top-down: row 6 = top
    const h = rowHeight * 0.55; // enemy height = 55% of row
    const yOffset = (rowHeight - h) / 2; // center vertically in row

    // Speed in actual pixels/sec
    const pxPerSec = (lane.speed / 100) * viewportWidth;
    const totalTravel = elapsed * pxPerSec;

    // Cycle length in px (from lane config)
    const cyclePx = lane.cycleLength * viewportWidth;

    for (const enemy of lane.enemies) {
      const w = enemy.widthFrac * viewportWidth;
      const startOffset = enemy.offset * viewportWidth;

      let x: number;
      if (lane.direction === 'right') {
        // Spawn from left, move right
        x = ((startOffset + totalTravel) % cyclePx) - w;
      } else {
        // Spawn from right, move left
        x = viewportWidth - ((startOffset + totalTravel) % cyclePx);
      }

      // Only include if visible on screen (with margin)
      if (x + w > -w && x < viewportWidth + w) {
        positions.push({
          laneIndex: laneIdx,
          x,
          y: y + yOffset,
          w,
          h,
          color: lane.color,
        });
      }
    }
  }

  return positions;
}

// =============================================================
// Player Position
// =============================================================

/**
 * Get player rect for collision detection.
 * Player is centered in their assigned column within their current row.
 */
export function getPlayerRect(
  row: number,
  column: number,
  sizeMultiplier: number,
  grid: GridDimensions,
  totalColumns: number
): Rect {
  const { viewportWidth, rowHeight } = grid;
  const colWidth = viewportWidth / totalColumns;
  const baseSize = rowHeight * PLAYER_BASE_SIZE;
  const size = baseSize * sizeMultiplier;

  // Center in column
  const x = column * colWidth + (colWidth - size) / 2;
  // Center in row (top-down, row 0 = bottom)
  const y = (TOTAL_ROWS - 1 - row) * rowHeight + (rowHeight - size) / 2;

  return { x, y, w: size, h: size };
}

// =============================================================
// Collision Detection
// =============================================================

/** AABB collision check */
export function checkCollision(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Check if player collides with any enemy.
 * Uses a slightly smaller hitbox (80% of visual) for forgiving gameplay.
 */
export function checkPlayerEnemyCollision(
  playerRect: Rect,
  enemies: EnemyPosition[]
): boolean {
  // Shrink player hitbox by 20% for forgiveness
  const margin = playerRect.w * 0.1;
  const shrunk: Rect = {
    x: playerRect.x + margin,
    y: playerRect.y + margin,
    w: playerRect.w - margin * 2,
    h: playerRect.h - margin * 2,
  };

  for (const enemy of enemies) {
    if (checkCollision(shrunk, { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h })) {
      return true;
    }
  }
  return false;
}

// =============================================================
// Column Assignment
// =============================================================

/** Assign columns to players (spread evenly) */
export function assignColumns(playerCount: number, totalColumns: number): number[] {
  if (playerCount === 1) return [Math.floor(totalColumns / 2)];
  if (playerCount === 2) return [1, totalColumns - 2];
  if (playerCount === 3) return [0, Math.floor(totalColumns / 2), totalColumns - 1];
  // 4 players
  const step = totalColumns / 4;
  return [
    Math.floor(step * 0.5),
    Math.floor(step * 1.5),
    Math.floor(step * 2.5),
    Math.floor(step * 3.5),
  ];
}

/** Get total columns based on viewport */
export function getTotalColumns(): number {
  return 5; // Fixed 5 columns
}
