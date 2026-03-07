#!/usr/bin/env python3
"""
Check that users exist in the DB (run after logging in via Clerk and loading Dashboard).
Usage (from project root):  python backend/scripts/check_db_users.py
Or from backend dir:        python scripts/check_db_users.py
"""
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from db.database import engine
from sqlalchemy import text

def main():
    with engine.connect() as c:
        r = c.execute(text("SELECT id, clerk_user_id, email, full_name, created_at FROM users ORDER BY created_at DESC LIMIT 10"))
        rows = r.fetchall()
    if not rows:
        print("No users in DB yet. Log in via Clerk and open Dashboard so /api/me creates the user.")
        return
    print(f"Found {len(rows)} user(s) in DB:")
    for row in rows:
        uid, cid, em, name, created = row[0], row[1] or "", row[2] or "", row[3] or "", row[4]
        print(f"  id={str(uid)[:8]}... clerk_user_id={str(cid)[:24]}... email={em}")

if __name__ == "__main__":
    main()
