import {useState, useEffect, useRef, useCallback} from 'react';
import {doc, onSnapshot} from 'firebase/firestore';
import {db} from '../services/firebase';
import type {Tournament, Match} from '../types';

export interface TournamentStream {
  tournament: Tournament | null;
  connected: boolean;
  lastUpdated: Date | null;
  recentlyChanged: Set<number>; // match IDs that just changed
}

export function useTournamentStream(groupCode: string, tournamentId: string): TournamentStream {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [connected, setConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [recentlyChanged, setRecentlyChanged] = useState<Set<number>>(new Set());
  const prevMatchesRef = useRef<Map<number, Match>>(new Map());
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detectChanges = useCallback((newMatches: Match[]) => {
    const prev = prevMatchesRef.current;
    const changed = new Set<number>();

    for (const m of newMatches) {
      const old = prev.get(m.id);
      if (!old) {
        changed.add(m.id); // new match
      } else if (old.status !== m.status || old.score?.teamA !== m.score?.teamA || old.score?.teamB !== m.score?.teamB) {
        changed.add(m.id);
      }
    }

    // Update prev ref
    const newMap = new Map<number, Match>();
    for (const m of newMatches) newMap.set(m.id, m);
    prevMatchesRef.current = newMap;

    return changed;
  }, []);

  useEffect(() => {
    const ref = doc(db, 'groups', groupCode, 'tournaments', tournamentId);

    const unsub = onSnapshot(ref, (snap) => {
      setConnected(true);
      if (!snap.exists()) return;

      const data = snap.data() as Tournament;
      const changed = detectChanges(data.matches || []);

      setTournament(data);
      setLastUpdated(new Date());

      if (changed.size > 0) {
        setRecentlyChanged(changed);
        // Clear highlights after 10 seconds
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        clearTimerRef.current = setTimeout(() => setRecentlyChanged(new Set()), 10000);
      }
    }, () => {
      setConnected(false);
    });

    return () => {
      unsub();
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [groupCode, tournamentId, detectChanges]);

  return {tournament, connected, lastUpdated, recentlyChanged};
}
