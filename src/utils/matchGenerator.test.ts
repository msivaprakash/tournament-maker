import {describe, it, expect} from 'vitest';
import {generateMatches, computeFairnessReport} from './matchGenerator';

describe('generateMatches', () => {
  const teamA = ['p1', 'p2', 'p3'];
  const teamB = ['p4', 'p5', 'p6'];

  it('generates matches with correct structure', () => {
    const matches = generateMatches({teamA, teamB, matchesPerPlayer: 1, courts: 1});
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      expect(m.teamAIds).toHaveLength(2);
      expect(m.teamBIds).toHaveLength(2);
      expect(m.status).toBe('pending');
      expect(m.round).toBeGreaterThan(0);
      expect(m.court).toBeGreaterThan(0);
    }
  });

  it('ensures every player plays at least matchesPerPlayer times', () => {
    const matches = generateMatches({teamA, teamB, matchesPerPlayer: 2, courts: 1, randomness: 100});
    const counts: Record<string, number> = {};
    [...teamA, ...teamB].forEach(id => counts[id] = 0);
    matches.forEach(m => {
      [...m.teamAIds, ...m.teamBIds].forEach(id => counts[id]++);
    });
    for (const id of [...teamA, ...teamB]) {
      expect(counts[id]).toBeGreaterThanOrEqual(2);
    }
  });

  it('does not let any player exceed matchesPerPlayer + 1', () => {
    const matches = generateMatches({teamA, teamB, matchesPerPlayer: 2, courts: 2});
    const counts: Record<string, number> = {};
    [...teamA, ...teamB].forEach(id => counts[id] = 0);
    matches.forEach(m => {
      [...m.teamAIds, ...m.teamBIds].forEach(id => counts[id]++);
    });
    for (const id of [...teamA, ...teamB]) {
      expect(counts[id]).toBeLessThanOrEqual(3);
    }
  });

  it('respects court count (no more than N matches per round)', () => {
    const matches = generateMatches({teamA, teamB, matchesPerPlayer: 2, courts: 2});
    const roundCounts: Record<number, number> = {};
    matches.forEach(m => {
      roundCounts[m.round] = (roundCounts[m.round] || 0) + 1;
    });
    for (const count of Object.values(roundCounts)) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('ensures no player plays twice in same round', () => {
    const matches = generateMatches({teamA, teamB, matchesPerPlayer: 2, courts: 3});
    const roundPlayers: Record<number, Set<string>> = {};
    matches.forEach(m => {
      if (!roundPlayers[m.round]) roundPlayers[m.round] = new Set();
      for (const id of [...m.teamAIds, ...m.teamBIds]) {
        expect(roundPlayers[m.round].has(id)).toBe(false);
        roundPlayers[m.round].add(id);
      }
    });
  });

  it('team A players are always in teamAIds', () => {
    const matches = generateMatches({teamA, teamB, matchesPerPlayer: 1, courts: 1});
    for (const m of matches) {
      expect(teamA).toContain(m.teamAIds[0]);
      expect(teamA).toContain(m.teamAIds[1]);
      expect(teamB).toContain(m.teamBIds[0]);
      expect(teamB).toContain(m.teamBIds[1]);
    }
  });

  it('returns empty array if less than 2 players per team', () => {
    expect(generateMatches({teamA: ['p1'], teamB: ['p2', 'p3'], matchesPerPlayer: 1, courts: 1})).toEqual([]);
    expect(generateMatches({teamA: ['p1', 'p2'], teamB: ['p3'], matchesPerPlayer: 1, courts: 1})).toEqual([]);
  });

  it('same seed produces same schedule', () => {
    const opts = {teamA, teamB, matchesPerPlayer: 2, courts: 1, seed: 'test123'};
    const a = generateMatches(opts);
    const b = generateMatches(opts);
    expect(a).toEqual(b);
  });

  it('different seeds produce different schedules', () => {
    const base = {teamA, teamB, matchesPerPlayer: 2, courts: 1, randomness: 100};
    const a = generateMatches({...base, seed: 'seed-A'});
    const b = generateMatches({...base, seed: 'seed-B'});
    const aIds = a.map(m => m.teamAIds.join(',')).join('|');
    const bIds = b.map(m => m.teamAIds.join(',')).join('|');
    expect(aIds).not.toEqual(bIds);
  });
});

describe('computeFairnessReport', () => {
  it('reports balanced when all players have equal matches', () => {
    const teamA = ['p1', 'p2'];
    const teamB = ['p3', 'p4'];
    const matches = generateMatches({teamA, teamB, matchesPerPlayer: 1, courts: 1});
    const report = computeFairnessReport(matches, [...teamA, ...teamB]);
    expect(report.fair).toBe(true);
    expect(report.max - report.min).toBeLessThanOrEqual(1);
  });

  it('excludes cancelled matches from counts', () => {
    const teamA = ['p1', 'p2'];
    const teamB = ['p3', 'p4'];
    const matches = generateMatches({teamA, teamB, matchesPerPlayer: 1, courts: 1});
    matches[0].status = 'cancelled';
    const report = computeFairnessReport(matches, [...teamA, ...teamB]);
    const total = Object.values(report.counts).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(matches.length * 4);
  });

  it('tracks partner and opponent repeats', () => {
    const teamA = ['p1', 'p2', 'p3'];
    const teamB = ['p4', 'p5', 'p6'];
    const matches = generateMatches({teamA, teamB, matchesPerPlayer: 3, courts: 1});
    const report = computeFairnessReport(matches, [...teamA, ...teamB]);
    expect(report.partnerCounts).toBeDefined();
    expect(report.opponentCounts).toBeDefined();
    expect(typeof report.worstPartnerRepeat).toBe('number');
    expect(typeof report.worstOpponentRepeat).toBe('number');
  });
});
