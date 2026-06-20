import type {Match} from '../types';

interface GenerateOptions {
  teamA: string[];
  teamB: string[];
  matchesPerPlayer: number;
  courts: number;
  seed?: string;
  randomness?: number;
}

function seededRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateMatches(options: GenerateOptions): Match[] {
  const {teamA, teamB, matchesPerPlayer, courts, seed, randomness = 30} = options;
  const baseSeed =
    seed || `${teamA.join('')}${teamB.join('')}${matchesPerPlayer}${courts}`;
  const rng = seededRng(baseSeed);

  if (teamA.length < 2 || teamB.length < 2) return [];

  const allPlayers = [...teamA, ...teamB];

  // Generate all possible partner pairs for each team
  const pairsA = getPairs(teamA);
  const pairsB = getPairs(teamB);

  // Determine how many matches we need.
  // Each match uses 2 from A and 2 from B, so:
  //   totalMatches * 2 >= teamA.length * matchesPerPlayer
  //   totalMatches * 2 >= teamB.length * matchesPerPlayer
  const totalMatchesFromA = Math.ceil((teamA.length * matchesPerPlayer) / 2);
  const totalMatchesFromB = Math.ceil((teamB.length * matchesPerPlayer) / 2);
  const targetMatches = Math.max(totalMatchesFromA, totalMatchesFromB);

  // Track opponent encounter counts (A player -> B player -> count)
  const opponentCount: Record<string, Record<string, number>> = {};
  for (const a of teamA) {
    opponentCount[a] = {};
    for (const b of teamB) {
      opponentCount[a][b] = 0;
    }
  }

  // Track partner counts within each team
  const partnerCountA: Record<string, Record<string, number>> = {};
  for (const a of teamA) {
    partnerCountA[a] = {};
    for (const a2 of teamA) {
      if (a !== a2) partnerCountA[a][a2] = 0;
    }
  }
  const partnerCountB: Record<string, Record<string, number>> = {};
  for (const b of teamB) {
    partnerCountB[b] = {};
    for (const b2 of teamB) {
      if (b !== b2) partnerCountB[b][b2] = 0;
    }
  }

  // Track play counts per player
  const playCounts: Record<string, number> = {};
  allPlayers.forEach(id => (playCounts[id] = 0));

  const selected: {a: [string, string]; b: [string, string]}[] = [];

  // Scoring function: lower is better.
  // Considers opponent balance (sum of encounter counts for the 4 cross-team pairs)
  // and partner balance (weighted partner repeat counts).
  function scoreCombo(aPair: [string, string], bPair: [string, string]): number {
    let score = 0;
    // Opponent encounters
    for (const a of aPair) {
      for (const b of bPair) {
        score += opponentCount[a][b];
      }
    }
    // Partner repeats (weighted higher to prioritize partner diversity)
    score += partnerCountA[aPair[0]][aPair[1]] * 2;
    score += partnerCountB[bPair[0]][bPair[1]] * 2;
    return score;
  }

  // Main greedy selection loop with fairness-aware scoring
  for (let iter = 0; iter < targetMatches; iter++) {
    if (allPlayers.every(id => playCounts[id] >= matchesPerPlayer)) break;

    // Build candidate list
    type Combo = {a: [string, string]; b: [string, string]; score: number};
    const candidates: Combo[] = [];

    for (const aPair of pairsA) {
      if (aPair.some(id => playCounts[id] > matchesPerPlayer)) continue;
      const aNeedy = aPair.some(id => playCounts[id] < matchesPerPlayer);

      for (const bPair of pairsB) {
        if (bPair.some(id => playCounts[id] > matchesPerPlayer)) continue;
        const bNeedy = bPair.some(id => playCounts[id] < matchesPerPlayer);
        if (!aNeedy && !bNeedy) continue;

        const score = scoreCombo(aPair, bPair);
        candidates.push({a: aPair, b: bPair, score});
      }
    }

    if (candidates.length === 0) break;

    // Sort by score ascending (best first)
    candidates.sort((x, y) => x.score - y.score);

    // Pick from top candidates based on randomness parameter
    let pickIndex: number;
    if (randomness === 0) {
      pickIndex = 0;
    } else {
      const windowFraction = randomness / 100;
      const bestScore = candidates[0].score;
      // Allow candidates within a tolerance of the best score
      const tolerance = Math.ceil(windowFraction * 4);
      let eligibleEnd = 0;
      for (let i = 0; i < candidates.length; i++) {
        if (candidates[i].score <= bestScore + tolerance) {
          eligibleEnd = i + 1;
        } else {
          break;
        }
      }
      const windowSize = Math.max(1, Math.ceil(candidates.length * windowFraction));
      const effectiveWindow = Math.max(
        eligibleEnd,
        Math.min(windowSize, candidates.length),
      );
      pickIndex = Math.floor(rng() * effectiveWindow);
    }

    const chosen = candidates[pickIndex];

    // Record the selection
    selected.push({a: chosen.a, b: chosen.b});
    for (const a of chosen.a) {
      for (const b of chosen.b) {
        opponentCount[a][b]++;
      }
    }
    partnerCountA[chosen.a[0]][chosen.a[1]]++;
    partnerCountA[chosen.a[1]][chosen.a[0]]++;
    partnerCountB[chosen.b[0]][chosen.b[1]]++;
    partnerCountB[chosen.b[1]][chosen.b[0]]++;
    for (const id of [...chosen.a, ...chosen.b]) {
      playCounts[id]++;
    }
  }

  // Extra pass: if some players still haven't met their matchesPerPlayer quota
  let extraAttempts = 0;
  const maxExtraAttempts = targetMatches;
  while (extraAttempts < maxExtraAttempts) {
    const unmet = allPlayers.filter(id => playCounts[id] < matchesPerPlayer);
    if (unmet.length === 0) break;

    type Combo = {a: [string, string]; b: [string, string]; score: number};
    const candidates: Combo[] = [];

    for (const aPair of pairsA) {
      if (aPair.every(id => playCounts[id] >= matchesPerPlayer + 1)) continue;
      const aHasNeedy = aPair.some(id => playCounts[id] < matchesPerPlayer);

      for (const bPair of pairsB) {
        if (bPair.every(id => playCounts[id] >= matchesPerPlayer + 1)) continue;
        const bHasNeedy = bPair.some(id => playCounts[id] < matchesPerPlayer);
        if (!aHasNeedy && !bHasNeedy) continue;

        const score = scoreCombo(aPair, bPair);
        candidates.push({a: aPair, b: bPair, score});
      }
    }

    if (candidates.length === 0) break;

    candidates.sort((x, y) => x.score - y.score);
    const chosen = candidates[Math.floor(rng() * Math.min(3, candidates.length))];

    selected.push({a: chosen.a, b: chosen.b});
    for (const a of chosen.a) {
      for (const b of chosen.b) {
        opponentCount[a][b]++;
      }
    }
    partnerCountA[chosen.a[0]][chosen.a[1]]++;
    partnerCountA[chosen.a[1]][chosen.a[0]]++;
    partnerCountB[chosen.b[0]][chosen.b[1]]++;
    partnerCountB[chosen.b[1]][chosen.b[0]]++;
    for (const id of [...chosen.a, ...chosen.b]) {
      playCounts[id]++;
    }
    extraAttempts++;
  }

  // Shuffle selected matches before grouping into rounds (deterministic via rng)
  const shuffledSelected = shuffle(selected, rng);

  const rounds = groupIntoRounds(shuffledSelected, courts);
  const matches: Match[] = [];
  let matchId = 1;

  for (let r = 0; r < rounds.length; r++) {
    for (let c = 0; c < rounds[r].length; c++) {
      const combo = rounds[r][c];
      matches.push({
        id: matchId++,
        round: r + 1,
        court: (c % courts) + 1,
        teamAIds: combo.a,
        teamBIds: combo.b,
        status: 'pending',
      });
    }
  }

  return matches;
}

