"""Add activity log triggers for Supabase migration.

Revision ID: 20260425_0003
Revises: 20260425_0002
Create Date: 2026-04-25
"""

from alembic import op


revision = "20260425_0003"
down_revision = "20260425_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("alter type auditaction add value if not exists 'LOGIN'")
    op.execute("create schema if not exists app_private")
    op.execute(
        """
        create or replace function app_private.write_audit_log()
        returns trigger
        language plpgsql
        security definer
        set search_path = public
        as $$
        declare
          v_action auditaction;
          v_entity entitytype;
          v_entity_id integer;
          v_description text;
          v_name text;
        begin
          v_action := case tg_op
            when 'INSERT' then 'CREATE'::auditaction
            when 'UPDATE' then 'UPDATE'::auditaction
            when 'DELETE' then 'DELETE'::auditaction
          end;

          v_entity := case tg_table_name
            when 'employees' then 'EMPLOYEE'::entitytype
            when 'attendance_logs' then 'ATTENDANCE'::entitytype
            when 'work_settings' then 'SETTINGS'::entitytype
            when 'holidays' then 'HOLIDAY'::entitytype
            when 'daily_work_schedules' then 'DAILY_SCHEDULE'::entitytype
            when 'admins' then 'ADMIN'::entitytype
            when 'service_types' then 'SERVICE_TYPE'::entitytype
            when 'survey_questions' then 'SURVEY_QUESTION'::entitytype
            when 'survey_responses' then 'SURVEY_RESPONSE'::entitytype
            when 'guest_book_entries' then 'GUESTBOOK'::entitytype
            when 'guest_book_meeting_targets' then 'GUESTBOOK'::entitytype
            else null
          end;

          if v_entity is null then
            return coalesce(new, old);
          end if;

          v_entity_id := coalesce((to_jsonb(new)->>'id')::integer, (to_jsonb(old)->>'id')::integer);
          v_name := coalesce(
            to_jsonb(new)->>'name',
            to_jsonb(old)->>'name',
            to_jsonb(new)->>'username',
            to_jsonb(old)->>'username',
            to_jsonb(new)->>'village_name',
            to_jsonb(old)->>'village_name',
            v_entity_id::text
          );

          v_description := case tg_op
            when 'INSERT' then 'Menambahkan ' || lower(v_entity::text) || ': ' || coalesce(v_name, v_entity_id::text)
            when 'UPDATE' then 'Mengupdate ' || lower(v_entity::text) || ': ' || coalesce(v_name, v_entity_id::text)
            when 'DELETE' then 'Menghapus ' || lower(v_entity::text) || ': ' || coalesce(v_name, v_entity_id::text)
          end;

          insert into public.audit_logs (action, entity_type, entity_id, description, performed_by, details)
          values (v_action, v_entity, v_entity_id, v_description, 'system', json_build_object('table', tg_table_name, 'operation', tg_op));

          return coalesce(new, old);
        end;
        $$;
        """
    )
    op.execute("revoke all on function app_private.write_audit_log() from public, anon, authenticated")

    for table in (
        "employees",
        "attendance_logs",
        "work_settings",
        "holidays",
        "daily_work_schedules",
        "admins",
        "service_types",
        "survey_questions",
        "survey_responses",
        "guest_book_entries",
        "guest_book_meeting_targets",
    ):
        op.execute(f"drop trigger if exists trg_audit_{table} on public.{table}")
        op.execute(
            f"""
            create trigger trg_audit_{table}
            after insert or update or delete on public.{table}
            for each row execute function app_private.write_audit_log()
            """
        )


def downgrade() -> None:
    for table in (
        "guest_book_meeting_targets",
        "guest_book_entries",
        "survey_responses",
        "survey_questions",
        "service_types",
        "admins",
        "daily_work_schedules",
        "holidays",
        "work_settings",
        "attendance_logs",
        "employees",
    ):
        op.execute(f"drop trigger if exists trg_audit_{table} on public.{table}")
    op.execute("drop function if exists app_private.write_audit_log()")
