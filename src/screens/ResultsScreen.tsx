import React, {useMemo} from 'react';
import {useStore} from '../state/store';
import {useSortable} from '../utils/useSortable';
import type {PlayerStats} from '../types';

interface Nav {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  reset: (screen?: string) => void;
}

export function ResultsScreen({nav}: {nav: Nav}) {
  const {state} = useStore();
  const tournament = state.tournament;
  const players = state.group?.players || [];

  if (!tournament) return (
    <div className="screen" style={{textAlign: 'center', padding: 40}}>
      <p>No tournament data available.</p>
      <button className="btn-primary" onClick={() => nav.reset('setup')}>Go Home</button>
    </div>
  );

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || '?';

  const activeMatches = tournament.matches.filter(m => m.status === 'completed');
  const teamAWins = activeMatches.filter(m => m.score?.winner === 'A').length;
  const teamBWins = activeMatches.filter(m => m.score?.winner === 'B').length;
  const isTie = teamAWins === teamBWins;
  const winnerText = isTie ? "It's a Draw!" : (teamAWins > teamBWins ? 'Team A Wins!' : 'Team B Wins!');

  const potIds = tournament.playerOfTournament ? tournament.playerOfTournament.split(',') : [];
  const potNames = potIds.map(id => getPlayerName(id)).join(', ');
  const potWins = potIds.length > 0 && tournament.playerStats?.[potIds[0]]?.won;

  const statsData = useMemo(() => {
    if (!tournament.playerStats) return [];
    return Object.entries(tournament.playerStats)
      .map(([id, s]) => ({
        id,
        name: getPlayerName(id),
        ...s,
        winPct: s.played > 0 ? Math.round((s.won / s.played) * 100) : 0,
      }));
  }, [tournament.playerStats]);

  const {sorted: sortedStats, toggleSort, indicator} = useSortable(statsData, 'winPct');

  const handleShare = async () => {
    const lines = [
      `${tournament.groupName} — ${tournament.playDate}`,
      `${winnerText} (${teamAWins} - ${teamBWins})`,
      `Player of the Tournament: ${potNames || 'N/A'}${potWins ? ` (${potWins} wins)` : ''}`,
      '',
      'Match Summary:',
      ...activeMatches.map(m =>
        `M${m.id}: ${getPlayerName(m.teamAIds[0])}+${getPlayerName(m.teamAIds[1])} ${m.score?.teamA}-${m.score?.teamB} ${getPlayerName(m.teamBIds[0])}+${getPlayerName(m.teamBIds[1])}`
      ),
      '',
      'Player Stats:',
      ...sortedStats.map((s, i) => `${i + 1}. ${s.name}: ${s.won}W/${s.lost}L (${s.winPct}%)`),
    ];
    const text = lines.join('\n');
    if (navigator.share) {
      try { await navigator.share({title: `${tournament.groupName} Results`, text}); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch {
      window.prompt('Copy this text:', text);
    }
  };

  return (
    <div className="screen">
      {/* Winner Banner */}
      <div className="winner-banner">
        <span className="trophy">🏆</span>
        <h2>{winnerText}</h2>
        <div className="final-score">{teamAWins} – {teamBWins}</div>
      </div>

      {/* Player of Tournament */}
      <div className="pot-card">
        <span>⭐ Player of the Tournament</span>
        <h3>{potNames || 'N/A'}</h3>
        {potWins ? <span className="meta">{potWins} wins{potIds.length > 1 ? ' each' : ''}</span> : null}
      </div>

      {/* Match Summary */}
      <div className="card" style={{marginBottom: 16}}>
        <div className="section-title" style={{margin: '0 0 8px'}}>MATCH SUMMARY</div>
        {activeMatches.map(m => (
          <div key={m.id} style={{padding: '4px 0', fontSize: 13}}>
            <span>M{m.id}: {getPlayerName(m.teamAIds[0])}+{getPlayerName(m.teamAIds[1])} </span>
            <span style={{color: m.score?.winner === 'A' ? 'var(--secondary)' : 'var(--text-muted)', fontWeight: 700}}>
              {m.score?.teamA}
            </span>
            <span style={{margin: '0 3px', color: 'var(--text-muted)'}}>–</span>
            <span style={{color: m.score?.winner === 'B' ? 'var(--secondary)' : 'var(--text-muted)', fontWeight: 700}}>
              {m.score?.teamB}
            </span>
            <span> {getPlayerName(m.teamBIds[0])}+{getPlayerName(m.teamBIds[1])}</span>
          </div>
        ))}
      </div>

      {/* Player Stats Table */}
      <div className="card" style={{marginBottom: 16, padding: 8}}>
        <div className="section-title" style={{margin: '0 0 8px'}}>PLAYER STATS</div>
        <table className="stats-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('name')}>Player{indicator('name')}</th>
              <th onClick={() => toggleSort('played')}>P{indicator('played')}</th>
              <th onClick={() => toggleSort('won')}>W{indicator('won')}</th>
              <th onClick={() => toggleSort('lost')}>L{indicator('lost')}</th>
              <th onClick={() => toggleSort('winPct')}>W%{indicator('winPct')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map(s => (
              <tr key={s.id}>
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

      {/* Actions */}
      <div style={{display: 'flex', gap: 12}}>
        <button className="btn-primary" style={{flex: 1}} onClick={handleShare}>
          Share Results
        </button>
        <button className="btn-outline" style={{flex: 1}} onClick={() => nav.reset('setup')}>
          Home
        </button>
      </div>
    </div>
  );
}
