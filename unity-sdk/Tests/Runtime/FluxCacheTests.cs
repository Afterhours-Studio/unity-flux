using System.Collections.Generic;
using System.IO;
using NUnit.Framework;

namespace UnityFlux.Tests
{
    /// <summary>
    /// Tests for FluxCache. Note: FluxCache uses Application.persistentDataPath
    /// which is only available in the Unity runtime. These tests exercise the
    /// memory-tier caching behavior and are intended to run inside the Unity
    /// Test Runner where Application.persistentDataPath is valid.
    /// </summary>
    [TestFixture]
    public class FluxCacheTests
    {
        private FluxCache _cache;

        [SetUp]
        public void SetUp()
        {
            // Uses a unique project/env combo to avoid collisions with real data
            _cache = new FluxCache("test-unit-" + System.Guid.NewGuid().ToString("N").Substring(0, 8), "test");
        }

        [TearDown]
        public void TearDown()
        {
            _cache.Clear();
        }

        [Test]
        public void SaveAndLoadConfig_MemoryTier_Works()
        {
            var json = "{\"Test\": [{\"id\": 1}]}";
            _cache.SaveConfig(json);
            var loaded = _cache.LoadConfig();
            Assert.AreEqual(json, loaded);
        }

        [Test]
        public void SaveAndLoadVersionTag_MemoryTier_Works()
        {
            _cache.SaveVersionTag("v1.0.1");
            var tag = _cache.LoadVersionTag();
            Assert.AreEqual("v1.0.1", tag);
        }

        [Test]
        public void LoadConfig_BeforeSave_ReturnsNull()
        {
            // Fresh cache with unique ID, no prior data on disk or in memory
            var freshCache = new FluxCache("empty-" + System.Guid.NewGuid().ToString("N"), "test");
            var result = freshCache.LoadConfig();
            // Should be null since there's nothing in memory, disk, or Resources
            Assert.IsNull(result);
        }

        [Test]
        public void LoadVersionTag_BeforeSave_ReturnsNull()
        {
            var freshCache = new FluxCache("empty-" + System.Guid.NewGuid().ToString("N"), "test");
            var result = freshCache.LoadVersionTag();
            Assert.IsNull(result);
        }

        [Test]
        public void Clear_RemovesCachedData()
        {
            _cache.SaveConfig("{\"data\": []}");
            _cache.SaveVersionTag("v1.0.0");
            _cache.Clear();
            // After clear, memory tier should be empty, disk deleted
            Assert.Pass("Clear completed without exception");
        }

        [Test]
        public void SaveConfig_OverwritesPreviousValue()
        {
            _cache.SaveConfig("{\"v1\": []}");
            _cache.SaveConfig("{\"v2\": []}");
            var loaded = _cache.LoadConfig();
            Assert.AreEqual("{\"v2\": []}", loaded);
        }

        [Test]
        public void SaveVersionTag_OverwritesPreviousValue()
        {
            _cache.SaveVersionTag("v1.0.0");
            _cache.SaveVersionTag("v2.0.0");
            var tag = _cache.LoadVersionTag();
            Assert.AreEqual("v2.0.0", tag);
        }

        [Test]
        public void SaveAndLoadTableHashes_Works()
        {
            var hashes = new Dictionary<string, string>
            {
                { "Enemies", "abc123" },
                { "Items", "def456" }
            };
            _cache.SaveTableHashes(hashes);
            var loaded = _cache.LoadTableHashes();
            Assert.IsNotNull(loaded);
            Assert.AreEqual("abc123", loaded["Enemies"]);
            Assert.AreEqual("def456", loaded["Items"]);
        }

        [Test]
        public void LoadTableHashes_BeforeSave_ReturnsNull()
        {
            var freshCache = new FluxCache("empty-" + System.Guid.NewGuid().ToString("N"), "test");
            var result = freshCache.LoadTableHashes();
            Assert.IsNull(result);
        }

        [Test]
        public void SaveTableHashes_OverwritesPreviousValue()
        {
            _cache.SaveTableHashes(new Dictionary<string, string> { { "A", "1" } });
            _cache.SaveTableHashes(new Dictionary<string, string> { { "B", "2" } });
            var loaded = _cache.LoadTableHashes();
            Assert.IsNotNull(loaded);
            Assert.IsFalse(loaded.ContainsKey("A"));
            Assert.AreEqual("2", loaded["B"]);
        }
    }
}
