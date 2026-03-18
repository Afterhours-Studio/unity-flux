# 06 — Unity SDK

> **Document Type:** SDK Reference
> **Audience:** Unity developers, game programmers

---

## 6.1 Overview

The **Flux Unity SDK** is a lightweight C# package that integrates into any Unity project to provide:

- Player authentication (anonymous, social login)
- Remote config synchronization with version-aware downloading
- Three-tier local caching for offline resilience
- Type-safe data access via generics

| Aspect          | Detail                                   |
| :-------------- | :--------------------------------------- |
| **Language**    | C# (.NET Standard 2.1)                  |
| **Min Unity**   | 2021.3 LTS or later                     |
| **Dependencies**| Newtonsoft.Json (via UPM)               |
| **Distribution**| Unity Package Manager (Git URL)         |
| **Size**        | < 50 KB (excluding dependencies)        |

---

## 6.2 Installation

### Via Unity Package Manager

1. Open Unity → `Window` → `Package Manager`
2. Click `+` → `Add package from git URL...`
3. Enter: `https://github.com/your-org/unity-flux-sdk.git`

### Dependencies

Add to `Packages/manifest.json` if not already present:

```json
{
  "dependencies": {
    "com.unity.nuget.newtonsoft-json": "3.2.1"
  }
}
```

---

## 6.3 Architecture

```
FluxManager (Singleton)
├── AuthenticationService
│   ├── AnonymousAuth
│   ├── GoogleAuth
│   ├── FacebookAuth
│   └── AppleAuth
├── DataFetcher
│   ├── VersionChecker
│   ├── ConfigDownloader
│   └── HashVerifier
├── LocalCache
│   ├── MemoryCache (Layer 1)
│   ├── DiskCache (Layer 2)
│   └── ResourcesCache (Layer 3)
└── ConfigRegistry
    └── GetData<T>()
```

---

## 6.4 Core Services

### 6.4.1 `FluxManager` — Entry Point

The singleton orchestrator for all SDK operations.

| Method                | Return Type      | Description                                     |
| :-------------------- | :--------------- | :---------------------------------------------- |
| `InitializeAsync()`   | `Task`           | Initializes cache, checks connectivity          |
| `SyncAsync()`         | `Task<bool>`     | Checks version, downloads if updated            |
| `GetData<T>(string)`  | `T`              | Retrieves typed config data by schema name       |
| `GetVersion()`        | `string`         | Returns current active version tag               |
| `ForceSync()`         | `Task<bool>`     | Bypasses hash check, always downloads            |

### 6.4.2 `AuthenticationService` — Player Identity

| Auth Method    | Description                                        | Configuration                |
| :------------- | :------------------------------------------------- | :--------------------------- |
| Anonymous      | Default. No sign-in required. Device-based ID.     | Enabled by default           |
| Google OAuth   | Cross-device progression via Google account.        | Requires Google client ID    |
| Facebook Login | Social features and friend lists.                  | Requires Facebook app ID     |
| Apple Sign-In  | Required for iOS apps with third-party auth.       | Requires Apple service ID    |

**Custom Claims:** The auth system supports dynamic player attributes (e.g., `"tier": "BattlePassOwner"`) that can be used for player-specific config overrides in future versions.

### 6.4.3 `DataFetcher` — Network Layer

Handles all communication with Cloudflare R2.

| Feature              | Implementation                                              |
| :------------------- | :---------------------------------------------------------- |
| Version Check        | `GET master_version.json` → compare hash with local cache   |
| Config Download      | `GET config_v{x.y.z}.json` → only if hash mismatch         |
| Hash Verification    | SHA-256 integrity check after download                       |
| Retry Logic          | Exponential backoff (1s → 2s → 4s → 8s) with 3 max retries|
| Timeout              | 10 seconds per request (configurable)                        |

### 6.4.4 `LocalCache` — Three-Tier Fallback

The cache ensures the game always has a usable configuration, even offline.

