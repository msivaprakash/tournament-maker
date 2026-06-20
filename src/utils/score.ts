import type {MatchScore} from '../types';

export function isValidBadmintonScore(scoreA: number, scoreB: number): boolean {
  if (scoreA < 0 || scoreB < 0) return false;
  if (scoreA > 30 || scoreB > 30) return false;
  if (scoreA === scoreB) return false;
  const max = Math.max(scoreA, scoreB);
  const min = Math.min(scoreA, scoreB);
  if (max < 21) return false;
  if (max === 21) return min <= 19;
  // Deuce: scores above 21 mean both players passed 20, so loser must be exactly max - 2
  if (max < 30) return max - min === 2;
  if (max === 30) return min === 29;
  return false;
}

export function scoreFromInputs(a: number, b: number): MatchScore | null {
  if (!isValidBadmintonScore(a, b)) return null;
  return {teamA: a, teamB: b, winner: a > b ? 'A' : 'B'};
}

export const QUICK_SCORES: [number, number][] = [
  [21, 12], [21, 15], [21, 18], [21, 19],
];
