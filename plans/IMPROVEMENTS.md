# Improvement Plans for @sudobility/starter_lib

## Priority 1 - High Impact

### 1. Add Tests for useHistoriesManager Hook -- COMPLETED

- Added comprehensive test suite in `src/business/hooks/useHistoriesManager.test.ts` (35 tests)
- Tests cover: basic data flow, cache fallback logic, percentage calculation (including division-by-zero), loading state aggregation, error handling priority, mutation wrappers (success + failure), autoFetch behavior, and refresh function
- Mocks `@sudobility/starter_client` hooks to isolate business logic testing
- Added `@testing-library/react`, `react-dom`, and `jsdom` as dev dependencies for React hook testing
- Created `vitest.config.ts` with jsdom environment and `vitest.setup.ts` for React act() support

### 2. Add JSDoc Documentation to All Exports -- COMPLETED

- Added complete JSDoc documentation to all exported interfaces and types:
  - `UseHistoriesManagerConfig` -- all fields documented with defaults and behavior notes
  - `UseHistoriesManagerReturn` -- all fields documented including percentage formula, isCached semantics, and mutation error throwing behavior
  - `useHistoriesManager` -- full hook-level documentation with usage example
  - `HistoriesCacheEntry` -- documented fields
  - `HistoriesStoreState` -- all methods documented with param/return descriptions
  - `useHistoriesStore` -- store-level documentation with usage examples
  - `DEFAULT_CACHE_EXPIRATION_MS` -- documented constant
  - `calculatePercentage` and `calculateSum` -- full JSDoc with examples

### 3. Add Cache Expiration Strategy to Zustand Store -- COMPLETED

- `getHistories` and `getCacheEntry` now accept an optional `maxAge` parameter (defaults to `DEFAULT_CACHE_EXPIRATION_MS` = 10 minutes)
- Expired cache entries return `undefined` from getter methods, triggering the same fallback behavior as missing entries
- Added `purgeExpired(maxAge?)` method to remove all expired entries from the store in bulk
- Exported `DEFAULT_CACHE_EXPIRATION_MS` constant for consumer configuration
- Added 8 new tests covering cache expiration and purging behavior with fake timers

## Priority 2 - Medium Impact

### 3. Improve Error Propagation in Mutation Wrappers -- COMPLETED

- `createHistory`, `updateHistory`, and `deleteHistory` now throw an `Error` when `response.success` is `false`
- Error message is extracted from `response.error` or falls back to a descriptive default (e.g., `'Failed to create history'`)
- Consumer apps can now catch mutation failures in try/catch blocks for proper UI feedback
- Existing consumer code in `starter_app_rn` already uses try/catch around mutations, so this is backwards-compatible
- Added test coverage for error throwing on each mutation type

### 4. Decouple Store Updates from Hook-Level Side Effects -- COMPLETED

- Added referential equality check using `useRef` to track previous `clientHistories` reference
- The `useEffect` that syncs client data to the store now only writes when the reference actually changes (`clientHistories !== prevClientHistoriesRef.current`), avoiding redundant store writes on re-renders
- Note: The store operations in mutation callbacks were kept as-is because they provide optimistic updates before TanStack Query re-invalidates, which improves perceived UI responsiveness

## Priority 3 - Nice to Have

### 5. Add Store Persistence Option -- SKIPPED

- Requires Zustand persist middleware + platform-specific storage adapters (AsyncStorage for RN, localStorage for web)
- This is a major architectural change that would introduce new peer dependencies and platform-specific configuration
- Deferred to a future iteration when cold-start performance becomes a priority

### 6. Extract Percentage Calculation into a Standalone Utility -- COMPLETED

- Created `src/business/utils/calculations.ts` with two pure functions:
  - `calculateSum(histories)` -- sums all `value` fields from a history array
  - `calculatePercentage(histories, globalTotal)` -- computes `(userSum / globalTotal) * 100` with `total <= 0` guard
- Updated `useHistoriesManager` to use `calculatePercentage` instead of inline logic
- Exported both functions from the package's public API for reuse by consumers
- Added 11 tests in `src/business/utils/calculations.test.ts` covering edge cases (empty array, zero total, negative total, decimal precision, percentages over 100)
