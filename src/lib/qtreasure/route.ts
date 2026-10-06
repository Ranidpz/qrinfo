/**
 * Q.Treasure per-player route ("the matrix").
 *
 * In 'perPlayer' mode each player gets their own crypto-shuffled ordering of the
 * SAME physical stations, so two players standing at one station are at different
 * points in their own routes — copying doesn't help, and a replay gets a fresh
 * order. In 'fixed' mode the route is just the stations in their configured order
 * (fully backward compatible).
 *
 * Server-only (uses Node crypto). Import from API routes only.
 */

import crypto from 'crypto';
import { QTreasureConfig, QTreasurePlayer, QTreasureStation } from '@/types/qtreasure';

/** Active stations sorted by their configured order. */
export function activeStationsInOrder(config: QTreasureConfig): QTreasureStation[] {
  return config.stations
    .filter((s) => s.isActive)
    .sort((a, b) => a.order - b.order);
}

/**
 * Build a route (ordered station IDs) for a new player / a replay.
 * Fixed mode → natural order. perPlayer mode → crypto-shuffled (Fisher–Yates,
 * `crypto.randomInt` per project convention — never Math.random).
 */
export function buildRouteSeq(config: QTreasureConfig): string[] {
  const ids = activeStationsInOrder(config).map((s) => s.id);
  if (config.routeMode !== 'perPlayer') return ids;
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/**
 * Resolve a player's effective route + current position, with a fallback for
 * legacy players created before per-player routes existed (derive a fixed route
 * from station.order and take routeIndex from the old currentStationIndex).
 */
export function resolvePlayerRoute(
  player: Pick<QTreasurePlayer, 'routeSeq' | 'routeIndex' | 'currentStationIndex'>,
  config: QTreasureConfig
): { routeSeq: string[]; routeIndex: number } {
  const routeSeq =
    player.routeSeq && player.routeSeq.length
      ? player.routeSeq
      : activeStationsInOrder(config).map((s) => s.id);
  const routeIndex =
    typeof player.routeIndex === 'number'
      ? player.routeIndex
      : player.currentStationIndex ?? 0;
  return { routeSeq, routeIndex };
}

export function stationById(
  config: QTreasureConfig,
  id: string | undefined
): QTreasureStation | undefined {
  if (!id) return undefined;
  return config.stations.find((s) => s.isActive && s.id === id);
}

/** The station a player should scan next (or undefined if their route is done). */
export function currentTargetStation(
  player: Pick<QTreasurePlayer, 'routeSeq' | 'routeIndex' | 'currentStationIndex'>,
  config: QTreasureConfig
): QTreasureStation | undefined {
  const { routeSeq, routeIndex } = resolvePlayerRoute(player, config);
  return stationById(config, routeSeq[routeIndex]);
}
