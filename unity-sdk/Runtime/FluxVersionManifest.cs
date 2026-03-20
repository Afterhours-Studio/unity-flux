using System;
using System.Collections.Generic;

namespace UnityFlux
{
    [Serializable]
    public class FluxVersionManifest
    {
        public string id;
        public string projectId;
        public string versionTag;
        public string environment;
        public string status;
        public Dictionary<string, string> tableHashes;
        public int tableCount;
        public int rowCount;
        public string publishedAt;
    }
}
