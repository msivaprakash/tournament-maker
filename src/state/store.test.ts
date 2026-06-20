import {describe, it, expect} from 'vitest';
import {reducer, initialState} from './store';
import type {Player, Match, Tournament, Group} from '../types';

const makeGroup = (players: Player[] = []): Group => ({
  code: 'HH-123456', name: 'Test Group', players, randomness: 30,
});

const makePlayer = (id: string, name: string): Player => ({
  id, name, dominantHand: 'Right', available: true, team: '',
});

const makeTournament = (matches: Match[] = []): Tournament => ({
  id: 't1', groupCode: 'HH-123456', groupName: 'Test', playDate: '2024-01-01',
  players: [], teamA: [], teamB: [], teamAName: 'Team A', teamBName: 'Team B', matches, matchesPerPlayer: 1, courts: 1,
  status: 'in_progress', createdAt: 1,
});

describe('reducer', () => {
  it('SET_GROUP sets the group', () => {
    const group = makeGroup();
    const state = reducer(initialState, {type: 'SET_GROUP', payload: group});
    expect(state.group).toEqual(group);
  });

  it('ADD_PLAYER adds to group players', () => {
    const state = {
      ...initialState,
      group: makeGroup([makePlayer('p1', 'Alice')]),
    };
    const next = reducer(state, {type: 'ADD_PLAYER', payload: makePlayer('p2', 'Bob')});
    expect(next.group!.players).toHaveLength(2);
    expect(next.group!.players[1].name).toBe('Bob');
  });

  it('REMOVE_PLAYER removes from group', () => {
    const state = {
      ...initialState,
      group: makeGroup([makePlayer('p1', 'Alice'), makePlayer('p2', 'Bob')]),
    };
    const next = reducer(state, {type: 'REMOVE_PLAYER', payload: 'p1'});
    expect(next.group!.players).toHaveLength(1);
    expect(next.group!.players[0].id).toBe('p2');
  });

  it('TOGGLE_AVAILABILITY flips player availability', () => {
    const state = {
      ...initialState,
      group: makeGroup([makePlayer('p1', 'Alice')]),
    };
    expect(state.group!.players[0].available).toBe(true);
    const next = reducer(state, {type: 'TOGGLE_AVAILABILITY', payload: 'p1'});
    expect(next.group!.players[0].available).toBe(false);
    const next2 = reducer(next, {type: 'TOGGLE_AVAILABILITY', payload: 'p1'});
    expect(next2.group!.players[0].available).toBe(true);
  });

  it('SET_TEAM assigns team to player', () => {
    const state = {
      ...initialState,
      group: makeGroup([makePlayer('p1', 'Alice')]),
    };
    const next = reducer(state, {type: 'SET_TEAM', payload: {playerId: 'p1', team: 'A'}});
    expect(next.group!.players[0].team).toBe('A');
  });

  it('SET_TOURNAMENT sets the tournament', () => {
    const t = makeTournament();
    const state = reducer(initialState, {type: 'SET_TOURNAMENT', payload: t});
    expect(state.tournament).toEqual(t);
  });

  it('CLEAR_TOURNAMENT clears tournament and myPlayerId', () => {
    const state = {
      ...initialState,
      tournament: makeTournament(),
      myPlayerId: 'p1',
    };
    const next = reducer(state, {type: 'CLEAR_TOURNAMENT'});
    expect(next.tournament).toBeNull();
    expect(next.myPlayerId).toBeNull();
  });

  it('UPDATE_MATCH updates specific match', () => {
    const match: Match = {id: 1, round: 1, court: 1, teamAIds: ['p1', 'p2'], teamBIds: ['p3', 'p4'], status: 'pending'};
    const state = {...initialState, tournament: makeTournament([match])};
    const updated: Match = {...match, status: 'completed', score: {teamA: 21, teamB: 15, winner: 'A'}};
    const next = reducer(state, {type: 'UPDATE_MATCH', payload: updated});
    expect(next.tournament!.matches[0].status).toBe('completed');
    expect(next.tournament!.matches[0].score?.teamA).toBe(21);
  });

  it('CANCEL_MATCH sets status to cancelled', () => {
    const match: Match = {id: 1, round: 1, court: 1, teamAIds: ['p1', 'p2'], teamBIds: ['p3', 'p4'], status: 'pending'};
    const state = {...initialState, tournament: makeTournament([match])};
    const next = reducer(state, {type: 'CANCEL_MATCH', payload: 1});
    expect(next.tournament!.matches[0].status).toBe('cancelled');
  });

  it('RESTORE_MATCH sets status to pending and adds restored flag', () => {
    const match: Match = {id: 1, round: 1, court: 1, teamAIds: ['p1', 'p2'], teamBIds: ['p3', 'p4'], status: 'cancelled'};
    const state = {...initialState, tournament: makeTournament([match])};
    const next = reducer(state, {type: 'RESTORE_MATCH', payload: 1});
    expect(next.tournament!.matches[0].status).toBe('pending');
    expect(next.tournament!.matches[0].flags).toContain('restored');
  });

  it('CONCLUDE_TOURNAMENT computes stats and POT', () => {
    const matches: Match[] = [
      {id: 1, round: 1, court: 1, teamAIds: ['p1', 'p2'], teamBIds: ['p3', 'p4'], status: 'completed', score: {teamA: 21, teamB: 15, winner: 'A'}},
      {id: 2, round: 2, court: 1, teamAIds: ['p1', 'p2'], teamBIds: ['p3', 'p4'], status: 'completed', score: {teamA: 21, teamB: 18, winner: 'A'}},
    ];
    const state = {...initialState, tournament: makeTournament(matches)};
    const next = reducer(state, {type: 'CONCLUDE_TOURNAMENT'});
    expect(next.tournament!.status).toBe('completed');
    expect(next.tournament!.playerStats).toBeDefined();
    expect(next.tournament!.playerStats!['p1'].won).toBe(2);
    expect(next.tournament!.playerStats!['p3'].lost).toBe(2);
    expect(next.tournament!.playerOfTournament).toContain('p1');
  });

  it('SWAP_PLAYER_IN_MATCH replaces player and adds flag', () => {
    const match: Match = {id: 1, round: 1, court: 1, teamAIds: ['p1', 'p2'], teamBIds: ['p3', 'p4'], status: 'pending'};
    const state = {...initialState, tournament: makeTournament([match])};
    const next = reducer(state, {type: 'SWAP_PLAYER_IN_MATCH', payload: {matchId: 1, oldPlayerId: 'p1', newPlayerId: 'p5'}});
    expect(next.tournament!.matches[0].teamAIds).toContain('p5');
    expect(next.tournament!.matches[0].teamAIds).not.toContain('p1');
    expect(next.tournament!.matches[0].flags).toContain('substitution');
  });

  it('RESET returns initial state', () => {
    const state = {
      ...initialState,
      group: makeGroup(),
      tournament: makeTournament(),
      myPlayerId: 'p1',
    };
    const next = reducer(state, {type: 'RESET'});
    expect(next).toEqual(initialState);
  });
});
