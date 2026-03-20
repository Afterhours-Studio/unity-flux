using System.Text;
using UnityEditor;
using UnityEngine;

namespace UnityFlux.Editor
{
    [CustomEditor(typeof(FluxConfig))]
    public class FluxConfigEditor : UnityEditor.Editor
    {
        private SerializedProperty _projectId;
        private SerializedProperty _projectSlug;
        private SerializedProperty _environment;
        private SerializedProperty _serverUrl;
        private SerializedProperty _cdnBaseUrl;
        private SerializedProperty _anonKey;

        private bool _showConnection = true;
        private string _testResult;
        private MessageType _testResultType;

        private void OnEnable()
        {
            _projectId = serializedObject.FindProperty("_projectId");
            _projectSlug = serializedObject.FindProperty("_projectSlug");
            _environment = serializedObject.FindProperty("_environment");
            _serverUrl = serializedObject.FindProperty("_serverUrl");
            _cdnBaseUrl = serializedObject.FindProperty("_cdnBaseUrl");
            _anonKey = serializedObject.FindProperty("_anonKey");
        }

        public override void OnInspectorGUI()
        {
            serializedObject.Update();

            // Header
            EditorGUILayout.Space(4);
            var headerStyle = new GUIStyle(EditorStyles.boldLabel) { fontSize = 14 };
            EditorGUILayout.LabelField("Unity Flux Config", headerStyle);
            EditorGUILayout.Space(4);

            // Project Section
            EditorGUILayout.LabelField("Project", EditorStyles.boldLabel);
            EditorGUI.indentLevel++;
            EditorGUILayout.PropertyField(_projectId, new GUIContent("Project ID", "From dashboard Overview > SDK Credentials"));
            EditorGUILayout.PropertyField(_projectSlug, new GUIContent("Project Slug", "Short name used in API paths"));
            EditorGUILayout.PropertyField(_environment, new GUIContent("Environment"));
            EditorGUI.indentLevel--;

            EditorGUILayout.Space(8);

            // Connection Section
            _showConnection = EditorGUILayout.Foldout(_showConnection, "Connection", true, EditorStyles.foldoutHeader);
            if (_showConnection)
            {
                EditorGUI.indentLevel++;
                EditorGUILayout.PropertyField(_serverUrl, new GUIContent("Server URL", "Phase 1: http://localhost:3001"));
                EditorGUILayout.PropertyField(_cdnBaseUrl, new GUIContent("CDN URL", "Phase 2: Cloudflare R2 URL (optional)"));

                EditorGUILayout.Space(4);
                EditorGUILayout.PropertyField(_anonKey, new GUIContent("Anonymous Key", "Client-safe key from dashboard"));

                EditorGUILayout.Space(4);

                EditorGUILayout.BeginHorizontal();
                if (GUILayout.Button("Test Connection", GUILayout.Height(24)))
                {
                    TestConnection();
                }
                if (GUILayout.Button("Open Dashboard", GUILayout.Height(24), GUILayout.Width(120)))
                {
                    var url = _serverUrl.stringValue.Replace("/api", "").Replace(":3001", ":5173");
                    if (!url.Contains("5173")) url = "http://localhost:5173";
                    Application.OpenURL(url);
                }
                EditorGUILayout.EndHorizontal();

                if (!string.IsNullOrEmpty(_testResult))
                {
                    EditorGUILayout.Space(2);
                    EditorGUILayout.HelpBox(_testResult, _testResultType);
                }

                EditorGUI.indentLevel--;
            }

            EditorGUILayout.Space(8);

            // Quick Copy Section
            EditorGUILayout.LabelField("Quick Setup", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(
                "1. Open Dashboard at http://localhost:5173\n" +
                "2. Go to your project > Overview > SDK Credentials\n" +
                "3. Copy Project ID and Anonymous Key here\n" +
                "4. Done! Call FluxManager.Instance.Configure(this) in code",
                MessageType.Info);

            serializedObject.ApplyModifiedProperties();
        }

        private async void TestConnection()
        {
            var serverUrl = _serverUrl.stringValue?.TrimEnd('/');
            var cdnUrl = _cdnBaseUrl.stringValue?.TrimEnd('/');
            var slug = _projectSlug.stringValue;
            var env = ((FluxEnvironment)_environment.enumValueIndex) switch
            {
                FluxEnvironment.Development => "development",
                FluxEnvironment.Staging => "staging",
                FluxEnvironment.Production => "production",
                _ => "development"
            };

            // Compute access hash from anonKey
            var anonKey = _anonKey.stringValue ?? "";
            var accessHash = ComputeAccessHash(anonKey);

            // Determine what to test
            string testUrl;
            string mode;
            if (!string.IsNullOrEmpty(cdnUrl))
            {
                if (string.IsNullOrEmpty(anonKey))
                {
                    _testResult = "Anonymous Key is required for CDN access";
                    _testResultType = MessageType.Error;
                    Repaint();
                    return;
                }
                testUrl = $"{cdnUrl}/{slug}/{accessHash}/{env}/master_version.json";
                mode = "CDN";
            }
            else if (!string.IsNullOrEmpty(serverUrl))
            {
                testUrl = $"{serverUrl}/api/status";
                mode = "API";
            }
            else
            {
                _testResult = "Both Server URL and CDN URL are empty";
                _testResultType = MessageType.Error;
                Repaint();
                return;
            }

            _testResult = $"Testing {mode}...";
            _testResultType = MessageType.Info;
            Repaint();

            try
            {
                var request = UnityEngine.Networking.UnityWebRequest.Get(testUrl);
                request.timeout = 10;
                var op = request.SendWebRequest();

                while (!op.isDone)
                    await System.Threading.Tasks.Task.Yield();

                if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    _testResult = $"{mode} OK — {testUrl}";
                    _testResultType = MessageType.Info;
                }
                else
                {
                    _testResult = $"{mode} failed ({request.responseCode}): {request.error}\nURL: {testUrl}";
                    _testResultType = MessageType.Error;
                }
            }
            catch (System.Exception ex)
            {
                _testResult = $"Error: {ex.Message}";
                _testResultType = MessageType.Error;
            }

            Repaint();
        }

        private static string ComputeAccessHash(string anonKey)
        {
            if (string.IsNullOrEmpty(anonKey)) return "";
            using var sha = System.Security.Cryptography.SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(anonKey));
            var sb = new StringBuilder(16);
            for (int i = 0; i < 8; i++) sb.Append(bytes[i].ToString("x2"));
            return sb.ToString();
        }
    }
}
