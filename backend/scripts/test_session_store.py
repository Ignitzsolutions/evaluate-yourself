#!/usr/bin/env python3
"""Test SessionStore lock and event methods."""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.session.session_store import SessionStore
from db.redis_client import get_redis_client
import time

def test_session_store():
    """Test SessionStore lock and event methods."""
    print("\n" + "=" * 60)
    print("🧪 SessionStore Lock and Event Tests")
    print("=" * 60)
    
    try:
        redis_client = get_redis_client()
        print("✅ Redis client created")
    except Exception as e:
        print(f"❌ Failed to create Redis client: {e}")
        print("   ℹ️  Start Redis with: brew install redis && redis-server")
        return False
    
    store = SessionStore(redis_client)
    test_session = "test_session_123"
    lock_key = "test_lock:123"
    
    # Test 1: Lock acquisition
    print("\n🔍 Test 1: Lock Acquisition")
    result = store.acquire_lock(lock_key, ttl_seconds=5)
    if result:
        print(f"   ✅ Lock acquired: {lock_key}")
    else:
        print(f"   ❌ Failed to acquire lock")
        return False
    
    # Test 2: Lock already held
    print("\n🔍 Test 2: Lock Already Held")
    result = store.acquire_lock(lock_key, ttl_seconds=5)
    if not result:
        print(f"   ✅ Lock correctly blocked (already held)")
    else:
        print(f"   ❌ Lock should not be acquired twice")
        return False
    
    # Test 3: Check lock exists
    print("\n🔍 Test 3: Check Lock Exists")
    exists = store.check_lock(lock_key)
    if exists:
        print(f"   ✅ Lock exists check passed")
    else:
        print(f"   ❌ Lock should exist")
        return False
    
    # Test 4: Release lock
    print("\n🔍 Test 4: Release Lock")
    result = store.release_lock(lock_key)
    if result:
        print(f"   ✅ Lock released")
    else:
        print(f"   ❌ Failed to release lock")
        return False
    
    # Test 5: Emit event
    print("\n🔍 Test 5: Emit Event")
    event_id = store.emit_event(test_session, "TEST_EVENT", {"data": "test payload", "count": 42})
    if event_id:
        print(f"   ✅ Event emitted: {event_id}")
    else:
        print(f"   ❌ Failed to emit event")
        return False
    
    # Test 6: Emit multiple events
    print("\n🔍 Test 6: Emit Multiple Events")
    for i in range(3):
        event_id = store.emit_event(test_session, "SEQUENCE_EVENT", {"index": i})
        if event_id:
            print(f"   ✅ Event {i+1} emitted: {event_id}")
        else:
            print(f"   ❌ Failed to emit event {i+1}")
            return False
    
    # Test 7: Replay events
    print("\n🔍 Test 7: Replay Events")
    events = store.replay_events(test_session, start_id="0", count=10)
    if events:
        print(f"   ✅ Retrieved {len(events)} events")
        for i, event in enumerate(events, 1):
            print(f"      {i}. {event['type']} @ {event['timestamp'][:19]}")
    else:
        print(f"   ❌ No events retrieved")
        return False
    
    # Test 8: Get latest events (non-blocking)
    print("\n🔍 Test 8: Get Latest Events")
    latest = store.get_latest_events(test_session, after_id=events[0]['id'], block_ms=0)
    if latest is not None:
        print(f"   ✅ Retrieved {len(latest)} latest events")
    else:
        print(f"   ❌ Failed to get latest events")
        return False
    
    # Cleanup
    print("\n🧹 Cleanup")
    try:
        redis_client.delete(f"events:{test_session}")
        redis_client.delete(lock_key)
        print("   ✅ Test data cleaned up")
    except Exception as e:
        print(f"   ⚠️  Cleanup warning: {e}")
    
    print("\n" + "=" * 60)
    print("✅ All SessionStore tests passed!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    try:
        success = test_session_store()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
