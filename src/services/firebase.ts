import {initializeApp} from 'firebase/app';
import {getAuth, signInAnonymously as fbSignIn} from 'firebase/auth';
import {
  getFirestore, doc, getDoc, getDocFromServer, setDoc, deleteDoc, collection,
  getDocs, query, orderBy, onSnapshot, serverTimestamp, runTransaction,
} from 'firebase/firestore';
import type {Group, Player, Tournament, TournamentSummary, Match} from '../types';
import {cacheSet, cacheGet} from '../utils/offlineQueue';

const firebaseConfig = {
  apiKey: "AIzaSyA5EH8QMFYoNZ0VBvxdgoVWl9mm42xBGw8",
  authDomain: "msp-tournament-maker.firebaseapp.com",
  projectId: "msp-tournament-maker",
  storageBucket: "msp-tournament-maker.firebasestorage.app",
  messagingSenderId: "13212651692",
  appId: "1:13212651692:web:1ded078a30ec8b65484f09",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
const auth = getAuth(app);

// --- Connectivity ---

let _isConnected = navigator.onLine;
const connectivityListeners: Set<(online: boolean) => void> = new Set();

/** Check connectivity — uses cached state from real operations, no extra reads */
export async function checkConnectivity(): Promise<boolean> {
  if (!navigator.onLine) { _setConnected(false); return false; }
  return _isConnected;
}

function _setConnected(val: boolean) {
  if (_isConnected !== val) {
    _isConnected = val;
    connectivityListeners.forEach(fn => fn(val));
  }
}

export function isConnected(): boolean { return _isConnected; }

export function onConnectivityChange(fn: (online: boolean) => void): () => void {
  connectivityListeners.add(fn);
  return () => { connectivityListeners.delete(fn); };
}

// Listen to browser events as a hint
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { _setConnected(true); });
  window.addEventListener('offline', () => { _setConnected(false); });
}

// --- Merge logic ---

/** Remove undefined values (Firestore rejects them in transactions) */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Stamp updatedAt on a match whenever it's being saved */
function stampMatch(m: Match): Match {
  return {...m, updatedAt: m.updatedAt || Date.now()};
}

/**
 * Bidirectional merge at match level using updatedAt timestamp.
 * For each match: whichever side has a higher updatedAt wins.
 * Matches only in local → keep. Matches only in remote → keep.
 */
function mergeMatches(localMatches: Match[], remoteMatches: Match[]): Match[] {
  const merged: Match[] = [];
  const remoteMap = new Map(remoteMatches.map(m => [m.id, m]));
  const localMap = new Map(localMatches.map(m => [m.id, m]));

  // Process all matches from both sides
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);
    if (local && !remote) {
      merged.push(local);
    } else if (remote && !local) {
      merged.push(remote);
    } else if (local && remote) {
      // Both exist: higher updatedAt wins
      const lt = local.updatedAt || 0;
      const rt = remote.updatedAt || 0;
      merged.push(lt >= rt ? local : remote);
    }
  }
  // Sort by original order (round, then court, then id)
  merged.sort((a, b) => a.round - b.round || a.court - b.court || a.id - b.id);
  return merged;
}

// --- Firebase service ---

