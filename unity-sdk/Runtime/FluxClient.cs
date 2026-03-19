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
        private readonly string _anonKey;

        internal FluxClient(string serverUrl, string anonKey)
        {
            _serverUrl = serverUrl;
            _anonKey = anonKey;
        }

        /// <summary>
        /// Fetch the active version for a project + environment.
        /// Returns null if no active version found.
        /// </summary>
        internal async Task<FluxVersion> FetchActiveVersionAsync(string projectId, string environment)
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

        /// <summary>
        /// Fetch config data from the active version's snapshot.
        /// Returns the full data object: { "TableName": [ {row}, {row} ], ... }
        /// </summary>
        internal async Task<string> FetchConfigDataAsync(string projectId, string environment)
        {
            var version = await FetchActiveVersionAsync(projectId, environment);
            if (version == null)
                throw new Exception($"No active version found for {environment}");

            // The version list response includes data inline
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
        /// Check if there's a newer version than the local one.
        /// </summary>
        internal async Task<bool> HasNewVersionAsync(string projectId, string environment, string localVersionTag)
        {
            try
            {
                var version = await FetchActiveVersionAsync(projectId, environment);
                if (version == null) return false;
                return version.versionTag != localVersionTag;
            }
            catch
            {
                FluxLogger.Warn("Version check failed - using cached data");
                return false;
            }
        }

        // ─── HTTP helper using UnityWebRequest ──────────

        private async Task<string> GetAsync(string url)
        {
            return await FluxRetry.ExecuteAsync(async () =>
            {
                var request = UnityWebRequest.Get(url);

                if (!string.IsNullOrEmpty(_anonKey))
                    request.SetRequestHeader("Authorization", $"Bearer {_anonKey}");

                request.SetRequestHeader("Accept", "application/json");

                var operation = request.SendWebRequest();

                while (!operation.isDone)
                    await Task.Yield();

                if (request.result != UnityWebRequest.Result.Success)
                    throw new Exception($"HTTP {request.responseCode}: {request.error} - {url}");

                return request.downloadHandler.text;
            });
        }
    }
}
