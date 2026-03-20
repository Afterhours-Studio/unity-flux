using System.Collections.Generic;
using System.Linq;
using System.Text;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;

namespace UnityFlux.Editor
{
    public class FluxDashboardWindow : EditorWindow
    {
        private FluxConfig _config;
        private int _tabIndex;
        private Vector2 _scrollPos;
        private string _syncResult;
        private MessageType _syncResultType;
        private SerializedObject _serializedConfig;
        private string _testResult;
        private MessageType _testResultType;
        private readonly HashSet<string> _expandedTables = new();

        private static readonly string[] Tabs = { "Status", "Config", "Tables", "Sync" };
        private static readonly Color Accent = new(0.92f, 0.68f, 0.2f);

        // Colors
        private static Color HeaderBg => Pro ? C(0.15f) : C(0.82f);
        private static Color TabBarBg => Pro ? C(0.18f) : C(0.85f);
        private static Color ActiveTabBg => Pro ? C(0.22f) : C(0.93f);
        private static Color CardBg => Pro ? C(0.25f) : C(0.96f);
        private static Color SepColor => Pro ? C(0.3f) : C(0.75f);
        private static Color MutedText => Pro ? C(0.55f) : C(0.4f);
        private static bool Pro => EditorGUIUtility.isProSkin;
        private static Color C(float v) => new(v, v, v);

        public static void ShowWindow()
        {
            var window = GetWindow<FluxDashboardWindow>("Unity Flux");
            window.minSize = new Vector2(460, 400);
            window.Show();
        }

        private void OnEnable() => FindConfig();

        private void FindConfig()
        {
            var guids = AssetDatabase.FindAssets("t:FluxConfig");
            if (guids.Length > 0)
                _config = AssetDatabase.LoadAssetAtPath<FluxConfig>(AssetDatabase.GUIDToAssetPath(guids[0]));
        }

        // ─── Main Layout ─────────────────────────────────

        private void OnGUI()
        {
            DrawHeader();
            GUILayout.Space(1);
            DrawTabBar();

            _scrollPos = EditorGUILayout.BeginScrollView(_scrollPos);
            GUILayout.Space(8);

            if (_config == null)
            {
                DrawEmptyState();
            }
            else
            {
                switch (_tabIndex)
                {
                    case 0: DrawStatusTab(); break;
                    case 1: DrawConfigTab(); break;
                    case 2: DrawTablesTab(); break;
                    case 3: DrawSyncTab(); break;
                }
            }

            GUILayout.Space(8);
            EditorGUILayout.EndScrollView();
        }

        // ─── Header ──────────────────────────────────────

        private void DrawHeader()
        {
            var rect = GUILayoutUtility.GetRect(0, 32, GUILayout.ExpandWidth(true));
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(rect, HeaderBg);

            // Status dot (left)
            var state = FluxManager.Instance.State;
            var dotColor = state switch
            {
                FluxState.Ready => new Color(0.3f, 0.8f, 0.45f),
                FluxState.Syncing => new Color(0.95f, 0.75f, 0.15f),
                FluxState.Initializing => new Color(0.95f, 0.75f, 0.15f),
                FluxState.Error => new Color(0.9f, 0.3f, 0.3f),
                _ => MutedText,
            };
            if (Event.current.type == EventType.Repaint)
            {
                var dotRect = new Rect(rect.x + 12, rect.y + rect.height / 2 - 4, 8, 8);
                // Draw circle via 2 overlapping rects (simple approximation)
                EditorGUI.DrawRect(new Rect(dotRect.x + 1, dotRect.y, 6, 8), dotColor);
                EditorGUI.DrawRect(new Rect(dotRect.x, dotRect.y + 1, 8, 6), dotColor);
            }

            // Centered title
            var titleStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 13,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Accent },
            };
            GUI.Label(rect, "Unity Flux", titleStyle);

