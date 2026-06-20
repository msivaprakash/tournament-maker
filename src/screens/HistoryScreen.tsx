import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {useStore} from '../state/store';
import {firebase} from '../services/firebase';
import type {Match, Tournament, PlayerStats, TournamentSummary} from '../types';

interface Nav {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  reset: (screen?: string) => void;
}

export function HistoryScreen({nav}: {nav: Nav}) {
  const {state, dispatch} = useStore();
  const [tab, setTab] = useState<'tournaments' | 'players'>('tournaments');
  const [loading, setLoading] = useState(false);
  const [allTimeStats, setAllTimeStats] = useState<Record<string, PlayerStats>>({});
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [perTournamentStats, setPerTournamentStats] = useState<{date: string; stats: Record<string, {won: number; played: number}>}[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const players = state.group?.players || [];
  const tournaments = state.tournaments;

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || '?';

  useEffect(() => {
    if (!state.group?.code) return;
    setLoading(true);
    firebase.fetchTournaments(state.group.code).then(fullTournaments => {
      const stats: Record<string, PlayerStats> = {};
      const matches: Match[] = [];
      fullTournaments.forEach(t => {
        if (t.status !== 'completed') return;
        if (t.playerStats) {
          Object.entries(t.playerStats).forEach(([id, s]) => {
            if (!stats[id]) stats[id] = {played: 0, won: 0, lost: 0};
            stats[id].played += s.played;
            stats[id].won += s.won;
            stats[id].lost += s.lost;
          });
        }
        matches.push(...t.matches.filter(m => m.status === 'completed' && m.score));
      });
      setAllTimeStats(stats);
      setAllMatches(matches);
      // Per-tournament stats for form graph (sorted oldest first)
      const perTourn = fullTournaments
        .filter(t => t.status === 'completed' && t.playerStats)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(t => ({
          date: t.playDate,
          stats: Object.fromEntries(
            Object.entries(t.playerStats!).map(([id, s]) => [id, {won: s.won, played: s.played}])
          ),
        }));
      setPerTournamentStats(perTourn);
      const summaries = fullTournaments.map(t => firebase.summarizeTournament(t));
      dispatch({type: 'SET_TOURNAMENTS', payload: summaries});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [state.group?.code]);

  // Head-to-head computation
  const h2h = useMemo(() => {
    if (!selectedPlayer) return [];
    const record: Record<string, {wins: number; losses: number}> = {};
    allMatches.forEach(m => {
      if (!m.score) return;
      const allInMatch = [...m.teamAIds, ...m.teamBIds];
      if (!allInMatch.includes(selectedPlayer)) return;
      const isOnA = m.teamAIds.includes(selectedPlayer);
      const won = (isOnA && m.score.winner === 'A') || (!isOnA && m.score.winner === 'B');
      const opponents = isOnA ? m.teamBIds : m.teamAIds;
      opponents.forEach(opp => {
        if (!record[opp]) record[opp] = {wins: 0, losses: 0};
        if (won) record[opp].wins++;
        else record[opp].losses++;
      });
    });
    return Object.entries(record)
      .map(([id, r]) => ({id, name: getPlayerName(id), ...r, total: r.wins + r.losses}))
      .sort((a, b) => b.total - a.total);
  }, [selectedPlayer, allMatches]);

  // Win streak for selected player
  const winStreak = useMemo(() => {
    if (!selectedPlayer) return {current: 0, longest: 0};
    let current = 0, longest = 0;
    allMatches.forEach(m => {
      if (!m.score) return;
      const allInMatch = [...m.teamAIds, ...m.teamBIds];
      if (!allInMatch.includes(selectedPlayer)) return;
      const isOnA = m.teamAIds.includes(selectedPlayer);
      const won = (isOnA && m.score.winner === 'A') || (!isOnA && m.score.winner === 'B');
      if (won) { current++; longest = Math.max(longest, current); }
      else { current = 0; }
    });
    return {current, longest};
  }, [selectedPlayer, allMatches]);

  // Player form: win% per tournament (last 5)
  const playerForm = useMemo(() => {
    if (!selectedPlayer) return [];
    return perTournamentStats
      .filter(t => t.stats[selectedPlayer])
      .map(t => {
        const s = t.stats[selectedPlayer];
        return {date: t.date, winPct: s.played > 0 ? Math.round((s.won / s.played) * 100) : 0};
      })
      .slice(-5);
  }, [selectedPlayer, perTournamentStats]);

  const leaderboard = Object.entries(allTimeStats)
    .map(([id, s]) => ({
      id,
      name: getPlayerName(id),
      ...s,
      winPct: s.played > 0 ? Math.round((s.won / s.played) * 100) : 0,
    }))
    .sort((a, b) => b.winPct - a.winPct);

  const handleResume = useCallback(async (tournamentId: string) => {
    if (!state.group) return;
    setLoading(true);
    try {
      const tournament = await firebase.fetchTournamentById(state.group.code, tournamentId);
      if (tournament) {
        dispatch({type: 'SET_TOURNAMENT', payload: tournament});
        nav.navigate('live');
      }
    } catch {}
    setLoading(false);
  }, [state.group, dispatch, nav]);

  const handleViewStats = useCallback(async (tournamentId: string) => {
    if (!state.group) return;
    setLoading(true);
    try {
      const tournament = await firebase.fetchTournamentById(state.group.code, tournamentId);
      if (tournament) {
        dispatch({type: 'SET_TOURNAMENT', payload: tournament});
        nav.navigate('results');
      }
    } catch {}
    setLoading(false);
  }, [state.group, dispatch, nav]);

  const handleDelete = useCallback(async (tournamentId: string) => {
    if (!state.group) return;
    if (!window.confirm('Delete Tournament? This cannot be undone.')) return;
    try {
      await firebase.deleteTournament(state.group.code, tournamentId);
      dispatch({type: 'DELETE_TOURNAMENT', payload: tournamentId});
    } catch {}
  }, [state.group, dispatch]);

  const handleShareStats = async () => {
    const lines = [
      `${state.group?.name || 'Group'} — All-Time Leaderboard`,
      '',
      ...leaderboard.map((s, i) => `${i + 1}. ${s.name}: ${s.won}W/${s.lost}L (${s.winPct}%)`),
    ];
    const text = lines.join('\n');
    if (navigator.share) {
      try { await navigator.share({title: `${state.group?.name} Leaderboard`, text}); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch {
      window.prompt('Copy this text:', text);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'var(--secondary)';
    if (status === 'in_progress') return 'var(--accent)';
    return 'var(--text-muted)';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'completed') return 'COMPLETED';
    if (status === 'in_progress') return 'IN PROGRESS';
    return 'SCHEDULED';
  };

  return (
    <div className="screen">
      {/* Tab Row */}
      <div className="tab-row">
        <button
          className={`tab-btn ${tab === 'tournaments' ? 'active' : ''}`}
          onClick={() => setTab('tournaments')}
        >
          Tournaments
        </button>
        <button
          className={`tab-btn ${tab === 'players' ? 'active' : ''}`}
          onClick={() => setTab('players')}
        >
          Players
        </button>
      </div>

      {loading && <div style={{textAlign: 'center', padding: 24, color: 'var(--text-secondary)'}}>Loading...</div>}

      {/* Tournaments Tab */}
      {tab === 'tournaments' && !loading && (
        <div>
          {tournaments.length === 0 && (
            <div style={{textAlign: 'center', padding: 40}}>
              <div style={{fontSize: 48, marginBottom: 12}}>🏸</div>
              <p style={{color: 'var(--text-secondary)', fontWeight: 600}}>No tournaments yet</p>
              <p style={{color: 'var(--text-muted)', fontSize: 13, marginTop: 4}}>Start a tournament from the home screen to see history here.</p>
            </div>
          )}
          {tournaments.map(t => (
            <div key={t.id} className="tourn-card">
              <div className="header">
                <span className="date">{t.playDate}</span>
                <span className="status" style={{color: getStatusColor(t.status)}}>
                  {getStatusLabel(t.status)}
                </span>
              </div>
              {t.status === 'completed' && (
                <div className="meta">
                  Team A: {t.teamAWins} | Team B: {t.teamBWins}
                </div>
              )}
              {t.status !== 'completed' && t.matchCount != null && (
                <div className="meta">
                  {t.completedMatchCount}/{t.matchCount} matches played
                </div>
              )}
              {t.playerOfTournament && (
                <div className="meta" style={{color: 'var(--accent)'}}>
                  MVP: {t.playerOfTournament.split(',').map(id => getPlayerName(id)).join(', ')}
                </div>
              )}
              <div className="actions">
                {t.status === 'completed' && (
                  <button className="btn-primary" onClick={() => handleViewStats(t.id)}>
                    View Stats
                  </button>
                )}
                {t.status === 'in_progress' && (
                  <button className="btn-primary" onClick={() => handleResume(t.id)}>
                    Resume
                  </button>
                )}
                {t.status === 'scheduled' && (
                  <button className="btn-danger" onClick={() => handleDelete(t.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Players Tab */}
      {tab === 'players' && !loading && (
        <div>
          {leaderboard.length === 0 ? (
            <div style={{textAlign: 'center', padding: 40}}>
              <div style={{fontSize: 48, marginBottom: 12}}>📊</div>
              <p style={{color: 'var(--text-secondary)', fontWeight: 600}}>No player stats yet</p>
              <p style={{color: 'var(--text-muted)', fontSize: 13, marginTop: 4}}>Complete a tournament to see player rankings. Tap a player to see head-to-head records.</p>
            </div>
          ) : (
            <>
              <div className="card" style={{padding: 8}}>
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>P</th>
                      <th>W</th>
                      <th>L</th>
                      <th>W%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((s, index) => (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedPlayer(selectedPlayer === s.id ? null : s.id)}
                        style={{cursor: 'pointer', background: selectedPlayer === s.id ? 'var(--primary-light)' : undefined}}
                      >
                        <td>{index + 1}</td>
                        <td>{s.name}</td>
                        <td>{s.played}</td>
                        <td className="win-col">{s.won}</td>
                        <td>{s.lost}</td>
                        <td>{s.winPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Head-to-Head */}
              {selectedPlayer && h2h.length > 0 && (
                <div className="card" style={{marginTop: 12}}>
                  <div className="section-title" style={{margin: '0 0 8px'}}>
                    HEAD-TO-HEAD: {getPlayerName(selectedPlayer)}
                  </div>
                  <table className="stats-table">
                    <thead>
                      <tr><th>Opponent</th><th>Won</th><th>Lost</th><th>Matches</th></tr>
                    </thead>
                    <tbody>
                      {h2h.map(r => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td className="win-col">{r.wins}</td>
                          <td>{r.losses}</td>
                          <td>{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {selectedPlayer && h2h.length === 0 && (
                <p style={{textAlign: 'center', color: 'var(--text-muted)', marginTop: 12, fontSize: 13}}>
                  No head-to-head data for {getPlayerName(selectedPlayer)}.
                </p>
              )}

              {/* Win Streak + Form */}
              {selectedPlayer && (winStreak.longest > 0 || playerForm.length > 0) && (
                <div className="card" style={{marginTop: 12}}>
                  {winStreak.longest > 0 && (
                    <div style={{marginBottom: 12}}>
                      <div className="section-title" style={{margin: '0 0 4px'}}>WIN STREAK</div>
                      <div style={{display: 'flex', gap: 16, fontSize: 14}}>
                        <span>Current: <strong>{winStreak.current}</strong></span>
                        <span>Longest: <strong style={{color: 'var(--accent)'}}>{winStreak.longest}</strong></span>
                      </div>
                    </div>
                  )}
                  {playerForm.length > 1 && (
                    <div>
                      <div className="section-title" style={{margin: '0 0 8px'}}>FORM (Last {playerForm.length} tournaments)</div>
                      <div style={{display: 'flex', alignItems: 'flex-end', gap: 4, height: 60}}>
                        {playerForm.map((f, i) => (
                          <div key={i} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2}}>
                            <span style={{fontSize: 10, color: 'var(--text-muted)'}}>{f.winPct}%</span>
                            <div style={{
                              width: '100%',
                              height: `${Math.max(4, f.winPct * 0.5)}px`,
                              background: f.winPct >= 50 ? 'var(--secondary)' : 'var(--danger)',
                              borderRadius: 2,
                            }} />
                            <span style={{fontSize: 9, color: 'var(--text-muted)'}}>{f.date.slice(5)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                className="btn-primary"
                style={{width: '100%', marginTop: 16}}
                onClick={handleShareStats}
              >
                Share Player Stats
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
