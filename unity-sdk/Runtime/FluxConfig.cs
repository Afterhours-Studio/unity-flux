using UnityEngine;

namespace UnityFlux
{
    [CreateAssetMenu(menuName = "Unity Flux/Flux Config", fileName = "FluxConfig")]
    public class FluxConfig : ScriptableObject
    {
        [Header("Project")]
        [SerializeField] private string _projectId;
        [SerializeField] private string _projectSlug;

        [Header("Environment")]
        [SerializeField] private FluxEnvironment _environment = FluxEnvironment.Development;

        [Header("Connection")]
        [Tooltip("Phase 1: http://localhost:3001  |  Phase 2: Supabase URL")]
        [SerializeField] private string _serverUrl = "http://localhost:3001";

        [Tooltip("Phase 2: Cloudflare R2 CDN URL")]
        [SerializeField] private string _cdnBaseUrl;

        [Header("Authentication")]
        [SerializeField] private string _anonKey;

        public string ProjectId => _projectId;
        public string ProjectSlug => _projectSlug;
        public FluxEnvironment Environment => _environment;
        public string ServerUrl => _serverUrl.TrimEnd('/');
        public string CdnBaseUrl => _cdnBaseUrl?.TrimEnd('/') ?? "";
        public string AnonKey => _anonKey;

        public string EnvironmentString => _environment switch
        {
            FluxEnvironment.Development => "development",
            FluxEnvironment.Staging => "staging",
            FluxEnvironment.Production => "production",
            _ => "development"
        };
    }
}
