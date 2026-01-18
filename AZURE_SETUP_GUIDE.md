# Azure OpenAI Setup Guide

## What You Need from Azure AI Foundry

You need to get **Azure OpenAI** credentials (different from Azure Speech Services which you already have).

### Required Keys:

1. **AZURE_OPENAI_API_KEY** - Your Azure OpenAI API key
2. **AZURE_OPENAI_ENDPOINT** - Your Azure OpenAI endpoint URL
3. **AZURE_OPENAI_DEPLOYMENT** - Your deployment name (default: `gpt-4o-realtime`)

## Step-by-Step: Getting Keys from Azure AI Foundry

### Step 1: Access Azure AI Foundry
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure AI Foundry** or search for "Azure OpenAI" in the search bar
3. Select your Azure OpenAI resource (or create one if you don't have it)

### Step 2: Get Your Endpoint
1. In your Azure OpenAI resource, go to **Keys and Endpoint** (or **Overview**)
2. Copy the **Endpoint** URL
   - Format: `https://your-resource-name.openai.azure.com`
   - Example: `https://myopenai.openai.azure.com`
   - This is your `AZURE_OPENAI_ENDPOINT`

### Step 3: Get Your API Key
1. Still in **Keys and Endpoint** section
2. Copy **KEY 1** or **KEY 2** (either works)
   - This is your `AZURE_OPENAI_API_KEY`
   - ⚠️ Keep this secret! Don't commit it to git.

### Step 4: Create/Verify Deployment
1. Go to **Deployments** in your Azure OpenAI resource
2. Check if you have a deployment named `gpt-4o-realtime` or similar
3. If not, create a new deployment:
   - Click **Create** or **+ Create**
   - Model: Select **gpt-4o-realtime** (or **gpt-4o-realtime-preview**)
   - Deployment name: `gpt-4o-realtime` (or your preferred name)
   - Click **Create**
4. Note the deployment name - this is your `AZURE_OPENAI_DEPLOYMENT`

### Step 5: Update Your .env File

Add these lines to `backend/.env`:

```bash
# Azure OpenAI Realtime API (REQUIRED for voice interviews)
AZURE_OPENAI_API_KEY=your-actual-api-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o-realtime
AZURE_OPENAI_API_VERSION=2024-10-01-preview
```

### Example .env File Structure:

```bash
# Azure Speech Services (you already have this)
AZURE_SPEECH_KEY=9FkAHyYS8z7tis12IT08azL78b7NTQV2jwjdsuzeBVuACWaIsEmRJQQJ99BIACGhslBXJ3w3AAAYACOGRnoi
AZURE_SPEECH_REGION=centralindia
AZURE_SPEECH_ENDPOINT=https://centralindia.api.cognitive.microsoft.com/

# Azure OpenAI Realtime API (ADD THESE)
AZURE_OPENAI_API_KEY=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=gpt-4o-realtime
AZURE_OPENAI_API_VERSION=2024-10-01-preview

# Azure Realtime Scope (already set)
AZURE_REALTIME_SCOPE=https://ai.azure.com/.default
```

## Quick Checklist

- [ ] Azure OpenAI resource created in Azure Portal
- [ ] Endpoint URL copied (`AZURE_OPENAI_ENDPOINT`)
- [ ] API Key copied (`AZURE_OPENAI_API_KEY`)
- [ ] Deployment created with `gpt-4o-realtime` model (`AZURE_OPENAI_DEPLOYMENT`)
- [ ] All values added to `backend/.env` file
- [ ] Backend server restarted

## Verify Your Setup

After adding the keys, run:

```bash
cd backend
python3 check-env.py
```

This will verify that all keys are correctly configured.

## Troubleshooting

### "Model not found" error
- Make sure you have a deployment with `gpt-4o-realtime` model
- Check that the deployment name matches `AZURE_OPENAI_DEPLOYMENT` in your .env

### "Invalid API key" error
- Verify you copied the full API key (no spaces)
- Make sure you're using the key from the correct Azure OpenAI resource

### "Endpoint not found" error
- Check that your endpoint URL includes `https://` and ends with `.openai.azure.com`
- Verify the resource name in the URL matches your actual resource

## Important Notes

1. **Azure OpenAI** and **Azure Speech Services** are different services:
   - Azure OpenAI = For the AI interview conversation (GPT Realtime API)
   - Azure Speech Services = For enhanced transcription (optional, you already have this)

2. **Deployment Name**: The deployment name must match exactly what you created in Azure Portal

3. **API Version**: The default `2024-10-01-preview` should work, but you can check the latest version in Azure Portal

4. **Region**: Make sure your Azure OpenAI resource is in a region that supports Realtime API (most regions do)
