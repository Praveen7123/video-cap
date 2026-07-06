"""ClipCut schema migration runner.

Migrations live in migrations/*.sql, numbered and applied in order. Every
statement in every migration must be idempotent (`if not exists` / `if not
exists`) so re-running the whole set is always safe.

Two modes, auto-detected:

1. DATABASE_URL is set (a real Postgres connection string, from Supabase ->
   Project Settings -> Database -> Connection string) -> migrations run for
   real, tracked in a `_migrations` table so each file applies exactly once.

2. DATABASE_URL is not set (today's default — we only hold the PostgREST
   service key, which cannot run DDL) -> prints the full, safe-to-paste SQL
   for the Supabase SQL Editor instead. This is the same manual step we've
   been doing ad hoc all session, now versioned and in one place instead of
   scattered across chat history.

Usage:
    python migrate.py            # apply (or print) all pending migrations
    python migrate.py --status   # show which migrations exist, applied or not
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MIGRATIONS_DIR = ROOT_DIR / "migrations"


def _migration_files():
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


def _print_manual_instructions(pending):
    print("No DATABASE_URL set — can't run migrations automatically")
    print("(the app only holds Supabase's REST API key, which can't run DDL).")
    print()
    print("Paste the SQL below into Supabase -> SQL Editor -> New query -> Run.")
    print("It's safe to run even if some of it is already applied (every")
    print("statement uses IF NOT EXISTS).")
    print()
    print("-" * 60)
    for f in pending:
        print(f"-- {f.name}")
        print(f.read_text())
        print()
    print("-" * 60)
    print()
    print("Tip: set DATABASE_URL in backend/.env to a Postgres connection")
    print("string (Supabase -> Project Settings -> Database) to have this")
    print("script apply migrations automatically instead, next time.")


def _run_with_db(db_url, files, status_only=False):
    import psycopg2  # optional dependency — only needed for this path

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("""
                create table if not exists public._migrations (
                    filename text primary key,
                    applied_at timestamptz default now()
                )
            """)
            conn.commit()
            cur.execute("select filename from public._migrations")
            applied = {row[0] for row in cur.fetchall()}

        pending = [f for f in files if f.name not in applied]

        if status_only:
            for f in files:
                mark = "✓ applied" if f.name in applied else "  pending"
                print(f"{mark}  {f.name}")
            return

        if not pending:
            print("Up to date — no pending migrations.")
            return

        for f in pending:
            print(f"Applying {f.name} ...")
            with conn.cursor() as cur:
                cur.execute(f.read_text())
                cur.execute("insert into public._migrations (filename) values (%s)", (f.name,))
            conn.commit()
            print(f"  done.")
        print(f"Applied {len(pending)} migration(s).")
    finally:
        conn.close()


def main():
    status_only = "--status" in sys.argv
    files = _migration_files()
    if not files:
        print("No migration files found in migrations/.")
        return

    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if db_url:
        try:
            _run_with_db(db_url, files, status_only=status_only)
            return
        except ImportError:
            print("DATABASE_URL is set but psycopg2 isn't installed.")
            print("Run: pip install psycopg2-binary")
            print("Falling back to printing the SQL for manual paste.")
            print()

    if status_only:
        print("(No DATABASE_URL — can't check what's actually applied.)")
        print("Migration files on disk, in order:")
        for f in files:
            print(f"  {f.name}")
        return

    _print_manual_instructions(files)


if __name__ == "__main__":
    main()
