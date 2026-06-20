export interface Player {
  id: string;
  name: string;
  dominantHand: 'Right' | 'Left';
  available: boolean;
  team?: 'A' | 'B' | '';
}

export type MatchFlag = 'added' | 'substitution' | 'edited' | 'restored';

export interface Match {
  id: number;
  round: number;
  court: number;
  teamAIds: [string, string];
  teamBIds: [string, string];
  score?: MatchScore;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  flags?: MatchFlag[];
  updatedAt?: number;
}

export interface MatchScore {
  teamA: number;
  teamB: number;
  winner: 'A' | 'B';
}

export interface Tournament {
  id: string;
  name?: string; // Display name for TV board header (defaults to groupName — playDate)
  groupCode: string;
  groupName: string;
  playDate: string;
  players: Player[];
  teamA: string[];
  teamB: string[];
  teamAName: string;
  teamBName: string;
  matches: Match[];
  matchesPerPlayer: number;
  courts: number;
  status: 'scheduled' | 'in_progress' | 'completed';
  playerStats?: Record<string, PlayerStats>;
  playerOfTournament?: string;
  createdAt: number;
}

export interface PlayerStats {
  played: number;
  won: number;
  lost: number;
}

export interface Group {
  code: string;
  name: string;
  players: Player[];
  seed?: string;
  randomness: number;
}

export interface TournamentSummary {
  id: string;
  groupCode: string;
  groupName: string;
  playDate: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  createdAt: number;
  matchCount?: number;
  completedMatchCount?: number;
  playerOfTournament?: string;
  teamAWins?: number;
  teamBWins?: number;
}

export interface RecentGroup {
  code: string;
  name: string;
  playerCount: number;
  lastUsed: number;
}
