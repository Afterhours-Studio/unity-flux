using System;
using System.Threading.Tasks;

namespace UnityFlux
{
    public interface IFluxManager
    {
        FluxState State { get; }
        string CurrentVersion { get; }

        event Action<FluxState> OnStateChanged;
        event Action<string> OnVersionUpdated;

        void Configure(FluxConfig config);
        Task InitializeAsync();
        Task<bool> SyncAsync();
        Task ForceRefreshAsync();
        void ClearCache();
    }
}
