create table if not exists public.face_clients (
    id serial primary key,
    tenant_id varchar(64) not null unique,
    name varchar(200) not null,
    api_key_hash varchar(64) not null unique,
    is_active boolean not null default true,
    created_at timestamp without time zone default now(),
    updated_at timestamp without time zone default now()
);

create index if not exists ix_face_clients_id on public.face_clients (id);
create index if not exists ix_face_clients_tenant_id on public.face_clients (tenant_id);
create index if not exists ix_face_clients_api_key_hash on public.face_clients (api_key_hash);

create table if not exists public.face_subjects (
    id serial primary key,
    tenant_id varchar(64) not null,
    external_subject_id varchar(128) not null,
    display_name varchar(200) not null,
    metadata json,
    is_active boolean not null default true,
    created_at timestamp without time zone default now(),
    updated_at timestamp without time zone default now(),
    constraint uq_face_subjects_tenant_external_id unique (tenant_id, external_subject_id)
);

create index if not exists ix_face_subjects_id on public.face_subjects (id);
create index if not exists ix_face_subjects_tenant_id on public.face_subjects (tenant_id);
create index if not exists ix_face_subjects_external_subject_id on public.face_subjects (external_subject_id);
create index if not exists ix_face_subjects_tenant_active on public.face_subjects (tenant_id, is_active);

create table if not exists public.face_templates (
    id serial primary key,
    tenant_id varchar(64) not null,
    subject_id integer not null references public.face_subjects(id) on delete cascade,
    embedding bytea not null,
    photo_url varchar(500) not null,
    model_name varchar(100) not null default 'face_recognition',
    embedding_version varchar(32) not null default 'v1',
    is_primary boolean not null default false,
    created_at timestamp without time zone default now()
);

create index if not exists ix_face_templates_id on public.face_templates (id);
create index if not exists ix_face_templates_tenant_id on public.face_templates (tenant_id);
create index if not exists ix_face_templates_subject_id on public.face_templates (subject_id);
create index if not exists ix_face_templates_tenant_subject on public.face_templates (tenant_id, subject_id);
create index if not exists ix_face_templates_embedding_version on public.face_templates (embedding_version, model_name);

alter table public.face_clients enable row level security;
alter table public.face_subjects enable row level security;
alter table public.face_templates enable row level security;

insert into public.face_subjects (tenant_id, external_subject_id, display_name, metadata, is_active, created_at, updated_at)
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
from public.employees e
on conflict (tenant_id, external_subject_id) do update set
    display_name = excluded.display_name,
    metadata = excluded.metadata,
    is_active = excluded.is_active,
    updated_at = excluded.updated_at;

insert into public.face_templates (
    tenant_id,
    subject_id,
    embedding,
    photo_url,
    model_name,
    embedding_version,
    is_primary,
    created_at
)
select
    fe.tenant_id,
    fs.id,
    fe.embedding,
    fe.photo_url,
    fe.model_name,
    fe.embedding_version,
    fe.is_primary,
    fe.created_at
from public.face_embeddings fe
join public.employees e on e.id = fe.employee_id
join public.face_subjects fs on fs.tenant_id = e.tenant_id and fs.external_subject_id = e.id::text
where not exists (
    select 1
    from public.face_templates existing
    where existing.tenant_id = fe.tenant_id
      and existing.subject_id = fs.id
      and existing.photo_url = fe.photo_url
);
