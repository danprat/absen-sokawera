"""supabase foundation

Revision ID: 20260425_0001
Revises: 20260425_0000
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260425_0001"
down_revision: Union[str, None] = "20260425_0000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("create extension if not exists vector with schema extensions")

    op.execute("""
        alter table if exists employees
        add column if not exists tenant_id varchar(64) not null default 'default',
        add column if not exists external_employee_id varchar(128)
    """)
    op.execute("create index if not exists ix_employees_tenant_id on employees (tenant_id)")
    op.execute("create index if not exists ix_employees_tenant_active on employees (tenant_id, is_active)")
    op.execute("""
        create unique index if not exists uq_employees_tenant_external_id
        on employees (tenant_id, external_employee_id)
        where external_employee_id is not null
    """)

    op.execute("""
        alter table if exists face_embeddings
        add column if not exists tenant_id varchar(64) not null default 'default',
        add column if not exists embedding_vector extensions.vector(128),
        add column if not exists embedding_version varchar(32) not null default 'v1',
        add column if not exists model_name varchar(100) not null default 'face_recognition'
    """)
    op.execute("create index if not exists ix_face_embeddings_tenant_id on face_embeddings (tenant_id)")
    op.execute("create index if not exists ix_face_embeddings_tenant_employee on face_embeddings (tenant_id, employee_id)")
    op.execute("create index if not exists ix_face_embeddings_embedding_version on face_embeddings (embedding_version, model_name)")
    op.execute("""
        create index if not exists ix_face_embeddings_embedding_vector_hnsw
        on face_embeddings
        using hnsw (embedding_vector extensions.vector_l2_ops)
        where embedding_vector is not null
    """)

    op.execute("""
        alter table if exists attendance_logs
        add column if not exists tenant_id varchar(64) not null default 'default'
    """)
    op.execute("create index if not exists ix_attendance_logs_tenant_id on attendance_logs (tenant_id)")
    op.execute("create index if not exists ix_attendance_logs_tenant_date on attendance_logs (tenant_id, date)")
    op.execute("""
        create index if not exists ix_attendance_logs_tenant_employee_date
        on attendance_logs (tenant_id, employee_id, date)
    """)

    for table in ("employees", "face_embeddings", "attendance_logs"):
        op.execute(f"alter table if exists {table} enable row level security")
        op.execute(f"grant select, insert, update, delete on table {table} to authenticated")
        op.execute(f"""
            do $$
            begin
                if not exists (
                    select 1
                    from pg_policies
                    where schemaname = 'public'
                      and tablename = '{table}'
                      and policyname = '{table}_tenant_isolation'
                ) then
                    create policy {table}_tenant_isolation
                    on {table}
                    for all
                    to authenticated
                    using (tenant_id = (select auth.jwt()->>'tenant_id'))
                    with check (tenant_id = (select auth.jwt()->>'tenant_id'));
                end if;
            end
            $$;
        """)

    op.execute("""
        insert into storage.buckets (id, name, public)
        values
            ('branding-assets', 'branding-assets', true),
            ('face-originals', 'face-originals', false),
            ('attendance-captures', 'attendance-captures', false)
        on conflict (id) do nothing
    """)

    op.execute("""
        do $$
        begin
            if not exists (
                select 1 from pg_policies
                where schemaname = 'storage'
                  and tablename = 'objects'
                  and policyname = 'branding_assets_public_read'
            ) then
                create policy branding_assets_public_read
                on storage.objects
                for select
                to public
                using (bucket_id = 'branding-assets');
            end if;
        end
        $$;
    """)

    op.execute("""
        do $$
        begin
            if not exists (
                select 1 from pg_policies
                where schemaname = 'storage'
                  and tablename = 'objects'
                  and policyname = 'tenant_storage_objects'
            ) then
                create policy tenant_storage_objects
                on storage.objects
                for all
                to authenticated
                using (
                    bucket_id in ('face-originals', 'attendance-captures')
                    and (storage.foldername(name))[1] = (select auth.jwt()->>'tenant_id')
                )
                with check (
                    bucket_id in ('face-originals', 'attendance-captures')
                    and (storage.foldername(name))[1] = (select auth.jwt()->>'tenant_id')
                );
            end if;
        end
        $$;
    """)


def downgrade() -> None:
    op.execute("drop policy if exists tenant_storage_objects on storage.objects")
    op.execute("drop policy if exists branding_assets_public_read on storage.objects")

    for table in ("attendance_logs", "face_embeddings", "employees"):
        op.execute(f"drop policy if exists {table}_tenant_isolation on {table}")

    op.execute("drop index if exists ix_attendance_logs_tenant_employee_date")
    op.execute("drop index if exists ix_attendance_logs_tenant_date")
    op.execute("drop index if exists ix_attendance_logs_tenant_id")
    op.execute("alter table if exists attendance_logs drop column if exists tenant_id")

    op.execute("drop index if exists ix_face_embeddings_embedding_vector_hnsw")
    op.execute("drop index if exists ix_face_embeddings_embedding_version")
    op.execute("drop index if exists ix_face_embeddings_tenant_employee")
    op.execute("drop index if exists ix_face_embeddings_tenant_id")
    op.execute("""
        alter table if exists face_embeddings
        drop column if exists model_name,
        drop column if exists embedding_version,
        drop column if exists embedding_vector,
        drop column if exists tenant_id
    """)

    op.execute("drop index if exists uq_employees_tenant_external_id")
    op.execute("drop index if exists ix_employees_tenant_active")
    op.execute("drop index if exists ix_employees_tenant_id")
    op.execute("""
        alter table if exists employees
        drop column if exists external_employee_id,
        drop column if exists tenant_id
    """)
