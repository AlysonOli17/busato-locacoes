const cache = new Map<string, { data: any, timestamp: number }>();

/**
 * Executes a fetcher function and caches its result for the specified TTL (Time To Live).
 * If a valid cached result exists, it returns it immediately without calling the fetcher.
 * 
 * @param key Unique identifier for the cache entry
 * @param ttlMs Time to live in milliseconds (e.g., 5 * 60 * 1000 for 5 minutes)
 * @param fetcher Function that returns a Promise with the data
 */
export const withCache = async <T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data;
  }
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};

/**
 * Clears the cache. If a pattern is provided, clears only keys containing the pattern.
 */
export const clearCache = (keyPattern?: string) => {
  if (!keyPattern) {
    cache.clear();
  } else {
    for (const k of cache.keys()) {
      if (k.includes(keyPattern)) cache.delete(k);
    }
  }
};
