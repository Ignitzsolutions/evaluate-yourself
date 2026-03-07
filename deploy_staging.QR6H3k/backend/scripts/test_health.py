#!/usr/bin/env python3
"""Quick test to verify health endpoint works."""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

try:
    print("🔍 Testing health endpoint...")
    from app import app
    from fastapi.testclient import TestClient
    
    client = TestClient(app)
    response = client.get('/health')
    
    print(f"\n✅ Status Code: {response.status_code}")
    
    if response.status_code in [200, 503]:
        data = response.json()
        print(f"✅ Status: {data.get('status')}")
        print(f"✅ Database: {data['services']['database']['status']} ({data['services']['database']['latency_ms']:.2f}ms)")
        print(f"✅ Redis: {data['services']['redis']['status']} ({data['services']['redis']['latency_ms']:.2f}ms)")
        print(f"✅ Environment: DB={data['environment']['database_type']}, Redis={data['environment']['redis_mode']}")
        
        print("\n🎉 Health endpoint working correctly!")
        sys.exit(0)
    else:
        print(f"❌ Unexpected status code: {response.status_code}")
        print(response.text)
        sys.exit(1)
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
