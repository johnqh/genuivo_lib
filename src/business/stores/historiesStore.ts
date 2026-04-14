import { create } from 'zustand';
import type { History } from '@sudobility/genuivo_types';

/**
 * Default cache expiration time in milliseconds (10 minutes).
 *
 * Cache entries older than this threshold are considered stale and
 * will be treated as expired by {@link HistoriesStoreState.getHistories}
 * and {@link HistoriesStoreState.getCacheEntry}.
 */
export const DEFAULT_CACHE_EXPIRATION_MS = 10 * 60 * 1000;

/**
 * A single cache entry for a user's history data.
 *
 * Stores the list of histories along with a timestamp indicating when
 * the data was cached. Used for staleness detection and cache expiration.
 */
export interface HistoriesCacheEntry {
  /** The cached list of history entries for a user. */
  histories: History[];
  /** Unix timestamp (in milliseconds) when this entry was last cached. */
  cachedAt: number;
}

/**
 * State shape and actions for the histories Zustand store.
 *
 * Provides per-user client-side caching with CRUD operations.
 * Cache entries are keyed by `userId` so that switching users
 * shows isolated data. The store is in-memory only -- data does
 * not persist across page refreshes or app restarts.
 *
 * @example
 * ```typescript
 * import { useHistoriesStore } from '@sudobility/genuivo_lib';
 *
 * // Read cache in a component
 * const histories = useHistoriesStore(state => state.getHistories('user-1'));
 *
 * // Write to cache outside of React
 * useHistoriesStore.getState().setHistories('user-1', freshData);
 * ```
 */
export interface HistoriesStoreState {
  /** Internal cache map keyed by user ID. */
  cache: Record<string, HistoriesCacheEntry>;

  /**
   * Sets (replaces) the cached histories for a user.
   * Updates the `cachedAt` timestamp to the current time.
   *
   * @param userId - The user's unique identifier
   * @param histories - The full list of histories to cache
   */
  setHistories: (userId: string, histories: History[]) => void;

  /**
   * Retrieves the cached histories for a user.
   * Returns `undefined` if no cache entry exists or if the entry has expired.
   *
   * @param userId - The user's unique identifier
   * @param maxAge - Maximum cache age in milliseconds (default: {@link DEFAULT_CACHE_EXPIRATION_MS})
   * @returns The cached history array, or `undefined` if missing or expired
   */
  getHistories: (userId: string, maxAge?: number) => History[] | undefined;

  /**
   * Retrieves the full cache entry (histories + metadata) for a user.
   * Returns `undefined` if no cache entry exists or if the entry has expired.
   *
   * @param userId - The user's unique identifier
   * @param maxAge - Maximum cache age in milliseconds (default: {@link DEFAULT_CACHE_EXPIRATION_MS})
   * @returns The cache entry, or `undefined` if missing or expired
   */
  getCacheEntry: (
    userId: string,
    maxAge?: number
  ) => HistoriesCacheEntry | undefined;

  /**
   * Appends a history entry to a user's cache.
   * Creates a new cache entry if one does not exist for the user.
   *
   * @param userId - The user's unique identifier
   * @param history - The history entry to append
   */
  addHistory: (userId: string, history: History) => void;

  /**
   * Replaces a specific history entry in a user's cache by ID.
   * Does nothing if the user has no cache entry.
   *
   * @param userId - The user's unique identifier
   * @param historyId - The ID of the history entry to replace
   * @param history - The updated history entry
   */
  updateHistory: (userId: string, historyId: string, history: History) => void;

  /**
   * Removes a specific history entry from a user's cache by ID.
   * Does nothing if the user has no cache entry.
   *
   * @param userId - The user's unique identifier
   * @param historyId - The ID of the history entry to remove
   */
  removeHistory: (userId: string, historyId: string) => void;

  /**
   * Removes all expired cache entries from the store.
   *
   * @param maxAge - Maximum cache age in milliseconds (default: {@link DEFAULT_CACHE_EXPIRATION_MS})
   */
  purgeExpired: (maxAge?: number) => void;

