import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  History,
  HistoryCreateRequest,
  HistoryUpdateRequest,
  NetworkClient,
  Optional,
} from '@sudobility/genuivo_types';
import type { FirebaseIdToken } from '@sudobility/genuivo_client';
import { useHistories, useHistoriesTotal } from '@sudobility/genuivo_client';
import { useHistoriesStore } from '../stores/historiesStore';
import { calculatePercentage } from '../utils/calculations';

/**
 * Configuration for the {@link useHistoriesManager} hook.
 *
 * @example
 * ```typescript
 * const config: UseHistoriesManagerConfig = {
 *   baseUrl: 'https://api.example.com',
 *   networkClient: myNetworkClient,
 *   userId: 'firebase-uid-123',
 *   token: 'eyJhbGciOiJSUzI1NiIs...',
 *   autoFetch: true,
 * };
 * ```
 */
export interface UseHistoriesManagerConfig {
  /** The base URL of the Starter API server. */
  baseUrl: string;

  /**
   * A {@link NetworkClient} implementation for HTTP requests.
   * Injected to allow different fetch implementations per platform (web vs React Native).
   */
  networkClient: NetworkClient;

  /**
   * The Firebase UID of the authenticated user, or `null`/`undefined` when not logged in.
   * Cache is isolated per user -- switching users shows a fresh state.
   */
  userId: Optional<string>;

  /**
   * A valid Firebase ID token for authentication, or `null`/`undefined` when not available.
   * Changing the token resets the internal fetch guard, allowing a fresh fetch
   * to prevent stale cross-user data.
   */
  token: Optional<FirebaseIdToken>;

  /**
   * Whether to automatically fetch histories on mount.
   *
   * When `true` (default), the hook fetches data on mount if `token` and `userId`
   * are present and no data has been loaded yet. A `useRef` guard prevents
   * duplicate fetches during React strict-mode double-mount.
   *
   * Set to `false` to control fetching manually via the `refresh` function.
   *
   * @defaultValue `true`
   */
  autoFetch?: boolean;
}

/**
 * Return type for the {@link useHistoriesManager} hook.
 *
 * Provides the current histories data, computed metrics, loading/error state,
 * cache indicators, and mutation functions for CRUD operations.
 */
export interface UseHistoriesManagerReturn {
  /**
   * The current list of history entries for the user.
   * Prefers fresh server data; falls back to cached data when the server
   * has not yet responded.
   */
  histories: History[];

  /**
   * The global total sum of all users' history values.
   * Used as the denominator in the {@link percentage} calculation.
   */
  total: number;

  /**
   * The user's percentage of the global total.
   *
   * Calculated as `(userSum / globalTotal) * 100` where `userSum` is the
   * sum of all `value` fields in the user's histories. Returns `0` when
   * `globalTotal <= 0` to avoid division-by-zero errors.
   */
  percentage: number;

  /**
   * Whether any operation is currently in progress (fetching histories,
   * fetching total, or performing a mutation).
   */
  isLoading: boolean;

  /**
   * The most recent error message from any data source (histories query,
   * total query, or mutations), or `null` if no error.
   *
   * Note: Only the first non-null error is surfaced. If multiple sources
   * have errors simultaneously, earlier errors in the priority chain
   * (histories > total > mutations) take precedence.
   */
  error: Optional<string>;

  /**
   * Whether the displayed data is from the client-side cache rather than
   * a fresh server response.
   *
   * `true` when `clientHistories` is empty but cached data exists.
   * The UI can use this to show a "stale data" indicator.
   */
  isCached: boolean;

  /**
   * Unix timestamp (in milliseconds) of when the displayed data was last cached,
   * or `null` if no cached data is available.
   */
  cachedAt: Optional<number>;

  /**
   * Creates a new history entry on the server and updates the local cache.
   *
   * @param data - The history data to create
   * @throws Error if the API call fails at the network level
   * @throws Error if the API returns `success: false` (e.g., validation error)
   */
  createHistory: (data: HistoryCreateRequest) => Promise<void>;

  /**
   * Updates an existing history entry on the server and updates the local cache.
   *
   * @param historyId - The ID of the history to update
   * @param data - The fields to update
   * @throws Error if the API call fails at the network level
   * @throws Error if the API returns `success: false` (e.g., validation error)
   */
  updateHistory: (
    historyId: string,
    data: HistoryUpdateRequest
  ) => Promise<void>;

  /**
   * Deletes a history entry on the server and removes it from the local cache.
   *
   * @param historyId - The ID of the history to delete
   * @throws Error if the API call fails at the network level
   * @throws Error if the API returns `success: false` (e.g., not found)
   */
  deleteHistory: (historyId: string) => Promise<void>;

  /**
   * Manually triggers a refetch of the user's histories from the server.
   * Useful when `autoFetch` is `false` or to force a refresh after external changes.
   */
  refresh: () => void;
}

