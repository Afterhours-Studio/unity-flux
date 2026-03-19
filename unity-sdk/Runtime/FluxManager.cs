using System;
using System.Threading.Tasks;
using UnityFlux.Internal;

namespace UnityFlux
{
    public class FluxManager
    {
        private static FluxManager _instance;
        public static FluxManager Instance => _instance ??= new FluxManager();

        private FluxConfig _config;
        private FluxClient _client;
        private FluxCache _cache;
        private FluxDataStore _dataStore;

        public FluxState State { get; private set; } = FluxState.NotInitialized;
        public string CurrentVersion { get; private set; }

        public event Action<FluxState> OnStateChanged;
        public event Action<string> OnVersionUpdated;

        /// <summary>
        /// Configure the SDK with a FluxConfig asset.
        /// </summary>
        public void Configure(FluxConfig config)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _client = new FluxClient(config.ServerUrl, config.AnonKey);
            _cache = new FluxCache(config.ProjectId, config.EnvironmentString);
            _dataStore = new FluxDataStore();

            FluxLogger.Log($"Configured: {config.ProjectSlug} ({config.EnvironmentString})");
        }

        /// <summary>
        /// Load cached data for instant startup. Works offline.
        /// Call this before SyncAsync for immediate data access.
        /// </summary>
        public async Task InitializeAsync()
        {
            EnsureConfigured();
            SetState(FluxState.Initializing);

            try
            {
                // Load from cache (Memory → Disk → Resources)
                var cached = _cache.LoadConfig();
                if (cached != null)
                {
                    _dataStore.Load(cached);
                    CurrentVersion = _cache.LoadVersionTag();
                    FluxLogger.Log($"Initialized from cache (version: {CurrentVersion ?? "unknown"})");
                }
                else
                {
                    FluxLogger.Warn("No cached data found - call SyncAsync to download");
                }

                SetState(FluxState.Ready);
            }
            catch (Exception ex)
            {
                FluxLogger.Error($"Initialize failed: {ex.Message}");
                SetState(FluxState.Error);
                throw;
            }

            await Task.CompletedTask;
        }

        /// <summary>
        /// Check for new version and download if available.
        /// Returns true if data was updated, false if already latest.
        /// </summary>
        public async Task<bool> SyncAsync()
        {
            EnsureConfigured();
            SetState(FluxState.Syncing);

            try
            {
                var hasNew = await _client.HasNewVersionAsync(
                    _config.ProjectId, _config.EnvironmentString, CurrentVersion);

                if (!hasNew)
                {
                    FluxLogger.Log("Already up to date");
                    SetState(FluxState.Ready);
                    return false;
                }

                FluxLogger.Log("New version available - downloading...");

                var configJson = await _client.FetchConfigDataAsync(
                    _config.ProjectId, _config.EnvironmentString);

                var version = await _client.FetchActiveVersionAsync(
                    _config.ProjectId, _config.EnvironmentString);

                // Update cache + memory
                _cache.SaveConfig(configJson);
                _cache.SaveVersionTag(version.versionTag);
                _dataStore.Load(configJson);
                CurrentVersion = version.versionTag;

                FluxLogger.Log($"Synced to {version.versionTag} ({version.tableCount} tables, {version.rowCount} rows)");
                SetState(FluxState.Ready);
                OnVersionUpdated?.Invoke(version.versionTag);
                return true;
            }
            catch (Exception ex)
            {
                FluxLogger.Error($"Sync failed: {ex.Message}");
                SetState(_dataStore.HasData ? FluxState.Ready : FluxState.Error);
                return false;
            }
        }

        /// <summary>
        /// Force re-download regardless of version.
        /// </summary>
        public async Task ForceRefreshAsync()
        {
            CurrentVersion = null;
            await SyncAsync();
        }

        /// <summary>
        /// Clear all cached data.
        /// </summary>
        public void ClearCache()
        {
            _cache?.Clear();
            _dataStore?.Clear();
            CurrentVersion = null;
            SetState(FluxState.NotInitialized);
        }

        // ─── Internal accessor for FluxData ──────────────

        internal FluxDataStore DataStore => _dataStore;

        // ─── Private helpers ─────────────────────────────

        private void EnsureConfigured()
        {
            if (_config == null)
                throw new InvalidOperationException("FluxManager not configured. Call Configure() first.");
        }

        private void SetState(FluxState state)
        {
            if (State == state) return;
            State = state;
            OnStateChanged?.Invoke(state);
        }
    }
}
