import {useState, useEffect, useCallback, useRef} from 'react';
import {doc, setDoc, onSnapshot, deleteDoc, serverTimestamp} from 'firebase/firestore';
import {db} from '../services/firebase';

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const UNPAIRED_EXPIRY_MS = 5 * 60 * 1000; // 5 min for unclaimed codes

function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
}

interface PairingResult {
  groupCode: string;
  tournamentId: string;
}

export function usePairing(onPaired: (ref: PairingResult) => void) {
  const [code, setCode] = useState<string>('');
  const [status, setStatus] = useState<'generating' | 'waiting' | 'paired' | 'expired'>('generating');
  const createdAtRef = useRef<number>(0);

  const createPairingCode = useCallback(async () => {
    const newCode = generateCode();
    const ref = doc(db, 'pairings', newCode);
    const now = Date.now();
    await setDoc(ref, {
      createdAt: now,
      paired: false,
      serverCreatedAt: serverTimestamp(),
    });
    createdAtRef.current = now;
    setCode(newCode);
    setStatus('waiting');
  }, []);

  // Generate code on mount
  useEffect(() => {
    createPairingCode();
  }, [createPairingCode]);

  // Listen for pairing + handle expiry
  useEffect(() => {
    if (!code) return;

    const ref = doc(db, 'pairings', code);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        // Doc deleted (expired/cleaned up)
        setStatus('expired');
        return;
      }
      const data = snap.data();
      const createdAt = data.createdAt as number;

      // Check 24h expiry for paired sessions
      if (data.paired && Date.now() - createdAt > EXPIRY_MS) {
        setStatus('expired');
        deleteDoc(ref).catch(() => {});
        return;
      }

      // Check 5min expiry for unclaimed codes
      if (!data.paired && Date.now() - createdAt > UNPAIRED_EXPIRY_MS) {
        setStatus('expired');
        deleteDoc(ref).catch(() => {});
        return;
      }

      if (data.paired && data.groupCode && data.tournamentId) {
        setStatus('paired');
        onPaired({groupCode: data.groupCode, tournamentId: data.tournamentId === '__auto__' ? '' : data.tournamentId});
      }
    }, () => {
      setStatus('expired');
    });

    return () => unsub();
  }, [code, onPaired]);

  // Periodic expiry check — regenerate if code expired while waiting
  useEffect(() => {
    if (!code || status === 'paired' || status === 'expired') return;
    const timer = setInterval(() => {
      if (createdAtRef.current && Date.now() - createdAtRef.current > UNPAIRED_EXPIRY_MS) {
        setStatus('expired');
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [code, status]);

  const regenerate = useCallback(() => {
    // Clean up old code
    if (code) {
      deleteDoc(doc(db, 'pairings', code)).catch(() => {});
    }
    setStatus('generating');
    createPairingCode();
  }, [code, createPairingCode]);

  const pairingUrl = code
    ? `${window.location.origin}${window.location.pathname.replace('tv.html', '')}?pair=${code}`
    : '';

  return {code, status, pairingUrl, regenerate};
}
