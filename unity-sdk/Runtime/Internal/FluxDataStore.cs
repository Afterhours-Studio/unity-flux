using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace UnityFlux
{
    /// <summary>
    /// In-memory store for parsed config data.
    /// Loaded from JSON: { "TableName": [ {row}, {row} ], ... }
    /// </summary>
    internal class FluxDataStore
    {
        private readonly Dictionary<string, JArray> _tables = new();
        private readonly Dictionary<string, Dictionary<string, ConfigParam>> _configTables = new();

        internal bool HasData => _tables.Count > 0;

        internal void Load(string json)
        {
            _tables.Clear();
            _configTables.Clear();

            var root = JObject.Parse(json);
            foreach (var prop in root.Properties())
            {
                if (prop.Value is JArray arr)
                {
                    _tables[prop.Name] = arr;

                    // Detect config tables (rows with parameter/type/value columns)
                    if (arr.Count > 0 && arr[0]["parameter"] != null && arr[0]["type"] != null && arr[0]["value"] != null)
                    {
                        var configParams = new Dictionary<string, ConfigParam>(StringComparer.OrdinalIgnoreCase);
                        foreach (var row in arr)
                        {
                            var param = new ConfigParam
                            {
                                Parameter = row["parameter"]?.ToString() ?? "",
                                Description = row["description"]?.ToString() ?? "",
                                Type = row["type"]?.ToString() ?? "string",
                                RawValue = row["value"]?.ToString() ?? "",
                            };
                            if (!string.IsNullOrEmpty(param.Parameter))
                                configParams[param.Parameter] = param;
                        }
                        _configTables[prop.Name] = configParams;
                    }
                }
            }
        }

        internal void Clear()
        {
            _tables.Clear();
            _configTables.Clear();
        }

        /// <summary>
        /// Get all rows of a table, deserialized to type T.
        /// </summary>
        internal List<T> GetTable<T>(string tableName) where T : class, new()
        {
            if (!_tables.TryGetValue(tableName, out var arr))
                return new List<T>();

            return arr.ToObject<List<T>>() ?? new List<T>();
        }

        /// <summary>
        /// Get raw JSON for a table.
        /// </summary>
        internal string GetRawJson(string tableName)
        {
            return _tables.TryGetValue(tableName, out var arr) ? arr.ToString() : null;
        }

        /// <summary>
        /// Get a typed value from a config table (Parameter/Type/Value).
        /// </summary>
        internal T GetConfigValue<T>(string tableName, string parameterName)
        {
            if (!_configTables.TryGetValue(tableName, out var dict))
                throw new KeyNotFoundException($"Config table not found: {tableName}");

            if (!dict.TryGetValue(parameterName, out var param))
                throw new KeyNotFoundException($"Parameter not found: {parameterName} in {tableName}");

            return param.GetValue<T>();
        }

        /// <summary>
        /// Check if a config table has a parameter.
        /// </summary>
        internal bool HasConfigValue(string tableName, string parameterName)
        {
            return _configTables.TryGetValue(tableName, out var dict)
                && dict.ContainsKey(parameterName);
        }

        /// <summary>
        /// Get all table names.
        /// </summary>
        internal IEnumerable<string> GetTableNames() => _tables.Keys;

        /// <summary>
        /// Check if a table is a config table.
        /// </summary>
        internal bool IsConfigTable(string tableName) => _configTables.ContainsKey(tableName);
    }

    internal class ConfigParam
    {
        public string Parameter;
        public string Description;
        public string Type;
        public string RawValue;

        public T GetValue<T>()
        {
            if (string.IsNullOrEmpty(RawValue))
                return default;

            var targetType = typeof(T);

            if (targetType == typeof(string)) return (T)(object)RawValue;
            if (targetType == typeof(int)) return (T)(object)int.Parse(RawValue);
            if (targetType == typeof(float)) return (T)(object)float.Parse(RawValue);
            if (targetType == typeof(double)) return (T)(object)double.Parse(RawValue);
            if (targetType == typeof(bool)) return (T)(object)(RawValue.ToLower() == "true");
            if (targetType == typeof(long)) return (T)(object)long.Parse(RawValue);

            return (T)Convert.ChangeType(RawValue, targetType);
        }
    }
}
