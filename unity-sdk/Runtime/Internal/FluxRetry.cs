using System;
using System.Threading.Tasks;

namespace UnityFlux.Internal
{
    internal static class FluxRetry
    {
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
                        var delay = baseDelaySec * (1 << attempt); // 1s, 2s, 4s
                        FluxLogger.Warn($"Attempt {attempt + 1} failed: {ex.Message}. Retrying in {delay}s...");
                        await Task.Delay(TimeSpan.FromSeconds(delay));
                    }
                }
            }

            throw new Exception($"All {maxRetries + 1} attempts failed", lastException);
        }
    }
}
