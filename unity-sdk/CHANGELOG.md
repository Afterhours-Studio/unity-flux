# Changelog

## [0.0.1] - 2026-03-19

### Added
- FluxManager singleton (Configure, InitializeAsync, SyncAsync, ForceRefreshAsync)
- FluxConfig ScriptableObject with custom inspector
- Flux static accessor (GetTable<T>, Get<T>, GetOrDefault<T>)
- 3-tier cache (Memory → Disk → Resources fallback)
- FluxClient with UnityWebRequest + exponential backoff retry
- Config table support (Parameter/Type/Value format)
- Editor Dashboard window (Window > Unity Flux > Dashboard)
- Custom FluxConfig inspector with connection test
- Offline resilience — works without network after first sync
