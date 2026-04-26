"""add face core tables

Revision ID: 20260426_0004
Revises: 20260425_0003
Create Date: 2026-04-26
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260426_0004"
down_revision: Union[str, None] = "20260425_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        create table if not exists face_clients (
            id serial primary key,
            tenant_id varchar(64) not null unique,
            name varchar(200) not null,
            api_key_hash varchar(64) not null unique,
            is_active boolean not null default true,
            created_at timestamp without time zone default now(),
            updated_at timestamp without time zone default now()
        )
    """)
    op.execute("create index if not exists ix_face_clients_id on face_clients (id)")
    op.execute("create index if not exists ix_face_clients_tenant_id on face_clients (tenant_id)")
    op.execute("create index if not exists ix_face_clients_api_key_hash on face_clients (api_key_hash)")

    op.execute("""
        create table if not exists face_subjects (
            id serial primary key,
            tenant_id varchar(64) not null,
            external_subject_id varchar(128) not null,
            display_name varchar(200) not null,
            metadata json,
            is_active boolean not null default true,
            created_at timestamp without time zone default now(),
            updated_at timestamp without time zone default now(),
            constraint uq_face_subjects_tenant_external_id unique (tenant_id, external_subject_id)
        )
    """)
    op.execute("create index if not exists ix_face_subjects_id on face_subjects (id)")
    op.execute("create index if not exists ix_face_subjects_tenant_id on face_subjects (tenant_id)")
    op.execute("create index if not exists ix_face_subjects_external_subject_id on face_subjects (external_subject_id)")
    op.execute("create index if not exists ix_face_subjects_tenant_active on face_subjects (tenant_id, is_active)")

    op.execute("""
        create table if not exists face_templates (
            id serial primary key,
            tenant_id varchar(64) not null,
            subject_id integer not null references face_subjects(id) on delete cascade,
            embedding bytea not null,
            photo_url varchar(500) not null,
            model_name varchar(100) not null default 'face_recognition',
            embedding_version varchar(32) not null default 'v1',
            is_primary boolean not null default false,
            created_at timestamp without time zone default now()
        )
    """)
    op.execute("create index if not exists ix_face_templates_id on face_templates (id)")
    op.execute("create index if not exists ix_face_templates_tenant_id on face_templates (tenant_id)")
    op.execute("create index if not exists ix_face_templates_subject_id on face_templates (subject_id)")
    op.execute("create index if not exists ix_face_templates_tenant_subject on face_templates (tenant_id, subject_id)")
    op.execute("create index if not exists ix_face_templates_embedding_version on face_templates (embedding_version, model_name)")

    for table in ("face_clients", "face_subjects", "face_templates"):
        op.execute(f"alter table {table} enable row level security")

    op.execute("""
        insert into face_subjects (tenant_id, external_subject_id, display_name, metadata, is_active, created_at, updated_at)
        select
            e.tenant_id,
            e.id::text,
            e.name,
            json_build_object(
                'source', 'employees',
                'employee_id', e.id,
                'external_employee_id', e.external_employee_id,
                'position', e.position,
                'photo_url', e.photo_url
            ),
            e.is_active,
            coalesce(e.created_at, now()),
            coalesce(e.updated_at, now())
        from employees e
        on conflict (tenant_id, external_subject_id) do update set
            display_name = excluded.display_name,
            metadata = excluded.metadata,
            is_active = excluded.is_active,
            updated_at = excluded.updated_at
    """)

def downgrade() -> None:
    for table in ("face_templates", "face_subjects", "face_clients"):
        op.execute(f"drop table if exists {table} cascade")
