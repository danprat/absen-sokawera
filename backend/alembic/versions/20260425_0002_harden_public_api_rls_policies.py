"""harden public api rls policies

Revision ID: 20260425_0002
Revises: 20260425_0001
Create Date: 2026-04-25
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260425_0002"
down_revision: Union[str, None] = "20260425_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PRIVATE_TABLES = (
    "admins",
    "audit_logs",
    "daily_work_schedules",
    "guest_book_entries",
    "guest_book_meeting_targets",
    "holidays",
    "service_types",
    "survey_questions",
    "survey_responses",
    "work_settings",
)


def upgrade() -> None:
    op.execute("drop policy if exists branding_assets_public_read on storage.objects")

    for table in PRIVATE_TABLES:
        policy = f"{table}_deny_data_api_access"
        op.execute(f"""
            do $$
            begin
                if not exists (
                    select 1
                    from pg_policies
                    where schemaname = 'public'
                      and tablename = '{table}'
                      and policyname = '{policy}'
                ) then
                    create policy {policy}
                    on {table}
                    for all
                    to public
                    using (false)
                    with check (false);
                end if;
            end
            $$;
        """)


def downgrade() -> None:
    for table in PRIVATE_TABLES:
        op.execute(f"drop policy if exists {table}_deny_data_api_access on {table}")

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
