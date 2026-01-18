# Quick Guide: What to Get from Azure AI Foundry

## ✅ What You Already Have:
- ✅ Azure Speech Services Key (configured)
- ✅ Azure Speech Region: centralindia
- ✅ Azure Speech Endpoint: https://centralindia.api.cognitive.microsoft.com/

## ❌ What You Need to Add:

### From Azure AI Foundry (Azure OpenAI Service):

1. **AZURE_OPENAI_API_KEY**
   - Where: Azure Portal → Azure OpenAI → Your Resource → **Keys and Endpoint** → Copy **KEY 1** or **KEY 2**
   - Format: Long alphanumeric string (e.g., `abc123def456...`)

2. **AZURE_OPENAI_ENDPOINT**
   - Where: Same page → Copy the **Endpoint** URL
   - Format: `https://your-resource-name.openai.azure.com`
   - Example: `https://myopenai.openai.azure.com`

3. **AZURE_OPENAI_DEPLOYMENT** (usually `gpt-4o-realtime`)
   - Where: Azure Portal → Azure OpenAI → Your Resource → **Deployments**
   - Action: Create a deployment with model **gpt-4o-realtime** if you don't have one
   - Name: Use `gpt-4o-realtime` as the deployment name

## 📝 Update Your backend/.env File:

Add or update these 3 lines in `backend/.env`:

```bash
AZURE_OPENAI_API_KEY=your-actual-key-from-azure-portal
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o-realtime
```

## 🔍 How to Find These in Azure Portal:

1. **Login to Azure Portal**: https://portal.azure.com
2. **Search for "Azure OpenAI"** in the top search bar
3. **Click on your Azure OpenAI resource**
4. **For API Key & Endpoint**:
   - Click **"Keys and Endpoint"** in the left menu
   - Copy **KEY 1** → This is `AZURE_OPENAI_API_KEY`
   - Copy **Endpoint** → This is `AZURE_OPENAI_ENDPOINT`
5. **For Deployment**:
   - Click **"Deployments"** in the left menu
   - If you see `gpt-4o-realtime` → Use that name
   - If not → Click **"+ Create"** → Select model `gpt-4o-realtime` → Name it `gpt-4o-realtime` → Create

## ✅ After Adding Keys:

1. Save `backend/.env` file
2. Restart backend: The server will auto-reload, or restart manually
3. Verify: Run `cd backend && python3 check-env.py`

## 🆘 Don't Have Azure OpenAI Resource?

If you don't have an Azure OpenAI resource yet:

1. Go to Azure Portal
2. Click **"+ Create a resource"**
3. Search for **"Azure OpenAI"**
4. Click **Create**
5. Fill in:
   - **Subscription**: Your subscription
   - **Resource Group**: Create new or use existing
   - **Region**: Choose a region (e.g., East US, West Europe)
   - **Name**: Your resource name (e.g., `my-openai-resource`)
   - **Pricing tier**: Choose based on your needs
6. Click **Review + Create** → **Create**
7. Wait for deployment (2-3 minutes)
8. Then follow steps above to get keys
