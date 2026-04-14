# Genuivo Lib

Business logic library with Zustand stores for the Genuivo application.

**npm**: `@sudobility/genuivo_lib` (restricted, BUSL-1.1)

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Bun
- **Package Manager**: Bun (do not use npm/yarn/pnpm for installing dependencies)
- **Build**: TypeScript compiler (ESM)
- **Test**: Vitest
- **State**: Zustand 5
- **Data Fetching**: TanStack Query 5

## Project Structure

```
src/
├── index.ts                              # Main exports
└── business/
    ├── index.ts                          # Business layer exports
    ├── stores/
    │   ├── index.ts                      # Store exports
    │   ├── historiesStore.ts             # Per-user Zustand cache store
    │   └── historiesStore.test.ts
    └── hooks/
        ├── index.ts                      # Hook exports
        └── useHistoriesManager.ts        # Unified business logic hook
```

## Commands

```bash
bun run build          # Build ESM
bun run clean          # Remove dist/
bun test               # Run Vitest tests (src/business/stores/historiesStore.test.ts)
bun run typecheck      # TypeScript check
bun run lint           # Run ESLint
bun run verify         # All checks + build (use before commit)
bun run prepublishOnly # Clean + build (runs on publish)
```

## Key Concepts

### useHistoriesStore

Zustand store providing per-user client-side cache with operations: `set`, `get`, `add`, `update`, `remove`. Keyed by user ID for multi-user support.

### useHistoriesManager

Unified hook that combines genuivo_client hooks + Zustand store + business logic:

- **Config**: `{ baseUrl, networkClient, userId, token, autoFetch? }`
- **Percentage calculation**: `(userSum / globalTotal) * 100`
- **Cache fallback**: returns cached data when server hasn't responded yet
- **Auto-fetch**: fetches on mount when `autoFetch` is enabled (default)
- **Token reactivity**: resets state when token changes

This is the primary hook consumed by UI layers (genuivo_app, genuivo_app_rn).

## Peer Dependencies

- `react` (>=18)
- `@tanstack/react-query` (>=5)
- `zustand` (>=5)
- `@sudobility/types` — NetworkClient interface

## Architecture

```
genuivo_app / genuivo_app_rn
    ↓ uses
@sudobility/genuivo_lib (this package)
    ↓ uses
@sudobility/genuivo_client (API hooks)
    ↓ uses
@sudobility/genuivo_types (type definitions)
```

## Related Projects

- **genuivo_types** — Shared type definitions; imported transitively via genuivo_client
- **genuivo_client** — API client SDK; this library wraps its hooks with business logic and Zustand state
- **genuivo_app** — Web frontend that consumes `useHistoriesManager` from this library
- **genuivo_app_rn** — React Native app that consumes `useHistoriesManager` via file: links
- **genuivo_api** — Backend server; this library communicates with it indirectly through genuivo_client

## Coding Patterns

- `useHistoriesManager` is the primary hook -- it orchestrates genuivo_client hooks + Zustand store into a single unified interface for UI layers
- Zustand store (`useHistoriesStore`) is keyed by `userId` for per-user cache isolation
- Percentage calculation: `(userSum / globalTotal) * 100` -- this is the core business metric
- `isCached` flag indicates when the UI is showing stale cached data before the server responds
- `autoFetch` (default: true) triggers data fetching on mount; use `autoFetch: false` for manual control
- Token reactivity: changing the auth token resets the store state to prevent stale cross-user data
- `useRef` is used to prevent duplicate fetch calls on React strict-mode double-mount

## Gotchas

- Zustand store is in-memory only -- there is no persistence; data is lost on page refresh or app restart
- Cache is isolated per `userId` -- switching users shows a fresh state (not another user's data)
- Token change resets the entire store state -- this is intentional to prevent data leakage between users
- `useRef` guards prevent duplicate fetches on mount; be careful not to break this guard when modifying the hook
- This is a published npm package (`@sudobility/genuivo_lib`) -- coordinate breaking changes with genuivo_app and genuivo_app_rn
