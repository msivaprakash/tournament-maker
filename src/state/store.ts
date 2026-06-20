import {createContext, useContext, useReducer, type Dispatch} from 'react';
import type {Group, Tournament, TournamentSummary, Match, Player, PlayerStats} from '../types';

export interface UndoEntry {
  matchId: number;
  prevMatch: Match;
}

export interface AppState {
  group: Group | null;
  tournament: Tournament | null;
  tournaments: TournamentSummary[];
  myPlayerId: string | null;
  matchesPerPlayer: number;
  courts: number;
  teamAName: string;
  teamBName: string;
  undoStack: UndoEntry[];
}

export type Action =
  | {type: 'SET_GROUP'; payload: Group}
  | {type: 'ADD_PLAYER'; payload: Player}
  | {type: 'REMOVE_PLAYER'; payload: string}
  | {type: 'TOGGLE_AVAILABILITY'; payload: string}
  | {type: 'SET_TEAM'; payload: {playerId: string; team: 'A' | 'B' | ''}}
  | {type: 'RENAME_PLAYER'; payload: {id: string; name: string; dominantHand?: 'Right' | 'Left'}}
  | {type: 'SET_TOURNAMENT'; payload: Tournament}
  | {type: 'CLEAR_TOURNAMENT'}
  | {type: 'SET_TOURNAMENTS'; payload: TournamentSummary[]}
  | {type: 'DELETE_TOURNAMENT'; payload: string}
  | {type: 'UPDATE_TOURNAMENT_SUMMARY'; payload: {id: string; status: 'scheduled' | 'in_progress' | 'completed'}}
  | {type: 'UPDATE_MATCH'; payload: Match}
  | {type: 'ADD_MATCH'; payload: Match}
  | {type: 'CANCEL_MATCH'; payload: number}
  | {type: 'RESTORE_MATCH'; payload: number}
  | {type: 'SWAP_PLAYER_IN_MATCH'; payload: {matchId: number; oldPlayerId: string; newPlayerId: string}}
  | {type: 'CONCLUDE_TOURNAMENT'}
  | {type: 'SET_MY_PLAYER'; payload: string | null}
  | {type: 'SET_SETTINGS'; payload: {matchesPerPlayer?: number; courts?: number; teamAName?: string; teamBName?: string}}
  | {type: 'UNDO_LAST_SCORE'}
  | {type: 'RESET'};

const initialState: AppState = {
  group: null,
  tournament: null,
  tournaments: [],
  myPlayerId: null,
  matchesPerPlayer: 2,
  courts: 1,
  teamAName: 'Team A',
  teamBName: 'Team B',
  undoStack: [],
};

export function computeStats(matches: Match[]): Record<string, PlayerStats> {
  const stats: Record<string, PlayerStats> = {};
  matches.forEach(m => {
    if (m.status !== 'completed' || !m.score) return;
    const all = [...m.teamAIds, ...m.teamBIds];
    const winners = m.score.winner === 'A' ? m.teamAIds : m.teamBIds;
    all.forEach(id => {
      if (!stats[id]) stats[id] = {played: 0, won: 0, lost: 0};
      stats[id].played++;
    });
    winners.forEach(id => { stats[id].won++; });
    all.filter(id => !winners.includes(id)).forEach(id => { stats[id].lost++; });
  });
  return stats;
}

