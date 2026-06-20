import React, {useState, useMemo, useCallback, useEffect, useRef} from 'react';
import {useStore, computeStats, computePOT} from '../state/store';
import {firebase, checkConnectivity, isConnected} from '../services/firebase';
import ScoreSheet from '../components/ScoreSheet';
import AddMatchSheet from '../components/AddMatchSheet';
import type {Match} from '../types';

interface Nav {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  reset: (screen?: string) => void;
}

export function LiveScreen({nav}: {nav: Nav}) {
  const {state, dispatch} = useStore();
  const tournament = state.tournament;
  const group = state.group;

  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'saved-local' | 'error' | 'sync-error' | 'idle'>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const isRemoteUpdate = useRef(false);
  const tournamentRef = useRef(tournament);
  tournamentRef.current = tournament;

  // Subscribe to real-time updates + refresh on tab focus
  const [syncing, setSyncing] = useState(false);
  const lastSaveTime = useRef(0);

  const bidirectionalSync = useCallback(async () => {
    if (!group || !tournamentRef.current) return;
    setSyncing(true);
    try {
      const online = await checkConnectivity();
      if (!online) {
        setSaveStatus('sync-error');
        setSyncing(false);
        return;
      }
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const merged = await firebase.syncTournament(group.code, tournamentRef.current);
      isRemoteUpdate.current = true;
      dispatch({type: 'SET_TOURNAMENT', payload: merged});
      isRemoteUpdate.current = false;
      setSaveStatus('saved');
      lastSaveTime.current = Date.now();
      setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000);
    } catch (err: any) {
      setLastError(err?.message || err?.code || String(err));
      setSaveStatus('sync-error');
    }
    setSyncing(false);
  }, [group?.code, tournament?.id]);

  useEffect(() => {
    if (!group || !tournament) return;
    const unsub = firebase.subscribeTournament(group.code, tournament.id, (updated) => {
      isRemoteUpdate.current = true;
      dispatch({type: 'SET_TOURNAMENT', payload: updated});
      isRemoteUpdate.current = false;
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSaveTime.current > 5000) {
        bidirectionalSync();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { unsub(); document.removeEventListener('visibilitychange', onVisible); };
  }, [group?.code, tournament?.id, bidirectionalSync]);

  const myPlayerId = state.myPlayerId;

  const allMatches = tournament?.matches || [];
  const players = tournament?.players || [];

  const isMyMatch = useCallback((m: Match) => {
    if (!myPlayerId) return false;
    return [...m.teamAIds, ...m.teamBIds].includes(myPlayerId);
  }, [myPlayerId]);

  const filteredMatches = useMemo(() => {
    if (filter === 'mine') return allMatches.filter(isMyMatch);
    return allMatches;
  }, [allMatches, filter, isMyMatch]);

  const inProgress = useMemo(() => filteredMatches.filter(m => m.status === 'in_progress'), [filteredMatches]);
  const pending = useMemo(() => filteredMatches.filter(m => m.status === 'pending'), [filteredMatches]);
  const completed = useMemo(() => filteredMatches.filter(m => m.status === 'completed'), [filteredMatches]);
  const cancelled = useMemo(() => filteredMatches.filter(m => m.status === 'cancelled'), [filteredMatches]);

  const teamAWins = useMemo(
    () => allMatches.filter(m => m.status === 'completed' && m.score?.winner === 'A').length,
    [allMatches],
  );
  const teamBWins = useMemo(
    () => allMatches.filter(m => m.status === 'completed' && m.score?.winner === 'B').length,
    [allMatches],
  );
  const remaining = useMemo(
    () => allMatches.filter(m => m.status === 'pending' || m.status === 'in_progress').length,
    [allMatches],
  );

  const getPlayerName = useCallback((id: string) => {
    const player = players.find(p => p.id === id);
    return player?.name || 'Unknown';
  }, [players]);

  const maxRound = useMemo(() => Math.max(0, ...allMatches.map(m => m.round)), [allMatches]);
  const nextMatchId = useMemo(() => Math.max(0, ...allMatches.map(m => m.id)) + 1, [allMatches]);

  const handleMatchTap = (match: Match) => {
    if (match.status === 'cancelled') {
      if (window.confirm(`Restore match ${match.id}?`)) {
        dispatch({type: 'RESTORE_MATCH', payload: match.id});
      }
      return;
    }
    setSelectedMatch(match);
  };

  // Auto-save tournament to Firebase whenever it changes (debounced, with retry)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    if (!group || !tournament || tournament.status === 'completed') return;
    if (isRemoteUpdate.current) return;
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const latest = tournamentRef.current;
      if (!latest || !group) return;

      const attemptSave = async (attempt: number): Promise<void> => {
        try {
          await firebase.saveTournament(group.code, latest);
          if (isConnected()) {
            setSaveStatus('saved');
          } else {
            setSaveStatus('saved-local');
          }
          retryCount.current = 0;
          setLastError(null);
          setTimeout(() => setSaveStatus(prev => (prev === 'saved' || prev === 'saved-local') ? 'idle' : prev), 3000);
        } catch (err: any) {
          if (attempt < maxRetries) {
            const delay = 1000 * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, delay));
            return attemptSave(attempt + 1);
          }
          retryCount.current = attempt;
          setLastError(err?.message || err?.code || String(err));
          setSaveStatus('error');
        }
      };
      attemptSave(0);
    }, 1000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [tournament, group]);

  // Force-save on tab close / navigation away
  useEffect(() => {
    const flushOnUnload = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const latest = tournamentRef.current;
      if (group && latest && latest.status !== 'completed') {
        firebase.saveTournament(group.code, latest).catch(() => {});
      }
    };
    const onVisChange = () => { if (document.visibilityState === 'hidden') flushOnUnload(); };
    window.addEventListener('beforeunload', flushOnUnload);
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('beforeunload', flushOnUnload);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [group]);

  // Undo
  const undoStack = state.undoStack;
  const [showUndo, setShowUndo] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSaveScore = (updatedMatch: Match) => {
    dispatch({type: 'UPDATE_MATCH', payload: {...updatedMatch, updatedAt: Date.now()}});
    setSelectedMatch(null);
    setShowUndo(true);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setShowUndo(false), 5000);

    // Auto-advance: if all matches in this round are now completed/cancelled, start next round
    if (updatedMatch.status === 'completed' && tournament) {
      const round = updatedMatch.round;
      const roundMatches = tournament.matches.filter(m => m.round === round);
      const allDone = roundMatches.every(m =>
        m.id === updatedMatch.id || m.status === 'completed' || m.status === 'cancelled'
      );
      if (allDone) {
        const nextRound = tournament.matches.filter(m => m.round === round + 1 && m.status === 'pending');
        nextRound.forEach(m => {
          dispatch({type: 'UPDATE_MATCH', payload: {...m, status: 'in_progress', updatedAt: Date.now()}});
        });
      }
    }
  };

  const handleUndo = () => {
    dispatch({type: 'UNDO_LAST_SCORE'});
    setShowUndo(false);
  };

  const handleCancelMatch = (matchId: number) => {
    // Stamp updatedAt so the cancellation wins in merge
    const match = tournament?.matches.find(m => m.id === matchId);
    if (match) {
      dispatch({type: 'UPDATE_MATCH', payload: {...match, status: 'cancelled', updatedAt: Date.now()}});
    } else {
      dispatch({type: 'CANCEL_MATCH', payload: matchId});
    }
    setSelectedMatch(null);
  };

  const handleSwapPlayer = (matchId: number, oldId: string, newId: string) => {
    dispatch({type: 'SWAP_PLAYER_IN_MATCH', payload: {matchId, oldPlayerId: oldId, newPlayerId: newId}});
  };

  const handleRenamePlayer = (id: string, name: string) => {
    dispatch({type: 'RENAME_PLAYER', payload: {id, name}});
  };

  const handleAddMatch = (match: Match) => {
    dispatch({type: 'ADD_MATCH', payload: match});
    setShowAddMatch(false);
  };

  const handleHome = async () => {
    const hasCompletedMatches = allMatches.some(m => m.status === 'completed');
    if (hasCompletedMatches) {
      if (!window.confirm('Leave this tournament? You can resume it later from the home screen.')) return;
    }
    // Cancel pending debounce and force immediate save with latest state
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const latest = tournamentRef.current;
    if (group && latest) {
      try {
        await firebase.saveTournament(group.code, latest);
      } catch {
        if (!window.confirm('Failed to save to cloud. Leave anyway? (Data saved locally)')) return;
      }
    }
    nav.reset('setup');
  };

  const handleConclude = async () => {
    if (!window.confirm('Conclude this tournament? This will finalize all results.')) return;
    dispatch({type: 'CONCLUDE_TOURNAMENT'});
    if (group && state.tournament) {
      const playerStats = computeStats(state.tournament.matches);
      const pot = computePOT(playerStats);
      try {
        await firebase.saveTournament(group.code, {
          ...state.tournament,
          status: 'completed',
          playerStats,
          playerOfTournament: pot,
        });
        dispatch({type: 'UPDATE_TOURNAMENT_SUMMARY', payload: {id: state.tournament.id, status: 'completed'}});
        nav.reset('results');
      } catch {
        setSaveStatus('error');
        alert('Failed to save tournament results. Please check your connection and try again.');
      }
    } else {
      nav.reset('results');
    }
  };

  const renderFlag = (flag: string) => {
    const labels: Record<string, string> = {
      added: 'Added',
      substitution: 'Sub',
      edited: 'Edited',
      restored: 'Restored',
    };
    return (
      <span key={flag} className="match-flag">
        {labels[flag] || flag}
      </span>
    );
  };

  const renderMatchCard = (match: Match) => {
    const isMine = isMyMatch(match);
    const classNames = [
      'match-card',
      match.status,
      isMine ? 'mine' : '',
    ].filter(Boolean).join(' ');

    return (
      <div
        key={match.id}
        className={classNames}
        onClick={() => handleMatchTap(match)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMatchTap(match); } }}
        tabIndex={0}
        role="button"
        aria-label={`Match ${match.id}, Court ${match.court}, Round ${match.round}. ${match.status}`}
      >
        {/* Flags row */}
        {match.flags && match.flags.length > 0 && (
          <div className="match-flags">
            {match.flags.map(renderFlag)}
          </div>
        )}

        {/* Court & Round */}
        <div className="match-meta">
          <span>Court {match.court} &bull; Round {match.round}</span>
          {isMine && <span className="you-badge">YOU</span>}
        </div>

        {/* Teams & Score */}
        <div className="match-teams">
          <span className="team-a-names">
            {match.teamAIds.map(getPlayerName).join(' & ')}
          </span>
          <span className="match-score-display">
            {match.score
              ? ` ${match.score.teamA} - ${match.score.teamB} `
              : ' vs '}
          </span>
          <span className="team-b-names">
            {match.teamBIds.map(getPlayerName).join(' & ')}
          </span>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, matches: Match[]) => {
    if (matches.length === 0) return null;
    return (
      <div style={{marginBottom: 16}}>
        <div className="section-title">{title}</div>
        <div className="match-grid">
          {matches.map(renderMatchCard)}
        </div>
      </div>
    );
  };

  if (!tournament) {
    return (
      <div className="screen" style={{textAlign: 'center', padding: 40}}>
        <p>No active tournament.</p>
        <button className="btn-primary" onClick={() => nav.reset('setup')}>Go Home</button>
      </div>
    );
  }

  return (
    <div className="screen">
      {/* Save status indicator */}
      {saveStatus === 'error' && (
        <div className="save-status error">
          ⚠️ Save failed — retries exhausted
          <button className="btn-ghost" style={{padding: '2px 8px', fontSize: 12, marginLeft: 8}} onClick={bidirectionalSync}>Retry</button>
          <button className="btn-ghost" style={{padding: '2px 8px', fontSize: 12, marginLeft: 4, textDecoration: 'underline'}} onClick={() => setShowErrorDetail(true)}>Details</button>
        </div>
      )}
      {saveStatus === 'sync-error' && (
        <div className="save-status error">
          ⚠️ Sync failed — can't reach server
          <button className="btn-ghost" style={{padding: '2px 8px', fontSize: 12, marginLeft: 8}} onClick={bidirectionalSync}>Retry</button>
          <button className="btn-ghost" style={{padding: '2px 8px', fontSize: 12, marginLeft: 4, textDecoration: 'underline'}} onClick={() => setShowErrorDetail(true)}>Details</button>
        </div>
      )}
      {showErrorDetail && lastError && (
        <div className="modal-overlay" onClick={() => setShowErrorDetail(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{maxWidth: 400, padding: 20}}>
            <h3 style={{margin: '0 0 12px'}}>Error Details</h3>
            <pre style={{background: 'var(--surface-elevated)', padding: 12, borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflow: 'auto'}}>{lastError}</pre>
            <button className="btn-ghost" style={{width: '100%', marginTop: 12}} onClick={() => setShowErrorDetail(false)}>Close</button>
          </div>
        </div>
      )}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px'}}>
        <span style={{fontSize: 11}}>
          {saveStatus === 'saved' && <span style={{color: 'var(--secondary)'}}>✓ Saved</span>}
          {saveStatus === 'saved-local' && <span style={{color: 'var(--warning, #e6a817)'}}>✓ Saved locally</span>}
          {saveStatus === 'saving' && <span style={{color: 'var(--text-muted)'}}>Saving...</span>}
        </span>
        <button className="btn-ghost" onClick={bidirectionalSync} disabled={syncing} style={{fontSize: 11, padding: '2px 8px'}} aria-label="Bidirectional sync with cloud">
          {syncing ? '⟳ Syncing...' : '↻ Sync'}
        </button>
      </div>

      {/* Score Banner */}
      <div className="score-banner">
        <div className="score-card" style={{
          background: teamAWins > teamBWins ? 'var(--secondary-light)' : teamAWins < teamBWins ? 'var(--danger-light)' : 'var(--surface-elevated)',
          border: `2px solid ${teamAWins >= teamBWins ? 'var(--team-a)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)', padding: '10px 16px', textAlign: 'center', flex: 1,
        }}>
          <div style={{fontSize: 11, fontWeight: 700, color: 'var(--team-a)', textTransform: 'uppercase'}}>{tournament?.teamAName || 'Team A'}</div>
          <div style={{fontSize: 32, fontWeight: 'bold', color: 'var(--team-a)'}}>{teamAWins}</div>
        </div>
        <div style={{padding: '0 10px', textAlign: 'center'}}>
          <div style={{fontSize: 11, color: 'var(--text-muted)'}}>{remaining} left</div>
        </div>
        <div className="score-card" style={{
          background: teamBWins > teamAWins ? 'var(--secondary-light)' : teamBWins < teamAWins ? 'var(--danger-light)' : 'var(--surface-elevated)',
          border: `2px solid ${teamBWins >= teamAWins ? 'var(--team-b)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)', padding: '10px 16px', textAlign: 'center', flex: 1,
        }}>
          <div style={{fontSize: 11, fontWeight: 700, color: 'var(--team-b)', textTransform: 'uppercase'}}>{tournament?.teamBName || 'Team B'}</div>
          <div style={{fontSize: 32, fontWeight: 'bold', color: 'var(--team-b)'}}>{teamBWins}</div>
        </div>
      </div>

      {/* Filter Toggle */}
      <div className="toggle-row">
        <button
          className={`toggle-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        {myPlayerId ? (
          <button
            className={`toggle-btn ${filter === 'mine' ? 'active' : ''}`}
            onClick={() => setFilter(filter === 'mine' ? 'all' : 'mine')}
          >
            My Matches ({getPlayerName(myPlayerId)})
          </button>
        ) : (
          <select
            className="toggle-btn"
            value=""
            onChange={e => {
              if (e.target.value) {
                dispatch({type: 'SET_MY_PLAYER', payload: e.target.value});
                setFilter('mine');
              }
            }}
            style={{appearance: 'none', textAlign: 'center', cursor: 'pointer'}}
          >
            <option value="">My Matches ▾</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>
      {myPlayerId && filter === 'mine' && (
        <div style={{textAlign: 'center', marginBottom: 4}}>
          <button className="btn-ghost" style={{fontSize: 11}} onClick={() => { dispatch({type: 'SET_MY_PLAYER', payload: null}); setFilter('all'); }}>
            Clear selection
          </button>
        </div>
      )}

      {/* Match Sections */}
      {renderSection('NOW PLAYING', inProgress)}
      {renderSection('UP NEXT', pending)}
      {renderSection('COMPLETED', completed)}
      {renderSection('CANCELLED', cancelled)}

      {filteredMatches.length === 0 && (
        <div style={{textAlign: 'center', color: 'var(--text-muted)', padding: 40}}>
          {filter === 'mine' ? 'No matches assigned to you.' : 'No matches scheduled.'}
        </div>
      )}

      {/* Undo toast */}
      {showUndo && undoStack.length > 0 && (
        <div className="undo-toast">
          <span>Score saved</span>
          <button className="btn-ghost" onClick={handleUndo}>Undo</button>
        </div>
      )}

      {/* Floating Action Bar */}
      <div className="floating-bar" role="toolbar" aria-label="Tournament actions">
        <button className="btn-secondary" onClick={handleHome} aria-label="Go to home screen">
          Home
        </button>
        <button className="btn-outline" onClick={() => setShowAddMatch(true)} aria-label="Add a custom match">
          + Add
        </button>
        <button className="btn-primary" onClick={handleConclude} aria-label="Conclude tournament">
          Conclude
        </button>
      </div>

      {/* Score Sheet Modal */}
      {selectedMatch && (
        <ScoreSheet
          match={selectedMatch}
          getPlayerName={getPlayerName}
          players={players}
          onClose={() => setSelectedMatch(null)}
          onSave={handleSaveScore}
          onCancel={handleCancelMatch}
          onSwapPlayer={handleSwapPlayer}
          onRenamePlayer={handleRenamePlayer}
        />
      )}

      {/* Add Match Modal */}
      {showAddMatch && (
        <AddMatchSheet
          players={players}
          nextMatchId={nextMatchId}
          maxRound={maxRound}
          courts={tournament.courts}
          onClose={() => setShowAddMatch(false)}
          onAdd={handleAddMatch}
        />
      )}
    </div>
  );
}
