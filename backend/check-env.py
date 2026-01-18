#!/usr/bin/env python3
"""Check if Azure OpenAI keys are configured in .env file"""
import os
import pathlib
from dotenv import load_dotenv

# Load .env file
env_path = pathlib.Path(__file__).parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=True)
    print(f"✅ Loaded .env from: {env_path}")
else:
    print(f"❌ .env file not found at: {env_path}")
    exit(1)

# Check keys
api_key = os.getenv('AZURE_OPENAI_API_KEY', '')
endpoint = os.getenv('AZURE_OPENAI_ENDPOINT', '')

print("\n" + "="*60)
print("AZURE OPENAI CONFIGURATION CHECK")
print("="*60)

if api_key and api_key != 'your-azure-openai-api-key-here' and len(api_key) > 10:
    print(f"✅ AZURE_OPENAI_API_KEY: {api_key[:10]}...{api_key[-4:]} (length: {len(api_key)})")
else:
    print(f"❌ AZURE_OPENAI_API_KEY: Not configured or using placeholder")
    print("   Current value:", api_key[:50] if api_key else "EMPTY")

if endpoint and endpoint != 'https://your-resource.openai.azure.com' and ('openai.azure.com' in endpoint or 'cognitiveservices.azure.com' in endpoint):
    print(f"✅ AZURE_OPENAI_ENDPOINT: {endpoint}")
else:
    print(f"❌ AZURE_OPENAI_ENDPOINT: Not configured or using placeholder")
    print("   Current value:", endpoint if endpoint else "EMPTY")

print("\n" + "="*60)
if api_key and api_key != 'your-azure-openai-api-key-here' and endpoint and endpoint != 'https://your-resource.openai.azure.com':
    print("✅ Configuration looks good!")
else:
    print("❌ Please update backend/.env with your actual Azure OpenAI keys:")
    print("   AZURE_OPENAI_API_KEY=your-actual-key-here")
    print("   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com")
print("="*60)