/**
 * Unified business logic hook that combines starter_client hooks, Zustand store,
 * and business logic into a single interface for UI layers.
 *
 * This is the primary hook consumed by `starter_app` and `starter_app_rn`.
 * It orchestrates:
 * - **Data fetching** via TanStack Query hooks from `@sudobility/genuivo_client`
 * - **Client-side caching** via the Zustand `useHistoriesStore`
 * - **Cache fallback** -- shows cached data while waiting for server response
 * - **Percentage calculation** -- computes `(userSum / globalTotal) * 100`
 * - **Auto-fetch** -- fetches on mount with `useRef` guard against React strict-mode double-mount
 * - **Token reactivity** -- resets the fetch guard when the token changes to prevent stale data
 * - **Error propagation** -- surfaces errors from failed mutations so the UI can display feedback
 *
 * @param config - The hook configuration (see {@link UseHistoriesManagerConfig})
 * @returns An object with data, state, and mutation functions (see {@link UseHistoriesManagerReturn})
 *
 * @example
 * ```typescript
 * import { useHistoriesManager } from '@sudobility/genuivo_lib';
 *
 * function HistoryDashboard() {
 *   const {
 *     histories,
 *     percentage,
 *     isLoading,
 *     error,
 *     isCached,
 *     createHistory,
 *   } = useHistoriesManager({
 *     baseUrl: 'https://api.example.com',
 *     networkClient,
 *     userId: 'uid-123',
 *     token: 'eyJhbG...',
 *   });
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <ErrorMessage message={error} />;
 *
 *   return (
 *     <div>
 *       {isCached && <StaleDataBanner />}
 *       <p>Your percentage: {percentage.toFixed(1)}%</p>
 *       <HistoryList items={histories} />
 *     </div>
 *   );
 * }
 * ```
 */
export const useHistoriesManager = ({
  baseUrl,
  networkClient,
  userId,
  token,
  autoFetch = true,
}: UseHistoriesManagerConfig): UseHistoriesManagerReturn => {
  const {
    histories: clientHistories,
    isLoading: historiesLoading,
    error: historiesError,
    update,
    createHistory: clientCreate,
    updateHistory: clientUpdate,
    deleteHistory: clientDelete,
    isCreating,
    isUpdating,
    isDeleting,
  } = useHistories(networkClient, baseUrl, userId ?? null, token ?? null);

  const {
    total,
    isLoading: totalLoading,
    error: totalError,
  } = useHistoriesTotal(networkClient, baseUrl);

  const cacheEntry = useHistoriesStore(
    useCallback(state => (userId ? state.cache[userId] : undefined), [userId])
  );
  const setHistories = useHistoriesStore(state => state.setHistories);
  const addHistoryToStore = useHistoriesStore(state => state.addHistory);
  const updateHistoryInStore = useHistoriesStore(state => state.updateHistory);
  const removeHistoryFromStore = useHistoriesStore(
    state => state.removeHistory
  );

  const cachedHistories = cacheEntry?.histories;
  const cachedAt = cacheEntry?.cachedAt;

  const histories = useMemo(
    () =>
      clientHistories.length > 0 ? clientHistories : (cachedHistories ?? []),
    [clientHistories, cachedHistories]
  );
  const isCached =
    clientHistories.length === 0 && (cachedHistories?.length ?? 0) > 0;

  // Track previous client histories reference to avoid redundant store writes
  const prevClientHistoriesRef = useRef<History[]>(clientHistories);

  // Sync client data to store (only when the reference actually changes)
  useEffect(() => {
    if (
      clientHistories.length > 0 &&
      userId &&
      clientHistories !== prevClientHistoriesRef.current
    ) {
      prevClientHistoriesRef.current = clientHistories;
      setHistories(userId, clientHistories);
    }
  }, [clientHistories, userId, setHistories]);

  // Calculate percentage using the extracted utility
  const percentage = useMemo(
    () => calculatePercentage(histories, total),
    [histories, total]
  );

  const createHistory = useCallback(
    async (data: HistoryCreateRequest): Promise<void> => {
      const response = await clientCreate(data);
      if (response.success && response.data && userId) {
        addHistoryToStore(userId, response.data);
      }
      if (!response.success) {
        throw new Error(response.error || 'Failed to create history');
      }
    },
    [clientCreate, userId, addHistoryToStore]
  );

  const updateHistory = useCallback(
    async (historyId: string, data: HistoryUpdateRequest): Promise<void> => {
      const response = await clientUpdate(historyId, data);
      if (response.success && response.data && userId) {
        updateHistoryInStore(userId, historyId, response.data);
      }
      if (!response.success) {
        throw new Error(response.error || 'Failed to update history');
      }
    },
    [clientUpdate, userId, updateHistoryInStore]
  );

  const deleteHistory = useCallback(
    async (historyId: string): Promise<void> => {
      const response = await clientDelete(historyId);
      if (response.success && userId) {
        removeHistoryFromStore(userId, historyId);
      }
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete history');
      }
    },
    [clientDelete, userId, removeHistoryFromStore]
  );

  const isLoading =
    historiesLoading || totalLoading || isCreating || isUpdating || isDeleting;
  const error = historiesError ?? totalError ?? null;

  const hasAttemptedFetchRef = useRef(false);

  useEffect(() => {
    if (
      autoFetch &&
      token &&
      userId &&
      histories.length === 0 &&
      !hasAttemptedFetchRef.current
    ) {
      hasAttemptedFetchRef.current = true;
      update();
    }
  }, [autoFetch, token, userId, histories.length, update]);

  useEffect(() => {
    hasAttemptedFetchRef.current = false;
  }, [token]);

  return useMemo(
    () => ({
      histories,
      total,
      percentage,
      isLoading,
      error,
      isCached,
      cachedAt: cachedAt ?? null,
      createHistory,
      updateHistory,
      deleteHistory,
      refresh: update,
    }),
    [
      histories,
      total,
      percentage,
      isLoading,
      error,
      isCached,
      cachedAt,
      createHistory,
      updateHistory,
      deleteHistory,
      update,
    ]
  );
};
