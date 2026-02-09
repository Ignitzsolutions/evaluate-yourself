# Evaluate Yourself - Deployment Endpoints (Production)

## App Service
- Name: evaluateyourself-app-123195
- URL: https://evaluateyourself-app-123195.azurewebsites.net
- Health check: https://evaluateyourself-app-123195.azurewebsites.net/health
- API docs: https://evaluateyourself-app-123195.azurewebsites.net/docs

## PostgreSQL (Azure Flexible Server)
- Server: evaluateyourself-pg-123195
- Host: evaluateyourself-pg-123195.postgres.database.azure.com
- Database: evaluateyourself
- Region: Central US
- Key Vault secret: evaluateyourself-db-url

## Redis (Azure Cache for Redis)
- Name: evaluateyourselfrediscucf6bf8
- Host: evaluateyourselfrediscucf6bf8.redis.cache.windows.net
- Region: Central US
- Key Vault secret: evaluateyourself-redis-url

## Key Vault
- Name: kv-ignitzne837402970807
- Secrets (Key Vault references used by App Service):
  - evaluateyourself-db-url
  - evaluateyourself-redis-url
  - evaluateyourself-azure-openai-api-key
  - evaluateyourself-azure-openai-endpoint
  - evaluateyourself-azure-openai-deployment
  - evaluateyourself-azure-openai-api-version
  - evaluateyourself-clerk-secret-key
  - evaluateyourself-clerk-publishable-key
  - evaluateyourself-allowed-origins

## Environment (App Service)
- ENV=production
- DATABASE_URL=@Microsoft.KeyVault(SecretUri=.../evaluateyourself-db-url/...)
- REDIS_URL=@Microsoft.KeyVault(SecretUri=.../evaluateyourself-redis-url/...)
- AZURE_OPENAI_* via Key Vault
- CLERK_* via Key Vault
- ALLOWED_ORIGINS via Key Vault

