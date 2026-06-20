import React, {useReducer, useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense} from 'react';
import {reducer, initialState, StoreContext} from './state/store';
import {SetupScreen} from './screens/SetupScreen';
import {PlayersScreen} from './screens/PlayersScreen';
import {firebase, isConnected, onConnectivityChange} from './services/firebase';

const ScheduleScreen = lazy(() => import('./screens/ScheduleScreen').then(m => ({default: m.ScheduleScreen})));
const LiveScreen = lazy(() => import('./screens/LiveScreen').then(m => ({default: m.LiveScreen})));
const ResultsScreen = lazy(() => import('./screens/ResultsScreen').then(m => ({default: m.ResultsScreen})));
const HistoryScreen = lazy(() => import('./screens/HistoryScreen').then(m => ({default: m.HistoryScreen})));

function InstallBanner() {
  const [show, setShow] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone;
    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    // Fallback: show generic banner after 3s if no prompt event (iOS)
    const timer = setTimeout(() => {
      if (!deferredPrompt.current && !isStandalone) setShow(true);
    }, 3000);
    return () => { window.removeEventListener('beforeinstallprompt', handler); clearTimeout(timer); };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
    }
    setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem('tm-install-dismissed', '1');
  };

  if (!show || sessionStorage.getItem('tm-install-dismissed')) return null;

  return (
    <div className="install-banner">
      <span>Add to Home Screen for the best experience</span>
      <button className="btn-primary" style={{padding: '6px 12px', fontSize: 12}} onClick={handleInstall}>Install</button>
      <button className="btn-ghost" style={{padding: '4px 8px', fontSize: 14}} onClick={handleDismiss}>✕</button>
    </div>
  );
}

type Screen = 'setup' | 'players' | 'schedule' | 'live' | 'results' | 'history';

