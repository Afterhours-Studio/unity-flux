using System.Collections.Generic;
using NUnit.Framework;

namespace UnityFlux.Tests
{
    [TestFixture]
    public class FluxDataStoreTests
    {
        private FluxDataStore _store;

        [SetUp]
        public void SetUp()
        {
            _store = new FluxDataStore();
        }

        [Test]
        public void HasData_ReturnsFalse_BeforeLoad()
        {
            Assert.IsFalse(_store.HasData);
        }

        [Test]
        public void Load_ValidJson_SetsHasData()
        {
            var json = "{\"EnemyStats\": [{\"name\": \"Goblin\", \"hp\": 100}]}";
            _store.Load(json);
            Assert.IsTrue(_store.HasData);
        }

        [Test]
        public void Load_EmptyObject_HasDataRemainsFalse()
        {
            _store.Load("{}");
            // Empty object has no tables, so HasData stays false
            Assert.IsFalse(_store.HasData);
        }

        [Test]
        public void Load_EmptyTable_SetsHasData()
        {
            _store.Load("{\"Enemies\": []}");
            Assert.IsTrue(_store.HasData);
        }

        [Test]
        public void GetTable_ValidName_ReturnsRows()
        {
            _store.Load("{\"Enemies\": [{\"name\": \"Goblin\"}, {\"name\": \"Orc\"}]}");
            var enemies = _store.GetTable<TestEnemy>("Enemies");
            Assert.AreEqual(2, enemies.Count);
            Assert.AreEqual("Goblin", enemies[0].name);
            Assert.AreEqual("Orc", enemies[1].name);
        }

        [Test]
        public void GetTable_InvalidName_ReturnsEmptyList()
        {
            _store.Load("{\"Enemies\": [{\"name\": \"Goblin\"}]}");
            var result = _store.GetTable<TestEnemy>("NonExistent");
            Assert.IsNotNull(result);
            Assert.AreEqual(0, result.Count);
        }

        [Test]
        public void GetTable_EmptyArray_ReturnsEmptyList()
        {
            _store.Load("{\"Enemies\": []}");
            var result = _store.GetTable<TestEnemy>("Enemies");
            Assert.IsNotNull(result);
            Assert.AreEqual(0, result.Count);
        }

        [Test]
        public void GetConfigValue_Integer_ReturnsCorrectValue()
        {
            var json = "{\"GameConfig\": [{\"parameter\": \"max_hp\", \"type\": \"integer\", \"value\": 100}]}";
            _store.Load(json);
            var value = _store.GetConfigValue<int>("GameConfig", "max_hp");
            Assert.AreEqual(100, value);
        }

        [Test]
        public void GetConfigValue_String_ReturnsCorrectValue()
        {
            var json = "{\"GameConfig\": [{\"parameter\": \"title\", \"type\": \"string\", \"value\": \"My Game\"}]}";
            _store.Load(json);
            var value = _store.GetConfigValue<string>("GameConfig", "title");
            Assert.AreEqual("My Game", value);
        }

        [Test]
        public void GetConfigValue_Boolean_ReturnsCorrectValue()
        {
            var json = "{\"GameConfig\": [{\"parameter\": \"debug\", \"type\": \"boolean\", \"value\": true}]}";
            _store.Load(json);
            var value = _store.GetConfigValue<bool>("GameConfig", "debug");
            Assert.IsTrue(value);
        }

        [Test]
        public void GetConfigValue_Float_ReturnsCorrectValue()
        {
            var json = "{\"GameConfig\": [{\"parameter\": \"speed\", \"type\": \"float\", \"value\": 3.14}]}";
            _store.Load(json);
            var value = _store.GetConfigValue<float>("GameConfig", "speed");
            Assert.AreEqual(3.14f, value, 0.01f);
        }

        [Test]
        public void GetConfigValue_MissingParam_ThrowsKeyNotFoundException()
        {
            var json = "{\"GameConfig\": [{\"parameter\": \"max_hp\", \"type\": \"integer\", \"value\": 100}]}";
            _store.Load(json);
            Assert.Throws<KeyNotFoundException>(() =>
                _store.GetConfigValue<int>("GameConfig", "nonexistent"));
        }

        [Test]
        public void GetConfigValue_MissingTable_ThrowsKeyNotFoundException()
        {
            _store.Load("{\"GameConfig\": [{\"parameter\": \"hp\", \"type\": \"integer\", \"value\": 1}]}");
            Assert.Throws<KeyNotFoundException>(() =>
                _store.GetConfigValue<int>("NonExistent", "hp"));
        }

