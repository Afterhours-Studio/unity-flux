using System;
#if UNITY_FLUX_UNITASK
using Cysharp.Threading.Tasks;
#else
using System.Threading.Tasks;
#endif

namespace UnityFlux.Internal
{
    internal static class FluxRetry
    {
#if UNITY_FLUX_UNITASK
        internal static async UniTask<T> ExecuteAsync<T>(
            Func<UniTask<T>> action,
            int maxRetries = 3,
            float baseDelaySec = 1f)
        {
            Exception lastException = null;

            for (int attempt = 0; attempt <= maxRetries; attempt++)
            {
                try
                {
                    return await action();
                }
                catch (Exception ex)
                {
                    lastException = ex;

                    if (attempt < maxRetries)
                    {
                        var delay = baseDelaySec * (1 << attempt);
                        FluxLogger.Warn($"Attempt {attempt + 1} failed: {ex.Message}. Retrying in {delay}s...");
                        await UniTask.Delay(TimeSpan.FromSeconds(delay));
                    }
                }
            }

            throw new Exception($"All {maxRetries + 1} attempts failed", lastException);
        }
#else
        internal static async Task<T> ExecuteAsync<T>(
            Func<Task<T>> action,
            int maxRetries = 3,
            float baseDelaySec = 1f)
        {
            Exception lastException = null;

            for (int attempt = 0; attempt <= maxRetries; attempt++)
            {
                try
                {
                    return await action();
                }
                catch (Exception ex)
                {
                    lastException = ex;

                    if (attempt < maxRetries)
                    {
                        var delay = baseDelaySec * (1 << attempt);
                        FluxLogger.Warn($"Attempt {attempt + 1} failed: {ex.Message}. Retrying in {delay}s...");
                        await Task.Delay(TimeSpan.FromSeconds(delay));
                    }
                }
            }

            throw new Exception($"All {maxRetries + 1} attempts failed", lastException);
        }
#endif
    }
}
