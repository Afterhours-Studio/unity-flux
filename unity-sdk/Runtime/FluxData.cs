using System;
using System.Collections.Generic;

namespace UnityFlux
{
    /// <summary>
    /// Static accessor for game config data.
    /// Use after FluxManager.InitializeAsync() or SyncAsync().
    /// </summary>
    public static class Flux
    {
        /// <summary>
        /// Whether config data has been loaded and is ready to access.
        /// </summary>
        public static bool IsReady => FluxManager.Instance.State == FluxState.Ready
                                   && FluxManager.Instance.DataStore?.HasData == true;

        /// <summary>
        /// Get all rows of a data table as a typed list.
        /// </summary>
        /// <example>
        /// var enemies = Flux.GetTable&lt;EnemyStats&gt;("EnemyStats");
        /// </example>
        public static List<T> GetTable<T>(string tableName) where T : class, new()
        {
            EnsureReady();
            return FluxManager.Instance.DataStore.GetTable<T>(tableName);
        }

        /// <summary>
        /// Get a typed value from a config table (Parameter/Type/Value format).
        /// </summary>
        /// <example>
        /// var maxHp = Flux.Get&lt;int&gt;("GameConfig", "max_hp");
        /// var speed = Flux.Get&lt;float&gt;("GameConfig", "speed");
        /// </example>
        public static T Get<T>(string tableName, string parameterName)
        {
            EnsureReady();
            return FluxManager.Instance.DataStore.GetConfigValue<T>(tableName, parameterName);
        }

        /// <summary>
        /// Try to get a config value. Returns default if not found.
        /// </summary>
        public static T GetOrDefault<T>(string tableName, string parameterName, T defaultValue = default)
        {
            if (!IsReady) return defaultValue;

            try
            {
                return FluxManager.Instance.DataStore.GetConfigValue<T>(tableName, parameterName);
            }
            catch
            {
                return defaultValue;
            }
        }

        /// <summary>
        /// Get raw JSON string for a table.
        /// </summary>
        public static string GetRawJson(string tableName)
        {
            EnsureReady();
            return FluxManager.Instance.DataStore.GetRawJson(tableName);
        }

        /// <summary>
        /// Check if a config parameter exists.
        /// </summary>
        public static bool Has(string tableName, string parameterName)
        {
            return IsReady && FluxManager.Instance.DataStore.HasConfigValue(tableName, parameterName);
        }

        /// <summary>
        /// Get all available table names.
        /// </summary>
        public static IEnumerable<string> GetTableNames()
        {
            EnsureReady();
            return FluxManager.Instance.DataStore.GetTableNames();
        }

        private static void EnsureReady()
        {
            if (!IsReady)
                throw new InvalidOperationException(
                    "Flux data not ready. Call FluxManager.Instance.InitializeAsync() first.");
        }
    }
}
