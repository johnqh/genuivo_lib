import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useHistoriesStore } from '../stores/historiesStore';
import type { History } from '@sudobility/genuivo_types';
import type { UseHistoriesManagerConfig } from './useHistoriesManager';

// --- Mocks ---

const mockUpdate = vi.fn();
const mockClientCreate = vi.fn();
const mockClientUpdate = vi.fn();
const mockClientDelete = vi.fn();

let mockHistoriesReturn = {
  histories: [] as History[],
  isLoading: false,
  error: null as string | null,
  update: mockUpdate,
  createHistory: mockClientCreate,
  updateHistory: mockClientUpdate,
  deleteHistory: mockClientDelete,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  clearError: vi.fn(),
};

let mockTotalReturn = {
  total: 0,
  isLoading: false,
  error: null as string | null,
};

vi.mock('@sudobility/genuivo_client', () => ({
  useHistories: () => mockHistoriesReturn,
  useHistoriesTotal: () => mockTotalReturn,
}));

// Import after mocks are set up
const { useHistoriesManager } = await import('./useHistoriesManager');

// --- Helpers ---

const makeHistory = (overrides: Partial<History> = {}): History => ({
  id: 'hist-1',
  user_id: 'user-1',
  datetime: '2024-01-01T00:00:00Z',
  value: 100,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const defaultConfig: UseHistoriesManagerConfig = {
  baseUrl: 'https://api.example.com',
  networkClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  userId: 'user-1',
  token: 'mock-token',
  autoFetch: false,
};

describe('useHistoriesManager', () => {
  beforeEach(() => {
    useHistoriesStore.getState().clearAll();
    mockUpdate.mockClear();
    mockClientCreate.mockClear();
    mockClientUpdate.mockClear();
    mockClientDelete.mockClear();

    mockHistoriesReturn = {
      histories: [],
      isLoading: false,
      error: null,
      update: mockUpdate,
      createHistory: mockClientCreate,
      updateHistory: mockClientUpdate,
      deleteHistory: mockClientDelete,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      clearError: vi.fn(),
    };
    mockTotalReturn = {
      total: 0,
      isLoading: false,
      error: null,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic data flow', () => {
    it('should return empty histories when no data is available', () => {
      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.histories).toEqual([]);
      expect(result.current.isCached).toBe(false);
    });

    it('should return client histories when available', () => {
      const histories = [makeHistory(), makeHistory({ id: 'hist-2' })];
      mockHistoriesReturn.histories = histories;

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.histories).toHaveLength(2);
      expect(result.current.isCached).toBe(false);
    });

    it('should return the total from the server', () => {
      mockTotalReturn.total = 1000;

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.total).toBe(1000);
    });
  });

  describe('cache fallback', () => {
    it('should fall back to cached data when client has no data', () => {
      // Pre-populate the cache
      useHistoriesStore
        .getState()
        .setHistories('user-1', [makeHistory({ value: 50 })]);

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.histories).toHaveLength(1);
      expect(result.current.histories[0].value).toBe(50);
      expect(result.current.isCached).toBe(true);
    });

    it('should prefer client data over cached data', () => {
      // Pre-populate cache with stale data
      useHistoriesStore
        .getState()
        .setHistories('user-1', [makeHistory({ value: 50 })]);

      // Client has fresh data
      mockHistoriesReturn.histories = [makeHistory({ value: 200 })];

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.histories[0].value).toBe(200);
      expect(result.current.isCached).toBe(false);
    });

    it('should set isCached to false when both client and cache are empty', () => {
      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.isCached).toBe(false);
    });

    it('should return cachedAt when using cached data', () => {
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.cachedAt).toBeGreaterThan(0);
    });

    it('should return null cachedAt when no cache entry exists', () => {
      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.cachedAt).toBeNull();
    });
  });

  describe('percentage calculation', () => {
    it('should return 0 when total is 0', () => {
      mockHistoriesReturn.histories = [makeHistory({ value: 100 })];
      mockTotalReturn.total = 0;

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.percentage).toBe(0);
    });

    it('should return 0 when total is negative', () => {
      mockHistoriesReturn.histories = [makeHistory({ value: 100 })];
      mockTotalReturn.total = -50;

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.percentage).toBe(0);
    });

    it('should calculate percentage correctly', () => {
      mockHistoriesReturn.histories = [
        makeHistory({ id: '1', value: 25 }),
        makeHistory({ id: '2', value: 75 }),
      ];
      mockTotalReturn.total = 1000;

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.percentage).toBe(10);
    });

    it('should return 0 when histories is empty', () => {
      mockTotalReturn.total = 1000;

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.percentage).toBe(0);
    });
  });

  describe('loading state', () => {
    it('should aggregate loading from histories', () => {
      mockHistoriesReturn.isLoading = true;

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.isLoading).toBe(true);
    });

    it('should aggregate loading from total', () => {
      mockTotalReturn.isLoading = true;

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.isLoading).toBe(true);
    });

    it('should aggregate loading from mutations', () => {
      mockHistoriesReturn.isCreating = true;

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.isLoading).toBe(true);
    });

    it('should not be loading when nothing is pending', () => {
      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should surface histories error', () => {
      mockHistoriesReturn.error = 'Failed to fetch histories';

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.error).toBe('Failed to fetch histories');
    });

    it('should surface total error when no histories error', () => {
      mockTotalReturn.error = 'Failed to fetch total';

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.error).toBe('Failed to fetch total');
    });

    it('should surface histories error (which includes mutation errors)', () => {
      mockHistoriesReturn.error = 'Mutation failed';

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.error).toBe('Mutation failed');
    });

    it('should prioritize histories error over total error', () => {
      mockHistoriesReturn.error = 'Histories error';
      mockTotalReturn.error = 'Total error';

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.error).toBe('Histories error');
    });

    it('should return null when no errors', () => {
      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      expect(result.current.error).toBeNull();
    });
  });

  describe('mutation wrappers', () => {
    it('createHistory should add to store on success', async () => {
      const newHistory = makeHistory({ id: 'new-1', value: 42 });
      mockClientCreate.mockResolvedValue({
        success: true,
        data: newHistory,
      });

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));

      await act(async () => {
        await result.current.createHistory({
          datetime: '2024-01-01T00:00:00Z',
          value: 42,
        });
      });

      const cached = useHistoriesStore.getState().getHistories('user-1');
      expect(cached).toHaveLength(1);
      expect(cached![0].id).toBe('new-1');
    });

    it('createHistory should throw on failure response', async () => {
      mockClientCreate.mockResolvedValue({
        success: false,
        error: 'Validation error: value must be positive',
      });

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));

      await expect(
        act(async () => {
          await result.current.createHistory({
            datetime: '2024-01-01T00:00:00Z',
            value: -1,
          });
        })
      ).rejects.toThrow('Validation error: value must be positive');
    });

    it('createHistory should throw default message when no error text', async () => {
      mockClientCreate.mockResolvedValue({
        success: false,
      });

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));

      await expect(
        act(async () => {
          await result.current.createHistory({
            datetime: '2024-01-01T00:00:00Z',
            value: 1,
          });
        })
      ).rejects.toThrow('Failed to create history');
    });

    it('updateHistory should update store on success', async () => {
      // Pre-populate cache
      useHistoriesStore
        .getState()
        .setHistories('user-1', [makeHistory({ id: 'hist-1', value: 100 })]);

      const updatedHistory = makeHistory({ id: 'hist-1', value: 999 });
      mockClientUpdate.mockResolvedValue({
        success: true,
        data: updatedHistory,
      });

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));

      await act(async () => {
        await result.current.updateHistory('hist-1', { value: 999 });
      });

      const cached = useHistoriesStore.getState().getHistories('user-1');
      expect(cached![0].value).toBe(999);
    });

    it('updateHistory should throw on failure response', async () => {
      mockClientUpdate.mockResolvedValue({
        success: false,
        error: 'Not found',
      });

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));

      await expect(
        act(async () => {
          await result.current.updateHistory('hist-1', { value: 999 });
        })
      ).rejects.toThrow('Not found');
    });

    it('deleteHistory should remove from store on success', async () => {
      // Pre-populate cache
      useHistoriesStore
        .getState()
        .setHistories('user-1', [
          makeHistory({ id: 'hist-1' }),
          makeHistory({ id: 'hist-2' }),
        ]);

      mockClientDelete.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));

      await act(async () => {
        await result.current.deleteHistory('hist-1');
      });

      const cached = useHistoriesStore.getState().getHistories('user-1');
      expect(cached).toHaveLength(1);
      expect(cached![0].id).toBe('hist-2');
    });

    it('deleteHistory should throw on failure response', async () => {
      mockClientDelete.mockResolvedValue({
        success: false,
        error: 'Forbidden',
      });

      const { result } = renderHook(() => useHistoriesManager(defaultConfig));

      await expect(
        act(async () => {
          await result.current.deleteHistory('hist-1');
        })
      ).rejects.toThrow('Forbidden');
    });

    it('mutations should not update store when userId is null', async () => {
      const configNoUser: UseHistoriesManagerConfig = {
        ...defaultConfig,
        userId: null,
      };

      const newHistory = makeHistory({ id: 'new-1' });
      mockClientCreate.mockResolvedValue({
        success: true,
        data: newHistory,
      });

      const { result } = renderHook(() => useHistoriesManager(configNoUser));

      await act(async () => {
        await result.current.createHistory({
          datetime: '2024-01-01T00:00:00Z',
          value: 42,
        });
      });

      // Store should not have any entries because userId is null
      expect(useHistoriesStore.getState().cache).toEqual({});
    });
  });

  describe('autoFetch behavior', () => {
    it('should call update when autoFetch is true and conditions are met', () => {
      renderHook(() =>
        useHistoriesManager({
          ...defaultConfig,
          autoFetch: true,
        })
      );

      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should not call update when autoFetch is false', () => {
      renderHook(() =>
        useHistoriesManager({
          ...defaultConfig,
          autoFetch: false,
        })
      );

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should not call update when token is null', () => {
      renderHook(() =>
        useHistoriesManager({
          ...defaultConfig,
          autoFetch: true,
          token: null,
        })
      );

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should not call update when userId is null', () => {
      renderHook(() =>
        useHistoriesManager({
          ...defaultConfig,
          autoFetch: true,
          userId: null,
        })
      );

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should not call update when histories already exist', () => {
      mockHistoriesReturn.histories = [makeHistory()];

      renderHook(() =>
        useHistoriesManager({
          ...defaultConfig,
          autoFetch: true,
        })
      );

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('refresh function', () => {
    it('should expose update as refresh', () => {
      const { result } = renderHook(() => useHistoriesManager(defaultConfig));
      act(() => {
        result.current.refresh();
      });
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
