# 11 — SDK Integration Guide

## Overview
The Unity Flux SDK provides over-the-air game configuration sync for Unity games. It features a 3-tier cache (memory → disk → resources), automatic retries with exponential backoff, and an event-driven state machine.

## Installation

### Via Unity Package Manager (UPM)
1. Open Unity → Window → Package Manager
2. Click the `+` button → "Add package from git URL..."
3. Enter the repository URL for the unity-sdk package
4. Click Add

### Via Local Path
1. Clone the repository
2. In Package Manager, click `+` → "Add package from disk..."
3. Navigate to `unity-sdk/package.json` and select it

## Quick Start

### 1. Create a FluxConfig Asset
- Right-click in the Project window → Create → Unity Flux → Flux Config
- Fill in:
  - **Project ID**: Your project ID from the dashboard
  - **Project Slug**: The URL-safe project name
  - **Environment**: Development, Staging, or Production
  - **Server URL**: `http://localhost:3001` (Phase 1)
  - **Anon Key**: Your project's anonymous key from the dashboard

### 2. Initialize Flux
```csharp
using UnityFlux;

public class GameBootstrap : MonoBehaviour
{
    [SerializeField] private FluxConfig _config;

    private async void Start()
    {
        // Step 1: Configure
        FluxManager.Instance.Configure(_config);

        // Step 2: Load cached data (instant, works offline)
        await FluxManager.Instance.InitializeAsync();

        // Step 3: Sync with server (downloads if new version available)
        bool updated = await FluxManager.Instance.SyncAsync();

        if (updated)
            Debug.Log($"Updated to version {FluxManager.Instance.CurrentVersion}");
    }
}
```

### 3. Access Data
```csharp
using UnityFlux;

// Get all rows from a data table as typed objects
List<EnemyStats> enemies = Flux.GetTable<EnemyStats>("EnemyStats");

// Get a single config value
int maxHp = Flux.Get<int>("GameConfig", "max_hp");

// Safe access with default value
float gravity = Flux.GetOrDefault<float>("Physics", "gravity", 9.81f);

// Check if data is ready
if (Flux.IsReady)
{
    var tableNames = Flux.GetTableNames();
}
```

## Configuration Options

### FluxConfig Properties
| Field | Type | Default | Description |
|---|---|---|---|
| Project ID | string | — | Unique project identifier |
| Project Slug | string | — | URL-safe project name |
| Environment | enum | Development | Target environment |
| Server URL | string | http://localhost:3001 | API server URL |
| CDN Base URL | string | — | CDN URL (Phase 2) |
| Anon Key | string | — | Client authentication key |
| Request Timeout | int | 30 | HTTP timeout in seconds |
| Max Retries | int | 3 | Maximum retry attempts |
| Retry Base Delay | float | 1.0 | Base delay between retries (exponential backoff) |

## State Machine
```
NotInitialized → Initializing → Ready ⇄ Syncing
                                  ↓          ↓
                                Error ←─────┘
```

- **NotInitialized**: Before `Configure()` is called
- **Initializing**: During `InitializeAsync()` (loading cache)
- **Ready**: Data loaded and accessible
- **Syncing**: During `SyncAsync()` (checking/downloading from server)
- **Error**: Failed with no cached data to fall back on

## Events
```csharp
FluxManager.Instance.OnStateChanged += (state) => {
    Debug.Log($"State: {state}");
};

FluxManager.Instance.OnVersionUpdated += (version) => {
    Debug.Log($"New version: {version}");
};
```

## Caching
The SDK uses a 3-tier cache:

1. **Memory**: Fastest, cleared on app restart
2. **Disk**: Persists at `Application.persistentDataPath/UnityFlux/{projectId}/{env}/`
3. **Resources**: Optional bundled fallback at `Resources/UnityFlux/config`

To ship a game with pre-loaded config:
1. Publish a version in the dashboard
2. Export the JSON from the version detail view
3. Save it as `Assets/Resources/UnityFlux/config.json`

## Code Generation
Generate C# classes from your table schemas:
1. Open the dashboard → your project → Codegen tab
2. Set the namespace (e.g., `GameConfig`)
3. Click Generate → Copy or download the file
4. Save to `Assets/Scripts/Generated/`

Or use the Editor window:
1. Window → Unity Flux → Dashboard
2. Go to the Sync tab
3. Click "Download & Save" in the Codegen section

Generated classes use `[Serializable]` with `[SerializeField] private` fields and public getters.

## Example Scene
Import the example from Package Manager:
1. Open Package Manager → Unity Flux → Samples
2. Click "Import" next to "Flux Example"
3. Open the scene and configure the FluxBootstrap with your FluxConfig asset

## Troubleshooting

### "Flux data not ready" error
- Ensure you called `FluxManager.Instance.Configure(config)` first
- Ensure you awaited `FluxManager.Instance.InitializeAsync()`

### Connection timeout
- Check that the server is running (`http://localhost:3001/api/status`)
- Verify the Server URL in your FluxConfig asset
- Adjust `Request Timeout` if on a slow network

### Data not updating
- Call `FluxManager.Instance.SyncAsync()` to check for updates
- Use `FluxManager.Instance.ForceRefreshAsync()` to force re-download
- Ensure you've published a version in the dashboard
