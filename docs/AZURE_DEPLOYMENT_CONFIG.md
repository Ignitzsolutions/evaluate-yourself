# Azure App Service Configuration Guide

## Environment Variables for Azure Deployment

### Required Configuration

Copy these environment variables to your Azure App Service Configuration → Application settings:

#### Database Configuration
```bash
# Azure PostgreSQL (Flexible Server recommended)
DATABASE_URL=postgresql://username:password@servername.postgres.database.azure.com:5432/dbname?sslmode=require

# Connection pool settings (optional, defaults shown)
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_RECYCLE=3600
DB_POOL_TIMEOUT=30
DB_SSL_MODE=require  # Azure PostgreSQL requires SSL
```

**How to get DATABASE_URL:**
1. Create Azure Database for PostgreSQL Flexible Server
2. Navigate to Settings → Connection strings
3. Copy the Python (psycopg2) connection string
4. Replace placeholders with actual credentials
5. Ensure `sslmode=require` is included

#### Redis Configuration
```bash
# Azure Cache for Redis (Premium/Standard tier for TLS)
REDIS_URL=rediss://:password@cachename.redis.cache.windows.net:6380/0

# Redis connection settings (optional, defaults shown)
REDIS_TIMEOUT=5
REDIS_CONNECT_TIMEOUT=5
REDIS_HEALTH_CHECK_INTERVAL=30
REDIS_MAX_CONNECTIONS=50
```

**How to get REDIS_URL:**
1. Create Azure Cache for Redis (Standard/Premium tier for SSL)
2. Navigate to Settings → Access keys
3. Copy Primary connection string
4. Format: `rediss://:PRIMARY_KEY@HOSTNAME:6380/0`
5. Note: Use `rediss://` (with double 's') for TLS on port 6380

#### Authentication (Clerk)
```bash
# Clerk authentication - ALREADY CONFIGURED
CLERK_PUBLISHABLE_KEY=pk_test_xxx  # or pk_live_xxx
CLERK_SECRET_KEY=sk_test_xxx  # or sk_live_xxx
CLERK_JWKS_URL=https://engaging-gazelle-52.clerk.accounts.dev/.well-known/jwks.json
JWT_SECRET_KEY=your-production-secret-change-this
```

#### Azure OpenAI (Chat/Feedback)
```bash
# ALREADY CONFIGURED - verify these exist
AZURE_OPENAI_API_KEY=xxx
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

#### Azure OpenAI Realtime API
```bash
# ALREADY CONFIGURED - verify these exist
AZURE_REALTIME_KEY=xxx
AZURE_PROJECT_BASE=https://ignit-mk7zvb02-swedencentral.cognitiveservices.azure.com
AZURE_REALTIME_DEPLOYMENT=gpt-realtime
AZURE_REALTIME_API_VERSION=2025-08-28
```

#### CORS Configuration
```bash
# IMPORTANT: Set allowed origins for production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
# DO NOT use "*" in production
```

#### Environment Detection
```bash
# Set to production for Azure
ENV=production
# OR
ENVIRONMENT=production
# OR
PYTHON_ENV=production
```

---

## Azure App Service Configuration Steps

### 1. Create App Service
```bash
# Using Azure CLI
az webapp create \
  --resource-group evaluate-yourself-rg \
  --plan evaluate-yourself-plan \
  --name evaluate-yourself-backend \
  --runtime "PYTHON:3.11"  # or 3.12
```

### 2. Configure Application Settings
Navigate to: **Azure Portal → App Service → Configuration → Application settings**

Click **+ New application setting** for each variable above.

### 3. Connection String Configuration (Alternative)
For DATABASE_URL, you can also use Connection Strings section:
- Type: `PostgreSQL`
- Name: `DATABASE_URL`
- Value: Your PostgreSQL connection string

### 4. Enable System-Assigned Managed Identity (Optional)
For passwordless authentication to Azure services:
```bash
az webapp identity assign \
  --resource-group evaluate-yourself-rg \
  --name evaluate-yourself-backend
