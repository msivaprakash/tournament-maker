import type {RecentGroup} from '../types';

const STORAGE_KEY = 'tournament-maker-recent-groups';
const MAX_RECENT = 5;

function getStorage(): RecentGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function setStorage(groups: RecentGroup[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {}
}

export function getRecentGroups(): RecentGroup[] {
  return getStorage().sort((a, b) => b.lastUsed - a.lastUsed);
}

export function saveRecentGroup(code: string, name: string, playerCount: number) {
  const existing = getStorage().filter(g => g.code !== code);
  const updated: RecentGroup[] = [{code, name, playerCount, lastUsed: Date.now()}, ...existing].slice(0, MAX_RECENT);
  setStorage(updated);
}

export function removeRecentGroup(code: string) {
  setStorage(getStorage().filter(g => g.code !== code));
}
