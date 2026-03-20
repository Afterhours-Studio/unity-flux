using System;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using UnityEngine.Networking;
using UnityFlux.Internal;

namespace UnityFlux
{
    internal class FluxClient
    {
        private readonly string _serverUrl;
        private readonly string _cdnBaseUrl;
        private readonly string _projectSlug;
        private readonly string _anonKey;
        private readonly int _timeoutSec;
        private readonly int _maxRetries;
        private readonly float _retryBaseDelaySec;

        internal bool UseCdn => !string.IsNullOrEmpty(_cdnBaseUrl);

        internal FluxClient(
            string serverUrl,
            string cdnBaseUrl,
            string projectSlug,
            string anonKey,
            int timeoutSec = 30,
            int maxRetries = 3,
            float retryBaseDelaySec = 1f)
        {
            _serverUrl = serverUrl;
            _cdnBaseUrl = NormalizeCdnUrl(cdnBaseUrl, projectSlug);
            _projectSlug = projectSlug;
            _anonKey = anonKey;
            _timeoutSec = timeoutSec;
            _maxRetries = maxRetries;
            _retryBaseDelaySec = retryBaseDelaySec;
        }

        /// <summary>
        /// Normalize CDN URL — handle cases where user pastes a full path like
        /// https://cdn.example.com/slug/env/master_version.json instead of just the base.
        /// Strips slug/env/file suffixes to get the clean base URL.
        /// </summary>
        private static string NormalizeCdnUrl(string cdnBaseUrl, string projectSlug)
        {
            if (string.IsNullOrEmpty(cdnBaseUrl)) return "";
            var url = cdnBaseUrl.TrimEnd('/');

            // Strip trailing master_version.json or config_*.json
            if (url.EndsWith("/master_version.json"))
                url = url.Substring(0, url.Length - "/master_version.json".Length);
            else if (url.EndsWith(".json") && url.Contains("/config_"))
                url = url.Substring(0, url.LastIndexOf('/'));

            // Strip trailing environment segment (development/staging/production)
            foreach (var env in new[] { "/development", "/staging", "/production" })
            {
                if (url.EndsWith(env))
                {
                    url = url.Substring(0, url.Length - env.Length);
                    break;
                }
            }

            // Strip trailing project slug
            if (!string.IsNullOrEmpty(projectSlug) && url.EndsWith("/" + projectSlug))
                url = url.Substring(0, url.Length - ("/" + projectSlug).Length);

            return url;
        }

        // ─── Public API ──────────────────────────────────

        /// <summary>
        /// Fetch the active version manifest (metadata, no data payload).
        /// Uses CDN master_version.json when configured, otherwise REST API.
        /// </summary>
        internal async Task<FluxVersionManifest> FetchVersionManifestAsync(string projectId, string environment)
        {
            if (UseCdn)
                return await FetchManifestFromCdnAsync(environment);

            var url = $"{_serverUrl}/api/projects/{projectId}/versions/active?env={environment}";
            var json = await GetAsync(url);
            return FluxJson.Deserialize<FluxVersionManifest>(json);
        }

        /// <summary>
        /// Fetch the full config data (all tables).
        /// Uses CDN config file when configured, otherwise REST API.
        /// </summary>
        internal async Task<string> FetchConfigDataAsync(string projectId, string environment)
        {
            if (UseCdn)
                return await FetchConfigFromCdnAsync(environment);

            var version = await FetchActiveVersionAsync(projectId, environment);
            if (version == null)
                throw new Exception($"No active version found for {environment}");

            var url = $"{_serverUrl}/api/projects/{projectId}/versions";
            var json = await GetAsync(url);
            var versions = JArray.Parse(json);

            foreach (var v in versions)
            {
                if (v["id"]?.ToString() == version.id)
                {
                    var data = v["data"];
                    return data?.ToString() ?? "{}";
                }
            }

            throw new Exception("Config data not found in version response");
        }

        /// <summary>
        /// Fetch a single table's data from a specific version (REST API only).
        /// </summary>
        internal async Task<string> FetchTableDataAsync(string projectId, string versionId, string tableName)
        {
            var url = $"{_serverUrl}/api/projects/{projectId}/versions/{versionId}/tables/{tableName}";
            return await GetAsync(url);
        }

        /// <summary>
        /// Check if there's a newer version than the local one.
        /// </summary>
        internal async Task<bool> HasNewVersionAsync(string projectId, string environment, string localVersionTag)
        {
            try
            {
                var manifest = await FetchVersionManifestAsync(projectId, environment);
                if (manifest == null) return false;
                return manifest.versionTag != localVersionTag;
            }
            catch
            {
                FluxLogger.Warn("Version check failed - using cached data");
                return false;
            }
        }

        // ─── CDN methods ─────────────────────────────────

        private async Task<FluxVersionManifest> FetchManifestFromCdnAsync(string environment)
        {
            var url = $"{_cdnBaseUrl}/{_projectSlug}/{environment}/master_version.json";
            var json = await GetAsync(url);
            var obj = JObject.Parse(json);

            return new FluxVersionManifest
            {
                versionTag = obj["version"]?.ToString(),
                environment = obj["environment"]?.ToString(),
                status = "active",
                tableCount = obj["tableCount"]?.ToObject<int>() ?? 0,
                rowCount = obj["rowCount"]?.ToObject<int>() ?? 0,
                publishedAt = obj["publishedAt"]?.ToString(),
                // CDN master_version doesn't include per-table hashes or id,
                // so delta sync is not available — full download will be used.
                id = null,
                tableHashes = null,
            };
        }

        private async Task<string> FetchConfigFromCdnAsync(string environment)
        {
            // First fetch master_version to get the configUrl
            var masterUrl = $"{_cdnBaseUrl}/{_projectSlug}/{environment}/master_version.json";
            var masterJson = await GetAsync(masterUrl);
            var master = JObject.Parse(masterJson);

            var configUrl = master["configUrl"]?.ToString();
            if (string.IsNullOrEmpty(configUrl))
                throw new Exception("master_version.json missing configUrl");

            // Fetch the actual config file
            var configJson = await GetAsync(configUrl);
            var config = JObject.Parse(configJson);

            // The CDN config wraps tables: { "version": ..., "tables": { ... } }
            var tables = config["tables"];
            return tables?.ToString() ?? "{}";
        }

        // ─── REST API helper (legacy local mode) ─────────

        private async Task<FluxVersion> FetchActiveVersionAsync(string projectId, string environment)
        {
            var url = $"{_serverUrl}/api/projects/{projectId}/versions";
            var json = await GetAsync(url);
            var versions = JArray.Parse(json);

            foreach (var v in versions)
            {
                if (v["environment"]?.ToString() == environment && v["status"]?.ToString() == "active")
                {
                    return FluxJson.Deserialize<FluxVersion>(v.ToString());
                }
            }

            return null;
        }

        // ─── HTTP layer ──────────────────────────────────

        private async Task<string> GetAsync(string url)
        {
            return await FluxRetry.ExecuteAsync(async () =>
            {
                var request = UnityWebRequest.Get(url);
                request.timeout = _timeoutSec;

                if (!string.IsNullOrEmpty(_anonKey))
                    request.SetRequestHeader("Authorization", $"Bearer {_anonKey}");

                request.SetRequestHeader("Accept", "application/json");

                var operation = request.SendWebRequest();

                while (!operation.isDone)
                    await Task.Yield();

                if (request.result != UnityWebRequest.Result.Success)
                    throw new Exception($"HTTP {request.responseCode}: {request.error} - {url}");

                return request.downloadHandler.text;
            }, _maxRetries, _retryBaseDelaySec);
        }
    }
}
