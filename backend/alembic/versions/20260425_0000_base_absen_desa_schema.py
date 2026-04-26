"""base absen desa schema

Revision ID: 20260425_0000
Revises:
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260425_0000"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        do $$ begin
            create type attendancestatus as enum ('HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALFA');
        exception when duplicate_object then null; end $$;
    """)
    op.execute("""
        do $$ begin
            create type auditaction as enum ('CREATE', 'UPDATE', 'DELETE', 'CORRECT', 'REORDER', 'EXPORT');
        exception when duplicate_object then null; end $$;
    """)
    op.execute("""
        do $$ begin
            create type entitytype as enum (
                'EMPLOYEE', 'ATTENDANCE', 'SETTINGS', 'HOLIDAY', 'DAILY_SCHEDULE', 'ADMIN',
                'SERVICE_TYPE', 'SURVEY_QUESTION', 'SURVEY_RESPONSE', 'GUESTBOOK'
            );
        exception when duplicate_object then null; end $$;
    """)
    op.execute("""
        do $$ begin
            create type questiontype as enum ('rating', 'text', 'multiple_choice');
        exception when duplicate_object then null; end $$;
    """)
    op.execute("""
        do $$ begin
            create type filledbytype as enum ('sendiri', 'diwakilkan');
        exception when duplicate_object then null; end $$;
    """)

    op.execute("""
        create table if not exists admins (
            id serial primary key,
            username varchar(50) not null unique,
            password_hash varchar(255) not null,
            name varchar(100) not null,
            role varchar(20) not null default 'admin',
            created_at timestamp without time zone default now(),
            updated_at timestamp without time zone default now()
        )
    """)
    op.execute("create index if not exists ix_admins_id on admins (id)")
    op.execute("create unique index if not exists ix_admins_username on admins (username)")

    op.execute("""
        create table if not exists employees (
            id serial primary key,
            tenant_id varchar(64) not null default 'default',
            external_employee_id varchar(128),
            nik varchar(20) unique,
            name varchar(100) not null,
            position varchar(100) not null,
            phone varchar(20),
            address varchar(500),
            photo_url varchar(500),
            is_active boolean not null default true,
            created_at timestamp without time zone default now(),
            updated_at timestamp without time zone default now()
        )
    """)
    op.execute("create index if not exists ix_employees_id on employees (id)")
    op.execute("create index if not exists ix_employees_tenant_id on employees (tenant_id)")
    op.execute("create index if not exists ix_employees_external_employee_id on employees (external_employee_id)")
    op.execute("create unique index if not exists ix_employees_nik on employees (nik)")
    op.execute("create index if not exists ix_employees_tenant_active on employees (tenant_id, is_active)")
    op.execute("""
        create unique index if not exists uq_employees_tenant_external_id
        on employees (tenant_id, external_employee_id)
        where external_employee_id is not null
    """)

    op.execute("""
        create table if not exists work_settings (
            id serial primary key,
            village_name varchar(200) not null default 'Desa',
            officer_name varchar(200),
            logo_url varchar(500),
            background_url varchar(500),
            check_in_start time without time zone not null default '07:00',
            check_in_end time without time zone not null default '08:00',
            late_threshold_minutes integer not null default 15,
            check_out_start time without time zone not null default '16:00',
            min_work_hours double precision not null default 8.0,
            face_similarity_threshold double precision not null default 0.5,
            updated_at timestamp without time zone default now()
        )
    """)
    op.execute("create index if not exists ix_work_settings_id on work_settings (id)")

    op.execute("""
        create table if not exists holidays (
            id serial primary key,
            date date not null unique,
            name varchar(200) not null,
            is_auto boolean default false,
            is_cuti boolean default false,
            is_excluded boolean default false,
            created_at timestamp without time zone default now()
        )
    """)
    op.execute("create index if not exists ix_holidays_id on holidays (id)")
    op.execute("create unique index if not exists ix_holidays_date on holidays (date)")

    op.execute("""
        create table if not exists audit_logs (
            id serial primary key,
            action auditaction not null,
            entity_type entitytype not null,
            entity_id integer,
            description varchar(500) not null,
            performed_by varchar(100) not null,
            details json,
            created_at timestamp without time zone default now()
        )
    """)
    op.execute("create index if not exists ix_audit_logs_id on audit_logs (id)")
    op.execute("create index if not exists ix_audit_logs_created_at on audit_logs (created_at)")

    op.execute("""
        create table if not exists daily_work_schedules (
            id serial primary key,
            day_of_week integer not null unique,
            is_workday boolean not null default true,
            check_in_start time without time zone not null default '07:00',
            check_in_end time without time zone not null default '08:00',
            check_out_start time without time zone not null default '16:00',
            updated_at timestamp without time zone default now()
        )
    """)
    op.execute("create index if not exists ix_daily_work_schedules_id on daily_work_schedules (id)")

    op.execute("""
        create table if not exists guest_book_meeting_targets (
            id serial primary key,
            name varchar(200) not null unique,
            is_active boolean not null default true,
            created_at timestamp without time zone not null default now(),
            updated_at timestamp without time zone not null default now()
        )
    """)
    op.execute("create index if not exists ix_guest_book_meeting_targets_id on guest_book_meeting_targets (id)")

    op.execute("""
        create table if not exists service_types (
            id serial primary key,
            name varchar(200) not null unique,
            is_active boolean not null default true,
            created_at timestamp without time zone not null default now(),
            updated_at timestamp without time zone not null default now()
        )
    """)
    op.execute("create index if not exists ix_service_types_id on service_types (id)")

    op.execute("""
        create table if not exists survey_questions (
            id serial primary key,
            question_text text not null,
            question_type questiontype not null default 'rating',
            options json,
            is_required boolean not null default true,
            is_active boolean not null default true,
            "order" integer not null default 0,
            created_at timestamp without time zone not null default now(),
            updated_at timestamp without time zone not null default now()
        )
    """)
    op.execute("create index if not exists ix_survey_questions_id on survey_questions (id)")

    op.execute("""
        create table if not exists attendance_logs (
            id serial primary key,
            tenant_id varchar(64) not null default 'default',
            employee_id integer not null references employees(id),
            date date not null,
            check_in_at timestamp without time zone,
            check_out_at timestamp without time zone,
            status attendancestatus not null default 'HADIR',
            confidence_score double precision,
            corrected_by varchar(100),
            correction_notes varchar(500),
            created_at timestamp without time zone default now(),
            updated_at timestamp without time zone default now()
        )
    """)
    op.execute("create index if not exists ix_attendance_logs_id on attendance_logs (id)")
    op.execute("create index if not exists ix_attendance_logs_employee_id on attendance_logs (employee_id)")
    op.execute("create index if not exists ix_attendance_logs_date on attendance_logs (date)")
    op.execute("create index if not exists ix_attendance_logs_tenant_id on attendance_logs (tenant_id)")
    op.execute("create index if not exists ix_attendance_logs_tenant_date on attendance_logs (tenant_id, date)")
    op.execute("create index if not exists ix_attendance_logs_tenant_employee_date on attendance_logs (tenant_id, employee_id, date)")

    op.execute("""
        create table if not exists guest_book_entries (
            id serial primary key,
            name varchar(100) not null,
            institution varchar(200) not null,
            meeting_target_id integer references guest_book_meeting_targets(id),
            meeting_target_name varchar(200) not null,
            purpose text not null,
            visit_date date not null,
            created_at timestamp without time zone not null default now()
        )
    """)
    op.execute("create index if not exists ix_guest_book_entries_id on guest_book_entries (id)")

    op.execute("""
        create table if not exists survey_responses (
            id serial primary key,
            service_type_id integer not null references service_types(id),
            filled_by filledbytype not null,
            responses json not null,
            feedback text,
            submitted_at timestamp without time zone not null default now()
        )
    """)
    op.execute("create index if not exists ix_survey_responses_id on survey_responses (id)")

    for table in (
        "admins",
        "employees",
        "work_settings",
        "holidays",
        "audit_logs",
        "daily_work_schedules",
        "guest_book_meeting_targets",
        "guest_book_entries",
        "service_types",
        "survey_questions",
        "survey_responses",
        "attendance_logs",
    ):
        op.execute(f"alter table {table} enable row level security")

    op.execute("""
        insert into admins (username, password_hash, name, role)
        values (
            'admin',
            '$2b$12$5CqfXc81p0P4sa8.s9AlaO4LQCjhUMD1Cg8fgQGKuYHOpksJme3ha',
            'Administrator',
            'admin'
        )
        on conflict (username) do nothing
    """)
    op.execute("""
        insert into work_settings (id, village_name)
        values (1, 'Desa')
        on conflict (id) do nothing
    """)
    op.execute("""
        select setval(
            pg_get_serial_sequence('work_settings', 'id'),
            greatest((select coalesce(max(id), 1) from work_settings), 1),
            true
        )
    """)
    op.execute("""
        insert into daily_work_schedules (day_of_week, is_workday, check_in_start, check_in_end, check_out_start)
        values
            (0, true, '07:00', '08:00', '16:00'),
            (1, true, '07:00', '08:00', '16:00'),
            (2, true, '07:00', '08:00', '16:00'),
            (3, true, '07:00', '08:00', '16:00'),
            (4, true, '07:00', '08:00', '11:30'),
            (5, false, '07:00', '08:00', '16:00'),
            (6, false, '07:00', '08:00', '16:00')
        on conflict (day_of_week) do nothing
    """)


def downgrade() -> None:
    for table in (
        "survey_responses",
        "guest_book_entries",
        "attendance_logs",
        "survey_questions",
        "service_types",
        "guest_book_meeting_targets",
        "daily_work_schedules",
        "audit_logs",
        "holidays",
        "work_settings",
        "employees",
        "admins",
    ):
        op.execute(f"drop table if exists {table} cascade")

    for enum_type in ("filledbytype", "questiontype", "entitytype", "auditaction", "attendancestatus"):
        op.execute(f"drop type if exists {enum_type}")
