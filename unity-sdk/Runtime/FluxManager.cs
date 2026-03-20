using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
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
            _client = new FluxClient(
                config.ServerUrl,
                config.CdnBaseUrl,
                config.ProjectSlug,
                config.AnonKey,
                config.RequestTimeoutSec,
                config.MaxRetries,
                config.RetryBaseDelaySec);
            _cache = new FluxCache(config.ProjectId, config.EnvironmentString);
            _dataStore = new FluxDataStore();

            var mode = _client.UseCdn ? "CDN" : "API";
            FluxLogger.Log($"Configured: {config.ProjectSlug} ({config.EnvironmentString}) [{mode}]");
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
        /// Uses delta sync to only download tables whose hashes have changed.
        /// Returns true if data was updated, false if already latest.
        /// </summary>
        public async Task<bool> SyncAsync()
        {
            EnsureConfigured();
            SetState(FluxState.Syncing);

            try
            {
                // Fetch manifest (lightweight - no data payload)
                var manifest = await _client.FetchVersionManifestAsync(
                    _config.ProjectId, _config.EnvironmentString);

                if (manifest == null)
                {
                    SetState(_dataStore.HasData ? FluxState.Ready : FluxState.Error);
                    return false;
                }

                // Already up to date?
                if (manifest.versionTag == CurrentVersion)
                {
                    FluxLogger.Log("Already up to date");
                    SetState(FluxState.Ready);
                    return false;
                }

                // Load cached hashes
                var cachedHashes = _cache.LoadTableHashes();

                // Determine which tables changed
                List<string> changedTables = null;
                if (manifest.tableHashes != null)
                {
                    changedTables = new List<string>();
                    foreach (var kvp in manifest.tableHashes)
                    {
                        string cachedHash;
                        if (cachedHashes == null || !cachedHashes.TryGetValue(kvp.Key, out cachedHash) || cachedHash != kvp.Value)
                        {
                            changedTables.Add(kvp.Key);
                        }
                    }
                }

                if (changedTables != null && changedTables.Count == 0)
                {
                    // Hashes match but version tag is different - just update the tag
                    CurrentVersion = manifest.versionTag;
                    _cache.SaveVersionTag(manifest.versionTag);
                    if (manifest.tableHashes != null)
                        _cache.SaveTableHashes(manifest.tableHashes);
                    SetState(FluxState.Ready);
                    OnVersionUpdated?.Invoke(manifest.versionTag);
                    return true;
                }

                // Delta sync is only available via REST API (per-table endpoints)
                if (!_client.UseCdn && changedTables != null &&
                    changedTables.Count < (manifest.tableCount > 0 ? manifest.tableCount : 999))
                {
                    // Delta sync: only download changed tables
                    FluxLogger.Log($"Delta sync: downloading {changedTables.Count} of {manifest.tableCount} tables");
                    var existingJson = _cache.LoadConfig();
                    var existingData = existingJson != null ? FluxJson.ParseObject(existingJson) : new JObject();

                    foreach (var tableName in changedTables)
                    {
                        var tableJson = await _client.FetchTableDataAsync(
                            _config.ProjectId, manifest.id, tableName);
                        existingData[tableName] = JArray.Parse(tableJson);
                    }

                    // Remove tables that no longer exist in the new version
                    if (manifest.tableHashes != null)
                    {
                        var removedTables = new List<string>();
                        foreach (var prop in existingData.Properties())
                        {
                            if (!manifest.tableHashes.ContainsKey(prop.Name))
                                removedTables.Add(prop.Name);
                        }
                        foreach (var name in removedTables)
                            existingData.Remove(name);
                    }

                    var configJson = existingData.ToString();
                    _cache.SaveConfig(configJson);
                    _dataStore.Load(configJson);
                }
                else
                {
                    // Full download (always used for CDN mode)
                    FluxLogger.Log("Full sync: downloading all tables");
                    var configJson = await _client.FetchConfigDataAsync(
                        _config.ProjectId, _config.EnvironmentString);
                    _cache.SaveConfig(configJson);
                    _dataStore.Load(configJson);
                }

                CurrentVersion = manifest.versionTag;
                _cache.SaveVersionTag(manifest.versionTag);
                if (manifest.tableHashes != null)
                    _cache.SaveTableHashes(manifest.tableHashes);

                FluxLogger.Log($"Synced to {manifest.versionTag} ({manifest.tableCount} tables, {manifest.rowCount} rows)");
                SetState(FluxState.Ready);
                OnVersionUpdated?.Invoke(manifest.versionTag);
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
