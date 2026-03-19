using UnityEngine;

namespace UnityFlux.Internal
{
    internal static class FluxLogger
    {
        internal static bool Enabled = true;

        internal static void Log(string message)
        {
            if (Enabled) Debug.Log($"[Flux] {message}");
        }

        internal static void Warn(string message)
        {
            if (Enabled) Debug.LogWarning($"[Flux] {message}");
        }

        internal static void Error(string message)
        {
            Debug.LogError($"[Flux] {message}");
        }
    }
}
