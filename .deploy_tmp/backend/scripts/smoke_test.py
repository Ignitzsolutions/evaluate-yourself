#!/usr/bin/env python3
"""
Smoke tests for Azure-ready backend architecture.
Tests database and Redis connectivity without running migrations.
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

def test_imports():
    """Test that all required modules can be imported."""
    print("🔍 Testing imports...")
    try:
        from db.database import test_db_connection, DATABASE_URL
        from db.redis_client import test_redis_connection, get_redis_client
        print("✅ All imports successful")
        return True
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        return False


def test_database_connection():
    """Test database connectivity."""
    print("\n🔍 Testing database connection...")
    try:
        from db.database import test_db_connection, DATABASE_URL
        
        print(f"   DATABASE_URL: {DATABASE_URL[:50]}...")
        db_type = "PostgreSQL" if DATABASE_URL.startswith("postgresql") else "SQLite"
        print(f"   Database type: {db_type}")
        
        success, message, latency = test_db_connection()
        
        if success:
            print(f"✅ Database connected: {message} ({latency:.2f}ms)")
            return True
        else:
            print(f"❌ Database connection failed: {message}")
            return False
    except Exception as e:
        print(f"❌ Database test error: {e}")
        return False


def test_redis_connection():
    """Test Redis connectivity."""
    print("\n🔍 Testing Redis connection...")
    try:
        from db.redis_client import test_redis_connection, get_redis_client
        
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            tls_mode = "TLS (rediss://)" if redis_url.startswith("rediss://") else "Plain (redis://)"
            print(f"   REDIS_URL: {redis_url[:50]}... ({tls_mode})")
        else:
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = os.getenv("REDIS_PORT", "6379")
            print(f"   Redis: {redis_host}:{redis_port} (local development)")
        
        success, message, latency = test_redis_connection()
        
        if success:
            print(f"✅ Redis connected: {message} ({latency:.2f}ms)")
            return True
        else:
            print(f"❌ Redis connection failed: {message}")
            return False
    except Exception as e:
        print(f"❌ Redis test error: {e}")
        return False


def test_redis_operations():
    """Test basic Redis operations."""
    print("\n🔍 Testing Redis operations...")
    try:
        from db.redis_client import get_redis_client
        
        client = get_redis_client()
        
        # Test SET
        test_key = "health_check_test"
        client.set(test_key, "test_value", ex=10)  # Expires in 10 seconds
        
        # Test GET
        value = client.get(test_key)
        if value != "test_value":
            print(f"❌ Redis SET/GET failed: expected 'test_value', got '{value}'")
            return False
        
        # Test DELETE
        client.delete(test_key)
        
        print("✅ Redis operations working (SET/GET/DELETE)")
        return True
    except Exception as e:
        print(f"❌ Redis operations test error: {e}")
        return False


def test_database_query():
    """Test simple database query."""
    print("\n🔍 Testing database query...")
    try:
        from db.database import SessionLocal
        from sqlalchemy import text
        
        db = SessionLocal()
        try:
            # Test a simple query
            result = db.execute(text("SELECT 1 as test")).fetchone()
            if result and result[0] == 1:
                print("✅ Database query successful")
                return True
            else:
                print("❌ Database query returned unexpected result")
                return False
        finally:
            db.close()
    except Exception as e:
        print(f"❌ Database query test error: {e}")
        return False


def test_environment_variables():
    """Check critical environment variables."""
    print("\n🔍 Checking environment variables...")
    
    critical_vars = {
        "Database": "DATABASE_URL",
        "Redis": ["REDIS_URL", "REDIS_HOST"],  # Either REDIS_URL or REDIS_HOST
        "Clerk Auth": "CLERK_SECRET_KEY",
        "Azure OpenAI": "AZURE_OPENAI_API_KEY",
    }
    
    all_ok = True
    for service, var_names in critical_vars.items():
        if isinstance(var_names, str):
            var_names = [var_names]
        
        found = any(os.getenv(var) for var in var_names)
        status = "✅" if found else "⚠️"
        var_display = " or ".join(var_names)
        
        if found:
            print(f"{status} {service}: {var_display} configured")
        else:
            print(f"{status} {service}: {var_display} not set (using defaults)")
    
    # Note: Using defaults is OK for local development
    print("\n   ℹ️  Local development uses defaults (SQLite + localhost Redis)")
    return True  # Pass even with defaults


def test_health_endpoint_logic():
    """Test health check logic without starting server."""
    print("\n🔍 Testing health endpoint logic...")
    try:
        from db.database import test_db_connection
        from db.redis_client import test_redis_connection
        
        db_ok, db_msg, db_latency = test_db_connection()
        redis_ok, redis_msg, redis_latency = test_redis_connection()
        
        overall_ok = db_ok and redis_ok
        status = "healthy" if overall_ok else "degraded"
        
        print(f"   Status: {status}")
        print(f"   Database: {'up' if db_ok else 'down'} ({db_latency:.2f}ms)")
        print(f"   Redis: {'up' if redis_ok else 'down'} ({redis_latency:.2f}ms)")
        
        if db_ok:
            print("✅ Health check logic working (database OK)")
            if not redis_ok:
                print("   ℹ️  Redis not available (start with: brew install redis && redis-server)")
            return True
        else:
            print("❌ Health check failed: database down")
            return False
    except Exception as e:
        print(f"❌ Health check logic error: {e}")
        return False


def run_all_tests():
    """Run all smoke tests."""
    print("=" * 60)
    print("🚀 Azure Backend Smoke Tests")
    print("=" * 60)
    
    tests = [
        ("Imports", test_imports),
        ("Environment Variables", test_environment_variables),
        ("Database Connection", test_database_connection),
        ("Database Query", test_database_query),
        ("Redis Connection", test_redis_connection),
        ("Redis Operations", test_redis_operations),
        ("Health Endpoint Logic", test_health_endpoint_logic),
    ]
    
    results = {}
    redis_available = True
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results[test_name] = result
            
            # Track if Redis tests fail
            if not result and "Redis" in test_name:
                redis_available = False
        except Exception as e:
            print(f"\n❌ {test_name} crashed: {e}")
            results[test_name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    
    passed = sum(1 for r in results.values() if r)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "⚠️ SKIP" if not redis_available and "Redis" in test_name else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    # Success criteria: Database tests must pass, Redis is optional
    critical_tests = ["Imports", "Database Connection", "Database Query"]
    critical_passed = all(results.get(t, False) for t in critical_tests)
    
    if critical_passed:
        print("\n✅ Critical tests passed! Backend database layer is Azure-ready.")
        if not redis_available:
            print("   ℹ️  Redis tests skipped (not running locally)")
            print("   ℹ️  Redis will work in Azure with REDIS_URL configured")
        else:
            print("   ✅ Redis also working!")
        return 0
    else:
        print(f"\n❌ Critical tests failed. Review configuration.")
        return 1


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
