using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityFlux;

namespace UnityFlux.Samples
{
    /// <summary>
    /// Example UI that displays Flux status, version info, and sample table data.
    /// Requires a Canvas with Text components assigned in the inspector.
    /// </summary>
    public class FluxExampleUI : MonoBehaviour
    {
        [Header("UI References")]
        [SerializeField] private Text _statusText;
        [SerializeField] private Text _versionText;
        [SerializeField] private Text _dataText;

        [Header("Settings")]
        [Tooltip("Name of a table to display sample data from")]
        [SerializeField] private string _sampleTableName = "GameConfig";

        [SerializeField] private float _refreshInterval = 1f;

        private float _timer;

        private void OnEnable()
        {
            FluxManager.Instance.OnStateChanged += OnStateChanged;
            FluxManager.Instance.OnVersionUpdated += OnVersionUpdated;
        }

        private void OnDisable()
        {
            FluxManager.Instance.OnStateChanged -= OnStateChanged;
            FluxManager.Instance.OnVersionUpdated -= OnVersionUpdated;
        }

        private void Update()
        {
            _timer += Time.deltaTime;
            if (_timer >= _refreshInterval)
            {
                _timer = 0f;
                RefreshUI();
            }
        }

        private void RefreshUI()
        {
            if (_statusText != null)
            {
                _statusText.text = $"State: {FluxManager.Instance.State}";
            }

            if (_versionText != null)
            {
                var version = FluxManager.Instance.CurrentVersion ?? "None";
                _versionText.text = $"Version: {version}";
            }

            if (_dataText != null)
            {
                if (!Flux.IsReady)
                {
                    _dataText.text = "Waiting for data...";
                    return;
                }

                var tableNames = Flux.GetTableNames();
                var lines = new List<string>();
                lines.Add($"Tables loaded: {string.Join(", ", tableNames)}");
                lines.Add("");

                if (!string.IsNullOrEmpty(_sampleTableName))
                {
                    var json = Flux.GetRawJson(_sampleTableName);
                    if (json != null)
                    {
                        lines.Add($"--- {_sampleTableName} ---");
                        // Show first 500 chars to avoid UI overflow
                        lines.Add(json.Length > 500 ? json.Substring(0, 500) + "..." : json);
                    }
                    else
                    {
                        lines.Add($"Table '{_sampleTableName}' not found.");
                    }
                }

                _dataText.text = string.Join("\n", lines);
            }
        }

        private void OnStateChanged(FluxState state)
        {
            Debug.Log($"[FluxExampleUI] State changed: {state}");
            RefreshUI();
        }

        private void OnVersionUpdated(string version)
        {
            Debug.Log($"[FluxExampleUI] Version updated: {version}");
            RefreshUI();
        }
    }
}
