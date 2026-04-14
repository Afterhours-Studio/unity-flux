using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;

namespace UnityFlux.Editor
{
    public class FluxDashboardWindow : EditorWindow
    {
        // ─── State ───────────────────────────────────────
        private FluxConfig _config;
        private int _tabIndex;
        private Vector2 _scrollPos;
        private string _syncResult;
        private MessageType _syncResultType;
        private SerializedObject _serializedConfig;
        private string _testResult;
        private MessageType _testResultType;
        private readonly HashSet<string> _expandedTables = new();
        private bool _isSyncing;
        private bool _showConfig;

        // ─── Tab animation ────────────────────────────────
        private float _tabLineX;
        private float _tabLineFromX;
        private bool _tabLineInitialized;
        private double _tabAnimStart;
        private const float TabAnimDuration = 0.2f;

        // ─── Codegen ─────────────────────────────────────
        private string _codegenNamespace = "GameConfig";
        private string _codegenPath = "Assets/Scripts/Generated";

        // ─── Theme ───────────────────────────────────────
        private static readonly string[] Tabs = { "Status", "Config", "Tables", "Sync" };
        private static readonly Color Accent       = new(0.92f, 0.68f,  0.2f);
        private static readonly Color AccentHover  = new(1.00f, 0.76f, 0.32f);
        private static readonly Color AccentGlow   = new(1f,    0.85f,  0.4f, 0.15f);
        private static readonly Color BtnGray      = new(0.35f, 0.35f, 0.35f);
        private static readonly Color BtnGrayHover = new(0.45f, 0.45f, 0.45f);

        private static Color HeaderBg    => Pro ? C(0.12f) : C(0.76f);
        private static Color TabBarBg    => Pro ? C(0.18f) : C(0.85f);
        private static Color ActiveTabBg => Pro ? C(0.22f) : C(0.93f);
        private static Color CardBg      => Pro ? C(0.25f) : C(0.96f);
        private static Color SepColor    => Pro ? C(0.30f) : C(0.75f);
        private static Color MutedText   => Pro ? C(0.55f) : C(0.40f);
        private static bool  Pro         => EditorGUIUtility.isProSkin;
        private static Color C(float v)  => new(v, v, v);

        // ─── Cached styles ────────────────────────────────
        // Rebuilt once when Pro skin changes — eliminates per-frame GUIStyle allocation.
        private static bool s_StylesInitialized;
        private static bool s_StylesBuiltForPro;

        // Header
        private static GUIStyle s_TitleStyle;
        private static GUIStyle s_HeaderBadge;
        private static GUIStyle s_CfgToggle;
        private static GUIStyle s_CfgLabel;
        // Tabs
        private static GUIStyle s_TabActive;
        private static GUIStyle s_TabInactive;
        // Sections / rows
        private static GUIStyle s_SectionTitle;
        private static GUIStyle s_RowLabel;
        private static GUIStyle s_RowValue;
        private static GUIStyle s_DescText;
        // Tables
        private static GUIStyle s_BadgeLabel;
        private static GUIStyle s_CountLabel;
        private static GUIStyle s_ColHeader;
        private static GUIStyle s_CellText;
        private static GUIStyle s_MoreRows;
        private static GUIStyle s_TablesEmpty;
        // Misc
        private static GUIStyle s_EmptyCenter;
        private static GUIStyle s_EmptyHint;
        private static GUIStyle s_ProgressLabel;
        private static GUIStyle s_BtnLabel;