export const firebase = {
  async signInAnonymously() {
    await fbSignIn(auth);
  },

  async createGroup(group: Group) {
    const ref = doc(db, 'groups', group.code);
    await setDoc(ref, {
      groupCode: group.code,
      groupName: group.name,
      players: group.players || [],
      randomness: group.randomness ?? 30,
      createdAt: serverTimestamp(),
    }, {merge: true});
  },

  async fetchGroup(groupCode: string): Promise<Group | null> {
    const ref = doc(db, 'groups', groupCode);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      code: data.groupCode,
      name: data.groupName,
      players: data.players || [],
      randomness: data.randomness ?? 30,
    };
  },

  async savePlayersToGroup(groupCode: string, players: Player[]) {
    const ref = doc(db, 'groups', groupCode);
    await setDoc(ref, {players}, {merge: true});
  },

  async saveTournament(groupCode: string, tournament: Tournament) {
    // Stamp updatedAt on every match that changed (has no timestamp yet)
    const stamped: Tournament = {
      ...tournament,
      matches: tournament.matches.map(stampMatch),
    };
    cacheSet(`tournament-${groupCode}-${tournament.id}`, stamped);
    const ref = doc(db, 'groups', groupCode, 'tournaments', tournament.id);

    await runTransaction(db, async (txn) => {
      const snap = await txn.get(ref);
      if (!snap.exists()) {
        txn.set(ref, stripUndefined({...stamped, createdAt: stamped.createdAt || Date.now()}));
        return;
      }
      const remote = snap.data() as Tournament;
      const mergedMatches = mergeMatches(stamped.matches, remote.matches);
      txn.set(ref, stripUndefined({
        ...stamped,
        matches: mergedMatches,
        createdAt: remote.createdAt || stamped.createdAt || Date.now(),
      }));
    });
    _setConnected(true);
  },

  /**
   * Bidirectional sync: fetch remote, merge with local using timestamps, push merged result back.
   * Returns the merged tournament.
   */
  async syncTournament(groupCode: string, localTournament: Tournament): Promise<Tournament> {
    const ref = doc(db, 'groups', groupCode, 'tournaments', localTournament.id);
    const localStamped: Tournament = {
      ...localTournament,
      matches: localTournament.matches.map(stampMatch),
    };

    const result = await runTransaction(db, async (txn) => {
      const snap = await txn.get(ref);
      if (!snap.exists()) {
        const data = stripUndefined({...localStamped, createdAt: localStamped.createdAt || Date.now()});
        txn.set(ref, data);
        return localStamped;
      }
      const remote = snap.data() as Tournament;
      const mergedMatches = mergeMatches(localStamped.matches, remote.matches);
      const merged: Tournament = {
        ...localStamped,
        matches: mergedMatches,
        createdAt: remote.createdAt || localStamped.createdAt || Date.now(),
      };
      txn.set(ref, stripUndefined(merged));
      return merged;
    });

    cacheSet(`tournament-${groupCode}-${localTournament.id}`, result);
    return result;
  },

  async fetchTournaments(groupCode: string): Promise<Tournament[]> {
    const colRef = collection(db, 'groups', groupCode, 'tournaments');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: Tournament[] = [];
    snap.forEach(d => list.push(d.data() as Tournament));
    return list;
  },

  async fetchTournamentById(groupCode: string, tournamentId: string): Promise<Tournament | null> {
    const cached = cacheGet<Tournament>(`tournament-${groupCode}-${tournamentId}`);
    try {
      const ref = doc(db, 'groups', groupCode, 'tournaments', tournamentId);
      const snap = await getDocFromServer(ref);
      if (!snap.exists()) return cached;
      const remote = snap.data() as Tournament;
      cacheSet(`tournament-${groupCode}-${tournamentId}`, remote);
      _setConnected(true);
      return remote;
    } catch {
      // Offline fallback: try SDK cache (now backed by IndexedDB), then localStorage
      _setConnected(false);
      try {
        const ref = doc(db, 'groups', groupCode, 'tournaments', tournamentId);
        const snap = await getDoc(ref);
        if (snap.exists()) return snap.data() as Tournament;
      } catch {}
      return cached;
    }
  },

  async deleteTournament(groupCode: string, tournamentId: string) {
    const ref = doc(db, 'groups', groupCode, 'tournaments', tournamentId);
    await deleteDoc(ref);
  },

  subscribeTournament(groupCode: string, tournamentId: string, onUpdate: (t: Tournament) => void): () => void {
    const ref = doc(db, 'groups', groupCode, 'tournaments', tournamentId);
    return onSnapshot(ref, snap => {
      if (snap.exists()) {
        _setConnected(true);
        const remote = snap.data() as Tournament;
        // Merge with localStorage cache (represents our latest local state)
        const cached = cacheGet<Tournament>(`tournament-${groupCode}-${tournamentId}`);
        if (cached) {
          const mergedMatches = mergeMatches(cached.matches, remote.matches);
          const merged: Tournament = {...remote, matches: mergedMatches};
          cacheSet(`tournament-${groupCode}-${tournamentId}`, merged);
          onUpdate(merged);
        } else {
          cacheSet(`tournament-${groupCode}-${tournamentId}`, remote);
          onUpdate(remote);
        }
      }
    }, () => { _setConnected(false); });
  },

  summarizeTournament(t: Tournament): TournamentSummary {
    const completed = t.matches.filter(m => m.status === 'completed');
    return {
      id: t.id,
      groupCode: t.groupCode,
      groupName: t.groupName,
      playDate: t.playDate,
      status: t.status,
      createdAt: t.createdAt,
      matchCount: t.matches.length,
      completedMatchCount: completed.length,
      playerOfTournament: t.playerOfTournament,
      teamAWins: completed.filter(m => m.score?.winner === 'A').length,
      teamBWins: completed.filter(m => m.score?.winner === 'B').length,
    };
  },

  async pairTvDisplay(pairingCode: string, groupCode: string, tournamentId: string) {
    const ref = doc(db, 'pairings', pairingCode);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Invalid pairing code');
    const data = snap.data();
    if (data.paired) throw new Error('Code already used');
    if (Date.now() - (data.createdAt as number) > 5 * 60 * 1000) throw new Error('Code expired');
    await setDoc(ref, {paired: true, groupCode, tournamentId}, {merge: true});
  },
};
