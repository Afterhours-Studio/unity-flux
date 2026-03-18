# Unity Client SDK

The **Flux Unity SDK** is a lightweight C# package designed to be dropped into any project to handle data synchronization automatically.

## 🛠 Integration

### Installation
- **UPM (Unity Package Manager)**: Add the package via git URL.
- **Dependencies**: Requires `Newtonsoft.Json` for high-performance parsing.

## 🔄 Core Services

### 1. `FluxManager` (Singleton)
The main entry point for the SDK.
- `Initialize()`: Sets up the local cache and checks for network connectivity.
- `Sync()`: Orchestrates the version check and download process.

### 2. `AuthenticationService`
Handles player sessions.
- **Anonymouse Auth**: Default for most games.
- **Social Login**: Wrappers for Google and Facebook SDKs.
- **Custom Claims**: Supports dynamic configuration based on player tier (e.g., "BattlePassOwner").

### 3. `DataFetcher`
Manages network requests to Cloudflare R2.
- **Hash Verification**: Ensures data integrity using MD5/SHA256 headers.
- **Retry Logic**: Built-in exponential backoff for unstable mobile connections.

### 4. `LocalCache`
Persistent storage for configurations.
- **Fallthrough Logic**:
    1. Check memory.
    2. Check local disk (last successful sync).
    3. Check `Resources/` folder (shipped with the build).

## 💻 Code Example

```csharp
public class GameInitializer : MonoBehaviour {
    async void Start() {
        // Initialize Flux
        await FluxManager.Instance.InitializeAsync();

        // Sync with R2 CDN
        bool hasUpdate = await FluxManager.Instance.SyncAsync();

        if (hasUpdate) {
            Debug.Log("Game configuration updated!");
        }

        // Access typed data
        var enemyStats = FluxManager.Instance.GetData<EnemyConfig>("EnemyStats");
        Debug.Log($"Enemy Health: {enemyStats.BaseHealth}");
    }
}
```

## 📈 Performance Considerations
- **Non-Blocking**: All network and I/O operations are `async/await` compatible, preventing frame drops during sync.
- **Smart Update**: Only downloads data if the version hash has changed.
