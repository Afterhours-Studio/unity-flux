using System.Collections.Generic;
using NUnit.Framework;
using UnityFlux.Internal;

namespace UnityFlux.Tests
{
    [TestFixture]
    public class FluxJsonTests
    {
        [Test]
        public void Serialize_SimpleObject_ReturnsJson()
        {
            var obj = new TestData { name = "test", value = 42 };
            var json = FluxJson.Serialize(obj);
            Assert.IsTrue(json.Contains("\"name\":\"test\"") || json.Contains("\"name\": \"test\""));
            Assert.IsTrue(json.Contains("42"));
        }

        [Test]
        public void Serialize_NullField_OmitsField()
        {
            var obj = new TestData { name = null, value = 42 };
            var json = FluxJson.Serialize(obj);
            Assert.IsFalse(json.Contains("\"name\""));
            Assert.IsTrue(json.Contains("42"));
        }

        [Test]
        public void Deserialize_ValidJson_ReturnsObject()
        {
            var json = "{\"name\": \"hello\", \"value\": 99}";
            var result = FluxJson.Deserialize<TestData>(json);
            Assert.AreEqual("hello", result.name);
            Assert.AreEqual(99, result.value);
        }

        [Test]
        public void DeserializeList_ValidArray_ReturnsList()
        {
            var json = "[{\"name\": \"a\", \"value\": 1}, {\"name\": \"b\", \"value\": 2}]";
            var result = FluxJson.DeserializeList<TestData>(json);
            Assert.AreEqual(2, result.Count);
            Assert.AreEqual("a", result[0].name);
            Assert.AreEqual("b", result[1].name);
        }

        [Test]
        public void DeserializeList_EmptyArray_ReturnsEmptyList()
        {
            var json = "[]";
            var result = FluxJson.DeserializeList<TestData>(json);
            Assert.IsNotNull(result);
            Assert.AreEqual(0, result.Count);
        }

        [Test]
        public void Deserialize_MissingField_UsesDefault()
        {
            var json = "{\"name\": \"hello\"}";
            var result = FluxJson.Deserialize<TestData>(json);
            Assert.AreEqual("hello", result.name);
            Assert.AreEqual(0, result.value); // default int
        }

        [Test]
        public void Deserialize_ExtraField_IgnoresExtra()
        {
            var json = "{\"name\": \"hello\", \"value\": 1, \"extra\": true}";
            var result = FluxJson.Deserialize<TestData>(json);
            Assert.AreEqual("hello", result.name);
            Assert.AreEqual(1, result.value);
        }

        [Test]
        public void ParseObject_ReturnsJObject()
        {
            var json = "{\"key\": \"value\"}";
            var obj = FluxJson.ParseObject(json);
            Assert.AreEqual("value", obj["key"].ToString());
        }

        [Test]
        public void ParseObject_NestedObject_Accessible()
        {
            var json = "{\"outer\": {\"inner\": 42}}";
            var obj = FluxJson.ParseObject(json);
            Assert.AreEqual(42, (int)obj["outer"]["inner"]);
        }

        [Test]
        public void ParseArray_ReturnsJArray()
        {
            var json = "[1, 2, 3]";
            var arr = FluxJson.ParseArray(json);
            Assert.AreEqual(3, arr.Count);
        }

        [Test]
        public void ParseArray_EmptyArray_ReturnsEmptyJArray()
        {
            var json = "[]";
            var arr = FluxJson.ParseArray(json);
            Assert.AreEqual(0, arr.Count);
        }

        [Test]
        public void RoundTrip_SerializeDeserialize_PreservesData()
        {
            var original = new TestData { name = "roundtrip", value = 777 };
            var json = FluxJson.Serialize(original);
            var restored = FluxJson.Deserialize<TestData>(json);
            Assert.AreEqual(original.name, restored.name);
            Assert.AreEqual(original.value, restored.value);
        }

        [Test]
        public void Serialize_Dictionary_ReturnsJson()
        {
            var dict = new Dictionary<string, string>
            {
                { "key1", "val1" },
                { "key2", "val2" }
            };
            var json = FluxJson.Serialize(dict);
            var restored = FluxJson.Deserialize<Dictionary<string, string>>(json);
            Assert.AreEqual("val1", restored["key1"]);
            Assert.AreEqual("val2", restored["key2"]);
        }

        [System.Serializable]
        private class TestData
        {
            public string name;
            public int value;
        }
    }
}
