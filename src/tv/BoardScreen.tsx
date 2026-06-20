import React, {useState, useEffect, useRef} from 'react';
import {useTournamentStream} from './useTournamentStream';
import {ScoreBanner} from './ScoreBanner';
import {NowPlaying} from './NowPlaying';
import {RoundsCarousel} from './RoundsCarousel';

interface Props {
  groupCode: string;
  tournamentId: string;
  onDisconnect: () => void;
}

export function BoardScreen({groupCode, tournamentId, onDisconnect}: Props) {
  const {tournament, connected, lastUpdated, recentlyChanged} = useTournamentStream(groupCode, tournamentId);
  const [clock, setClock] = useState(formatTime(new Date()));
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Live clock (updates every second for footer, every minute for header)
  useEffect(() => {
    const timer = setInterval(() => setClock(formatTime(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);

  // Screen Wake Lock
  useEffect(() => {
    const acquireWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {}
    };
    acquireWakeLock();

    // Re-acquire on visibility change (e.g., after tab switch)
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquireWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  if (!tournament) {
    return (
      <div className="board-screen">
        <div className="tv-loading">Loading tournament...</div>
        {!connected && <div className="connection-bar">Reconnecting...</div>}
      </div>
    );
  }

  const displayName = tournament.name || `${tournament.groupName} — ${tournament.playDate}`;
  const players = tournament.players || [];
  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown';

  const lastUpdatedStr = lastUpdated
    ? `Last updated ${lastUpdated.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false})}`
    : '';

  return (
    <div className="board-screen">
      {!connected && <div className="connection-bar">Reconnecting...</div>}

      {/* Header */}
      <div className="board-header">
        <div className="board-tournament-name">🏆 {displayName}</div>
        <div className="board-clock">🕐 {clock}</div>
      </div>

      {/* Score Banner */}
      <ScoreBanner tournament={tournament} />

      {/* Now Playing / Celebration */}
      <NowPlaying tournament={tournament} recentlyChanged={recentlyChanged} />

      {/* Rounds Carousel */}
      <RoundsCarousel
        matches={tournament.matches || []}
        getPlayerName={getPlayerName}
        recentlyChanged={recentlyChanged}
        teamAName={tournament.teamAName || 'Team A'}
        teamBName={tournament.teamBName || 'Team B'}
      />

      {/* Footer */}
      <div className="board-footer">
        <div className="board-footer-left">
          {tournament.groupName} · {tournament.playDate}
        </div>
        <div className="board-footer-right">{lastUpdatedStr}</div>
      </div>
    </div>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
}
