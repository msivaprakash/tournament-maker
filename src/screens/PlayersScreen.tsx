import React, {useState, useMemo} from 'react';
import {useStore} from '../state/store';
import type {Player} from '../types';

interface Nav {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  reset: (screen?: string) => void;
}

export function PlayersScreen({nav}: {nav: Nav}) {
  const {state, dispatch} = useStore();
  const [validationError, setValidationError] = useState('');
  const [mppInput, setMppInput] = useState(String(state.matchesPerPlayer));

  const matchesPerPlayer = state.matchesPerPlayer;
  const courts = state.courts;
  const teamAName = state.teamAName;
  const teamBName = state.teamBName;
  const setCourts = (v: number) => dispatch({type: 'SET_SETTINGS', payload: {courts: v}});

  const players = state.group?.players || [];

  const teamA = useMemo(() => players.filter(p => p.available && p.team === 'A'), [players]);
  const teamB = useMemo(() => players.filter(p => p.available && p.team === 'B'), [players]);
  const available = useMemo(() => players.filter(p => p.available), [players]);

  const handEmoji = (hand: 'Right' | 'Left') => hand === 'Right' ? '🤚' : '🖐️';

  const handleToggleAvailability = (id: string) => {
    dispatch({type: 'TOGGLE_AVAILABILITY', payload: id});
  };

  const handleSetTeam = (playerId: string, team: 'A' | 'B' | '') => {
    const player = players.find(p => p.id === playerId);
    const newTeam = player?.team === team ? '' : team;
    dispatch({type: 'SET_TEAM', payload: {playerId, team: newTeam}});
  };

  const handleShuffle = () => {
    const availablePlayers = players.filter(p => p.available);
    const shuffled = [...availablePlayers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const half = Math.ceil(shuffled.length / 2);
    shuffled.forEach((p, idx) => {
      dispatch({type: 'SET_TEAM', payload: {playerId: p.id, team: idx < half ? 'A' : 'B'}});
    });
  };

  const handleGenerate = () => {
    setValidationError('');

    if (available.length < 4) {
      setValidationError('Need at least 4 available players');
      return;
    }

    const unassigned = available.filter(p => !p.team);
    if (unassigned.length > 0) {
      setValidationError('All available players must be assigned to a team. Use Shuffle or assign manually.');
      return;
    }

    if (teamA.length < 2) {
      setValidationError('Team A needs at least 2 players');
      return;
    }
    if (teamB.length < 2) {
      setValidationError('Team B needs at least 2 players');
      return;
    }

    const mpp = Math.max(1, Math.min(10, parseInt(mppInput) || 1));
    dispatch({type: 'SET_SETTINGS', payload: {matchesPerPlayer: mpp}});
    nav.navigate('schedule', {
      teamA: teamA.map(p => p.id),
      teamB: teamB.map(p => p.id),
      matchesPerPlayer: mpp,
      courts,
    });
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', flex: 1}}>
      {/* Summary Bar */}
      <div className="summary-bar" style={{flexWrap: 'wrap', gap: 6}}>
        <span className="a" style={{display: 'flex', alignItems: 'center', gap: 4}}>
          <input
            type="text"
            value={teamAName}
            onChange={e => dispatch({type: 'SET_SETTINGS', payload: {teamAName: e.target.value.slice(0, 15)}})}
            maxLength={15}
            style={{width: 70, padding: '2px 6px', fontSize: 12, fontWeight: 700, color: 'var(--team-a)', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', textAlign: 'center'}}
          />
          : {teamA.length}
        </span>
        <span className="sep">|</span>
        <span className="b" style={{display: 'flex', alignItems: 'center', gap: 4}}>
          <input
            type="text"
            value={teamBName}
            onChange={e => dispatch({type: 'SET_SETTINGS', payload: {teamBName: e.target.value.slice(0, 15)}})}
            maxLength={15}
            style={{width: 70, padding: '2px 6px', fontSize: 12, fontWeight: 700, color: 'var(--team-b)', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', textAlign: 'center'}}
          />
          : {teamB.length}
        </span>
        <span className="sep">|</span>
        <span>Available Today: {available.length}/{players.length}</span>
      </div>

      <div className="screen">
        {players.length === 0 && (
          <div style={{textAlign: 'center', color: 'var(--text-muted)', padding: 20}}>
            <p>No players in this group yet.</p>
            <p style={{marginTop: 8, fontSize: 13}}>Go back and add players from the group home screen.</p>
          </div>
        )}

        {/* Instructions */}
        {players.length > 0 && (
          <p style={{fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12}}>
            Check players <strong>available today</strong>, then assign them to Team A or B.
          </p>
        )}

        {/* Player List — availability + team assignment only */}
        {players.map(p => (
          <div key={p.id} className={`player-row ${!p.available ? 'inactive' : ''}`}>
            <input
              type="checkbox"
              checked={p.available}
              onChange={() => handleToggleAvailability(p.id)}
              style={{width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--primary)'}}
            />
            <span className="name">{p.name} {handEmoji(p.dominantHand)}</span>
            {p.available && (
              <div className="team-btns">
                <button
                  className={`team-btn ${p.team === 'A' ? 'active-a' : ''}`}
                  onClick={() => handleSetTeam(p.id, 'A')}
                >
                  A
                </button>
                <button
                  className={`team-btn ${p.team === 'B' ? 'active-b' : ''}`}
                  onClick={() => handleSetTeam(p.id, 'B')}
                >
                  B
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Shuffle Teams */}
        {players.length >= 4 && (
          <div style={{marginTop: 12}}>
            <button
              className="btn-outline"
              style={{width: '100%'}}
              onClick={handleShuffle}
              disabled={available.length < 4}
            >
              🔀 Shuffle Teams
            </button>
            <p style={{fontSize: 11, color: 'var(--text-muted)', marginTop: 4}}>
              Extra players are kept unassigned (bench) when count is odd.
            </p>
          </div>
        )}

        {/* Settings Card */}
        <div className="card" style={{marginTop: 16}}>
          <div style={{marginBottom: 12}}>
            <label style={{fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6}}>
              Matches per player
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={mppInput}
              onChange={e => setMppInput(e.target.value)}
              onBlur={() => {
                const v = Math.max(1, Math.min(10, parseInt(mppInput) || 1));
                setMppInput(String(v));
                dispatch({type: 'SET_SETTINGS', payload: {matchesPerPlayer: v}});
              }}
              style={{width: 80}}
            />
            <p style={{fontSize: 11, color: 'var(--text-muted)', marginTop: 4}}>Each player will play approximately this many matches.</p>
          </div>
          <div>
            <label style={{fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6}}>
              Courts
            </label>
            <div className="court-row">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  className={`court-btn ${courts === n ? 'active' : ''}`}
                  onClick={() => setCourts(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={{fontSize: 11, color: 'var(--text-muted)', marginTop: 4}}>Matches will be scheduled in parallel based on available courts.</p>
          </div>
        </div>

        {/* Validation Error */}
        {validationError && (
          <div style={{color: 'var(--danger)', fontSize: 13, textAlign: 'center', marginTop: 12}}>
            {validationError}
          </div>
        )}

        {/* Generate Schedule Button */}
        <button
          className="btn-primary btn-lg"
          style={{width: '100%', marginTop: 16}}
          onClick={handleGenerate}
          disabled={available.length < 4}
        >
          Generate Schedule
        </button>

        {/* Link back to manage roster */}
        <p style={{fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12}}>
          Need to add or remove players? <button className="btn-ghost" style={{fontSize: 12, textDecoration: 'underline', padding: 0}} onClick={() => nav.goBack()}>Manage roster</button> from the group home.
        </p>
      </div>
    </div>
  );
}
