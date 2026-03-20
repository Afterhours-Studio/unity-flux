using System;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using UnityEngine.Networking;
using UnityFlux.Internal;

namespace UnityFlux
{
    internal class FluxClient
    {
        private readonly string _serverUrl;
        private readonly string _projectId;
        private readonly string _anonKey;
        private readonly int _timeoutSec;
        private readonly int _maxRetries;
        private readonly float _retryBaseDelaySec;

        internal FluxClient(
            string serverUrl,
            string projectId,
            string anonKey,
            int timeoutSec = 30,
            int maxRetries = 3,
            float retryBaseDelaySec = 1f)
        {
            _serverUrl = serverUrl?.TrimEnd('/') ?? "";
            _projectId = projectId;
            _anonKey = anonKey;
            _timeoutSec = timeoutSec;
            _maxRetries = maxRetries;
            _retryBaseDelaySec = retryBaseDelaySec;
        }

        // ─── Public API ──────────────────────────────────

        /// <summary>
        /// Fetch the active version manifest (metadata, no data payload).
        /// Uses authenticated /api/sdk?action=manifest endpoint.
        /// </summary>
        internal async Task<FluxVersionManifest> FetchVersionManifestAsync(string projectId, string environment)
        {
            var url = $"{_serverUrl}/api/sdk?action=manifest?projectId={projectId}&env={environment}";
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
                id = null,
                tableHashes = null,
            };
        }

        /// <summary>
        /// Fetch the full config data (all tables).
        /// Uses authenticated /api/sdk?action=config endpoint.
        /// </summary>
        internal async Task<string> FetchConfigDataAsync(string projectId, string environment)
        {
            var url = $"{_serverUrl}/api/sdk?action=config?projectId={projectId}&env={environment}";
            var json = await GetAsync(url);
            var obj = JObject.Parse(json);

            var tables = obj["tables"];
            return tables?.ToString() ?? "{}";
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
