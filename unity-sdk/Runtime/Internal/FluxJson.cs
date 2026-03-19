using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace UnityFlux.Internal
{
    internal static class FluxJson
    {
        private static readonly JsonSerializerSettings Settings = new()
        {
            NullValueHandling = NullValueHandling.Ignore,
            MissingMemberHandling = MissingMemberHandling.Ignore,
        };

        internal static T Deserialize<T>(string json)
        {
            return JsonConvert.DeserializeObject<T>(json, Settings);
        }

        internal static List<T> DeserializeList<T>(string json)
        {
            return JsonConvert.DeserializeObject<List<T>>(json, Settings);
        }

        internal static string Serialize(object obj)
        {
            return JsonConvert.SerializeObject(obj, Formatting.None, Settings);
        }

        internal static JObject ParseObject(string json)
        {
            return JObject.Parse(json);
        }

        internal static JArray ParseArray(string json)
        {
            return JArray.Parse(json);
        }
    }
}