const TITLES: Record<Screen, string> = {
  setup: '', players: 'Players & Teams', schedule: 'Schedule',
  live: 'Live', results: 'Results', history: 'History & Stats',
};
const STEP_LABELS = ['Setup', 'Players', 'Schedule', 'Play'];
const SCREEN_STEP: Record<Screen, number> = {
  setup: 1, players: 2, schedule: 3, live: 4, results: 4, history: 0,
};

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [screen, setScreen] = useState<Screen>('setup');
  const [history, setHistory] = useState<Screen[]>([]);
  const [params, setParams] = useState<any>({});
  const [dark, setDark] = useState(() => localStorage.getItem('tm-dark') === 'true');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('tm-dark', String(dark));
  }, [dark]);

  // Deep linking
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairStatus, setPairStatus] = useState<'idle' | 'pairing' | 'success' | 'error'>('idle');

  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    const pair = url.get('pair');
    if (pair) {
      setPairCode(pair);
      return; // Don't process group/tournament deep link if pairing
    }
    const groupCode = url.get('group');
    const tournamentId = url.get('tournament');
    if (groupCode) {
      firebase.signInAnonymously().then(async () => {
        const group = await firebase.fetchGroup(groupCode);
        if (!group) return;
        dispatch({type: 'SET_GROUP', payload: group});
        if (tournamentId) {
          const t = await firebase.fetchTournamentById(groupCode, tournamentId);
          if (t) {
            dispatch({type: 'SET_TOURNAMENT', payload: t});
            setScreen(t.status === 'completed' ? 'results' : 'live');
          }
        }
      }).catch(() => {});
    }
  }, []);

  // Offline handling — uses real Firebase connectivity check
  const [isOffline, setIsOffline] = useState(!isConnected());
  useEffect(() => {
    return onConnectivityChange((online) => setIsOffline(!online));
  }, []);

  // Warn before tab close during active tournament
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.tournament && state.tournament.status === 'in_progress') {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.tournament?.status]);

  const navigate = useCallback((name: string, p?: any) => {
    setHistory(prev => [...prev, screen]);
    setScreen(name as Screen);
    setParams(p || {});
  }, [screen]);

  const goBack = useCallback(() => {
    if (history.length > 0) {
      setScreen(history[history.length - 1]);
      setHistory(h => h.slice(0, -1));
    }
  }, [history]);

  const reset = useCallback((name?: string, p?: any) => {
    setHistory([]);
    setScreen((name as Screen) || 'setup');
    setParams(p || {});
  }, []);

  const nav = useMemo(() => ({navigate, goBack, reset}), [navigate, goBack, reset]);
  const step = SCREEN_STEP[screen];

  return (
    <StoreContext.Provider value={{state, dispatch}}>
      {/* Dark mode toggle — only show fixed on Setup (no header) */}
      {screen === 'setup' && (
        <button className="dark-toggle" onClick={() => setDark(!dark)} aria-label="Toggle dark mode">
          {dark ? '☀️' : '🌙'}
        </button>
      )}

      {/* Offline indicator */}
      {isOffline && <div className="offline-banner">Offline — changes saved locally</div>}

      {/* Stepper (only on players & schedule) */}
      {(step === 2 || step === 3) && (
        <div className="stepper">
          {STEP_LABELS.map((label, i) => {
            const s = i + 1;
            const isDone = s < step;
            const isActive = s === step;
            return (
              <div className="stepper-step" key={i}>
                {i > 0 && <div className={`stepper-connector ${isDone ? 'done' : ''}`} />}
                <div className={`stepper-circle ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                  {isDone ? '✓' : s}
                </div>
                <span className={`stepper-label ${isDone ? 'done' : isActive ? 'active' : ''}`}>{label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Header */}
      {screen !== 'setup' && TITLES[screen] && (
        <header className="app-header">
          {screen !== 'live' && screen !== 'results' ? (
            <button className="back-btn" onClick={goBack}>← Back</button>
          ) : <span className="spacer" />}
          <h1>{TITLES[screen]}</h1>
          <button className="back-btn" onClick={() => setDark(!dark)} aria-label="Toggle dark mode" style={{textAlign: 'right'}}>
            {dark ? '☀️' : '🌙'}
          </button>
        </header>
      )}

      {/* Screens */}
      {screen === 'setup' && <SetupScreen nav={nav} />}
      {screen === 'players' && <PlayersScreen nav={nav} />}
      <Suspense fallback={<div className="screen" style={{textAlign: 'center', padding: 40}}>Loading...</div>}>
        {screen === 'schedule' && <ScheduleScreen nav={nav} params={params} />}
        {screen === 'live' && <LiveScreen nav={nav} />}
        {screen === 'results' && <ResultsScreen nav={nav} />}
        {screen === 'history' && <HistoryScreen nav={nav} />}
      </Suspense>

      {/* PWA Install Banner */}
      <InstallBanner />

      {/* TV Pairing Modal */}
      {pairCode && (
        <div className="modal-overlay" onClick={() => { setPairCode(null); window.history.replaceState({}, '', window.location.pathname); }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{maxWidth: 400}}>
            <h2 style={{marginBottom: 12}}>📺 Pair TV Display</h2>
            <p style={{color: 'var(--text-muted)', marginBottom: 16}}>
              Code: <strong style={{color: 'var(--primary)', fontSize: 20}}>{pairCode}</strong>
            </p>
            {state.group && state.tournament ? (
              <>
                <p style={{marginBottom: 12}}>
                  Send <strong>{state.group.name}</strong> ({state.tournament.playDate}) to this TV?
                </p>
                <button
                  className="btn-primary"
                  style={{width: '100%', marginBottom: 8}}
                  disabled={pairStatus === 'pairing'}
                  onClick={async () => {
                    setPairStatus('pairing');
                    try {
                      await firebase.pairTvDisplay(pairCode!, state.group!.code, state.tournament!.id);
                      setPairStatus('success');
                      setTimeout(() => { setPairCode(null); window.history.replaceState({}, '', window.location.pathname); }, 1500);
                    } catch (err: any) {
                      setPairStatus('error');
                    }
                  }}
                >
                  {pairStatus === 'pairing' ? 'Pairing...' : pairStatus === 'success' ? '✓ Paired!' : 'Pair Now'}
                </button>
                {pairStatus === 'error' && <p style={{color: 'var(--danger)', fontSize: 13}}>Failed — code may be expired or already used.</p>}
              </>
            ) : (
              <div>
                <p style={{color: 'var(--text-muted)', marginBottom: 12}}>
                  No active tournament loaded. Enter a group code to connect:
                </p>
                <input
                  className="input"
                  placeholder="Group code (e.g. HH-785726)"
                  id="pair-group-input"
                  style={{width: '100%', marginBottom: 8, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 16}}
                />
                <button
                  className="btn-primary"
                  style={{width: '100%'}}
                  onClick={async () => {
                    const input = document.getElementById('pair-group-input') as HTMLInputElement;
                    const groupCode = input?.value?.trim();
                    if (!groupCode) return;
                    setPairStatus('pairing');
                    try {
                      await firebase.pairTvDisplay(pairCode!, groupCode, '__auto__');
                      setPairStatus('success');
                      setTimeout(() => { setPairCode(null); window.history.replaceState({}, '', window.location.pathname); }, 1500);
                    } catch {
                      setPairStatus('error');
                    }
                  }}
                >
                  {pairStatus === 'pairing' ? 'Pairing...' : pairStatus === 'success' ? '✓ Paired!' : 'Connect'}
                </button>
                {pairStatus === 'error' && <p style={{color: 'var(--danger)', fontSize: 13, marginTop: 8}}>Failed — check code or connection.</p>}
              </div>
            )}
            <button className="btn-ghost" style={{width: '100%', marginTop: 8}} onClick={() => { setPairCode(null); window.history.replaceState({}, '', window.location.pathname); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </StoreContext.Provider>
  );
}
