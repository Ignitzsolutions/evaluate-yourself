# Realtime API Troubleshooting

If the Real Time (WebRTC) interview fails when starting, use this checklist.

## 1. Run the token test

From the project root:

```bash
python backend/test_realtime_token.py
```

This prints the raw Azure response. Typical outcomes:

- **200** – Token created; Real Time API is reachable. If the app still fails, the issue is likely SDP/WebRTC or frontend.
- **500 Internal Server Error** – Azure’s Realtime backend is failing. See “500 from Azure” below.
- **400 “API version not supported”** – The api-version sent for this resource is not supported.
- **401** – Wrong or invalid `AZURE_OPENAI_API_KEY`.
- **404** – Wrong base URL or Realtime not exposed on this resource.

## 2. When you get 500 from Azure

Azure returns a generic 500 for the `client_secrets` call in these situations:

1. **Realtime not enabled for this resource**  
   In Azure Portal (or AI Foundry), confirm that:
   - The resource supports OpenAI and has Realtime/audio models.
   - You are in a supported region (e.g. **Sweden Central**, **East US 2**).

2. **Wrong deployment name**  
   `AZURE_OPENAI_DEPLOYMENT` in `backend/.env` must match the **exact** deployment name in the portal (e.g. `gpt-realtime`).  
   Check: **Azure Portal → your resource → Model deployments** and use the deployment name shown there.

3. **Resource type**  
   Docs and samples use `{resource}.openai.azure.com`. Your `.env` may use `*.cognitiveservices.azure.com`; the backend converts that to `*.openai.azure.com`.  
   If you still get 500, try creating a dedicated **Azure OpenAI** resource (not only multi-service Cognitive Services) in Sweden Central and deploying a Realtime model there, then point `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_DEPLOYMENT` to that resource and deployment.

## 3. Environment variables

In `backend/.env` you should have at least:

- `AZURE_OPENAI_ENDPOINT` – e.g. `https://your-resource-swedencentral.cognitiveservices.azure.com` or `https://your-resource.openai.azure.com`
- `AZURE_OPENAI_API_KEY` – API key for that resource
- `AZURE_OPENAI_DEPLOYMENT` – Deployment name (e.g. `gpt-realtime`)
- `AZURE_OPENAI_API_VERSION` – e.g. `2025-08-28` (optional; backend has a default)

## 4. Useful links

- [Use the GPT Realtime API via WebRTC (Azure)](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio-webrtc)
- Realtime models in Sweden Central: e.g. `gpt-realtime` (2025-08-28), `gpt-4o-realtime-preview` (2024-12-17)
