using System;
using System.Text;
using Newtonsoft.Json.Linq;
using UnityEngine.Networking;
using UnityFlux.Internal;
#if UNITY_FLUX_UNITASK
using Cysharp.Threading.Tasks;
#else
using System.Threading.Tasks;
#endif

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

#if UNITY_FLUX_UNITASK
        internal async UniTask<FluxVersionManifest> FetchVersionManifestAsync(string projectId, string environment)
#else
        internal async Task<FluxVersionManifest> FetchVersionManifestAsync(string projectId, string environment)
#endif
        {
            var url = $"{_serverUrl}/api/sdk?action=manifest&projectId={projectId}&env={environment}";
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

#if UNITY_FLUX_UNITASK
        internal async UniTask<string> FetchConfigDataAsync(string projectId, string environment)
#else
        internal async Task<string> FetchConfigDataAsync(string projectId, string environment)
#endif
        {
            var url = $"{_serverUrl}/api/sdk?action=config&projectId={projectId}&env={environment}";
            var json = await GetAsync(url);
            var obj = JObject.Parse(json);

            var tables = obj["tables"];
            return tables?.ToString() ?? "{}";
        }

#if UNITY_FLUX_UNITASK
        internal async UniTask<bool> HasNewVersionAsync(string projectId, string environment, string localVersionTag)
#else
        internal async Task<bool> HasNewVersionAsync(string projectId, string environment, string localVersionTag)
#endif
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

#if UNITY_FLUX_UNITASK
        private async UniTask<string> GetAsync(string url)
#else
        private async Task<string> GetAsync(string url)
#endif
        {
            return await FluxRetry.ExecuteAsync(async () =>
            {
                var request = UnityWebRequest.Get(url);
                request.timeout = _timeoutSec;

                if (!string.IsNullOrEmpty(_anonKey))
                    request.SetRequestHeader("Authorization", $"Bearer {_anonKey}");

                request.SetRequestHeader("Accept", "application/json");

                var operation = request.SendWebRequest();

#if UNITY_FLUX_UNITASK
                await operation.ToUniTask();
#else
                while (!operation.isDone)
                    await Task.Yield();
#endif

                if (request.result != UnityWebRequest.Result.Success)
                    throw new Exception($"HTTP {request.responseCode}: {request.error} - {url}");

                return request.downloadHandler.text;
            }, _maxRetries, _retryBaseDelaySec);
        }
    }
}
