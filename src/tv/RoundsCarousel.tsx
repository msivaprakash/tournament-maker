import React, {useEffect, useState, useMemo} from 'react';
import type {Match} from '../types';
import {MatchTile} from './MatchTile';

interface Props {
  matches: Match[];
  getPlayerName: (id: string) => string;
  recentlyChanged: Set<number>;
  teamAName: string;
  teamBName: string;
}

export function RoundsCarousel({matches, getPlayerName, recentlyChanged, teamAName, teamBName}: Props) {
  // Group matches by round
  const rounds = useMemo(() => {
    const map = new Map<number, Match[]>();
    for (const m of matches) {
      const list = map.get(m.round) || [];
      list.push(m);
      map.set(m.round, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [matches]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-cycle through rounds every 5 seconds
  useEffect(() => {
    if (rounds.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex(i => (i + 1) % rounds.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [rounds.length]);

  // Reset index if rounds change
  useEffect(() => {
    if (currentIndex >= rounds.length) setCurrentIndex(0);
  }, [rounds.length, currentIndex]);

  if (rounds.length === 0) {
    return <div className="rounds-carousel"><div className="round-empty">No matches scheduled</div></div>;
  }

  const [round, roundMatches] = rounds[currentIndex] || rounds[0];

  return (
    <div className="rounds-carousel">
      <div className="round-header">
        <span className="round-label">📋 Round {round}</span>
        <span className="round-pager">{currentIndex + 1} / {rounds.length}</span>
      </div>
      <div className="round-grid">
        {roundMatches.map(m => (
          <MatchTile
            key={m.id}
            match={m}
            getPlayerName={getPlayerName}
            showScore={m.status === 'completed'}
            highlighted={recentlyChanged.has(m.id)}
            teamAName={teamAName}
            teamBName={teamBName}
          />
        ))}
      </div>
    </div>
  );
}
