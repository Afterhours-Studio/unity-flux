# Content Delivery (Cloudflare R2)

Flux leverages **Cloudflare R2** as its primary distribution hub. By using an S3-compatible object store at the edge, Flux achieves massive scale with predictable pricing.

## 🏗 Distribution Strategy

### The "Zero Egress" Advantage
Unlike AWS S3 or Google Cloud Storage, Cloudflare R2 does not charge for data transfer (egress). 
- **Database Relief**: 100% of player traffic is served by the CDN, keeping the Supabase database load to near zero.
- **Cost Scaling**: Costs remain flat even if your game goes viral and reaches millions of downloads.

### File Structure
Files are organized in a structured bucket to allow for easy lookup and caching:

```text
r2-bucket-name/
├── production/
│   ├── master_version.json (Pointer file)
│   ├── config_v1.0.0.json
│   ├── config_v1.0.1.json
├── staging/
│   ├── master_version.json
│   └── config_v1.0.1-beta.json
└── development/
    └── ...
```

## ⚙️ Cache Optimization

### Edge Caching
- **Immutable Files**: Individual versioned config files (e.g., `config_v1.2.3.json`) are marked as immutable with long-lived `Cache-Control` headers.
- **Version Pointer**: The `master_version.json` file has a short TTL (Time To Live), ensuring players discover updates within minutes of publication.

### Security
- **Public Read / Private Write**: The R2 bucket is configured for public read access via a custom domain (secured with Cloudflare WAF) but requires HMAC-signed requests or API keys for writing (publishing).
