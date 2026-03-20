using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityFlux.Internal;

namespace UnityFlux
{
    internal class FluxCache
    {
        private readonly Dictionary<string, string> _memory = new();
        private readonly string _basePath;

        internal FluxCache(string projectId, string environment)
        {
            _basePath = Path.Combine(Application.persistentDataPath, "UnityFlux", projectId, environment);
        }

        // ─── Save ────────────────────────────────────────

        internal void SaveConfig(string json)
        {
            _memory["config"] = json;
            WriteFile("config.json", json);
            FluxLogger.Log("Config saved to cache");
        }

        internal void SaveVersionTag(string tag)
        {
            _memory["version"] = tag;
            WriteFile("version.txt", tag);
        }

        // ─── Load (Memory → Disk → Resources → null) ────

        internal string LoadConfig()
        {
            // Tier 1: Memory
            if (_memory.TryGetValue("config", out var mem))
                return mem;

            // Tier 2: Disk
            var disk = ReadFile("config.json");
            if (disk != null)
            {
                _memory["config"] = disk;
                FluxLogger.Log("Config loaded from disk cache");
                return disk;
            }

            // Tier 3: Resources (bundled fallback)
            var resource = Resources.Load<TextAsset>("UnityFlux/config");
            if (resource != null)
            {
                _memory["config"] = resource.text;
                FluxLogger.Log("Config loaded from Resources fallback");
                return resource.text;
            }

            return null;
        }

        internal string LoadVersionTag()
        {
            if (_memory.TryGetValue("version", out var mem))
                return mem;

            var disk = ReadFile("version.txt");
            if (disk != null)
            {
                _memory["version"] = disk;
                return disk;
            }

            return null;
        }

        // ─── Table Hashes (for delta sync) ────────────────

        internal void SaveTableHashes(Dictionary<string, string> hashes)
        {
            try
            {
                var json = FluxJson.Serialize(hashes);
                _memory["tableHashes"] = json;
                WriteFile("hashes.json", json);
            }
            catch (System.Exception ex)
            {
                FluxLogger.Warn($"Failed to save table hashes: {ex.Message}");
            }
        }

        internal Dictionary<string, string> LoadTableHashes()
        {
            try
            {
                // Memory
                if (_memory.TryGetValue("tableHashes", out var cached))
                    return FluxJson.Deserialize<Dictionary<string, string>>(cached);

                // Disk
                var disk = ReadFile("hashes.json");
                if (disk != null)
                {
                    _memory["tableHashes"] = disk;
                    return FluxJson.Deserialize<Dictionary<string, string>>(disk);
                }
            }
            catch (System.Exception ex)
            {
                FluxLogger.Warn($"Failed to load table hashes: {ex.Message}");
            }
            return null;
        }

        // ─── Clear ───────────────────────────────────────

        internal void Clear()
        {
            _memory.Clear();

            if (Directory.Exists(_basePath))
            {
                Directory.Delete(_basePath, true);
                FluxLogger.Log("Cache cleared");
            }
        }

        // ─── File I/O ────────────────────────────────────

        private void WriteFile(string filename, string content)
        {
            try
            {
                Directory.CreateDirectory(_basePath);
                File.WriteAllText(Path.Combine(_basePath, filename), content);
            }
            catch (System.Exception ex)
            {
                FluxLogger.Warn($"Failed to write cache file {filename}: {ex.Message}");
            }
        }

        private string ReadFile(string filename)
        {
            try
            {
                var path = Path.Combine(_basePath, filename);
                return File.Exists(path) ? File.ReadAllText(path) : null;
            }
            catch
            {
                return null;
            }
        }
    }
}