        private static void EnsureStyles()
        {
            if (s_StylesInitialized && s_StylesBuiltForPro == Pro) return;
            s_StylesInitialized = true;
            s_StylesBuiltForPro = Pro;

            s_TitleStyle = new GUIStyle
            {
                fontSize = 15, fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Pro ? Color.white : C(0.08f) },
            };
            s_HeaderBadge = new GUIStyle
            {
                fontSize = 9, alignment = TextAnchor.MiddleRight,
                padding = new RectOffset(0, 10, 0, 0),
                normal = { textColor = MutedText },
            };
            s_CfgToggle = new GUIStyle
            {
                fontSize = 9, alignment = TextAnchor.MiddleRight,
                padding = new RectOffset(0, 10, 0, 0),
                normal = { textColor = MutedText },
                hover  = { textColor = Pro ? Color.white : C(0.1f) },
            };
            s_CfgLabel = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = MutedText },
                alignment = TextAnchor.MiddleLeft,
            };
            s_TabActive = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11, fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Pro ? Color.white : C(0.1f) },
            };
            s_TabInactive = new GUIStyle(EditorStyles.label)
            {
                fontSize = 11, fontStyle = FontStyle.Normal,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = MutedText },
            };
            s_SectionTitle = new GUIStyle(EditorStyles.boldLabel);
            s_RowLabel = new GUIStyle(EditorStyles.label)
            {
                normal = { textColor = MutedText },
            };
            s_RowValue = new GUIStyle(EditorStyles.label) { wordWrap = true };
            s_DescText = new GUIStyle(EditorStyles.miniLabel)
            {
                normal = { textColor = MutedText }, wordWrap = true,
            };
            s_BadgeLabel = new GUIStyle(EditorStyles.miniLabel)
            {
                fontSize = 8, fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
            };
            s_CountLabel = new GUIStyle(EditorStyles.miniLabel)
            {
                alignment = TextAnchor.MiddleRight,
                normal = { textColor = MutedText },
            };
            s_ColHeader = new GUIStyle(EditorStyles.miniLabel)
            {
                fontStyle = FontStyle.Bold,
                normal = { textColor = MutedText },
                clipping = TextClipping.Clip,
                padding = new RectOffset(4, 4, 0, 0),
            };
            s_CellText = new GUIStyle(EditorStyles.miniLabel)
            {
                clipping = TextClipping.Clip,
                padding = new RectOffset(4, 4, 0, 0),
            };
            s_MoreRows = new GUIStyle(EditorStyles.centeredGreyMiniLabel);
            s_TablesEmpty = new GUIStyle(EditorStyles.label)
            {
                alignment = TextAnchor.MiddleCenter, wordWrap = true,
                fontSize = 11, normal = { textColor = MutedText },
            };
            s_EmptyCenter = new GUIStyle(EditorStyles.label)
            {
                alignment = TextAnchor.MiddleCenter, fontSize = 12,
            };
            s_EmptyHint = new GUIStyle(EditorStyles.centeredGreyMiniLabel) { wordWrap = true };
            s_ProgressLabel = new GUIStyle(EditorStyles.miniLabel)
            {
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Color.white },
            };
            s_BtnLabel = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 12, alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Color.white },
            };
        }

        // ─── Package version ─────────────────────────────

        private static string _cachedVersion;
        private static string PackageVersion
        {
            get
            {
                if (_cachedVersion != null) return _cachedVersion;
                var pkg = UnityEditor.PackageManager.PackageInfo.FindForAssembly(
                    typeof(FluxDashboardWindow).Assembly);
                _cachedVersion = pkg != null ? $"v{pkg.version}" : "v?";
                return _cachedVersion;
            }
        }

        // ─── Window open ─────────────────────────────────

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
            EnsureStyles();
            DrawHeader();
            DrawTabBar();

            _scrollPos = EditorGUILayout.BeginScrollView(_scrollPos);
            GUILayout.Space(8);

            if (_config == null)
                DrawEmptyState();
            else
                switch (_tabIndex)
                {
                    case 0: DrawStatusTab(); break;
                    case 1: DrawConfigTab(); break;
                    case 2: DrawTablesTab(); break;
                    case 3: DrawSyncTab();   break;
                }

            GUILayout.Space(8);
            EditorGUILayout.EndScrollView();
        }

        // ─── Header ──────────────────────────────────────

        private void DrawHeader()
        {
            var rect = GUILayoutUtility.GetRect(0, 38, GUILayout.ExpandWidth(true));
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(rect, HeaderBg);

            // Status dot — vertically centered, left edge
            var state = FluxManager.Instance.State;
            var dotColor = state switch
            {
                FluxState.Ready        => new Color(0.30f, 0.80f, 0.45f),
                FluxState.Syncing      => new Color(0.95f, 0.75f, 0.15f),
                FluxState.Initializing => new Color(0.95f, 0.75f, 0.15f),
                FluxState.Error        => new Color(0.90f, 0.30f, 0.30f),
                _                      => MutedText,
            };
            if (Event.current.type == EventType.Repaint)
            {
                var dc = new Vector2(rect.x + 16, rect.y + rect.height / 2f);
                EditorGUI.DrawRect(new Rect(dc.x - 3, dc.y - 4, 6, 8), dotColor);
                EditorGUI.DrawRect(new Rect(dc.x - 4, dc.y - 3, 8, 6), dotColor);
            }

            // Title — centered
            GUI.Label(rect, "Unity Flux", s_TitleStyle);

            // Version + toggle arrow — right side, clickable
            var arrow = _showConfig ? "\u25BC" : "\u25B6";
            GUI.Label(rect, $"{PackageVersion}  {arrow}", s_CfgToggle);
            var toggleZone = new Rect(rect.xMax - 90, rect.y, 90, rect.height);
            EditorGUIUtility.AddCursorRect(toggleZone, MouseCursor.Link);
            if (Event.current.type == EventType.MouseDown && toggleZone.Contains(Event.current.mousePosition))
            {
                _showConfig = !_showConfig;
                Event.current.Use();
                Repaint();
            }

            // ── Config sub-bar (20px) — hidden by default ──
            Rect bottomRect = rect;
            if (_showConfig)
            {
                var cfgRect = GUILayoutUtility.GetRect(0, 20, GUILayout.ExpandWidth(true));
                if (Event.current.type == EventType.Repaint)
                    EditorGUI.DrawRect(cfgRect, HeaderBg);

                GUI.Label(new Rect(cfgRect.x + 12, cfgRect.y + 2, 38, 16), "Config", s_CfgLabel);

                EditorGUI.BeginChangeCheck();
                _config = (FluxConfig)EditorGUI.ObjectField(
                    new Rect(cfgRect.x + 52, cfgRect.y + 2, cfgRect.width - 64, 16),
                    _config, typeof(FluxConfig), false);
                if (EditorGUI.EndChangeCheck())
                    _serializedConfig = null;

                bottomRect = cfgRect;
            }

            // Accent line — always at bottom of header block
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(new Rect(rect.x, bottomRect.yMax - 1, rect.width, 1), Accent);
        }

        // ─── Tab Bar ─────────────────────────────────────

        private void DrawTabBar()
        {
            var barRect = GUILayoutUtility.GetRect(0, 32, GUILayout.ExpandWidth(true));
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(barRect, TabBarBg);

            var tabW    = barRect.width / Tabs.Length;
            var targetX = barRect.x + _tabIndex * tabW;

            // Snap on first frame — no jitter on window open
            if (!_tabLineInitialized)
            {
                _tabLineX = targetX;
                _tabLineFromX = targetX;
                _tabLineInitialized = true;
            }

            // ── Animated accent line — ease-out quad ──
            var animating = false;
            if (Mathf.Abs(_tabLineX - targetX) > 0.5f)
            {
                var t = (float)((EditorApplication.timeSinceStartup - _tabAnimStart) / TabAnimDuration);
                t = Mathf.Clamp01(t);
                t = 1f - (1f - t) * (1f - t); // ease-out quad
                _tabLineX = Mathf.Lerp(_tabLineFromX, targetX, t);
                animating = t < 1f;
            }
            else
            {
                _tabLineX = targetX;
            }

            // ── Tab labels + active bg ──
            for (int i = 0; i < Tabs.Length; i++)
            {
                var tabRect = new Rect(barRect.x + i * tabW, barRect.y, tabW, barRect.height);
                bool active = _tabIndex == i;

                if (Event.current.type == EventType.Repaint && active)
                    EditorGUI.DrawRect(tabRect, ActiveTabBg);

                if (GUI.Button(tabRect, Tabs[i], active ? s_TabActive : s_TabInactive))
                {
                    _tabLineFromX = _tabLineX; // start slide from current animated position
                    _tabAnimStart = EditorApplication.timeSinceStartup;
                    _tabIndex = i;
                }

                EditorGUIUtility.AddCursorRect(tabRect, MouseCursor.Link);
            }

            // ── Sliding accent line + glow — drawn last so it overlays tab bg ──
            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(new Rect(_tabLineX + 8,  barRect.yMax - 3, tabW - 16, 3), Accent);
                EditorGUI.DrawRect(new Rect(_tabLineX + 4,  barRect.yMax - 1, tabW - 8,  1), AccentGlow);
            }

            if (animating) Repaint();
        }

        // ─── Empty State ─────────────────────────────────

        private void DrawEmptyState()
        {
            GUILayout.Space(40);
            GUILayout.Label("No FluxConfig asset found", s_EmptyCenter);
            GUILayout.Space(8);
            Indent(() =>
            {
                DrawAccentButton("Create FluxConfig Asset", () =>
                {
                    var asset = ScriptableObject.CreateInstance<FluxConfig>();
                    var path = "Assets/FluxConfig.asset";
                    AssetDatabase.CreateAsset(asset, AssetDatabase.GenerateUniqueAssetPath(path));
                    AssetDatabase.SaveAssets();
                    _config = asset;
                    _serializedConfig = null;
                    EditorGUIUtility.PingObject(asset);
                    Selection.activeObject = asset;
                }, 28);
            });
            GUILayout.Space(4);
            GUILayout.Label("Or drag a FluxConfig asset into the Config field in the header.", s_EmptyHint);
        }

        // ─── Status Tab ──────────────────────────────────

        private void DrawStatusTab()
        {
            BeginSection("Connection");
            DrawRow("Server URL",  _config.ServerUrl    ?? "(not set)");
            DrawRow("Project ID",  _config.ProjectId    ?? "(not set)");
            DrawRow("Slug",        _config.ProjectSlug  ?? "(not set)");
            DrawRow("Environment", _config.EnvironmentString ?? "development");
            EndSection();

            BeginSection("Runtime");
            DrawRow("State",      FluxManager.Instance.State.ToString());
            DrawRow("Version",    FluxManager.Instance.CurrentVersion ?? "(none)");
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
                DrawRow("Path",   cachePath);
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
                DrawGrayButton("Clear Cache", () =>
                {
                    FluxManager.Instance.ClearCache();
                    _syncResult = "Cache cleared";
                    _syncResultType = MessageType.Info;
                }, 22);
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
            DrawProp("_projectId",   "Project ID");
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
                DrawGrayButton("Test Connection", TestConnection, 26);
                GUILayout.Space(4);
                DrawGrayButton("Open Dashboard", () => Application.OpenURL("http://localhost:5173"), 26);
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
                Repaint(); return;
            }
            if (string.IsNullOrEmpty(_config.AnonKey))
            {
                _testResult = "Anon Key is required";
                _testResultType = MessageType.Error;
                Repaint(); return;
            }
            if (string.IsNullOrEmpty(_config.ProjectId))
            {
                _testResult = "Project ID is required";
                _testResultType = MessageType.Error;
                Repaint(); return;
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
                    var json   = JObject.Parse(request.downloadHandler.text);
                    var version = json["version"]?.ToString() ?? "unknown";
                    var tables  = json["tableCount"]?.ToObject<int>() ?? 0;
                    var rows    = json["rowCount"]?.ToObject<int>() ?? 0;
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
                GUILayout.Label("No data loaded.\nGo to Sync tab and initialize first.", s_TablesEmpty);
                return;
            }

            var tables = Flux.GetTableNames().ToList();
            BeginSection($"Tables — {tables.Count}");

            foreach (var name in tables)
            {
                var isConfig = FluxManager.Instance.DataStore.IsConfigTable(name);
                var expanded = _expandedTables.Contains(name);

                var cardRect = GUILayoutUtility.GetRect(0, 28, GUILayout.ExpandWidth(true));
                if (Event.current.type == EventType.Repaint)
                    EditorGUI.DrawRect(cardRect, CardBg);

                // Foldout arrow
                EditorGUI.Foldout(new Rect(cardRect.x + 6, cardRect.y + 6, 16, 16), expanded, GUIContent.none);

                // CFG / DATA badge
                var badgeColor = isConfig ? new Color(0.55f, 0.35f, 0.85f) : new Color(0.2f, 0.55f, 0.85f);
                DrawBadge(new Rect(cardRect.x + 24, cardRect.y + 6, 34, 16),
                          isConfig ? "CFG" : "DATA", badgeColor);

                // Table name
                GUI.Label(new Rect(cardRect.x + 64, cardRect.y, cardRect.width - 140, cardRect.height),
                          name, EditorStyles.boldLabel);

                // Row count
                var rawJson = Flux.GetRawJson(name);
                JArray rows = null;
                if (rawJson != null)
                {
                    rows = JArray.Parse(rawJson);
                    GUI.Label(new Rect(cardRect.xMax - 70, cardRect.y, 62, cardRect.height),
                              $"{rows.Count} rows", s_CountLabel);
                }

                if (Event.current.type == EventType.MouseDown && cardRect.Contains(Event.current.mousePosition))
                {
                    if (expanded) _expandedTables.Remove(name);
                    else          _expandedTables.Add(name);
                    Event.current.Use();
                    Repaint();
                }
                EditorGUIUtility.AddCursorRect(cardRect, MouseCursor.Link);

                if (expanded && rows != null && rows.Count > 0)
                    DrawTableRows(rows);

                GUILayout.Space(2);
            }

            EndSection();
        }

        private void DrawTableRows(JArray rows)
        {
            var columns = new List<string>();
            if (rows[0] is JObject firstRow)
                foreach (var prop in firstRow.Properties())
                    columns.Add(prop.Name);
            if (columns.Count == 0) return;

            // Measure column widths once from sampled content
            var measure = new GUIStyle(EditorStyles.miniLabel);
            var colW = new float[columns.Count];
            for (int c = 0; c < columns.Count; c++)
            {
                colW[c] = measure.CalcSize(new GUIContent(columns[c])).x;
                for (int r = 0, n = Mathf.Min(rows.Count, 15); r < n; r++)
                    if (rows[r] is JObject sampleRow)
                        colW[c] = Mathf.Max(colW[c],
                            measure.CalcSize(new GUIContent(sampleRow[columns[c]]?.ToString() ?? "")).x);
                colW[c] = Mathf.Clamp(colW[c] + 16, 48, 220);
            }

            var headerBg = Pro ? C(0.19f) : C(0.88f);
            var evenBg   = Pro ? C(0.22f) : C(0.93f);
            var oddBg    = Pro ? C(0.20f) : C(0.91f);
            const float rowH   = 20;
            const float indent = 28;

            // Header row
            var hRect = GUILayoutUtility.GetRect(0, rowH, GUILayout.ExpandWidth(true));
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(hRect, headerBg);
            float x = hRect.x + indent;
            for (int c = 0; c < columns.Count; c++)
            {
                GUI.Label(new Rect(x, hRect.y, colW[c], rowH), columns[c], s_ColHeader);
                x += colW[c];
            }

            // Data rows (cap 50)
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
                    var val  = row[columns[c]];
                    var text = val?.Type switch
                    {
                        JTokenType.Null    => "\u2014",
                        JTokenType.Boolean => val.Value<bool>() ? "true" : "false",
                        _                  => val?.ToString() ?? "",
                    };
                    GUI.Label(new Rect(x, rRect.y, colW[c], rowH), text, s_CellText);
                    x += colW[c];
                }
            }

            if (rows.Count > max)
                GUILayout.Label($"\u2026 and {rows.Count - max} more rows", s_MoreRows);

            GUILayout.Space(4);
        }

        // ─── Sync Tab ────────────────────────────────────

        private void DrawSyncTab()
        {
            BeginSection("Sync Operations");
            GUILayout.Label(
                "Simulate runtime sync — fetches config from CDN/API and saves to runtime cache (persistentDataPath).",
                s_DescText);
            GUILayout.Space(8);

            if (_isSyncing)
            {
                DrawProgressBar(_syncResult ?? "Working...");
            }
            else
            {
                DrawGrayButton("Load from Cache", () =>
                    RunAsync(async () =>
                    {
                        FluxManager.Instance.Configure(_config);
                        await FluxManager.Instance.InitializeAsync();
                        _syncResult = $"Initialized. Version: {FluxManager.Instance.CurrentVersion ?? "none"}";
                        _syncResultType = MessageType.Info;
                    }), 28);

                GUILayout.Space(4);

                DrawAccentButton("Sync from Server (Runtime)", () =>
                    RunAsync(async () =>
                    {
                        FluxManager.Instance.Configure(_config);
                        await FluxManager.Instance.InitializeAsync();
                        var updated = await FluxManager.Instance.SyncAsync();
                        _syncResult = updated
                            ? $"Updated to {FluxManager.Instance.CurrentVersion}"
                            : "Already up to date";
                        _syncResultType = MessageType.Info;
                    }));

                GUILayout.Space(4);

                DrawGrayButton("Force Re-download", () =>
                    RunAsync(async () =>
                    {
                        FluxManager.Instance.Configure(_config);
                        await FluxManager.Instance.ForceRefreshAsync();
                        _syncResult = $"Force refreshed to {FluxManager.Instance.CurrentVersion}";
                        _syncResultType = MessageType.Info;
                    }), 24);
            }
            EndSection();

            BeginSection("Codegen");
            GUILayout.Label("Download auto-generated C# classes from dashboard.", s_DescText);
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
                    _codegenPath = folder.StartsWith(Application.dataPath)
                        ? "Assets" + folder.Substring(Application.dataPath.Length)
                        : folder;
                }
            }
            EditorGUILayout.EndHorizontal();

            GUILayout.Space(4);
            DrawGrayButton("Download C# Classes", FetchCodegen, 26);
            EndSection();

            if (!string.IsNullOrEmpty(_syncResult) && !_isSyncing)
            {
                GUILayout.Space(4);
                Indent(() => EditorGUILayout.HelpBox(_syncResult, _syncResultType));
            }
        }

        private async void FetchCodegen()
        {
            if (string.IsNullOrEmpty(_config.ProjectId))
            {
                _syncResult = "Set Project ID first";
                _syncResultType = MessageType.Error;
                Repaint(); return;
            }

            _syncResult = "Downloading codegen...";
            _syncResultType = MessageType.Info;
            _isSyncing = true;
            Repaint();

            try
            {
                var url = $"{_config.ServerUrl}/api/projects/{_config.ProjectId}/codegen" +
                          $"?namespace={UnityEngine.Networking.UnityWebRequest.EscapeURL(_codegenNamespace)}";
                var request = UnityEngine.Networking.UnityWebRequest.Get(url);
                var op = request.SendWebRequest();
                while (!op.isDone) await System.Threading.Tasks.Task.Yield();

                if (request.result != UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    _syncResult = $"Failed: {request.error}";
                    _syncResultType = MessageType.Error;
                    _isSyncing = false;
                    Repaint(); return;
                }

                if (!System.IO.Directory.Exists(_codegenPath))
                    System.IO.Directory.CreateDirectory(_codegenPath);

                var filePath = System.IO.Path.Combine(_codegenPath, $"{_codegenNamespace}.cs");
                System.IO.File.WriteAllText(filePath, request.downloadHandler.text);
                AssetDatabase.Refresh();

                _syncResult = $"Saved to {filePath}";
                _syncResultType = MessageType.Info;

                var asset = AssetDatabase.LoadAssetAtPath<Object>(filePath);
                if (asset != null) EditorGUIUtility.PingObject(asset);
            }
            catch (System.Exception ex)
            {
                _syncResult = $"Error: {ex.Message}";
                _syncResultType = MessageType.Error;
            }
            _isSyncing = false;
            Repaint();
        }

        // ─── UI Primitives ───────────────────────────────

        private static void BeginSection(string title)
        {
            GUILayout.BeginVertical();
            GUILayout.BeginHorizontal();
            GUILayout.Space(12);
            GUILayout.Label(title, s_SectionTitle);
            GUILayout.EndHorizontal();

            var lineRect = GUILayoutUtility.GetRect(0, 1, GUILayout.ExpandWidth(true));
            lineRect.x += 12; lineRect.width -= 24;
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(lineRect, SepColor);

            GUILayout.Space(6);
            GUILayout.BeginVertical();
            GUILayout.BeginHorizontal();
            GUILayout.Space(16);
            GUILayout.BeginVertical();
        }

        private static void EndSection()
        {
            GUILayout.EndVertical();
            GUILayout.Space(16);
            GUILayout.EndHorizontal();
            GUILayout.EndVertical();
            GUILayout.Space(8);
            GUILayout.EndVertical();
        }

        private static void DrawRow(string label, string value)
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(label, s_RowLabel, GUILayout.Width(90));
            EditorGUILayout.LabelField(value, s_RowValue);
            EditorGUILayout.EndHorizontal();
        }

        /// <summary>Semi-transparent colored badge drawn at a specific Rect.</summary>
        private static void DrawBadge(Rect rect, string text, Color color)
        {
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(rect, new Color(color.r, color.g, color.b, 0.22f));
            s_BadgeLabel.normal.textColor = color;
            GUI.Label(rect, text, s_BadgeLabel);
        }

        /// <summary>Indeterminate animated progress bar. Calls Repaint() to keep animating.</summary>
        private void DrawProgressBar(string label)
        {
            var barRect = GUILayoutUtility.GetRect(0, 22, GUILayout.ExpandWidth(true));
            if (Event.current.type == EventType.Repaint)
            {
                EditorGUI.DrawRect(barRect, Pro ? C(0.18f) : C(0.82f));

                var t      = (float)((EditorApplication.timeSinceStartup * 0.7) % 1.0);
                var slideW = barRect.width * 0.35f;
                var slideX = barRect.x + (barRect.width + slideW) * t - slideW;
                var cx     = Mathf.Max(slideX, barRect.x);
                var cr     = Mathf.Min(slideX + slideW, barRect.xMax);
                if (cr > cx)
                    EditorGUI.DrawRect(new Rect(cx, barRect.y, cr - cx, barRect.height), Accent);

                // Leading-edge glow
                if (cr > barRect.x + 4)
                    EditorGUI.DrawRect(new Rect(cr - 3, barRect.y, 5, barRect.height),
                                       new Color(1f, 1f, 1f, 0.25f));
            }
            GUI.Label(barRect, label, s_ProgressLabel);
            Repaint(); // keep animating while active
        }

        private static void DrawAccentButton(string text, System.Action onClick, float height = 32)
            => DrawColorButton(text, Accent, AccentHover, onClick, height);

        private static void DrawGrayButton(string text, System.Action onClick, float height = 26)
            => DrawColorButton(text, BtnGray, BtnGrayHover, onClick, height);

        private static void DrawColorButton(string text, Color color, Color hoverColor,
                                            System.Action onClick, float height)
        {
            var btnRect = GUILayoutUtility.GetRect(0, height, GUILayout.ExpandWidth(true));
            var hover   = btnRect.Contains(Event.current.mousePosition);
            if (Event.current.type == EventType.Repaint)
                EditorGUI.DrawRect(btnRect, hover ? hoverColor : color);
            GUI.Label(btnRect, text, s_BtnLabel);
            EditorGUIUtility.AddCursorRect(btnRect, MouseCursor.Link);
            if (Event.current.type == EventType.MouseDown && btnRect.Contains(Event.current.mousePosition))
            {
                Event.current.Use();
                onClick?.Invoke();
            }
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
            _isSyncing = true;
            Repaint();
            try { await action(); }
            catch (System.Exception ex)
            {
                _syncResult = $"Error: {ex.Message}";
                _syncResultType = MessageType.Error;
            }
            _isSyncing = false;
            Repaint();
        }
    }
}
