# SANO db layer - sqlite3 stdlib only, no ORM
import os
import sqlite3

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "sano.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""CREATE TABLE IF NOT EXISTS records(
        id TEXT PRIMARY KEY, title TEXT, type TEXT, date TEXT,
        status TEXT, extracted TEXT, summary TEXT, filename TEXT)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS medications(
        id TEXT PRIMARY KEY, name TEXT, dose TEXT, schedule TEXT,
        status TEXT DEFAULT 'current', adherence INTEGER DEFAULT 100)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS wellness(
        date TEXT PRIMARY KEY, steps INT DEFAULT 0, sleep_hrs FLOAT DEFAULT 0,
        water_l FLOAT DEFAULT 0, heart_rate INT DEFAULT 0)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS appointments(
        id TEXT PRIMARY KEY, title TEXT, date TEXT, status TEXT DEFAULT 'upcoming')""")
    # Extended booking fields (migration-safe for existing DBs)
    for col in ("doctor TEXT", "specialty TEXT", "appt_type TEXT", "time TEXT",
                "location TEXT", "notes TEXT"):
        try:
            conn.execute(f"ALTER TABLE appointments ADD COLUMN {col}")
        except Exception:
            pass
    conn.execute("""CREATE TABLE IF NOT EXISTS users(
        id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, pw_hash TEXT, token TEXT)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS profiles(
        email TEXT PRIMARY KEY, name TEXT DEFAULT '', phone TEXT DEFAULT '',
        gender TEXT DEFAULT '', dob TEXT DEFAULT '', blood_group TEXT DEFAULT '',
        address TEXT DEFAULT '')""")
    # Body measurements live with personal details (migration-safe for existing DBs)
    for col in ("height_cm REAL", "weight_kg REAL"):
        try:
            conn.execute(f"ALTER TABLE profiles ADD COLUMN {col}")
        except Exception:
            pass
    # No seed/demo rows: tables start empty and fill only from user input
    # (signup, uploads, manual records, medications, wellness logs, appointments).
    conn.commit()
    conn.close()
