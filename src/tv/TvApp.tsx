import React, {useState, useEffect} from 'react';
import {firebase} from '../services/firebase';
import {PairingScreen} from './PairingScreen';
import {BoardScreen} from './BoardScreen';

interface TournamentRef {
  groupCode: string;
  tournamentId: string;
}

export function TvApp() {
  const [tournamentRef, setTournamentRef] = useState<TournamentRef | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authenticate anonymously on mount
  useEffect(() => {
    firebase.signInAnonymously().then(() => setAuthReady(true)).catch(() => setAuthReady(true));
  }, []);

  // Check URL params for direct link (from "Copy TV Link")
  useEffect(() => {
    if (!authReady) return;
    const params = new URLSearchParams(window.location.search);
    const group = params.get('group');
    const tournament = params.get('tournament');
    if (group && tournament) {
      setTournamentRef({groupCode: group, tournamentId: tournament});
    } else if (group) {
      // No tournament ID — find the latest in-progress or completed tournament
      firebase.fetchTournaments(group).then(tournaments => {
        const active = tournaments.find(t => t.status === 'in_progress')
          || tournaments.find(t => t.status === 'completed')
          || tournaments[0];
        if (active) {
          setTournamentRef({groupCode: group, tournamentId: active.id});
        } else {
          setError(`No tournaments found for group ${group}`);
        }
      }).catch(() => {
        setError('Failed to load tournaments. Check your connection.');
      });
    }
  }, [authReady]);

  // Auto-find tournament when tournamentId is empty (from pairing with __auto__)
  useEffect(() => {
    if (!tournamentRef || tournamentRef.tournamentId || !authReady) return;
    firebase.fetchTournaments(tournamentRef.groupCode).then(tournaments => {
      const active = tournaments.find(t => t.status === 'in_progress')
        || tournaments.find(t => t.status === 'completed')
        || tournaments[0];
      if (active) {
        setTournamentRef({groupCode: tournamentRef.groupCode, tournamentId: active.id});
      } else {
        setError(`No tournaments found for group ${tournamentRef.groupCode}`);
        setTournamentRef(null);
      }
    }).catch(() => {
      setError('Failed to load tournaments.');
      setTournamentRef(null);
    });
  }, [tournamentRef?.groupCode, tournamentRef?.tournamentId, authReady]);

  if (!authReady) {
    return <div className="tv-loading">Connecting...</div>;
  }

  if (error) {
    return (
      <div className="tv-loading">
        <div>{error}</div>
        <button className="pairing-btn" style={{marginTop: 16}} onClick={() => { setError(null); setTournamentRef(null); }}>
          Try Again
        </button>
      </div>
    );
  }

  if (tournamentRef) {
    if (!tournamentRef.tournamentId) {
      return <div className="tv-loading">Finding tournament...</div>;
    }

    return (
      <BoardScreen
        groupCode={tournamentRef.groupCode}
        tournamentId={tournamentRef.tournamentId}
        onDisconnect={() => setTournamentRef(null)}
      />
    );
  }

  return <PairingScreen onPaired={setTournamentRef} />;
}