```

Then grant the identity access to:
- Azure Database for PostgreSQL (Reader role)
- Azure Cache for Redis (Contributor role)
- Azure OpenAI (Cognitive Services User role)

### 5. Configure Health Check
Navigate to: **App Service → Monitoring → Health check**
- Health check path: `/health`
- Interval: 60 seconds

### 6. Configure Logging
Navigate to: **App Service → Monitoring → App Service logs**
- Application Logging: File System (Level: Information)
- Web server logging: File System
- Detailed error messages: On

---

## Database Setup (One-time)

### Create PostgreSQL Database
```bash
# Using Azure CLI
az postgres flexible-server create \
  --resource-group evaluate-yourself-rg \
  --name evaluate-yourself-db \
  --location swedencentral \
  --admin-user dbadmin \
  --admin-password "YourSecurePassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --storage-size 32

# Create database
az postgres flexible-server db create \
  --resource-group evaluate-yourself-rg \
  --server-name evaluate-yourself-db \
  --database-name evaluate_yourself
```

### Configure Firewall Rules
```bash
# Allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group evaluate-yourself-rg \
  --name evaluate-yourself-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Allow your development IP (optional)
az postgres flexible-server firewall-rule create \
  --resource-group evaluate-yourself-rg \
  --name evaluate-yourself-db \
  --rule-name AllowDevelopment \
  --start-ip-address YOUR_IP \
  --end-ip-address YOUR_IP
```

---

## Redis Setup (One-time)

### Create Azure Cache for Redis
```bash
# Standard tier for TLS support
az redis create \
  --resource-group evaluate-yourself-rg \
  --name evaluate-yourself-cache \
  --location swedencentral \
  --sku Standard \
  --vm-size c1 \
  --enable-non-ssl-port false
```

### Configure Redis Settings
Navigate to: **Azure Portal → Azure Cache for Redis → Settings → Advanced settings**
- Non-SSL port: Disabled (security)
- TLS version: 1.2 minimum

---

## Deployment

### Option 1: GitHub Actions (Recommended)
Create `.github/workflows/azure-deploy.yml`:
```yaml
name: Deploy to Azure App Service

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: evaluate-yourself-backend
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: ./backend
```

### Option 2: Azure CLI
```bash
cd backend
az webapp up \
  --resource-group evaluate-yourself-rg \
  --name evaluate-yourself-backend \
  --runtime "PYTHON:3.11" \
  --sku B1
```

### Option 3: VS Code Extension
1. Install "Azure App Service" extension
2. Right-click `backend/` folder
3. Select "Deploy to Web App..."
4. Follow prompts

---

## Startup Command

In Azure App Service Configuration → General settings → Startup Command:
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app:app --bind 0.0.0.0:8000 --timeout 120
```

Or for Uvicorn directly:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Post-Deployment Verification

### 1. Check Health Endpoint
```bash
curl https://evaluate-yourself-backend.azurewebsites.net/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-04T12:00:00",
  "services": {
    "database": {
      "status": "up",
      "message": "Database connected",
      "latency_ms": 15.23
    },
    "redis": {
      "status": "up",
      "message": "Redis connected",
      "latency_ms": 3.45
    }
  },
  "environment": {
    "database_type": "postgresql",
    "redis_mode": "azure"
  }
}
```

### 2. Check Application Logs
```bash
az webapp log tail \
  --resource-group evaluate-yourself-rg \
  --name evaluate-yourself-backend
```

Look for:
- `Connecting to Redis via URL (TLS: True)`
- `PostgreSQL SSL mode: require`
- `Database connection established: psycopg2 connection`

### 3. Test Database Connection
```bash
# SSH into App Service container
az webapp ssh \
  --resource-group evaluate-yourself-rg \
  --name evaluate-yourself-backend

# In container, test database
python -c "from backend.db.database import test_db_connection; print(test_db_connection())"
```

---

## Troubleshooting

### Database Connection Fails
**Symptoms:** Health check shows database "down"

**Checks:**
1. Verify firewall rules allow App Service IP
2. Check connection string has `sslmode=require`
3. Verify database credentials are correct
4. Check PostgreSQL server is running

**Fix firewall:**
```bash
# Get App Service outbound IPs
az webapp show \
  --resource-group evaluate-yourself-rg \
  --name evaluate-yourself-backend \
  --query outboundIpAddresses \
  --output tsv

# Add each IP to PostgreSQL firewall
```

