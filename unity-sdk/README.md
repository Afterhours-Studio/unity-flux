# Unity Flux SDK

Over-the-air game configuration sync for Unity. Fetch, cache, and access typed config data with offline resilience.

## Install

1. Open **Window > Package Manager** in Unity
2. Click **+ > Add package from git URL**
3. Paste: `https://github.com/user/unity-flux.git?path=unity-sdk`

## Setup

1. Create config asset: **Assets > Create > Unity Flux > Flux Config**
2. Fill in **Project ID** and **Anonymous Key** from the dashboard
3. Set **Server URL** to `http://localhost:3001` (Phase 1)

## Usage

```csharp
using UnityFlux;

public class GameBootstrap : MonoBehaviour
{
    [SerializeField] private FluxConfig _config;

    async void Start()
    {
        // Configure + load cached data (instant, works offline)
        FluxManager.Instance.Configure(_config);
        await FluxManager.Instance.InitializeAsync();

        // Check for updates (requires network)
        bool updated = await FluxManager.Instance.SyncAsync();
        if (updated) Debug.Log($"Updated to {FluxManager.Instance.CurrentVersion}");

        // Access data tables
        var enemies = Flux.GetTable<EnemyStats>("EnemyStats");
        Debug.Log($"Loaded {enemies.Count} enemies");

        // Access config parameters
        var maxHp = Flux.Get<int>("GameConfig", "max_hp");
        var speed = Flux.Get<float>("GameConfig", "speed");
    }
}

[System.Serializable]
public class EnemyStats
{
    [SerializeField] private string _name;
    [SerializeField] private int _hp;
    [SerializeField] private float _speed;

    public string Name => _name;
    public int Hp => _hp;
    public float Speed => _speed;
}
```

## API

### FluxManager

| Method | Description |
|--------|-------------|
| `Configure(FluxConfig)` | Set project credentials |
| `InitializeAsync()` | Load cached data (offline-safe) |
| `SyncAsync()` | Check + download new version. Returns `true` if updated |
| `ForceRefreshAsync()` | Re-download regardless of version |
| `ClearCache()` | Delete all cached data |

### Flux (Static Accessor)

| Method | Description |
|--------|-------------|
| `Flux.GetTable<T>(tableName)` | Get data table rows as typed list |
| `Flux.Get<T>(tableName, param)` | Get config parameter value |
| `Flux.GetOrDefault<T>(table, param, default)` | Safe get with fallback |
| `Flux.GetRawJson(tableName)` | Get raw JSON string |
| `Flux.Has(tableName, param)` | Check if config param exists |
| `Flux.IsReady` | Whether data is loaded |

### Events

```csharp
FluxManager.Instance.OnStateChanged += (state) => { };
FluxManager.Instance.OnVersionUpdated += (version) => { };
```

## Editor Tools

- **Window > Unity Flux > Dashboard** — Status, config, tables viewer, manual sync
- **FluxConfig Inspector** — Connection test, open dashboard button
- **Window > Unity Flux > Clear Cache** — Wipe local cache

## Cache

3-tier cache for offline resilience:

1. **Memory** — Instant access, cleared on restart
2. **Disk** — `persistentDataPath/UnityFlux/{projectId}/{env}/` — survives restart
3. **Resources** — Bundle fallback config in `Resources/UnityFlux/config.txt`

## Requirements

- Unity 2021.3+
- Newtonsoft.Json (auto-installed via UPM dependency)
