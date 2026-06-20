const QUEUE_KEY = 'tm-offline-queue';
const CACHE_PREFIX = 'tm-cache-';

interface QueuedOp {
  id: string;
  method: string;
  args: any[];
  timestamp: number;
}

function getQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveQueue(queue: QueuedOp[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

export function enqueue(method: string, args: any[]) {
  const queue = getQueue();
  queue.push({id: Date.now().toString(36), method, args, timestamp: Date.now()});
  saveQueue(queue);
}

export function dequeue(id: string) {
  saveQueue(getQueue().filter(op => op.id !== id));
}

export function getPendingOps(): QueuedOp[] {
  return getQueue();
}

export function clearQueue() {
  saveQueue([]);
}

// Local cache for tournament data
export function cacheSet(key: string, data: any) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data)); } catch {}
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function cacheRemove(key: string) {
  try { localStorage.removeItem(CACHE_PREFIX + key); } catch {}
}
