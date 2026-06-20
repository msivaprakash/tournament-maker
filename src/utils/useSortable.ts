import {useState, useMemo} from 'react';

export function useSortable<T>(data: T[], defaultKey: keyof T, defaultAsc = false) {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [asc, setAsc] = useState(defaultAsc);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'string' && typeof vb === 'string') {
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [data, sortKey, asc]);

  const toggleSort = (key: keyof T) => {
    if (key === sortKey) {
      setAsc(!asc);
    } else {
      setSortKey(key);
      setAsc(false);
    }
  };

  const indicator = (key: keyof T) => key === sortKey ? (asc ? ' ▲' : ' ▼') : '';

  return {sorted, toggleSort, indicator, sortKey, asc};
}