export function computePOT(stats: Record<string, PlayerStats>): string | undefined {
  const entries = Object.entries(stats);
  if (entries.length === 0) return undefined;
  let maxWins = 0;
  entries.forEach(([, s]) => { if (s.won > maxWins) maxWins = s.won; });
  if (maxWins === 0) return undefined;
  return entries.filter(([, s]) => s.won === maxWins).map(([id]) => id).join(',');
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_GROUP':
      return {...state, group: action.payload};
    case 'ADD_PLAYER':
      return state.group ? {...state, group: {...state.group, players: [...state.group.players, action.payload]}} : state;
    case 'REMOVE_PLAYER':
      return state.group ? {...state, group: {...state.group, players: state.group.players.filter(p => p.id !== action.payload)}} : state;
    case 'TOGGLE_AVAILABILITY':
      return state.group ? {...state, group: {...state.group, players: state.group.players.map(p =>
        p.id === action.payload ? {...p, available: !p.available} : p
      )}} : state;
    case 'SET_TEAM':
      return state.group ? {...state, group: {...state.group, players: state.group.players.map(p =>
        p.id === action.payload.playerId ? {...p, team: action.payload.team} : p
      )}} : state;
    case 'RENAME_PLAYER':
      return state.group ? {...state, group: {...state.group, players: state.group.players.map(p =>
        p.id === action.payload.id ? {...p, name: action.payload.name, ...(action.payload.dominantHand && {dominantHand: action.payload.dominantHand})} : p
      )}} : state;
    case 'SET_TOURNAMENT':
      return {...state, tournament: action.payload};
    case 'CLEAR_TOURNAMENT':
      return {...state, tournament: null, myPlayerId: null};
    case 'SET_TOURNAMENTS':
      return {...state, tournaments: action.payload};
    case 'DELETE_TOURNAMENT':
      return {...state, tournaments: state.tournaments.filter(t => t.id !== action.payload)};
    case 'UPDATE_TOURNAMENT_SUMMARY':
      return {...state, tournaments: state.tournaments.map(t =>
        t.id === action.payload.id ? {...t, status: action.payload.status} : t
      )};
    case 'UPDATE_MATCH':
      if (!state.tournament) return state;
      const prevMatch = state.tournament.matches.find(m => m.id === action.payload.id);
      return {
        ...state,
        tournament: {...state.tournament, matches: state.tournament.matches.map(m =>
          m.id === action.payload.id ? action.payload : m
        )},
        undoStack: prevMatch
          ? [{matchId: action.payload.id, prevMatch}, ...state.undoStack].slice(0, 5)
          : state.undoStack,
      };
    case 'ADD_MATCH':
      return state.tournament ? {...state, tournament: {...state.tournament, matches: [...state.tournament.matches, action.payload]}} : state;
    case 'CANCEL_MATCH':
      return state.tournament ? {...state, tournament: {...state.tournament, matches: state.tournament.matches.map(m =>
        m.id === action.payload ? {...m, status: 'cancelled' as const, updatedAt: Date.now()} : m
      )}} : state;
    case 'RESTORE_MATCH':
      return state.tournament ? {...state, tournament: {...state.tournament, matches: state.tournament.matches.map(m =>
        m.id === action.payload ? {...m, status: 'pending' as const, score: undefined, flags: [...(m.flags || []), 'restored'], updatedAt: Date.now()} : m
      )}} : state;
    case 'SWAP_PLAYER_IN_MATCH':
      if (!state.tournament) return state;
      return {...state, tournament: {...state.tournament, matches: state.tournament.matches.map(m => {
        if (m.id !== action.payload.matchId) return m;
        const swapIn = (ids: [string, string]): [string, string] =>
          ids.map(id => id === action.payload.oldPlayerId ? action.payload.newPlayerId : id) as [string, string];
        return {...m, teamAIds: swapIn(m.teamAIds), teamBIds: swapIn(m.teamBIds), flags: [...(m.flags || []), 'substitution'], updatedAt: Date.now()};
      })}};
    case 'CONCLUDE_TOURNAMENT':
      if (!state.tournament) return state;
      const stats = computeStats(state.tournament.matches);
      const pot = computePOT(stats);
      return {...state, tournament: {...state.tournament, status: 'completed', playerStats: stats, playerOfTournament: pot}};
    case 'SET_MY_PLAYER':
      return {...state, myPlayerId: action.payload};
    case 'SET_SETTINGS':
      return {
        ...state,
        matchesPerPlayer: action.payload.matchesPerPlayer ?? state.matchesPerPlayer,
        courts: action.payload.courts ?? state.courts,
        teamAName: action.payload.teamAName ?? state.teamAName,
        teamBName: action.payload.teamBName ?? state.teamBName,
      };
    case 'UNDO_LAST_SCORE':
      if (!state.tournament || state.undoStack.length === 0) return state;
      const [undoEntry, ...restUndo] = state.undoStack;
      return {
        ...state,
        tournament: {...state.tournament, matches: state.tournament.matches.map(m =>
          m.id === undoEntry.matchId ? undoEntry.prevMatch : m
        )},
        undoStack: restUndo,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export const StoreContext = createContext<{state: AppState; dispatch: Dispatch<Action>} | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export {initialState};
