# @sudobility/starter_lib

Business logic library with Zustand stores for the Starter application.

## Installation

```bash
bun add @sudobility/starter_lib
```

Peer dependencies:

```bash
bun add react @tanstack/react-query zustand @sudobility/types
```

## Usage

```ts
import { useHistoriesManager } from "@sudobility/starter_lib";

// In a React component:
const {
  histories,
  total,
  percentage,
  isCached,
  createHistory,
  updateHistory,
  deleteHistory,
} = useHistoriesManager({
  baseUrl: "https://api.example.com",
  networkClient,
  userId: "firebase-uid",
  token: firebaseIdToken,
  autoFetch: true, // default
});
```

## API

### useHistoriesManager

Unified hook that combines starter_client hooks + Zustand store + business logic:

- Percentage calculation: `(userSum / globalTotal) * 100`
- Cache fallback: returns cached data while server hasn't responded
- Auto-fetch on mount (configurable)
- Token reactivity: resets state on token change

### useHistoriesStore

Zustand store providing per-user client-side cache with operations: `set`, `get`, `add`, `update`, `remove`. Keyed by user ID.

## Development

```bash
bun run build          # Build ESM
bun run clean          # Remove dist/
bun test               # Run Vitest tests
bun run typecheck      # TypeScript check
bun run lint           # ESLint
bun run verify         # All checks + build (use before commit)
```

## Related Packages

- **starter_types** -- Shared type definitions (imported transitively via starter_client)
- **starter_client** -- API client SDK; this library wraps its hooks with business logic
- **starter_app** -- Web frontend that consumes `useHistoriesManager`
- **starter_app_rn** -- React Native app that consumes `useHistoriesManager`
- **starter_api** -- Backend server (communicated with indirectly through starter_client)

## License

BUSL-1.1
