import {describe, it, expect} from 'vitest';
import {isValidBadmintonScore, scoreFromInputs, QUICK_SCORES} from './score';

describe('isValidBadmintonScore', () => {
  it('accepts standard 21-point wins', () => {
    expect(isValidBadmintonScore(21, 12)).toBe(true);
    expect(isValidBadmintonScore(21, 19)).toBe(true);
    expect(isValidBadmintonScore(21, 0)).toBe(true);
  });

  it('accepts deuce wins (exactly +2)', () => {
    expect(isValidBadmintonScore(22, 20)).toBe(true);
    expect(isValidBadmintonScore(25, 23)).toBe(true);
    expect(isValidBadmintonScore(29, 27)).toBe(true);
  });

  it('rejects impossible deuce scores (gap > 2 above 21)', () => {
    expect(isValidBadmintonScore(25, 20)).toBe(false);
    expect(isValidBadmintonScore(28, 22)).toBe(false);
    expect(isValidBadmintonScore(23, 20)).toBe(false);
  });

  it('accepts 30-29 cap', () => {
    expect(isValidBadmintonScore(30, 29)).toBe(true);
    expect(isValidBadmintonScore(29, 30)).toBe(true);
  });

  it('rejects scores below 21', () => {
    expect(isValidBadmintonScore(20, 18)).toBe(false);
    expect(isValidBadmintonScore(15, 10)).toBe(false);
  });

  it('rejects ties', () => {
    expect(isValidBadmintonScore(21, 21)).toBe(false);
    expect(isValidBadmintonScore(0, 0)).toBe(false);
  });

  it('rejects win by 1 (not at 30)', () => {
    expect(isValidBadmintonScore(21, 20)).toBe(false);
    expect(isValidBadmintonScore(25, 24)).toBe(false);
  });

  it('rejects scores above 30', () => {
    expect(isValidBadmintonScore(31, 29)).toBe(false);
    expect(isValidBadmintonScore(32, 30)).toBe(false);
  });

  it('rejects negative scores', () => {
    expect(isValidBadmintonScore(-1, 21)).toBe(false);
    expect(isValidBadmintonScore(21, -5)).toBe(false);
  });
});

describe('scoreFromInputs', () => {
  it('returns MatchScore with correct winner', () => {
    const result = scoreFromInputs(21, 15);
    expect(result).toEqual({teamA: 21, teamB: 15, winner: 'A'});
  });

  it('assigns winner B when B has more', () => {
    const result = scoreFromInputs(18, 21);
    expect(result).toEqual({teamA: 18, teamB: 21, winner: 'B'});
  });

  it('returns null for invalid scores', () => {
    expect(scoreFromInputs(20, 18)).toBeNull();
    expect(scoreFromInputs(21, 20)).toBeNull();
  });
});

describe('QUICK_SCORES', () => {
  it('contains valid score pairs', () => {
    for (const [a, b] of QUICK_SCORES) {
      expect(isValidBadmintonScore(a, b)).toBe(true);
    }
  });
});
