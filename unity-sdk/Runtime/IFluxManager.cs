using System;
#if UNITY_FLUX_UNITASK
using Cysharp.Threading.Tasks;
#else
using System.Threading.Tasks;
#endif

namespace UnityFlux
{
    public interface IFluxManager
    {
        FluxState State { get; }
        string CurrentVersion { get; }

        event Action<FluxState> OnStateChanged;
        event Action<string> OnVersionUpdated;

        void Configure(FluxConfig config);
#if UNITY_FLUX_UNITASK
        UniTask InitializeAsync();
        UniTask<bool> SyncAsync();
        UniTask ForceRefreshAsync();
#else
        Task InitializeAsync();
        Task<bool> SyncAsync();
        Task ForceRefreshAsync();
#endif
        void ClearCache();
    }
}