  /**
   * Clears the entire cache for all users.
   */
  clearAll: () => void;
}

/**
 * Checks whether a cache entry has expired based on its `cachedAt` timestamp.
 *
 * @param entry - The cache entry to check
 * @param maxAge - Maximum age in milliseconds
 * @returns `true` if the entry is older than `maxAge`
 */
const isCacheExpired = (
  entry: HistoriesCacheEntry,
  maxAge: number
): boolean => {
  return Date.now() - entry.cachedAt > maxAge;
};

/**
 * Zustand store providing per-user client-side history caching.
 *
 * Operations: `set`, `get`, `add`, `update`, `remove`, `purgeExpired`, `clearAll`.
 * Keyed by user ID for multi-user support. Includes cache expiration via
 * a configurable `maxAge` parameter (defaults to {@link DEFAULT_CACHE_EXPIRATION_MS}).
 *
 * This store is in-memory only -- data is lost on page refresh or app restart.
 *
 * @example
 * ```typescript
 * import { useHistoriesStore } from '@sudobility/genuivo_lib';
 *
 * // In a React component
 * const histories = useHistoriesStore(state => state.getHistories('user-1'));
 *
 * // Outside React
 * const store = useHistoriesStore.getState();
 * store.setHistories('user-1', [history1, history2]);
 * ```
 */
export const useHistoriesStore = create<HistoriesStoreState>((set, get) => ({
  cache: {},

  setHistories: (userId: string, histories: History[]) =>
    set(state => ({
      cache: {
        ...state.cache,
        [userId]: {
          histories,
          cachedAt: Date.now(),
        },
      },
    })),

  getHistories: (
    userId: string,
    maxAge: number = DEFAULT_CACHE_EXPIRATION_MS
  ) => {
    const entry = get().cache[userId];
    if (!entry) return undefined;
    if (isCacheExpired(entry, maxAge)) return undefined;
    return entry.histories;
  },

  getCacheEntry: (
    userId: string,
    maxAge: number = DEFAULT_CACHE_EXPIRATION_MS
  ) => {
    const entry = get().cache[userId];
    if (!entry) return undefined;
    if (isCacheExpired(entry, maxAge)) return undefined;
    return entry;
  },

  addHistory: (userId: string, history: History) =>
    set(state => {
      const existing = state.cache[userId];
      if (!existing) {
        return {
          cache: {
            ...state.cache,
            [userId]: {
              histories: [history],
              cachedAt: Date.now(),
            },
          },
        };
      }
      return {
        cache: {
          ...state.cache,
          [userId]: {
            histories: [...existing.histories, history],
            cachedAt: Date.now(),
          },
        },
      };
    }),

  updateHistory: (userId: string, historyId: string, history: History) =>
    set(state => {
      const existing = state.cache[userId];
      if (!existing) return state;
      return {
        cache: {
          ...state.cache,
          [userId]: {
            histories: existing.histories.map(h =>
              h.id === historyId ? history : h
            ),
            cachedAt: Date.now(),
          },
        },
      };
    }),

  removeHistory: (userId: string, historyId: string) =>
    set(state => {
      const existing = state.cache[userId];
      if (!existing) return state;
      return {
        cache: {
          ...state.cache,
          [userId]: {
            histories: existing.histories.filter(h => h.id !== historyId),
            cachedAt: Date.now(),
          },
        },
      };
    }),

  purgeExpired: (maxAge: number = DEFAULT_CACHE_EXPIRATION_MS) =>
    set(state => {
      const now = Date.now();
      const newCache: Record<string, HistoriesCacheEntry> = {};
      for (const [userId, entry] of Object.entries(state.cache)) {
        if (now - entry.cachedAt <= maxAge) {
          newCache[userId] = entry;
        }
      }
      return { cache: newCache };
    }),

  clearAll: () => set({ cache: {} }),
}));