```
Priority Order:
┌─────────────────────────────────────────────────┐
│  Layer 1: Memory Cache                          │
│  • In-memory dictionary                         │
│  • Fastest access (< 1ms)                       │
│  • Cleared on app restart                       │
├─────────────────────────────────────────────────┤
│  Layer 2: Disk Cache                            │
│  • Application.persistentDataPath               │
│  • Persists across sessions                     │
│  • Updated after every successful sync          │
├─────────────────────────────────────────────────┤
│  Layer 3: Resources Cache (Bundled Default)     │
│  • Assets/Resources/FluxDefaults/               │
│  • Shipped with the build                       │
│  • Used only on first launch (no sync yet)      │
└─────────────────────────────────────────────────┘
```

**Resolution Logic:**
1. Check memory → if found, return immediately.
2. Check disk → if found, load into memory and return.
3. Check `Resources/` → load bundled default, copy to disk, load into memory.
4. If all fail → throw `FluxCacheException`.

---

## 6.5 Usage Examples

### Basic Integration

```csharp
using UnityFlux;

public class GameInitializer : MonoBehaviour
{
    async void Start()
    {
        // Initialize the SDK
        await FluxManager.Instance.InitializeAsync();

        // Sync with remote (downloads only if version changed)
        bool hasUpdate = await FluxManager.Instance.SyncAsync();

        if (hasUpdate)
        {
            Debug.Log($"Updated to version {FluxManager.Instance.GetVersion()}");
        }

        // Access typed configuration data
        var enemies = FluxManager.Instance.GetData<List<EnemyConfig>>("EnemyStats");
        foreach (var enemy in enemies)
        {
            Debug.Log($"{enemy.Name}: HP={enemy.BaseHealth}, Speed={enemy.Speed}");
        }
    }
}
```

### Data Model Definition

```csharp
using Newtonsoft.Json;

[System.Serializable]
public class EnemyConfig
{
    [JsonProperty("id")]
    public string Id { get; set; }

    [JsonProperty("base_health")]
    public int BaseHealth { get; set; }

    [JsonProperty("speed")]
    public float Speed { get; set; }

    [JsonProperty("element")]
    public string Element { get; set; }

    [JsonProperty("is_boss")]
    public bool IsBoss { get; set; }
}
```

### Configuration Setup

```csharp
// In a ScriptableObject or initialization script
FluxManager.Instance.Configure(new FluxConfig
{
    ProjectSlug = "idle-heroes",
    Environment = FluxEnvironment.Production,
    CdnBaseUrl = "https://flux-cdn.yourstudio.com",
    RequestTimeout = TimeSpan.FromSeconds(10),
    MaxRetries = 3
});
```

---

## 6.6 Performance Characteristics

| Metric                     | Value                          | Notes                          |
| :------------------------- | :----------------------------- | :----------------------------- |
| Version check latency      | < 100ms                        | Single lightweight GET         |
| Config download (100 KB)   | < 200ms                        | Edge CDN, gzip compressed      |
| Memory footprint           | < 2 MB                         | Depends on config size         |
| Frame impact during sync   | 0 frames dropped               | Fully async/await              |
| Cold start (first launch)  | < 500ms                        | Falls back to bundled defaults |

---

## 6.7 Error Handling

| Scenario                  | SDK Behavior                                              |
| :------------------------ | :-------------------------------------------------------- |
| No network on first launch| Uses bundled defaults from `Resources/`                   |
| No network on subsequent  | Uses disk cache (last successful sync)                    |
| Download corrupted        | Hash mismatch detected → retry with backoff               |
| All retries exhausted     | Falls back to cached version, emits `OnSyncFailed` event  |
| Invalid JSON structure    | Throws `FluxParseException` with detailed error message   |

---

**Previous:** [05 — Content Delivery](05-content-delivery.md)
**Next:** [07 — Data Flow & Lifecycle](07-data-flow.md)