### Redis Connection Fails
**Symptoms:** Health check shows Redis "down", logs show timeout

**Checks:**
1. Verify REDIS_URL uses `rediss://` (double 's') for TLS
2. Verify port is 6380 (not 6379)
3. Check Redis access key is correct
4. Verify Redis cache is running

**Test connection:**
```bash
# In App Service SSH
python -c "from backend.db.redis_client import test_redis_connection; print(test_redis_connection())"
```

### SSL Certificate Errors
**Symptoms:** "SSL: CERTIFICATE_VERIFY_FAILED"

**Fix for PostgreSQL:**
Download Azure root certificate:
```python
# Add to requirements.txt
certifi>=2024.0.0

# Connection string
DATABASE_URL=postgresql://...?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca-certificates.crt
```

### Memory/Performance Issues
**Symptoms:** Slow responses, worker timeouts

**Adjust App Service plan:**
```bash
az appservice plan update \
  --resource-group evaluate-yourself-rg \
  --name evaluate-yourself-plan \
  --sku B2  # or B3, S1, S2, P1v2, etc.
```

**Adjust connection pools in application settings:**
```bash
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
REDIS_MAX_CONNECTIONS=100
```

---

## Cost Optimization

### Development/Testing
- App Service: B1 (Basic) - ~$13/month
- PostgreSQL: Burstable B1ms - ~$12/month
- Redis: Standard C0 - ~$15/month
**Total: ~$40/month**

### Production (Small Scale)
- App Service: S1 (Standard) - ~$70/month
- PostgreSQL: General Purpose D2s_v3 - ~$140/month
- Redis: Standard C1 - ~$75/month
**Total: ~$285/month**

### Production (High Availability)
- App Service: P1v2 (Premium) with autoscale - ~$150/month
- PostgreSQL: General Purpose D4s_v3 with HA - ~$400/month
- Redis: Premium P1 with persistence - ~$250/month
**Total: ~$800/month**

---

## Security Checklist

- [ ] DATABASE_URL uses `sslmode=require`
- [ ] REDIS_URL uses `rediss://` (TLS)
- [ ] JWT_SECRET_KEY changed from default
- [ ] ALLOWED_ORIGINS set to specific domains (not "*")
- [ ] ENV/ENVIRONMENT set to "production"
- [ ] PostgreSQL firewall configured
- [ ] Redis non-SSL port disabled
- [ ] Application Insights enabled for monitoring
- [ ] Managed Identity configured for passwordless auth
- [ ] Secrets stored in Azure Key Vault (optional)

---

## Migration Checklist (Before Running Migrations)

- [ ] Azure PostgreSQL database created
- [ ] Azure Redis Cache created
- [ ] DATABASE_URL configured in App Service
- [ ] REDIS_URL configured in App Service
- [ ] All other environment variables configured
- [ ] Health check endpoint returns 200
- [ ] Database connectivity verified (`test_db_connection()`)
- [ ] Redis connectivity verified (`test_redis_connection()`)
- [ ] Application deployed and running
- [ ] Logs showing no connection errors

**Once all checks pass, you can proceed with database migrations.**

---

## Next Steps After Configuration

1. **Test locally with Azure connections:**
   ```bash
   # Export Azure connection strings locally
   export DATABASE_URL="postgresql://..."
   export REDIS_URL="rediss://..."
   
   # Run backend
   cd backend
   uvicorn app:app --reload
   
   # Check health
   curl http://localhost:8000/health
   ```

2. **Create Alembic migrations** (when ready):
   ```bash
   cd backend
   alembic init alembic
   alembic revision --autogenerate -m "Initial schema"
   alembic upgrade head
   ```

3. **Update frontend API_BASE_URL** to point to Azure App Service:
   ```javascript
   const API_BASE_URL = process.env.REACT_APP_API_URL || 
                        "https://evaluate-yourself-backend.azurewebsites.net";
   ```

4. **Set up monitoring:**
   - Enable Application Insights
   - Configure alerts for health check failures
   - Set up log analytics
