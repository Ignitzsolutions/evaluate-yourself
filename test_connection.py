import os
import asyncio
import websockets
from dotenv import load_dotenv

load_dotenv()

AOAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "https://gpt-interactive-talk.cognitiveservices.azure.com/")
AOAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
API_VERSION = "2024-10-01-preview"

print("=" * 60)
print("Azure Realtime API Connection Tester")
print("=" * 60)
print(f"\nEndpoint: {AOAI_ENDPOINT}")
print(f"API Version: {API_VERSION}")
print(f"API Key: {AOAI_API_KEY[:20]}..." if AOAI_API_KEY else "API Key: NOT SET")
print("=" * 60)

# Test different deployment names
deployment_names = [
    "gpt-4o-realtime-preview",
    "gpt-4o-realtime",
    "gpt-realtime",
    "realtime",
    "gpt-4o-mini-realtime-preview",
    "gpt-4-realtime-preview",
]

async def test_connection(deployment_name):
    ws_url = (
        AOAI_ENDPOINT.rstrip("/")
        + f"/openai/realtime?api-version={API_VERSION}&deployment={deployment_name}"
    ).replace("https://", "wss://")
    
    print(f"\n[Testing] Deployment: {deployment_name}")
    print(f"URL: {ws_url}")
    
    headers = {"api-key": AOAI_API_KEY}
    
    try:
        async with websockets.connect(ws_url, additional_headers=headers, max_size=None) as ws:
            print("✅ Connection successful!")
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                print(f"✅ Received first message!")
                return True, deployment_name
            except asyncio.TimeoutError:
                print("⚠️ Connected but no response within 5 seconds")
                return True, deployment_name
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"❌ HTTP {e.status_code}")
        return False, None
    except Exception as e:
        print(f"❌ Error: {e}")
        return False, None

async def main():
    print("\nTesting different deployment names...\n")
    
    for deployment in deployment_names:
        success, working_deployment = await test_connection(deployment)
        if success:
            print(f"\n{'='*60}")
            print("✅ WORKING DEPLOYMENT FOUND!")
            print(f"Deployment Name: {working_deployment}")
            print(f"\nUpdate your .env file:")
            print(f"AZURE_REALTIME_DEPLOYMENT={working_deployment}")
            print(f"{'='*60}\n")
            return
        await asyncio.sleep(0.5)
    
    print(f"\n{'='*60}")
    print("❌ None of the deployment names worked.")
    print("\nPlease check your Azure portal:")
    print("1. Go to https://portal.azure.com")
    print("2. Navigate to your resource: gpt-interactive-talk")
    print("3. Click on 'Deployments' or 'Model deployments'")
    print("4. Find the realtime model deployment name")
    print("5. Update AZURE_REALTIME_DEPLOYMENT in .env with the exact name")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    asyncio.run(main())
