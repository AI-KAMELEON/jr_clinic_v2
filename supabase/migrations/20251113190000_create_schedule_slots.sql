-- Create schedule slots table for 15-minute availability units used by the voice agent
create table if not exists public.schedule_slots (
    id uuid primary key default gen_random_uuid(),
    resource_id uuid,
    slot_date date not null,
    slot_start time not null,
    slot_end time not null,
    slot_unit_minutes integer not null default 15,
    slot_group_id uuid,
    status text not null default 'free',
    linked_wizyta_id uuid,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists schedule_slots_unique_idx
    on public.schedule_slots (
        coalesce(resource_id, '00000000-0000-0000-0000-000000000000'::uuid),
        slot_date,
        slot_start
    );

alter table public.schedule_slots
    add constraint schedule_slots_wizyta_fkey
    foreign key (linked_wizyta_id)
    references public.wizyty (id)
    on delete set null;

create index if not exists schedule_slots_resource_date_idx
    on public.schedule_slots (resource_id, slot_date, status);

create index if not exists schedule_slots_status_idx
    on public.schedule_slots (status);

create index if not exists schedule_slots_linked_idx
    on public.schedule_slots (linked_wizyta_id);

-- Updated_at trigger
create or replace function update_schedule_slots_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_schedule_slots_updated_at on public.schedule_slots;
create trigger trigger_update_schedule_slots_updated_at
    before update on public.schedule_slots
    for each row
    execute function update_schedule_slots_updated_at();

-- Enable RLS and policies
alter table public.schedule_slots enable row level security;

create policy "Schedule slots read for authenticated"
    on public.schedule_slots
    for select
    to authenticated
    using (true);

create policy "Schedule slots full access for service role"
    on public.schedule_slots
    for all
    to service_role
    using (true)
    with check (true);

grant all on public.schedule_slots to service_role;
grant select on public.schedule_slots to authenticated;

