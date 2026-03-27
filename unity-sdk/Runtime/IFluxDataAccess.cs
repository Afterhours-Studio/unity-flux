using System.Collections.Generic;

namespace UnityFlux
{
    public interface IFluxDataAccess
    {
        bool IsReady { get; }
        List<T> GetTable<T>(string tableName) where T : class, new();
        T Get<T>(string tableName, string parameterName);
        T GetOrDefault<T>(string tableName, string parameterName, T defaultValue = default);
        string GetRawJson(string tableName);
        bool Has(string tableName, string parameterName);
        IEnumerable<string> GetTableNames();
    }
}
