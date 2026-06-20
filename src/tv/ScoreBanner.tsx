import React from 'react';
import type {Match, Tournament} from '../types';

interface Props {
  tournament: Tournament;
}

export function ScoreBanner({tournament}: Props) {
  const matches = tournament.matches || [];
  const completed = matches.filter(m => m.status === 'completed');
  const inProgress = matches.filter(m => m.status === 'in_progress');
  const remaining = matches.filter(m => m.status === 'pending' || m.status === 'in_progress');

  const teamAWins = completed.filter(m => m.score?.winner === 'A').length;
  const teamBWins = completed.filter(m => m.score?.winner === 'B').length;

  const teamAName = tournament.teamAName || 'Team A';
  const teamBName = tournament.teamBName || 'Team B';

  const teamALeading = teamAWins > teamBWins;
  const teamBLeading = teamBWins > teamAWins;

  return (
    <div className="score-banner-tv">
      <div className={`score-team team-a ${teamALeading ? 'leading' : ''}`}>
        <div className="score-team-name">🏸 {teamAName}</div>
        <div className="score-team-value">{teamAWins}</div>
      </div>
      <div className="score-center">
        <div className="score-activity">
          {inProgress.length > 0 && <span>🔥 {inProgress.length} playing · </span>}
          <span>{completed.length} done · {remaining.length} left</span>
        </div>
      </div>
      <div className={`score-team team-b ${teamBLeading ? 'leading' : ''}`}>
        <div className="score-team-name">{teamBName} 🏸</div>
        <div className="score-team-value">{teamBWins}</div>
      </div>
    </div>
  );
}
