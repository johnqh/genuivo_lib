import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHistoriesStore } from './historiesStore';
import type { History } from '@sudobility/genuivo_types';

const makeHistory = (overrides: Partial<History> = {}): History => ({
  id: 'hist-1',
  user_id: 'user-1',
  datetime: '2024-01-01T00:00:00Z',
  value: 100,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('historiesStore', () => {
  beforeEach(() => {
    useHistoriesStore.getState().clearAll();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setHistories', () => {
    it('should set histories for a user', () => {
      const histories = [makeHistory(), makeHistory({ id: 'hist-2' })];
      useHistoriesStore.getState().setHistories('user-1', histories);
      const result = useHistoriesStore.getState().getHistories('user-1');
      expect(result).toHaveLength(2);
    });

    it('should overwrite existing histories', () => {
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);
      useHistoriesStore
        .getState()
        .setHistories('user-1', [makeHistory({ id: 'hist-new' })]);
      const result = useHistoriesStore.getState().getHistories('user-1');
      expect(result).toHaveLength(1);
      expect(result![0].id).toBe('hist-new');
    });

    it('should not affect other users', () => {
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);
      useHistoriesStore
        .getState()
        .setHistories('user-2', [
          makeHistory({ id: 'hist-2', user_id: 'user-2' }),
        ]);
      expect(useHistoriesStore.getState().getHistories('user-1')).toHaveLength(
        1
      );
      expect(useHistoriesStore.getState().getHistories('user-2')).toHaveLength(
        1
      );
    });
  });

  describe('getHistories', () => {
    it('should return undefined for unknown user', () => {
      const result = useHistoriesStore.getState().getHistories('unknown');
      expect(result).toBeUndefined();
    });

    it('should return histories for known user', () => {
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);
      const result = useHistoriesStore.getState().getHistories('user-1');
      expect(result).toHaveLength(1);
      expect(result![0].id).toBe('hist-1');
    });
  });

  describe('getCacheEntry', () => {
    it('should return undefined for unknown user', () => {
      const entry = useHistoriesStore.getState().getCacheEntry('unknown');
      expect(entry).toBeUndefined();
    });

    it('should return cache entry with cachedAt timestamp', () => {
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);
      const entry = useHistoriesStore.getState().getCacheEntry('user-1');
      expect(entry).toBeDefined();
      expect(entry!.histories).toHaveLength(1);
      expect(entry!.cachedAt).toBeGreaterThan(0);
    });
  });

  describe('addHistory', () => {
    it('should add to existing histories', () => {
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);
      useHistoriesStore
        .getState()
        .addHistory('user-1', makeHistory({ id: 'hist-2', value: 200 }));
      const result = useHistoriesStore.getState().getHistories('user-1');
      expect(result).toHaveLength(2);
      expect(result![1].id).toBe('hist-2');
    });

    it('should create cache entry if none exists', () => {
      useHistoriesStore
        .getState()
        .addHistory('user-1', makeHistory({ id: 'hist-1' }));
      const result = useHistoriesStore.getState().getHistories('user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('updateHistory', () => {
    it('should update existing history by id', () => {
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);
      useHistoriesStore
        .getState()
        .updateHistory(
          'user-1',
          'hist-1',
          makeHistory({ id: 'hist-1', value: 999 })
        );
      const result = useHistoriesStore.getState().getHistories('user-1');
      expect(result![0].value).toBe(999);
    });

    it('should not modify other histories', () => {
      useHistoriesStore
        .getState()
        .setHistories('user-1', [
          makeHistory(),
          makeHistory({ id: 'hist-2', value: 200 }),
        ]);
      useHistoriesStore
        .getState()
        .updateHistory(
          'user-1',
          'hist-1',
          makeHistory({ id: 'hist-1', value: 999 })
        );
      const result = useHistoriesStore.getState().getHistories('user-1');
      expect(result![1].value).toBe(200);
    });

    it('should do nothing if user has no cache', () => {
      useHistoriesStore
        .getState()
        .updateHistory('unknown', 'hist-1', makeHistory());
      const result = useHistoriesStore.getState().getHistories('unknown');
      expect(result).toBeUndefined();
    });
  });

  describe('removeHistory', () => {
    it('should remove history by id', () => {
      useHistoriesStore
        .getState()
        .setHistories('user-1', [makeHistory(), makeHistory({ id: 'hist-2' })]);
      useHistoriesStore.getState().removeHistory('user-1', 'hist-1');
      const result = useHistoriesStore.getState().getHistories('user-1');
      expect(result).toHaveLength(1);
      expect(result![0].id).toBe('hist-2');
    });

    it('should do nothing if user has no cache', () => {
      useHistoriesStore.getState().removeHistory('unknown', 'hist-1');
      const result = useHistoriesStore.getState().getHistories('unknown');
      expect(result).toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('should clear all cached data', () => {
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);
      useHistoriesStore
        .getState()
        .setHistories('user-2', [
          makeHistory({ id: 'hist-2', user_id: 'user-2' }),
        ]);
      useHistoriesStore.getState().clearAll();
      expect(
        useHistoriesStore.getState().getHistories('user-1')
      ).toBeUndefined();
      expect(
        useHistoriesStore.getState().getHistories('user-2')
      ).toBeUndefined();
    });
  });

  describe('cache expiration', () => {
    it('should return undefined for expired cache entry via getHistories', () => {
      vi.useFakeTimers();
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);

      // Advance time past the default expiration (10 minutes)
      vi.advanceTimersByTime(11 * 60 * 1000);

      const result = useHistoriesStore.getState().getHistories('user-1');
      expect(result).toBeUndefined();
    });

    it('should return undefined for expired cache entry via getCacheEntry', () => {
      vi.useFakeTimers();
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);

      vi.advanceTimersByTime(11 * 60 * 1000);

      const entry = useHistoriesStore.getState().getCacheEntry('user-1');
      expect(entry).toBeUndefined();
    });

    it('should return data within the expiration window', () => {
      vi.useFakeTimers();
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);

      // Advance time but stay within the 10 minute window
      vi.advanceTimersByTime(5 * 60 * 1000);

      const result = useHistoriesStore.getState().getHistories('user-1');
      expect(result).toHaveLength(1);
    });

    it('should support custom maxAge for getHistories', () => {
      vi.useFakeTimers();
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);

      // Advance 2 seconds
      vi.advanceTimersByTime(2000);

      // With 1-second maxAge, data should be expired
      const expired = useHistoriesStore.getState().getHistories('user-1', 1000);
      expect(expired).toBeUndefined();

      // With 5-second maxAge, data should still be valid
      const valid = useHistoriesStore.getState().getHistories('user-1', 5000);
      expect(valid).toHaveLength(1);
    });

    it('should support custom maxAge for getCacheEntry', () => {
      vi.useFakeTimers();
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);

      vi.advanceTimersByTime(2000);

      const expired = useHistoriesStore
        .getState()
        .getCacheEntry('user-1', 1000);
      expect(expired).toBeUndefined();

      const valid = useHistoriesStore.getState().getCacheEntry('user-1', 5000);
      expect(valid).toBeDefined();
    });
  });

  describe('purgeExpired', () => {
    it('should remove expired entries and keep fresh ones', () => {
      vi.useFakeTimers();

      // Cache user-1 data
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);

      // Advance 6 minutes
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Cache user-2 data (fresh)
      useHistoriesStore
        .getState()
        .setHistories('user-2', [
          makeHistory({ id: 'hist-2', user_id: 'user-2' }),
        ]);

      // Advance 5 more minutes (user-1 is now 11 min old, user-2 is 5 min old)
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Purge with default 10 minute expiry
      useHistoriesStore.getState().purgeExpired();

      // user-1 should be purged (11 min old), user-2 should remain (5 min old)
      expect(useHistoriesStore.getState().cache['user-1']).toBeUndefined();
      expect(useHistoriesStore.getState().cache['user-2']).toBeDefined();
    });

    it('should support custom maxAge for purging', () => {
      vi.useFakeTimers();
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);

      vi.advanceTimersByTime(2000);

      // Purge with 1 second maxAge
      useHistoriesStore.getState().purgeExpired(1000);

      expect(useHistoriesStore.getState().cache['user-1']).toBeUndefined();
    });

    it('should not remove anything when all entries are fresh', () => {
      useHistoriesStore.getState().setHistories('user-1', [makeHistory()]);
      useHistoriesStore
        .getState()
        .setHistories('user-2', [
          makeHistory({ id: 'hist-2', user_id: 'user-2' }),
        ]);

      useHistoriesStore.getState().purgeExpired();

      expect(useHistoriesStore.getState().cache['user-1']).toBeDefined();
      expect(useHistoriesStore.getState().cache['user-2']).toBeDefined();
    });
  });
});