function getPairs(playerIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      pairs.push([playerIds[i], playerIds[j]]);
    }
  }
  return pairs;
}

function groupIntoRounds(
  combos: {a: [string, string]; b: [string, string]}[],
  courts: number,
): {a: [string, string]; b: [string, string]}[][] {
  const rounds: {a: [string, string]; b: [string, string]}[][] = [];
  const used = new Set<number>();

  while (used.size < combos.length) {
    const round: {a: [string, string]; b: [string, string]}[] = [];
    const playersInRound = new Set<string>();

    for (let i = 0; i < combos.length; i++) {
      if (used.has(i)) continue;
      if (round.length >= courts) break;
      const players = [...combos[i].a, ...combos[i].b];
      if (players.some(p => playersInRound.has(p))) continue;
      round.push(combos[i]);
      players.forEach(p => playersInRound.add(p));
      used.add(i);
    }

    if (round.length === 0) break;
    rounds.push(round);
  }

  return rounds;
}

export function computeFairnessReport(matches: Match[], allPlayerIds: string[]) {
  const counts: Record<string, number> = {};
  allPlayerIds.forEach(id => (counts[id] = 0));
  matches.forEach(m => {
    if (m.status === 'cancelled') return;
    [...m.teamAIds, ...m.teamBIds].forEach(id => {
      if (counts[id] !== undefined) counts[id]++;
    });
  });

  const partnerCounts: Record<string, number> = {};
  const opponentCounts: Record<string, number> = {};

  // Build matrices
  const opponentMatrix: Record<string, Record<string, number>> = {};
  const partnerMatrixA: Record<string, Record<string, number>> = {};
  const partnerMatrixB: Record<string, Record<string, number>> = {};

  // Determine which players are in which team based on match data
  const teamAPlayers = new Set<string>();
  const teamBPlayers = new Set<string>();
  matches.forEach(m => {
    if (m.status === 'cancelled') return;
    m.teamAIds.forEach(id => teamAPlayers.add(id));
    m.teamBIds.forEach(id => teamBPlayers.add(id));
  });

  const teamAArr = allPlayerIds.filter(id => teamAPlayers.has(id));
  const teamBArr = allPlayerIds.filter(id => teamBPlayers.has(id));

  // Initialize matrices
  teamAArr.forEach(a => {
    opponentMatrix[a] = {};
    partnerMatrixA[a] = {};
    teamBArr.forEach(b => {
      opponentMatrix[a][b] = 0;
    });
    teamAArr.forEach(a2 => {
      partnerMatrixA[a][a2] = 0;
    });
  });
  teamBArr.forEach(b => {
    partnerMatrixB[b] = {};
    teamBArr.forEach(b2 => {
      partnerMatrixB[b][b2] = 0;
    });
  });

  // Populate matrices and flat counts
  matches.forEach(m => {
    if (m.status === 'cancelled') return;
    const pairKey = (a: string, b: string) => [a, b].sort().join('-');

    // Partner counts (flat)
    partnerCounts[pairKey(m.teamAIds[0], m.teamAIds[1])] =
      (partnerCounts[pairKey(m.teamAIds[0], m.teamAIds[1])] || 0) + 1;
    partnerCounts[pairKey(m.teamBIds[0], m.teamBIds[1])] =
      (partnerCounts[pairKey(m.teamBIds[0], m.teamBIds[1])] || 0) + 1;

    // Partner matrix A
    for (const a of m.teamAIds) {
      if (partnerMatrixA[a]) partnerMatrixA[a][a] = (partnerMatrixA[a][a] || 0) + 1;
    }
    if (m.teamAIds.length === 2) {
      const [a1, a2] = m.teamAIds;
      if (partnerMatrixA[a1]) partnerMatrixA[a1][a2] = (partnerMatrixA[a1][a2] || 0) + 1;
      if (partnerMatrixA[a2]) partnerMatrixA[a2][a1] = (partnerMatrixA[a2][a1] || 0) + 1;
    }

    // Partner matrix B
    for (const b of m.teamBIds) {
      if (partnerMatrixB[b]) partnerMatrixB[b][b] = (partnerMatrixB[b][b] || 0) + 1;
    }
    if (m.teamBIds.length === 2) {
      const [b1, b2] = m.teamBIds;
      if (partnerMatrixB[b1]) partnerMatrixB[b1][b2] = (partnerMatrixB[b1][b2] || 0) + 1;
      if (partnerMatrixB[b2]) partnerMatrixB[b2][b1] = (partnerMatrixB[b2][b1] || 0) + 1;
    }

    // Opponent counts (flat and matrix)
    for (const a of m.teamAIds) {
      for (const b of m.teamBIds) {
        opponentCounts[pairKey(a, b)] = (opponentCounts[pairKey(a, b)] || 0) + 1;
        if (opponentMatrix[a]) opponentMatrix[a][b] = (opponentMatrix[a][b] || 0) + 1;
      }
    }
  });

  const values = Object.values(counts);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const fair = max - min <= 1;
  const worstPartnerRepeat = Math.max(0, ...Object.values(partnerCounts)) - 1;
  const worstOpponentRepeat = Math.max(0, ...Object.values(opponentCounts)) - 1;

  return {
    counts,
    min,
    max,
    fair,
    partnerCounts,
    opponentCounts,
    worstPartnerRepeat,
    worstOpponentRepeat,
    opponentMatrix,
    partnerMatrixA,
    partnerMatrixB,
  };
}
