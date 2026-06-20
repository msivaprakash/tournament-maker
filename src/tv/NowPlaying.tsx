import React, {useMemo} from 'react';
import type {Tournament, Match, PlayerStats} from '../types';
import {MatchTile} from './MatchTile';

interface Props {
  tournament: Tournament;
  recentlyChanged: Set<number>;
}

export function NowPlaying({tournament, recentlyChanged}: Props) {
  const matches = tournament.matches || [];
  const players = tournament.players || [];
  const inProgress = matches.filter(m => m.status === 'in_progress');
  const isCompleted = tournament.status === 'completed';

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';

  // Compute winner and star player when tournament is completed
  const celebration = useMemo(() => {
    if (!isCompleted) return null;

    const completed = matches.filter(m => m.status === 'completed');
    const teamAWins = completed.filter(m => m.score?.winner === 'A').length;
    const teamBWins = completed.filter(m => m.score?.winner === 'B').length;

    const winnerTeam = teamAWins > teamBWins ? 'A' : teamBWins > teamAWins ? 'B' : null;
    const winnerName = winnerTeam === 'A' ? (tournament.teamAName || 'Team A')
      : winnerTeam === 'B' ? (tournament.teamBName || 'Team B') : null;

    // Compute player stats for star player
    const stats: Record<string, {played: number; won: number}> = {};
    for (const m of completed) {
      if (!m.score) continue;
      const winners = m.score.winner === 'A' ? m.teamAIds : m.teamBIds;
      const losers = m.score.winner === 'A' ? m.teamBIds : m.teamAIds;
      for (const id of winners) {
        if (!stats[id]) stats[id] = {played: 0, won: 0};
        stats[id].played++;
        stats[id].won++;
      }
      for (const id of losers) {
        if (!stats[id]) stats[id] = {played: 0, won: 0};
        stats[id].played++;
      }
    }

    // Star player = most wins (tiebreak: fewer matches played)
    let starId = '';
    let starWins = 0;
    let starPlayed = Infinity;
    for (const [id, s] of Object.entries(stats)) {
      if (s.won > starWins || (s.won === starWins && s.played < starPlayed)) {
        starId = id;
        starWins = s.won;
        starPlayed = s.played;
      }
    }

    // Use tournament's POT if available
    const pot = tournament.playerOfTournament || starId;

    return {
      winnerTeam,
      winnerName,
      teamAWins,
      teamBWins,
      starPlayer: getPlayerName(pot),
      starWins: stats[pot]?.won || 0,
      isTie: teamAWins === teamBWins,
    };
  }, [isCompleted, matches, tournament]);

  if (isCompleted && celebration) {
    return (
      <div className="now-playing celebration">
        <div className="celebration-content">
          {celebration.isTie ? (
            <div className="celebration-title">🤝 It&apos;s a Tie!</div>
          ) : (
            <div className="celebration-title">🏆 {celebration.winnerName} Wins!</div>
          )}
          <div className="celebration-score">
            {celebration.teamAWins} – {celebration.teamBWins}
          </div>
          <div className="celebration-star">
            ⭐ Player of the Tournament: <strong>{celebration.starPlayer}</strong>
            <span className="star-stat">({celebration.starWins} wins)</span>
          </div>
        </div>
      </div>
    );
  }

  if (inProgress.length === 0) {
    return (
      <div className="now-playing empty">
        <div className="now-playing-placeholder">🏸 No matches in play</div>
      </div>
    );
  }

  return (
    <div className="now-playing">
      <div className="now-playing-label">🎯 NOW PLAYING</div>
      <div className="now-playing-grid">
        {inProgress.map(m => (
          <MatchTile
            key={m.id}
            match={m}
            getPlayerName={getPlayerName}
            showScore={false}
            highlighted={recentlyChanged.has(m.id)}
            variant="playing"
            teamAName={tournament.teamAName || 'Team A'}
            teamBName={tournament.teamBName || 'Team B'}
          />
        ))}
      </div>
    </div>
  );
}
