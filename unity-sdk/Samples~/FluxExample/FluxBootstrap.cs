using UnityEngine;
using UnityFlux;

namespace UnityFlux.Samples
{
    /// <summary>
    /// Bootstrap component that configures, initializes, and syncs Unity Flux on Start.
    /// Attach this to a GameObject in your scene alongside a FluxConfig reference.
    /// </summary>
    public class FluxBootstrap : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private FluxConfig _config;

        [Header("Options")]
        [Tooltip("Automatically sync with server on start")]
        [SerializeField] private bool _autoSync = true;

        private async void Start()
        {
            if (_config == null)
            {
                Debug.LogError("[FluxBootstrap] No FluxConfig assigned! Please assign a FluxConfig asset.");
                return;
            }

            Debug.Log($"[FluxBootstrap] Configuring Flux for project: {_config.ProjectId}");
            FluxManager.Instance.Configure(_config);

            Debug.Log("[FluxBootstrap] Initializing (loading cached data)...");
            await FluxManager.Instance.InitializeAsync();

            if (_autoSync)
            {
                Debug.Log("[FluxBootstrap] Syncing with server...");
                bool updated = await FluxManager.Instance.SyncAsync();
                Debug.Log(updated
                    ? $"[FluxBootstrap] Synced! New version: {FluxManager.Instance.CurrentVersion}"
                    : "[FluxBootstrap] Already up to date.");
            }

            Debug.Log($"[FluxBootstrap] Flux is ready. State: {FluxManager.Instance.State}");
        }
    }
}
