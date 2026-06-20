import React, {useState, useMemo, useCallback} from 'react';
import {useStore} from '../state/store';
import {firebase} from '../services/firebase';
import {generateMatches, computeFairnessReport} from '../utils/matchGenerator';
import type {Tournament} from '../types';

interface Nav {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  reset: (screen?: string) => void;
}

interface Params {
  teamA: string[];
  teamB: string[];
  matchesPerPlayer: number;
  courts: number;
}

function uid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * 26)];
  return id;
}

export function ScheduleScreen({nav, params}: {nav: Nav; params: Params}) {
  if (!params?.teamA || !params?.teamB) {
    return <div className="screen" style={{textAlign: 'center', padding: 40}}>
      <p>No schedule data. Go back and generate a schedule.</p>
      <button className="btn-primary" onClick={() => nav.goBack()}>Go Back</button>
    </div>;
  }

  const {state, dispatch} = useStore();
  const {teamA, teamB, matchesPerPlayer, courts} = params;

  const allPlayerIds = useMemo(() => [...teamA, ...teamB], [teamA, teamB]);

  const [playDate, setPlayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [seed, setSeed] = useState(() => uid());
  const [randomness, setRandomness] = useState(() => state.group?.randomness ?? 30);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tournamentId, setTournamentId] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [tvLinkCopied, setTvLinkCopied] = useState(false);

  const matches = useMemo(
    () => generateMatches({teamA, teamB, matchesPerPlayer, courts, seed, randomness}),
    [teamA, teamB, matchesPerPlayer, courts, seed, randomness],
  );

  const fairness = useMemo(
    () => computeFairnessReport(matches, allPlayerIds),
    [matches, allPlayerIds],
  );

  const rounds = useMemo(() => {
    const map: Record<number, typeof matches> = {};
    matches.forEach(m => {
      if (!map[m.round]) map[m.round] = [];
      map[m.round].push(m);
    });
    return Object.entries(map)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([round, roundMatches]) => ({round: Number(round), matches: roundMatches}));
  }, [matches]);

  const getPlayerName = useCallback((id: string) => {
    const player = state.group?.players.find(p => p.id === id);
    return player?.name || 'Unknown';
  }, [state.group?.players]);

  const handleRegenerate = () => {
    setSeed(uid());
  };

  const handleSave = async () => {
    if (!state.group) return;

    const id = uid();
    const tournament: Tournament = {
      id,
      groupCode: state.group.code,
      groupName: state.group.name,
      playDate,
      players: state.group.players.filter(p => allPlayerIds.includes(p.id)),
      teamA,
      teamB,
      teamAName: state.teamAName,
      teamBName: state.teamBName,
      matches,
      matchesPerPlayer,
      courts,
      status: 'scheduled',
      createdAt: Date.now(),
    };

    dispatch({type: 'SET_TOURNAMENT', payload: tournament});
    await firebase.saveTournament(state.group.code, tournament);
    setTournamentId(id);
    setSaved(true);
  };

  const getTournamentLink = () => {
    if (!state.group) return '';
    return `${window.location.origin}${window.location.pathname}?group=${state.group.code}&tournament=${tournamentId}`;
  };

  const handleCopyLink = async () => {
    const url = getTournamentLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const getTvLink = () => {
    if (!state.group) return '';
    const base = `${window.location.origin}${window.location.pathname}`.replace(/index\.html$/, '');
    return `${base}tv.html?group=${state.group.code}&tournament=${tournamentId}`;
  };

  const handleCopyTvLink = async () => {
    const url = getTvLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setTvLinkCopied(true);
      setTimeout(() => setTvLinkCopied(false), 2000);
    } catch {
      window.prompt('Copy TV display link:', url);
    }
  };

  const handleShareLink = async () => {
    const url = getTournamentLink();
    if (!url) return;
    const shareData = {
      title: `${state.group!.name} — Tournament`,
      text: `Join our badminton tournament on ${playDate}!`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  const handleLetsPlay = async () => {
    if (!state.tournament || !state.group) return;

    const updated: Tournament = {
      ...state.tournament,
      status: 'in_progress',
      matches: state.tournament.matches.map(m =>
        m.status === 'pending' && m.round === 1
          ? {...m, status: 'in_progress' as const}
          : m
      ),
    };

    dispatch({type: 'SET_TOURNAMENT', payload: updated});
    await firebase.saveTournament(state.group.code, updated);
    nav.reset('live');
  };

  const handleHome = () => {
    nav.reset('setup');
  };

  return (
    <div className="screen">
      {/* Date Picker */}
      <div className="card">
        <label style={{fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6}}>
          Play Date
        </label>
        <input
          type="date"
          value={playDate}
          onChange={e => setPlayDate(e.target.value)}
          disabled={saved}
          style={{width: '100%'}}
        />
      </div>

      {/* Matches by Round */}
      <div style={{marginTop: 16}}>
        <h3 style={{marginBottom: 8, color: 'var(--text-primary)'}}>
          {matches.length} Matches in {rounds.length} Rounds
        </h3>
        <div className="rounds-grid">
        {rounds.map(({round, matches: roundMatches}) => (
          <div className="round-card" key={round}>
            <div style={{fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13}}>
              Round {round}
            </div>
            {roundMatches.map(m => (
              <div className="round-match" key={m.id}>
                <span style={{fontSize: 12, color: 'var(--text-muted)'}}>Court {m.court}</span>
                <span style={{color: 'var(--team-a)'}}>
                  {m.teamAIds.map(getPlayerName).join(' & ')}
                </span>
                <span style={{color: 'var(--text-muted)', fontSize: 12, margin: '0 6px'}}>vs</span>
                <span style={{color: 'var(--team-b)'}}>
                  {m.teamBIds.map(getPlayerName).join(' & ')}
                </span>
              </div>
            ))}
          </div>
        ))}
        </div>
      </div>

      {/* Fairness Report */}
      <div className="card fairness" style={{marginTop: 16}}>
        <h4 style={{marginBottom: 8}}>Fairness Report</h4>
        <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8}}>
          <span style={{fontSize: 18}}>{fairness.fair ? '✅' : '⚠️'}</span>
          <span>{fairness.fair ? 'Balanced schedule' : 'Slight imbalance detected'}</span>
        </div>
        <div style={{fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6}}>
          <div>Min matches: {fairness.min} | Max matches: {fairness.max}</div>
          <div>Worst partner repeat: {fairness.worstPartnerRepeat} | Worst opponent repeat: {fairness.worstOpponentRepeat}</div>
        </div>

        {/* Per-player match count */}
        <details style={{marginTop: 10}}>
          <summary style={{fontSize: 12, cursor: 'pointer', color: 'var(--primary)', fontWeight: 600}}>Matches per player</summary>
          <table className="stats-table" style={{marginTop: 6}}>
            <thead><tr><th>Player</th><th>Matches</th></tr></thead>
            <tbody>
              {Object.entries(fairness.counts).map(([id, count]) => (
                <tr key={id}><td>{getPlayerName(id)}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </details>

        {/* Partner repeats */}
        {fairness.worstPartnerRepeat > 0 && (
          <details style={{marginTop: 6}}>
            <summary style={{fontSize: 12, cursor: 'pointer', color: 'var(--primary)', fontWeight: 600}}>Partner repeats</summary>
            <table className="stats-table" style={{marginTop: 6}}>
              <thead><tr><th>Pair</th><th>Times</th></tr></thead>
              <tbody>
                {Object.entries(fairness.partnerCounts).filter(([,c]) => c > 1).sort(([,a],[,b]) => b - a).map(([pair, count]) => (
                  <tr key={pair}><td>{pair.split('-').map(id => getPlayerName(id)).join(' + ')}</td><td>{count}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        {/* Opponent repeats */}
        {fairness.worstOpponentRepeat > 0 && (
          <details style={{marginTop: 6}}>
            <summary style={{fontSize: 12, cursor: 'pointer', color: 'var(--primary)', fontWeight: 600}}>Opponent repeats</summary>
            <table className="stats-table" style={{marginTop: 6}}>
              <thead><tr><th>Pair</th><th>Times</th></tr></thead>
              <tbody>
                {Object.entries(fairness.opponentCounts).filter(([,c]) => c > 1).sort(([,a],[,b]) => b - a).map(([pair, count]) => (
                  <tr key={pair}><td>{pair.split('-').map(id => getPlayerName(id)).join(' vs ')}</td><td>{count}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        {/* Opponent Matrix: Team A vs Team B */}
        <details style={{marginTop: 6}}>
          <summary style={{fontSize: 12, cursor: 'pointer', color: 'var(--primary)', fontWeight: 600}}>Team A vs Team B (Opponent Matrix)</summary>
          <div style={{overflowX: 'auto', marginTop: 6}}>
            <table className="stats-table">
              <thead>
                <tr>
                  <th></th>
                  {Object.keys(Object.values(fairness.opponentMatrix)[0] || {}).map(bId => (
                    <th key={bId} style={{textAlign: 'center'}}>{getPlayerName(bId).split(' ')[0].slice(0, 8)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(fairness.opponentMatrix).map(([aId, row]) => (
                  <tr key={aId}>
                    <td style={{fontWeight: 600}}>{getPlayerName(aId).split(' ')[0].slice(0, 8)}</td>
                    {Object.entries(row).map(([bId, count]) => (
                      <td key={bId} style={{
                        textAlign: 'center',
                        color: count === 0 ? 'var(--text-muted)' : count === 1 ? 'var(--secondary)' : 'var(--accent)',
                        fontWeight: count >= 2 ? 700 : 400,
                      }}>{count}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        {/* Partner Matrix A */}
        <details style={{marginTop: 6}}>
          <summary style={{fontSize: 12, cursor: 'pointer', color: 'var(--primary)', fontWeight: 600}}>Team A Partners</summary>
          <div style={{overflowX: 'auto', marginTop: 6}}>
            <table className="stats-table">
              <thead>
                <tr>
                  <th></th>
                  {Object.keys(fairness.partnerMatrixA).map(id => (
                    <th key={id} style={{textAlign: 'center'}}>{getPlayerName(id).split(' ')[0].slice(0, 8)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(fairness.partnerMatrixA).map(([rowId, row]) => (
                  <tr key={rowId}>
                    <td style={{fontWeight: 600}}>{getPlayerName(rowId).split(' ')[0].slice(0, 8)}</td>
                    {Object.entries(row).map(([colId, count]) => (
                      <td key={colId} style={{
                        textAlign: 'center',
                        color: count === 0 ? 'var(--text-muted)' : count === 1 ? 'var(--secondary)' : 'var(--accent)',
                        fontWeight: rowId === colId ? 700 : count >= 2 ? 700 : 400,
                        background: rowId === colId ? 'var(--surface-elevated)' : undefined,
                      }}>{count}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        {/* Partner Matrix B */}
        <details style={{marginTop: 6}}>
          <summary style={{fontSize: 12, cursor: 'pointer', color: 'var(--primary)', fontWeight: 600}}>Team B Partners</summary>
          <div style={{overflowX: 'auto', marginTop: 6}}>
            <table className="stats-table">
              <thead>
                <tr>
                  <th></th>
                  {Object.keys(fairness.partnerMatrixB).map(id => (
                    <th key={id} style={{textAlign: 'center'}}>{getPlayerName(id).split(' ')[0].slice(0, 8)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(fairness.partnerMatrixB).map(([rowId, row]) => (
                  <tr key={rowId}>
                    <td style={{fontWeight: 600}}>{getPlayerName(rowId).split(' ')[0].slice(0, 8)}</td>
                    {Object.entries(row).map(([colId, count]) => (
                      <td key={colId} style={{
                        textAlign: 'center',
                        color: count === 0 ? 'var(--text-muted)' : count === 1 ? 'var(--secondary)' : 'var(--accent)',
                        fontWeight: rowId === colId ? 700 : count >= 2 ? 700 : 400,
                        background: rowId === colId ? 'var(--surface-elevated)' : undefined,
                      }}>{count}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      {/* Actions Row */}
      {!saved && (
        <div className="actions-row" style={{marginTop: 16, display: 'flex', gap: 8}}>
          <button className="btn-outline" onClick={handleRegenerate} style={{flex: 1}}>
            Regenerate
          </button>
          <button className="btn-primary" onClick={handleSave} style={{flex: 1}}>
            Save Schedule
          </button>
        </div>
      )}

      {/* Advanced Section */}
      {!saved && (
        <div className="card" style={{marginTop: 12}}>
          <button
            className="btn-ghost"
            style={{width: '100%', textAlign: 'left', fontWeight: 600}}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▾' : '▸'} Advanced
          </button>
          {showAdvanced && (
            <div style={{marginTop: 12}}>
              <label style={{fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6}}>
                Randomness: {randomness}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={randomness}
                onChange={e => setRandomness(Number(e.target.value))}
                style={{width: '100%', marginBottom: 8}}
              />
              <div className="preset-row">
                {[0, 25, 50, 75, 100].map(val => (
                  <button
                    key={val}
                    className={`preset-btn ${randomness === val ? 'active' : ''}`}
                    onClick={() => setRandomness(val)}
                  >
                    {val}
                  </button>
                ))}
              </div>

              <label style={{fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginTop: 12, marginBottom: 6}}>
                Seed (optional)
              </label>
              <div style={{display: 'flex', gap: 8}}>
                <input
                  type="text"
                  value={seed}
                  onChange={e => setSeed(e.target.value)}
                  placeholder="Auto-generated"
                  style={{flex: 1, fontSize: 13}}
                />
                <button className="btn-ghost" onClick={() => setSeed(uid())} style={{fontSize: 12}}>Random</button>
              </div>
              <p style={{fontSize: 11, color: 'var(--text-muted)', marginTop: 4}}>Same seed + same players = same schedule</p>
            </div>
          )}
        </div>
      )}

      {/* Post-Save Actions */}
      {saved && (
        <div style={{marginTop: 16}}>
          <p style={{fontSize: 13, color: 'var(--secondary)', fontWeight: 600, marginBottom: 10, textAlign: 'center'}}>
            ✓ Schedule saved! Share the link with your group.
          </p>
          <div style={{display: 'flex', gap: 8}}>
            <button
              className="btn-outline"
              style={{flex: 1}}
              onClick={handleCopyLink}
            >
              {linkCopied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
            <button
              className="btn-outline"
              style={{flex: 1}}
              onClick={handleCopyTvLink}
            >
              {tvLinkCopied ? '✓ Copied!' : '📺 TV Link'}
            </button>
            <button
              className="btn-primary"
              style={{flex: 1}}
              onClick={handleShareLink}
            >
              📤 Share
            </button>
            <button
              className="btn-outline"
              style={{flex: 1}}
              onClick={() => window.print()}
            >
              🖨️ Print
            </button>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="actions-row" style={{marginTop: 16, display: 'flex', gap: 8}}>
        <button
          className="btn-secondary"
          style={{flex: 1}}
          onClick={handleHome}
          disabled={!saved}
        >
          Home
        </button>
        <button
          className="btn-primary btn-lg"
          style={{flex: 2}}
          onClick={handleLetsPlay}
          disabled={!saved}
        >
          Let's Play!
        </button>
      </div>
    </div>
  );
}
