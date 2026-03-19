using System;

namespace UnityFlux
{
    [Serializable]
    public class FluxVersion
    {
        public string id;
        public string projectId;
        public string versionTag;
        public string environment;
        public string status;
        public int tableCount;
        public int rowCount;
        public string publishedAt;
    }
}
