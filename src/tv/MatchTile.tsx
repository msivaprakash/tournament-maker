import React from 'react';
import type {Match} from '../types';

interface Props {
  match: Match;
  getPlayerName: (id: string) => string;
  showScore: boolean;
  highlighted: boolean;
  variant?: 'playing' | 'round';
  teamAName?: string;
  teamBName?: string;
}

export function MatchTile({match, getPlayerName, showScore, highlighted, variant = 'round', teamAName = 'Team A', teamBName = 'Team B'}: Props) {
  const statusLabel = match.status === 'in_progress' ? '▶ Playing'
    : match.status === 'pending' ? '⏳ Upcoming'
    : match.status === 'cancelled' ? '✕ Cancelled'
    : '';

  const classes = [
    'match-tile',
    `status-${match.status}`,
    variant === 'playing' ? 'variant-playing' : '',
    highlighted ? 'tile-pulse' : '',
    match.status === 'cancelled' ? 'cancelled' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="tile-court">#{match.id} · Court {match.court} · Round {match.round}</div>
      <div className="tile-teams">
        <div className={`tile-side ${match.score?.winner === 'A' ? 'winner' : ''}`}>
          <div className="tile-team-label team-a-label">{teamAName}</div>
          <div className="tile-team team-a">
            {match.teamAIds.map(getPlayerName).join(' & ')}
          </div>
        </div>
        <div className="tile-center">
          {showScore && match.status === 'completed' && match.score ? (
            <span className="tile-score">{match.score.teamA} – {match.score.teamB}</span>
          ) : (
            <span className={`tile-status tile-status-${match.status}`}>{statusLabel || 'vs'}</span>
          )}
        </div>
        <div className={`tile-side ${match.score?.winner === 'B' ? 'winner' : ''}`}>
          <div className="tile-team-label team-b-label">{teamBName}</div>
          <div className="tile-team team-b">
            {match.teamBIds.map(getPlayerName).join(' & ')}
          </div>
        </div>
      </div>
    </div>
  );
}
