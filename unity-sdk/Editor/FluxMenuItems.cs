using UnityEditor;
using UnityEngine;

namespace UnityFlux.Editor
{
    public static class FluxMenuItems
    {
        [MenuItem("Tools/Unity Flux/Dashboard", priority = 100)]
        public static void OpenDashboard()
        {
            FluxDashboardWindow.ShowWindow();
        }

        [MenuItem("Tools/Unity Flux/Clear Cache", priority = 200)]
        public static void ClearCache()
        {
            var path = System.IO.Path.Combine(Application.persistentDataPath, "UnityFlux");
            if (System.IO.Directory.Exists(path))
            {
                System.IO.Directory.Delete(path, true);
                Debug.Log("[Flux] Cache cleared: " + path);
            }
            else
            {
                Debug.Log("[Flux] No cache to clear");
            }
        }
    }
}