            // Config selector row
            GUILayout.Space(2);
            EditorGUILayout.BeginHorizontal();
            GUILayout.Space(12);
            EditorGUILayout.LabelField("Config", GUILayout.Width(42));
            EditorGUI.BeginChangeCheck();
            _config = (FluxConfig)EditorGUILayout.ObjectField(_config, typeof(FluxConfig), false);
            if (EditorGUI.EndChangeCheck())
                _serializedConfig = null;
            GUILayout.Space(12);
            EditorGUILayout.EndHorizontal();
            GUILayout.Space(2);
        }

        // ─── Tab Bar ─────────────────────────────────────

        private void DrawTabBar()
        {
            var barRect = GUILayoutUtility.GetRect(0, 30, GUILayout.ExpandWidth(true));
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(barRect, TabBarBg);

            var tabW = barRect.width / Tabs.Length;
            for (int i = 0; i < Tabs.Length; i++)
            {
                var tabRect = new Rect(barRect.x + i * tabW, barRect.y, tabW, barRect.height);
                bool active = _tabIndex == i;

                if (Event.current.type == EventType.Repaint)
                {
                    if (active)
                    {
                        // Active tab bg matches content
                        EditorGUI.DrawRect(tabRect, ActiveTabBg);
                        // Accent underline
                        EditorGUI.DrawRect(new Rect(tabRect.x + 4, tabRect.yMax - 2, tabRect.width - 8, 2), Accent);
                    }
                }

                var style = new GUIStyle(EditorStyles.label)
                {
                    fontSize = 11,
                    fontStyle = active ? FontStyle.Bold : FontStyle.Normal,
                    alignment = TextAnchor.MiddleCenter,
                    normal = { textColor = active ? (Pro ? Color.white : C(0.1f)) : MutedText },
                };

                if (GUI.Button(tabRect, Tabs[i], style))
                    _tabIndex = i;

                EditorGUIUtility.AddCursorRect(tabRect, MouseCursor.Link);
            }
        }

        // ─── Empty State ─────────────────────────────────

        private void DrawEmptyState()
        {
            GUILayout.Space(40);
            var center = new GUIStyle(EditorStyles.label) { alignment = TextAnchor.MiddleCenter, fontSize = 12 };
            GUILayout.Label("No FluxConfig asset found", center);
            GUILayout.Space(8);
            GUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Create FluxConfig Asset", GUILayout.Height(28), GUILayout.Width(200)))
            {
                var asset = ScriptableObject.CreateInstance<FluxConfig>();
                var path = "Assets/FluxConfig.asset";
                AssetDatabase.CreateAsset(asset, AssetDatabase.GenerateUniqueAssetPath(path));
                AssetDatabase.SaveAssets();
                _config = asset;
                _serializedConfig = null;
                EditorGUIUtility.PingObject(asset);
                Selection.activeObject = asset;
            }
            GUILayout.FlexibleSpace();
            GUILayout.EndHorizontal();
            GUILayout.Space(4);
            var hint = new GUIStyle(EditorStyles.centeredGreyMiniLabel) { wordWrap = true };
            GUILayout.Label("Or drag a FluxConfig asset into the field above.", hint);
        }

        // ─── Status Tab ──────────────────────────────────

        private void DrawStatusTab()
        {
            BeginSection("Connection");
            DrawRow("Server URL", _config.ServerUrl ?? "(not set)");
            DrawRow("Project ID", _config.ProjectId ?? "(not set)");
            DrawRow("Slug", _config.ProjectSlug ?? "(not set)");
            DrawRow("Environment", _config.EnvironmentString ?? "development");
            EndSection();

            BeginSection("Runtime");
            DrawRow("State", FluxManager.Instance.State.ToString());
            DrawRow("Version", FluxManager.Instance.CurrentVersion ?? "(none)");
            DrawRow("Data Ready", Flux.IsReady ? "Yes" : "No");
            if (Flux.IsReady)
                DrawRow("Tables", Flux.GetTableNames().Count().ToString());
            EndSection();

            BeginSection("Cache");
            var pid = _config.ProjectId;
            bool cacheExists = false;
            if (!string.IsNullOrEmpty(pid))
            {
                var cachePath = System.IO.Path.Combine(
                    Application.persistentDataPath, "UnityFlux", pid,
                    _config.EnvironmentString ?? "development");
                DrawRow("Path", cachePath);
                cacheExists = System.IO.Directory.Exists(cachePath);
                DrawRow("Status", cacheExists ? "Cached" : "Empty");
            }
            else
            {
                DrawRow("Path", "(set Project ID first)");
            }
            if (cacheExists)
            {
                GUILayout.Space(4);
                if (GUILayout.Button("Clear Cache", GUILayout.Height(22)))
                {
                    FluxManager.Instance.ClearCache();
                    _syncResult = "Cache cleared";
                    _syncResultType = MessageType.Info;
                }
            }
            EndSection();
        }

        // ─── Config Tab ──────────────────────────────────

        private void DrawConfigTab()
        {
            if (_serializedConfig == null || _serializedConfig.targetObject != _config)
                _serializedConfig = new SerializedObject(_config);
            _serializedConfig.Update();

            BeginSection("Project");
            DrawProp("_projectId", "Project ID");
            DrawProp("_projectSlug", "Project Slug");
            DrawProp("_environment", "Environment");
            EndSection();

            BeginSection("Connection");
            DrawProp("_serverUrl", "Server URL");
            EndSection();

            BeginSection("Authentication");
            DrawProp("_anonKey", "Anon Key");
            EndSection();

            _serializedConfig.ApplyModifiedProperties();

            GUILayout.Space(4);
            Indent(() =>
            {
                EditorGUILayout.BeginHorizontal();
                if (GUILayout.Button("Test Connection", GUILayout.Height(26)))
                    TestConnection();
                if (GUILayout.Button("Open Dashboard", GUILayout.Height(26)))
                    Application.OpenURL("http://localhost:5173");
                EditorGUILayout.EndHorizontal();
            });

            if (!string.IsNullOrEmpty(_testResult))
            {
                GUILayout.Space(4);
                Indent(() => EditorGUILayout.HelpBox(_testResult, _testResultType));
            }
        }

        private void DrawProp(string propName, string label)
        {
            var prop = _serializedConfig.FindProperty(propName);
            if (prop != null)
                EditorGUILayout.PropertyField(prop, new GUIContent(label));
        }

        private async void TestConnection()
        {
            var serverUrl = _config.ServerUrl;
            if (string.IsNullOrEmpty(serverUrl))
            {
                _testResult = "Server URL is empty";
                _testResultType = MessageType.Error;
                Repaint();
                return;
            }

            if (string.IsNullOrEmpty(_config.AnonKey))
            {
                _testResult = "Anon Key is required";
                _testResultType = MessageType.Error;
                Repaint();
                return;
            }

            if (string.IsNullOrEmpty(_config.ProjectId))
            {
                _testResult = "Project ID is required";
                _testResultType = MessageType.Error;
                Repaint();
                return;
            }

            var testUrl = $"{serverUrl}/api/sdk?action=manifest&projectId={_config.ProjectId}&env={_config.EnvironmentString}";
            _testResult = "Testing...";
            _testResultType = MessageType.Info;
            Repaint();

            try
            {
                var request = UnityEngine.Networking.UnityWebRequest.Get(testUrl);
                request.timeout = 10;
                request.SetRequestHeader("Authorization", $"Bearer {_config.AnonKey}");
                request.SetRequestHeader("Accept", "application/json");

                var op = request.SendWebRequest();
                while (!op.isDone) await System.Threading.Tasks.Task.Yield();

                if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    var json = Newtonsoft.Json.Linq.JObject.Parse(request.downloadHandler.text);
                    var version = json["version"]?.ToString() ?? "unknown";
                    var tables = json["tableCount"]?.ToObject<int>() ?? 0;
                    var rows = json["rowCount"]?.ToObject<int>() ?? 0;
                    _testResult = $"Connected — {version} ({tables} tables, {rows} rows)";
                    _testResultType = MessageType.Info;
                }
                else if (request.responseCode == 403)
                {
                    _testResult = "Auth failed — check Anon Key";
                    _testResultType = MessageType.Error;
                }
                else if (request.responseCode == 404)
                {
                    _testResult = "No active version for this environment";
                    _testResultType = MessageType.Warning;
                }
                else
                {
                    _testResult = $"Failed ({request.responseCode}): {request.error}";
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

        // ─── Tables Tab ──────────────────────────────────

        private void DrawTablesTab()
        {
            if (!Flux.IsReady)
            {
                GUILayout.Space(30);
                var center = new GUIStyle(EditorStyles.label)
                {
                    alignment = TextAnchor.MiddleCenter, wordWrap = true, fontSize = 11,
                    normal = { textColor = MutedText },
                };
                GUILayout.Label("No data loaded.\nGo to Sync tab and initialize first.", center);
                return;
            }

            var tables = Flux.GetTableNames().ToList();
            BeginSection($"Tables - {tables.Count}");

            foreach (var name in tables)
            {
                var isConfig = FluxManager.Instance.DataStore.IsConfigTable(name);
                var expanded = _expandedTables.Contains(name);

                // Card header — rect-based for precise pixel alignment
                var cardRect = GUILayoutUtility.GetRect(0, 28, GUILayout.ExpandWidth(true));
                if (Event.current.type == EventType.Repaint)
                    EditorGUI.DrawRect(cardRect, CardBg);

                // Native foldout arrow (always pixel-perfect)
                var arrowRect = new Rect(cardRect.x + 6, cardRect.y + 6, 16, 16);
                EditorGUI.Foldout(arrowRect, expanded, GUIContent.none);

                // Badge
                var badgeColor = isConfig ? new Color(0.55f, 0.35f, 0.85f) : new Color(0.2f, 0.55f, 0.85f);
                var badgeRect = new Rect(cardRect.x + 24, cardRect.y + 6, 34, 16);
                if (Event.current.type == EventType.Repaint)
                    EditorGUI.DrawRect(badgeRect, new Color(badgeColor.r, badgeColor.g, badgeColor.b, 0.25f));
                var bs = new GUIStyle(EditorStyles.miniLabel)
                {
                    fontSize = 8, fontStyle = FontStyle.Bold,
                    alignment = TextAnchor.MiddleCenter,
                    normal = { textColor = badgeColor },
                };
                GUI.Label(badgeRect, isConfig ? "CFG" : "DATA", bs);

                // Table name
                var nameRect = new Rect(cardRect.x + 64, cardRect.y, cardRect.width - 140, cardRect.height);
                GUI.Label(nameRect, name, EditorStyles.boldLabel);

                // Row count (right-aligned)
                var rawJson = Flux.GetRawJson(name);
                JArray rows = null;
                if (rawJson != null)
                {
                    rows = JArray.Parse(rawJson);
                    var countStyle = new GUIStyle(EditorStyles.miniLabel)
                    {
                        alignment = TextAnchor.MiddleRight,
                        normal = { textColor = MutedText },
                    };
                    var countRect = new Rect(cardRect.xMax - 70, cardRect.y, 62, cardRect.height);
                    GUI.Label(countRect, $"{rows.Count} rows", countStyle);
                }

                // Click to toggle
                if (Event.current.type == EventType.MouseDown && cardRect.Contains(Event.current.mousePosition))
                {
                    if (expanded) _expandedTables.Remove(name);
                    else _expandedTables.Add(name);
                    Event.current.Use();
                    Repaint();
                }
                EditorGUIUtility.AddCursorRect(cardRect, MouseCursor.Link);

                // Expanded rows
                if (expanded && rows != null && rows.Count > 0)
                    DrawTableRows(rows);

                GUILayout.Space(2);
            }

            EndSection();
        }

        private void DrawTableRows(JArray rows)
        {
            // Collect columns
            var columns = new List<string>();
            if (rows[0] is JObject firstRow)
                foreach (var prop in firstRow.Properties())
                    columns.Add(prop.Name);
            if (columns.Count == 0) return;

            // Measure column widths from actual content
            var measure = new GUIStyle(EditorStyles.miniLabel);
            var colW = new float[columns.Count];
            for (int c = 0; c < columns.Count; c++)
            {
                colW[c] = measure.CalcSize(new GUIContent(columns[c])).x;
                for (int r = 0, n = Mathf.Min(rows.Count, 15); r < n; r++)
                    if (rows[r] is JObject sampleRow)
                        colW[c] = Mathf.Max(colW[c], measure.CalcSize(new GUIContent(sampleRow[columns[c]]?.ToString() ?? "")).x);
                colW[c] = Mathf.Clamp(colW[c] + 16, 48, 220);
            }

            var headerStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                normal = { textColor = MutedText },
                clipping = TextClipping.Clip,
                padding = new RectOffset(4, 4, 0, 0),
            };
            var cellStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                clipping = TextClipping.Clip,
                padding = new RectOffset(4, 4, 0, 0),
            };

            var headerBg = Pro ? C(0.19f) : C(0.88f);
            var evenBg = Pro ? C(0.22f) : C(0.93f);
            var oddBg = Pro ? C(0.20f) : C(0.91f);
            const float rowH = 20;
            const float indent = 28;

            // Header
            var hRect = GUILayoutUtility.GetRect(0, rowH, GUILayout.ExpandWidth(true));
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(hRect, headerBg);
            float x = hRect.x + indent;
            for (int c = 0; c < columns.Count; c++)
            {
                GUI.Label(new Rect(x, hRect.y, colW[c], rowH), columns[c], headerStyle);
                x += colW[c];
            }

            // Rows (cap 50)
            int max = Mathf.Min(rows.Count, 50);
            for (int i = 0; i < max; i++)
            {
                if (rows[i] is not JObject row) continue;
                var rRect = GUILayoutUtility.GetRect(0, rowH, GUILayout.ExpandWidth(true));
                if (Event.current.type == EventType.Repaint)
                    EditorGUI.DrawRect(rRect, i % 2 == 0 ? evenBg : oddBg);
                x = rRect.x + indent;
                for (int c = 0; c < columns.Count; c++)
                {
                    var val = row[columns[c]];
                    var text = val?.Type switch
                    {
                        JTokenType.Null => "\u2014",
                        JTokenType.Boolean => val.Value<bool>() ? "true" : "false",
                        _ => val?.ToString() ?? "",
                    };
                    GUI.Label(new Rect(x, rRect.y, colW[c], rowH), text, cellStyle);
                    x += colW[c];
                }
            }

            if (rows.Count > max)
            {
                var more = new GUIStyle(EditorStyles.centeredGreyMiniLabel);
                GUILayout.Label($"\u2026 and {rows.Count - max} more rows", more);
            }
            GUILayout.Space(4);
        }

        // ─── Sync Tab ────────────────────────────────────

        private void DrawSyncTab()
        {
            BeginSection("Sync Operations");

            var desc = new GUIStyle(EditorStyles.miniLabel) { normal = { textColor = MutedText }, wordWrap = true };
            GUILayout.Label("Simulate runtime sync — fetches config from CDN/API and saves to runtime cache (persistentDataPath).", desc);
            GUILayout.Space(8);

            if (GUILayout.Button("Load from Cache", GUILayout.Height(28)))
            {
                RunAsync(async () =>
                {
                    FluxManager.Instance.Configure(_config);
                    await FluxManager.Instance.InitializeAsync();
                    _syncResult = $"Initialized. Version: {FluxManager.Instance.CurrentVersion ?? "none"}";
                    _syncResultType = MessageType.Info;
                });
            }

            GUILayout.Space(4);

            var prevBg = GUI.backgroundColor;
            GUI.backgroundColor = Accent;
            if (GUILayout.Button("Sync from Server (Runtime)", GUILayout.Height(32)))
            {
                RunAsync(async () =>
                {
                    FluxManager.Instance.Configure(_config);
                    await FluxManager.Instance.InitializeAsync();
                    var updated = await FluxManager.Instance.SyncAsync();
                    _syncResult = updated
                        ? $"Updated to {FluxManager.Instance.CurrentVersion}"
                        : "Already up to date";
                    _syncResultType = MessageType.Info;
                });
            }
            GUI.backgroundColor = prevBg;

            GUILayout.Space(4);

            if (GUILayout.Button("Force Re-download", GUILayout.Height(22)))
            {
                RunAsync(async () =>
                {
                    FluxManager.Instance.Configure(_config);
                    await FluxManager.Instance.ForceRefreshAsync();
                    _syncResult = $"Force refreshed to {FluxManager.Instance.CurrentVersion}";
                    _syncResultType = MessageType.Info;
                });
            }

            EndSection();

            BeginSection("Codegen");
            var codeDesc = new GUIStyle(EditorStyles.miniLabel) { normal = { textColor = MutedText }, wordWrap = true };
            GUILayout.Label("Download auto-generated C# classes from dashboard.", codeDesc);
            GUILayout.Space(4);

            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("Namespace", GUILayout.Width(72));
            _codegenNamespace = EditorGUILayout.TextField(_codegenNamespace);
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField("Save to", GUILayout.Width(72));
            _codegenPath = EditorGUILayout.TextField(_codegenPath);
            if (GUILayout.Button("...", GUILayout.Width(28)))
            {
                var folder = EditorUtility.OpenFolderPanel("Save codegen", "Assets", "");
                if (!string.IsNullOrEmpty(folder))
                {
                    // Convert absolute to Assets-relative
                    if (folder.StartsWith(Application.dataPath))
                        _codegenPath = "Assets" + folder.Substring(Application.dataPath.Length);
                    else
                        _codegenPath = folder;
                }
            }
            EditorGUILayout.EndHorizontal();

            GUILayout.Space(4);
            if (GUILayout.Button("Download C# Classes", GUILayout.Height(26)))
            {
                FetchCodegen();
            }
            EndSection();

            if (!string.IsNullOrEmpty(_syncResult))
            {
                GUILayout.Space(4);
                Indent(() => EditorGUILayout.HelpBox(_syncResult, _syncResultType));
            }
        }

        private string _codegenNamespace = "GameConfig";
        private string _codegenPath = "Assets/Scripts/Generated";

        private async void FetchCodegen()
        {
            if (string.IsNullOrEmpty(_config.ProjectId))
            {
                _syncResult = "Set Project ID first";
                _syncResultType = MessageType.Error;
                Repaint();
                return;
            }

            _syncResult = "Downloading codegen...";
            _syncResultType = MessageType.Info;
            Repaint();

            try
            {
                var url = $"{_config.ServerUrl}/api/projects/{_config.ProjectId}/codegen?namespace={UnityEngine.Networking.UnityWebRequest.EscapeURL(_codegenNamespace)}";
                var request = UnityEngine.Networking.UnityWebRequest.Get(url);
                var op = request.SendWebRequest();
                while (!op.isDone) await System.Threading.Tasks.Task.Yield();

                if (request.result != UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    _syncResult = $"Failed: {request.error}";
                    _syncResultType = MessageType.Error;
                    Repaint();
                    return;
                }

                var code = request.downloadHandler.text;

                // Ensure directory
                if (!System.IO.Directory.Exists(_codegenPath))
                    System.IO.Directory.CreateDirectory(_codegenPath);

                var filePath = System.IO.Path.Combine(_codegenPath, $"{_codegenNamespace}.cs");
                System.IO.File.WriteAllText(filePath, code);
                AssetDatabase.Refresh();

                _syncResult = $"Saved to {filePath}";
                _syncResultType = MessageType.Info;

                // Ping the file
                var asset = AssetDatabase.LoadAssetAtPath<Object>(filePath);
                if (asset != null) EditorGUIUtility.PingObject(asset);
            }
            catch (System.Exception ex)
            {
                _syncResult = $"Error: {ex.Message}";
                _syncResultType = MessageType.Error;
            }
            Repaint();
        }

        // ─── UI Primitives ───────────────────────────────

        private static void BeginSection(string title)
        {
            GUILayout.BeginVertical();
            GUILayout.BeginHorizontal();
            GUILayout.Space(12);
            GUILayout.Label(title, EditorStyles.boldLabel);
            GUILayout.EndHorizontal();

            // Separator line
            var lineRect = GUILayoutUtility.GetRect(0, 1, GUILayout.ExpandWidth(true));
            lineRect.x += 12;
            lineRect.width -= 24;
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(lineRect, SepColor);

            GUILayout.Space(6);
            GUILayout.BeginVertical();
            GUILayout.BeginHorizontal();
            GUILayout.Space(16); // left indent
            GUILayout.BeginVertical();
        }

        private static void EndSection()
        {
            GUILayout.EndVertical();
            GUILayout.Space(16); // right indent (matches left)
            GUILayout.EndHorizontal();
            GUILayout.EndVertical();
            GUILayout.Space(8);
            GUILayout.EndVertical();
        }

        private static void DrawRow(string label, string value)
        {
            EditorGUILayout.BeginHorizontal();
            var labelStyle = new GUIStyle(EditorStyles.label) { normal = { textColor = MutedText } };
            EditorGUILayout.LabelField(label, labelStyle, GUILayout.Width(90));
            var valStyle = new GUIStyle(EditorStyles.label) { wordWrap = true };
            EditorGUILayout.LabelField(value, valStyle);
            EditorGUILayout.EndHorizontal();
        }

        private static void Indent(System.Action content)
        {
            GUILayout.BeginHorizontal();
            GUILayout.Space(12);
            GUILayout.BeginVertical();
            content();
            GUILayout.EndVertical();
            GUILayout.Space(12);
            GUILayout.EndHorizontal();
        }

        private async void RunAsync(System.Func<System.Threading.Tasks.Task> action)
        {
            _syncResult = "Working...";
            _syncResultType = MessageType.Info;
            Repaint();
            try { await action(); }
            catch (System.Exception ex)
            {
                _syncResult = $"Error: {ex.Message}";
                _syncResultType = MessageType.Error;
            }
            Repaint();
        }

    }
}
