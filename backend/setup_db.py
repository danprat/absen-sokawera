#!/usr/bin/env python3
"""
Script to initialize database and create all tables
"""
import sys
from sqlalchemy import text
from app.database import engine, Base
from app.models import (
    Admin, Employee, FaceEmbedding, FaceClient, FaceSubject, FaceTemplate, AttendanceLog,
    WorkSettings, Holiday, AuditLog, GuestBookEntry,
    GuestBookMeetingTarget
)

def test_connection():
    """Test database connection"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✓ Database connection successful")
            return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False

def create_tables():
    """Create all tables using SQLAlchemy metadata"""
    try:
        # Import all models to ensure they're registered with Base
        Base.metadata.create_all(bind=engine)
        print("✓ All tables created successfully")
        return True
    except Exception as e:
        print(f"✗ Failed to create tables: {e}")
        return False

def verify_tables():
    """Verify all expected tables exist"""
    expected_tables = [
        'admins', 'employees', 'face_embeddings',
        'face_clients', 'face_subjects', 'face_templates',
        'attendance_logs', 'work_settings', 'holidays', 'audit_logs',
        'daily_work_schedules', 'guest_book_entries', 'guest_book_meeting_targets',
        'survey_questions', 'survey_responses'
    ]
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SHOW TABLES"))
            existing_tables = [row[0] for row in result]
            
            print("\nTables in database:")
            missing = []
            for table in expected_tables:
                if table in existing_tables:
                    print(f"  ✓ {table}")
                else:
                    print(f"  ✗ {table} (missing)")
                    missing.append(table)
            
            if missing:
                print(f"\n✗ Missing tables: {', '.join(missing)}")
                return False
            else:
                print("\n✓ All expected tables exist")
                return True
    except Exception as e:
        print(f"✗ Failed to verify tables: {e}")
        return False

def main():
    print("=" * 60)
    print("Database Setup for Sistem Absensi Desa")
    print("=" * 60)
    print()
    
    # Step 1: Test connection
    print("Step 1: Testing database connection...")
    if not test_connection():
        sys.exit(1)
    print()
    
    # Step 2: Create tables
    print("Step 2: Creating tables...")
    if not create_tables():
        sys.exit(1)
    print()
    
    # Step 3: Verify tables
    print("Step 3: Verifying tables...")
    if not verify_tables():
        sys.exit(1)
    print()
    
    print("=" * 60)
    print("Database setup completed successfully!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Start the FastAPI server: uvicorn app.main:app --reload")
    print("2. Setup admin account: POST http://localhost:8000/api/v1/auth/setup")
    print()

if __name__ == "__main__":
    main()
