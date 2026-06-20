let preloaded = false;

export function preloadTournamentScreens() {
  if (preloaded) return;
  preloaded = true;
  import('../screens/ScheduleScreen');
  import('../screens/LiveScreen');
  import('../screens/ResultsScreen');
}
