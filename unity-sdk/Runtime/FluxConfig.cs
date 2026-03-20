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
        [Tooltip("Dashboard server URL (e.g. https://flux.h1dr0n.org)")]
        [SerializeField] private string _serverUrl;

        [Header("Authentication")]
        [Tooltip("Client-safe read-only key from dashboard. Found in Overview > SDK Credentials > Anon Key. Required to fetch config data.")]
        [SerializeField] private string _anonKey;

        [Header("Retry & Timeout")]
        [Tooltip("HTTP request timeout in seconds")]
        [SerializeField] private int _requestTimeoutSec = 30;

        [Tooltip("Maximum number of retry attempts on failure")]
        [SerializeField] private int _maxRetries = 3;

        [Tooltip("Base delay between retries in seconds (doubles each attempt)")]
        [SerializeField] private float _retryBaseDelaySec = 1f;

        public string ProjectId => _projectId;
        public string ProjectSlug => _projectSlug;
        public FluxEnvironment Environment => _environment;
        public string ServerUrl => _serverUrl?.TrimEnd('/') ?? "";
        public string AnonKey => _anonKey;
        public int RequestTimeoutSec => _requestTimeoutSec;
        public int MaxRetries => _maxRetries;
        public float RetryBaseDelaySec => _retryBaseDelaySec;

        public string EnvironmentString => _environment switch
        {
            FluxEnvironment.Development => "development",
            FluxEnvironment.Staging => "staging",
            FluxEnvironment.Production => "production",
            _ => "development"
        };
    }
}
