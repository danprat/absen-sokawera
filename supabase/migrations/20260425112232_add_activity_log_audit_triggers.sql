alter type auditaction add value if not exists 'LOGIN';

create schema if not exists app_private;

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

revoke all on function app_private.write_audit_log() from public, anon, authenticated;

drop trigger if exists trg_audit_employees on public.employees;
create trigger trg_audit_employees after insert or update or delete on public.employees for each row execute function app_private.write_audit_log();

drop trigger if exists trg_audit_attendance_logs on public.attendance_logs;
create trigger trg_audit_attendance_logs after insert or update or delete on public.attendance_logs for each row execute function app_private.write_audit_log();

drop trigger if exists trg_audit_work_settings on public.work_settings;
create trigger trg_audit_work_settings after insert or update or delete on public.work_settings for each row execute function app_private.write_audit_log();

drop trigger if exists trg_audit_holidays on public.holidays;
create trigger trg_audit_holidays after insert or update or delete on public.holidays for each row execute function app_private.write_audit_log();

drop trigger if exists trg_audit_daily_work_schedules on public.daily_work_schedules;
create trigger trg_audit_daily_work_schedules after insert or update or delete on public.daily_work_schedules for each row execute function app_private.write_audit_log();

drop trigger if exists trg_audit_admins on public.admins;
create trigger trg_audit_admins after insert or update or delete on public.admins for each row execute function app_private.write_audit_log();

drop trigger if exists trg_audit_service_types on public.service_types;
create trigger trg_audit_service_types after insert or update or delete on public.service_types for each row execute function app_private.write_audit_log();

drop trigger if exists trg_audit_survey_questions on public.survey_questions;
create trigger trg_audit_survey_questions after insert or update or delete on public.survey_questions for each row execute function app_private.write_audit_log();

drop trigger if exists trg_audit_survey_responses on public.survey_responses;
create trigger trg_audit_survey_responses after insert or update or delete on public.survey_responses for each row execute function app_private.write_audit_log();

drop trigger if exists trg_audit_guest_book_entries on public.guest_book_entries;
create trigger trg_audit_guest_book_entries after insert or update or delete on public.guest_book_entries for each row execute function app_private.write_audit_log();

drop trigger if exists trg_audit_guest_book_meeting_targets on public.guest_book_meeting_targets;
create trigger trg_audit_guest_book_meeting_targets after insert or update or delete on public.guest_book_meeting_targets for each row execute function app_private.write_audit_log();
