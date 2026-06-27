#!/usr/bin/env python3
"""Check if OpenAI keys are configured in .env file."""
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
api_key = os.getenv('OPENAI_API_KEY', '') or os.getenv('OPENAI_REALTIME_API_KEY', '')
model = os.getenv('OPENAI_REALTIME_MODEL', '')

print("\n" + "="*60)
print("OPENAI CONFIGURATION CHECK")
print("="*60)

if api_key and api_key != 'your-openai-api-key-here' and len(api_key) > 10:
    print(f"✅ OPENAI_API_KEY: {api_key[:10]}...{api_key[-4:]} (length: {len(api_key)})")
else:
    print(f"❌ OPENAI_API_KEY: Not configured or using placeholder")
    print("   Current value:", api_key[:50] if api_key else "EMPTY")

if model:
    print(f"✅ OPENAI_REALTIME_MODEL: {model}")
else:
    print(f"⚠️ OPENAI_REALTIME_MODEL: Not configured (will use server default)")

print("\n" + "="*60)
if api_key and api_key != 'your-openai-api-key-here':
    print("✅ Configuration looks good!")
else:
    print("❌ Please update backend/.env with your actual OpenAI key:")
    print("   OPENAI_API_KEY=your-actual-key-here")
print("="*60)
