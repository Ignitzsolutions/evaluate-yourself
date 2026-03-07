# Evaluate Yourself - Azure Master Reference

Last verified: 2026-02-15 (UTC) from Azure CLI in subscription `Azure subscription 1` (`e63a31c1-d798-485d-b9ab-c0251ab9f380`).

## 1) Production App Endpoint

- App Service name: `projecte`
- Resource Group: `projecte_group`
- URL: `https://projecte-btcnhqfxfcdahten.southindia-01.azurewebsites.net`
- Runtime state: `Running`

## 2) Azure Resource Inventory (Current Subscription)

### App Hosting
- `Microsoft.Web/sites`: `projecte` (`projecte_group`)
- `Microsoft.Web/serverFarms`: `ASP-projectegroup-a9cd` (`projecte_group`)

### Data + Infra
- PostgreSQL Flexible Server: `evaluateyourself-pg-123195` (`rg-ignitzrealtime`)
  - Host/FQDN: `evaluateyourself-pg-123195.postgres.database.azure.com`
  - Engine: PostgreSQL 16
  - DB in use: `evaluateyourself`
  - Firewall rules currently present:
    - `AllowAllAzureServicesAndResourcesWithinAzureIps_2026-2-9_1-18-35` (`0.0.0.0`)
    - `client-ip` (`130.230.155.172`)
- Azure Cache for Redis: `evaluateyourselfrediscucf6bf8` (`rg-ignitzrealtime`)
  - Host: `evaluateyourselfrediscucf6bf8.redis.cache.windows.net`
  - SSL Port: `6380`
- Key Vault: `kv-ignitzne837402970807` (`rg-ignitzrealtime`)

### AI Resource Used by Backend
- Backend setting points to:
  - `AZURE_OPENAI_ENDPOINT=https://ignit-mk7zvb02-swedencentral.cognitiveservices.azure.com`
  - Deployment in app settings: `AZURE_OPENAI_DEPLOYMENT=gpt-realtime`

## 3) Application API Endpoints (Base URL + Path)

Base URL:
- `https://projecte-btcnhqfxfcdahten.southindia-01.azurewebsites.net`

Core auth/profile:
- `GET /api/me`
- `GET /api/users/me`
- `GET /api/profile/status`
- `GET /api/profile/me`
- `PUT /api/profile/me`

Interview session + realtime:
- `POST /api/realtime/webrtc`
- `POST /api/interview/{session_id}/adaptive-turn`
- `POST /api/interview/{session_id}/transcript`
- `GET /api/interview/sessions/{session_id}`

Reports:
- `GET /api/interview/reports`
- `GET /api/interview/reports/{report_id}`
- `GET /api/interview/reports/{report_id}/download?format=pdf`
- `PUT /api/interview/reports/{report_id}/feedback`

Analytics:
- `GET /api/analytics/summary`
- `GET /api/analytics/trends`
- `GET /api/analytics/skills`

Realtime WebSocket routes:
- `wss://projecte-btcnhqfxfcdahten.southindia-01.azurewebsites.net/api/realtime/ws`
- `wss://projecte-btcnhqfxfcdahten.southindia-01.azurewebsites.net/api/interview/realtime/{session_id}`

## 4) PostgreSQL Tables Used for Ingestion

Tables created by app migrations/models:
- `users`
- `user_profiles`
- `interview_sessions`
- `interview_reports`

Key ingestion flow:
1. Session starts -> runtime session metadata in Redis + durable row in `interview_sessions`.
2. End interview -> transcript/metrics saved to `interview_reports`.
3. Session row updated to `COMPLETED` with `report_id`.
4. Optional user feedback persisted in `interview_reports.metrics.session_feedback`.

## 5) SQL Checks to Confirm Data Is Ingesting

Run on DB `evaluateyourself`:

```sql
select count(*) as users_count from users;
select count(*) as profiles_count from user_profiles;
select count(*) as sessions_count from interview_sessions;
select count(*) as reports_count from interview_reports;

select id, user_id, session_id, date, overall_score
from interview_reports
order by date desc
limit 20;

select session_id, clerk_user_id, status, started_at, ended_at, report_id
from interview_sessions
order by started_at desc
limit 20;
```

## 6) Azure CLI Commands for Ops Verification

```bash
az account show -o table
az webapp show -g projecte_group -n projecte -o table
az webapp config appsettings list -g projecte_group -n projecte --query "[].name" -o tsv
az resource list -g rg-ignitzrealtime -o table
az postgres flexible-server show -g rg-ignitzrealtime -n evaluateyourself-pg-123195 -o table
az redis show -g rg-ignitzrealtime -n evaluateyourselfrediscucf6bf8 -o table
```

## 7) Access Notes for Your Friend

- For API inspection: provide app URL and a valid Clerk login.
- For DB inspection: grant PostgreSQL access (Azure Portal or pgAdmin) and whitelist client IP if needed.
- If direct DB login times out, compare current public IP vs firewall rules and add/update a rule.
- For logs:
  - App Service -> `projecte` -> Log stream
  - or use `az webapp log tail -g projecte_group -n projecte`

## 8) Security Notes (Important)

- Do **not** share `DATABASE_URL`, `REDIS_URL`, Clerk secret keys, or Azure OpenAI API keys in docs/screenshots.
- Share only hostnames/resource names/endpoints.
- Current environment appears to still use Clerk test keys (`pk_test_` / `sk_test_`); move to live keys before final production launch.
