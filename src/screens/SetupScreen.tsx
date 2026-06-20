import React, {useState, useEffect, useCallback} from 'react';
import {useStore} from '../state/store';
import {firebase} from '../services/firebase';
import {generateGroupCode, isValidGroupCode} from '../utils/groupCode';
import {getRecentGroups, saveRecentGroup, removeRecentGroup} from '../utils/recentGroups';
import {preloadTournamentScreens} from '../utils/preload';
import type {RecentGroup, Tournament, PlayerStats, Player} from '../types';

interface Nav {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  reset: (screen?: string) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function ManagePlayers() {
  const {state, dispatch} = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHand, setNewHand] = useState<'Right' | 'Left'>('Right');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editHand, setEditHand] = useState<'Right' | 'Left'>('Right');

  const players = state.group?.players || [];
  const handEmoji = (hand: 'Right' | 'Left') => hand === 'Right' ? '🤚' : '🖐️';

  const saveToCloud = (updatedPlayers: Player[]) => {
    if (state.group) firebase.savePlayersToGroup(state.group.code, updatedPlayers).catch(() => {});
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      alert('A player with this name already exists');
      return;
    }
    const player: Player = {id: generateId(), name, dominantHand: newHand, available: true, team: ''};
    dispatch({type: 'ADD_PLAYER', payload: player});
    saveToCloud([...players, player]);
    setNewName('');
  };

  const handleRemove = (id: string) => {
    dispatch({type: 'REMOVE_PLAYER', payload: id});
    saveToCloud(players.filter(p => p.id !== id));
    setConfirmDelete(null);
  };

  const startEdit = (p: Player) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditHand(p.dominantHand);
    setConfirmDelete(null);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    dispatch({type: 'RENAME_PLAYER', payload: {id: editingId, name: editName.trim(), dominantHand: editHand}});
    const updated = players.map(p => p.id === editingId ? {...p, name: editName.trim(), dominantHand: editHand} : p);
    saveToCloud(updated);
    setEditingId(null);
  };

  return (
    <div style={{marginBottom: 16}}>
      <div className="section-title" style={{margin: '0 0 8px'}}>PLAYERS ({players.length})</div>

      {players.length > 0 && (
        <div className="card" style={{padding: 8}}>
          {players.map(p => (
            <div key={p.id} style={{padding: '6px 8px', borderBottom: '0.5px solid var(--border-light)'}}>
              {editingId === p.id ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                  <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value.slice(0, 20))}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); }}
                      maxLength={20}
                      style={{flex: 1, padding: '4px 8px', fontSize: 14}}
                      autoFocus
                    />
                    <button style={{background: 'var(--secondary)', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer'}} onClick={saveEdit}>Save</button>
                    <button style={{background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12}} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                  <div style={{display: 'flex', gap: 6}}>
                    <button className={`preset-btn ${editHand === 'Right' ? 'active' : ''}`} onClick={() => setEditHand('Right')} style={{fontSize: 11, padding: '3px 8px'}}>🤚 Right</button>
                    <button className={`preset-btn ${editHand === 'Left' ? 'active' : ''}`} onClick={() => setEditHand('Left')} style={{fontSize: 11, padding: '3px 8px'}}>🖐️ Left</button>
                  </div>
                </div>
              ) : (
                <div style={{display: 'flex', alignItems: 'center'}}>
                  <span style={{flex: 1, fontSize: 14, cursor: 'pointer'}} onClick={() => startEdit(p)}>{p.name} {handEmoji(p.dominantHand)}</span>
                  {confirmDelete === p.id ? (
                    <span style={{display: 'flex', gap: 6, alignItems: 'center'}}>
                      <span style={{fontSize: 11, color: 'var(--danger)'}}>Delete permanently?</span>
                      <button style={{background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer'}} onClick={() => handleRemove(p.id)}>Yes</button>
                      <button style={{background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--text)'}} onClick={() => setConfirmDelete(null)}>No</button>
                    </span>
                  ) : (
                    <span style={{display: 'flex', gap: 4}}>
                      <button className="btn-ghost" style={{padding: '2px 6px', fontSize: 14}} onClick={() => startEdit(p)} title="Edit">✏️</button>
                      <button className="remove-btn" onClick={() => setConfirmDelete(p.id)} title="Remove from group" aria-label={`Remove ${p.name}`}>✕</button>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add player */}
      <div style={{marginTop: 8}}>
        {showAdd ? (
          <div className="card">
            <div style={{display: 'flex', gap: 8, marginBottom: 8}}>
              <input type="text" placeholder="Player name" value={newName} onChange={e => setNewName(e.target.value.slice(0, 20))} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} style={{flex: 1}} autoFocus maxLength={20} />
              <button className="btn-primary" onClick={handleAdd} disabled={!newName.trim()}>Add</button>
            </div>
            <div style={{display: 'flex', gap: 8}}>
              <button className={`preset-btn ${newHand === 'Right' ? 'active' : ''}`} onClick={() => setNewHand('Right')}>🤚 Right</button>
              <button className={`preset-btn ${newHand === 'Left' ? 'active' : ''}`} onClick={() => setNewHand('Left')}>🖐️ Left</button>
              <button className="btn-ghost" onClick={() => setShowAdd(false)} style={{marginLeft: 'auto'}}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn-outline" style={{width: '100%'}} onClick={() => setShowAdd(true)}>+ Add Player</button>
        )}
      </div>
    </div>
  );
}

export function SetupScreen({nav}: {nav: Nav}) {
  const {state, dispatch} = useStore();
  const [recentGroups, setRecentGroups] = useState<RecentGroup[]>([]);
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  // Load recent groups on mount
  useEffect(() => {
    setRecentGroups(getRecentGroups());
  }, []);

  // Fetch tournaments when group is loaded + refresh on tab focus
  const fetchData = useCallback(async () => {
    if (!state.group) return;
    try {
      await firebase.signInAnonymously();
      const ts = await firebase.fetchTournaments(state.group.code);
      setTournaments(ts);
      dispatch({type: 'SET_TOURNAMENTS', payload: ts.map(t => firebase.summarizeTournament(t))});
    } catch {}
  }, [state.group, dispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchData]);

  const loadGroup = useCallback(async (code: string) => {
    setLoading(true);
    setError('');
    try {
      await firebase.signInAnonymously();
      const group = await firebase.fetchGroup(code);
      if (!group) {
        setError('Group not found');
        setLoading(false);
        return;
      }
      dispatch({type: 'SET_GROUP', payload: group});
      saveRecentGroup(group.code, group.name, group.players.length);
      setRecentGroups(getRecentGroups());
    } catch (e: any) {
      setError(e.message || 'Failed to load group');
    }
    setLoading(false);
  }, [dispatch]);

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!isValidGroupCode(code)) {
      setError('Invalid code. Format: HH-XXXXXX');
      return;
    }
    loadGroup(code);
  };

  const handleCreate = async () => {
    const name = groupName.trim();
    if (!name) {
      setError('Please enter a group name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await firebase.signInAnonymously();
      const code = generateGroupCode();
      const group = {code, name, players: [], randomness: 30};
      await firebase.createGroup(group);
      dispatch({type: 'SET_GROUP', payload: group});
      saveRecentGroup(code, name, 0);
      setRecentGroups(getRecentGroups());
    } catch (e: any) {
      setError(e.message || 'Failed to create group');
    }
    setLoading(false);
  };

  const handleRemoveRecent = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    removeRecentGroup(code);
    setRecentGroups(getRecentGroups());
  };

  const handleSwitch = () => {
    dispatch({type: 'RESET'});
    setTournaments([]);
  };

  const handleRefresh = async () => {
    if (!state.group) return;
    setLoading(true);
    try {
      await firebase.signInAnonymously();
      const [group, ts] = await Promise.all([
        firebase.fetchGroup(state.group.code),
        firebase.fetchTournaments(state.group.code),
      ]);
      if (group) dispatch({type: 'SET_GROUP', payload: group});
      setTournaments(ts);
      dispatch({type: 'SET_TOURNAMENTS', payload: ts.map(t => firebase.summarizeTournament(t))});
    } catch {}
    setLoading(false);
  };

  const handleNewTournament = () => {
    dispatch({type: 'CLEAR_TOURNAMENT'});
    nav.navigate('players');
  };

  const handleResume = async (tournamentId: string) => {
    if (!state.group) return;
    try {
      const t = await firebase.fetchTournamentById(state.group.code, tournamentId);
      if (t) {
        dispatch({type: 'SET_TOURNAMENT', payload: t});
        nav.navigate('live');
      }
    } catch {}
  };

  const handleDeleteTournament = async (tournamentId: string) => {
    if (!state.group) return;
    try {
      await firebase.deleteTournament(state.group.code, tournamentId);
      dispatch({type: 'DELETE_TOURNAMENT', payload: tournamentId});
      setTournaments(prev => prev.filter(t => t.id !== tournamentId));
    } catch {}
  };

  const handleViewResults = async (tournamentId: string) => {
    if (!state.group) return;
    try {
      const t = await firebase.fetchTournamentById(state.group.code, tournamentId);
      if (t) {
        dispatch({type: 'SET_TOURNAMENT', payload: t});
        nav.navigate('results');
      }
    } catch {}
  };

  // Aggregate stats from all completed tournaments
  const aggregateStats = useCallback((): {id: string; name: string; stats: PlayerStats}[] => {
    const allStats: Record<string, PlayerStats> = {};
    const completed = tournaments.filter(t => t.status === 'completed');
    completed.forEach(t => {
      if (t.playerStats) {
        Object.entries(t.playerStats).forEach(([id, s]) => {
          if (!allStats[id]) allStats[id] = {played: 0, won: 0, lost: 0};
          allStats[id].played += s.played;
          allStats[id].won += s.won;
          allStats[id].lost += s.lost;
        });
      }
    });
    const players = state.group?.players || [];
    return Object.entries(allStats)
      .map(([id, stats]) => ({
        id,
        name: players.find(p => p.id === id)?.name || 'Unknown',
        stats,
      }))
      .sort((a, b) => b.stats.won - a.stats.won);
  }, [tournaments, state.group]);

  // ====== Selection Mode (no group loaded) ======
  if (!state.group) {  /* falls through below */
    return (
      <div className="screen">
        <div style={{textAlign: 'center', marginBottom: 24}}>
          <h1 style={{fontSize: 28, fontWeight: 800, marginBottom: 4}}>Tournament Maker</h1>
          <p style={{color: 'var(--text-secondary)', fontSize: 14}}>Select or create a group</p>
        </div>

        {error && <div style={{color: 'var(--danger)', fontSize: 13, textAlign: 'center', marginBottom: 12}}>{error}</div>}

        {/* Recent Groups */}
        {recentGroups.length > 0 && (
          <div style={{marginBottom: 20}}>
            <div className="section-title" style={{margin: '0 0 8px'}}>RECENT GROUPS</div>
            {recentGroups.map(g => (
              <div key={g.code} className="recent-card" onClick={() => loadGroup(g.code)}>
                <div className="info">
                  <div className="name">{g.name}</div>
                  <div className="meta">{g.playerCount} players · {g.code}</div>
                </div>
                <button
                  className="remove-btn"
                  onClick={(e) => handleRemoveRecent(e, g.code)}
                  aria-label="Remove from recents"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Join by Group Code */}
        <div className="card">
          <button
            className="btn-ghost"
            style={{width: '100%', textAlign: 'left', fontWeight: 600}}
            onClick={() => { setShowJoin(!showJoin); setShowCreate(false); }}
          >
            {showJoin ? '▾' : '▸'} Join by Group Code
          </button>
          {showJoin && (
            <div style={{marginTop: 10, display: 'flex', gap: 8}}>
              <input
                type="text"
                placeholder="HH-XXXXXX"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                style={{flex: 1}}
              />
              <button className="btn-primary" onClick={handleJoin} disabled={loading}>
                {loading ? '...' : 'Join'}
              </button>
            </div>
          )}
        </div>

        {/* Create New Group */}
        <div className="card">
          <button
            className="btn-ghost"
            style={{width: '100%', textAlign: 'left', fontWeight: 600}}
            onClick={() => { setShowCreate(!showCreate); setShowJoin(false); }}
          >
            {showCreate ? '▾' : '▸'} Create New Group
          </button>
          {showCreate && (
            <div style={{marginTop: 10, display: 'flex', gap: 8}}>
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={e => setGroupName(e.target.value.slice(0, 30))}
                maxLength={30}
                style={{flex: 1}}
              />
              <button className="btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? '...' : 'Create'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ====== Group Home Mode (group loaded) ======
  const activeTournaments = tournaments.filter(t => t.status !== 'completed');
  const completedTournaments = tournaments.filter(t => t.status === 'completed');
  const leaderboard = aggregateStats();
  const handEmoji = (hand: 'Right' | 'Left') => hand === 'Right' ? '🤚' : '🖐️';

  return (
    <div className="screen">
      {/* Group Header */}
      <div className="group-home-header">
        <div style={{flex: 1}}>
          <h1>{state.group.name}</h1>
          <div className="meta">
            {state.group.players.length} players · Code: {state.group.code}
          </div>
        </div>
        <button className="btn-ghost" onClick={handleRefresh} aria-label="Refresh data" title="Sync from cloud" style={{fontSize: 18, padding: '4px 8px'}}>↻</button>
        <button className="btn-outline" onClick={handleSwitch}>Switch Group</button>
      </div>

      {/* New Tournament Button */}
      <button className="btn-primary btn-lg" style={{width: '100%', marginBottom: 16}} onClick={handleNewTournament} onMouseEnter={preloadTournamentScreens} onTouchStart={preloadTournamentScreens}>
        New Tournament
      </button>

      {/* Active/Upcoming Tournaments */}
      {activeTournaments.length > 0 && (
        <div style={{marginBottom: 16}}>
          <div className="section-title" style={{margin: '0 0 8px'}}>ACTIVE / UPCOMING</div>
          {activeTournaments.map(t => (
            <div key={t.id} className="tourn-card">
              <div className="header">
                <span className="date">{t.playDate}</span>
                <span className="status" style={{color: t.status === 'in_progress' ? 'var(--accent)' : 'var(--primary)'}}>
                  {t.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                </span>
              </div>
              <div className="meta">
                {t.matches.length} matches · {t.players.length} players
              </div>
              <div className="actions">
                <button className="btn-primary" onClick={() => handleResume(t.id)}>Resume</button>
                <button className="btn-outline" onClick={() => {
                  const base = `${window.location.origin}${window.location.pathname}`.replace(/index\.html$/, '');
                  const url = `${base}tv.html?group=${state.group!.code}&tournament=${t.id}`;
                  navigator.clipboard.writeText(url).catch(() => window.prompt('Copy TV link:', url));
                }}>📺 TV</button>
                {t.status === 'scheduled' && (
                  <button className="btn-danger" onClick={() => handleDeleteTournament(t.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manage Players */}
      <ManagePlayers />

      {/* Overall Player Stats */}
      {leaderboard.length > 0 && (
        <div style={{marginBottom: 16}}>
          <div className="section-title" style={{margin: '0 0 8px'}}>OVERALL PLAYER STATS</div>
          <div className="card" style={{padding: 8}}>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>P</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Win%</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 10).map((entry, idx) => (
                  <tr key={entry.id}>
                    <td>{idx + 1}</td>
                    <td>{entry.name}</td>
                    <td>{entry.stats.played}</td>
                    <td className="win-col">{entry.stats.won}</td>
                    <td>{entry.stats.lost}</td>
                    <td>{entry.stats.played > 0 ? Math.round((entry.stats.won / entry.stats.played) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leaderboard.length > 10 && (
              <button
                className="btn-ghost"
                style={{width: '100%', marginTop: 8, textAlign: 'center'}}
                onClick={() => nav.navigate('history')}
              >
                See all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Past Tournaments */}
      {completedTournaments.length > 0 && (
        <div style={{marginBottom: 16}}>
          <div className="section-title" style={{margin: '0 0 8px'}}>PAST TOURNAMENTS</div>
          {completedTournaments.slice(0, 5).map(t => {
            const mvpName = t.playerOfTournament
              ? (state.group!.players.find(p => p.id === t.playerOfTournament)?.name || t.playerOfTournament)
              : null;
            return (
              <div key={t.id} className="tourn-card" onClick={() => handleViewResults(t.id)} style={{cursor: 'pointer'}}>
                <div className="header">
                  <span className="date">{t.playDate}</span>
                  <span className="status" style={{color: 'var(--secondary)'}}>Completed</span>
                </div>
                <div className="meta">
                  Team A {t.matches.filter(m => m.score?.winner === 'A').length} – {t.matches.filter(m => m.score?.winner === 'B').length} Team B
                  {mvpName && <span> · MVP: {mvpName}</span>}
                </div>
              </div>
            );
          })}
          {completedTournaments.length > 5 && (
            <button
              className="btn-ghost"
              style={{width: '100%', textAlign: 'center'}}
              onClick={() => nav.navigate('history')}
            >
              View all
            </button>
          )}
        </div>
      )}

      <p style={{fontSize: 12, color: 'var(--text-muted)', marginTop: 20, textAlign: 'center'}}>
        ⚠️ Currently only doubles matches (2 vs 2) are supported.
      </p>
      <p style={{fontSize: 10, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center', opacity: 0.6}}>
        v1.0.3
      </p>
    </div>
  );
}
