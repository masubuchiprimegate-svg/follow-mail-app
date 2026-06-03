create extension if not exists "pgcrypto";

create type lead_temperature as enum (
  'ready_to_propose',
  'relationship_building',
  'low_interest'
);

create type lead_status as enum (
  'not_created',
  'draft_created',
  'sent',
  'replied'
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  exhibition_name text not null,
  conversation_memo text not null default '',
  temperature lead_temperature not null default 'relationship_building',
  next_follow_up_date date,
  status lead_status not null default 'not_created',
  outlook_draft_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  subject text not null,
  body text not null,
  outlook_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_status_idx on public.leads(status);
create index leads_next_follow_up_date_idx on public.leads(next_follow_up_date);
create index email_drafts_lead_id_idx on public.email_drafts(lead_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create trigger set_email_drafts_updated_at
before update on public.email_drafts
for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
alter table public.email_drafts enable row level security;

-- MVP note:
-- This app uses SUPABASE_SERVICE_ROLE_KEY only from Next.js Route Handlers.
-- Add user auth and owner_id columns before exposing per-user data in production.