        [Test]
        public void GetConfigValue_CaseInsensitiveParameter()
        {
            var json = "{\"GameConfig\": [{\"parameter\": \"MaxHP\", \"type\": \"integer\", \"value\": 100}]}";
            _store.Load(json);
            var value = _store.GetConfigValue<int>("GameConfig", "maxhp");
            Assert.AreEqual(100, value);
        }

        [Test]
        public void HasConfigValue_ExistingParam_ReturnsTrue()
        {
            var json = "{\"GameConfig\": [{\"parameter\": \"hp\", \"type\": \"integer\", \"value\": 10}]}";
            _store.Load(json);
            Assert.IsTrue(_store.HasConfigValue("GameConfig", "hp"));
        }

        [Test]
        public void HasConfigValue_MissingParam_ReturnsFalse()
        {
            var json = "{\"GameConfig\": [{\"parameter\": \"hp\", \"type\": \"integer\", \"value\": 10}]}";
            _store.Load(json);
            Assert.IsFalse(_store.HasConfigValue("GameConfig", "nonexistent"));
        }

        [Test]
        public void HasConfigValue_MissingTable_ReturnsFalse()
        {
            _store.Load("{\"GameConfig\": [{\"parameter\": \"hp\", \"type\": \"integer\", \"value\": 10}]}");
            Assert.IsFalse(_store.HasConfigValue("Missing", "hp"));
        }

        [Test]
        public void IsConfigTable_ConfigTable_ReturnsTrue()
        {
            var json = "{\"GameConfig\": [{\"parameter\": \"hp\", \"type\": \"integer\", \"value\": 10}]}";
            _store.Load(json);
            Assert.IsTrue(_store.IsConfigTable("GameConfig"));
        }

        [Test]
        public void IsConfigTable_DataTable_ReturnsFalse()
        {
            _store.Load("{\"Enemies\": [{\"name\": \"Goblin\", \"hp\": 100}]}");
            Assert.IsFalse(_store.IsConfigTable("Enemies"));
        }

        [Test]
        public void GetTableNames_ReturnsAllTableNames()
        {
            _store.Load("{\"Enemies\": [], \"Items\": [], \"Config\": []}");
            var names = new List<string>(_store.GetTableNames());
            Assert.AreEqual(3, names.Count);
            Assert.Contains("Enemies", names);
            Assert.Contains("Items", names);
            Assert.Contains("Config", names);
        }

        [Test]
        public void GetRawJson_ValidTable_ReturnsJsonString()
        {
            _store.Load("{\"Enemies\": [{\"name\": \"Goblin\"}]}");
            var raw = _store.GetRawJson("Enemies");
            Assert.IsNotNull(raw);
            Assert.IsTrue(raw.Contains("Goblin"));
        }

        [Test]
        public void GetRawJson_InvalidTable_ReturnsNull()
        {
            _store.Load("{\"Enemies\": []}");
            var raw = _store.GetRawJson("NonExistent");
            Assert.IsNull(raw);
        }

        [Test]
        public void Clear_RemovesAllData()
        {
            _store.Load("{\"Enemies\": [{\"name\": \"Goblin\"}]}");
            Assert.IsTrue(_store.HasData);
            _store.Clear();
            Assert.IsFalse(_store.HasData);
        }

        [Test]
        public void Load_MultipleTables_AllAccessible()
        {
            var json = @"{
                ""Enemies"": [{""name"": ""Goblin""}],
                ""Items"": [{""name"": ""Sword""}],
                ""GameConfig"": [{""parameter"": ""hp"", ""type"": ""integer"", ""value"": 100}]
            }";
            _store.Load(json);
            Assert.AreEqual(1, _store.GetTable<TestEnemy>("Enemies").Count);
            Assert.AreEqual(1, _store.GetTable<TestItem>("Items").Count);
            Assert.AreEqual(100, _store.GetConfigValue<int>("GameConfig", "hp"));
        }

        [Test]
        public void Load_CalledTwice_ReplacesData()
        {
            _store.Load("{\"Enemies\": [{\"name\": \"Goblin\"}]}");
            Assert.AreEqual(1, _store.GetTable<TestEnemy>("Enemies").Count);

            _store.Load("{\"Items\": [{\"name\": \"Sword\"}]}");
            Assert.AreEqual(0, _store.GetTable<TestEnemy>("Enemies").Count);
            Assert.AreEqual(1, _store.GetTable<TestItem>("Items").Count);
        }

        // Helper classes for deserialization
        [System.Serializable]
        private class TestEnemy
        {
            public string name;
            public int hp;
        }

        [System.Serializable]
        private class TestItem
        {
            public string name;
        }
    }
}
