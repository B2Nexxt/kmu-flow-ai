-- MVP: Mandanten-Onboarding Persistierung (Phase 2)
--
-- Ausgangslage organizations: id, name, created_at
-- Zentrale Tabelle: organizations (= Mandant + Hauptunternehmen im MVP)
-- Unverändert: customers, organization_members
--
-- Neue Tabellen (FK → organizations.id):
--   ansprechpartner, bankverbindungen, organization_modules, organization_automatisierungen

-- Legacy-Bereinigung: parallele Tabellen aus früherer Entwurfs-Migration
drop table if exists public.mandant_automatisierungen cascade;
drop table if exists public.mandant_module cascade;
drop table if exists public.unternehmen cascade;
drop table if exists public.mandanten cascade;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- organizations erweitern (bestehende Spalten id, name, created_at bleiben unberührt)
alter table public.organizations
  add column if not exists updated_at timestamptz,
  add column if not exists status text,
  add column if not exists einrichtungsgebuehr text,
  add column if not exists monatlicher_grundpreis text,
  add column if not exists rabatt_in_prozent text,
  add column if not exists vertragslaufzeit text,
  add column if not exists abrechnungsbeginn date,
  add column if not exists individuelle_automatisierungswuensche text,
  add column if not exists rechtsform text,
  add column if not exists strasse text,
  add column if not exists hausnummer text,
  add column if not exists plz text,
  add column if not exists ort text,
  add column if not exists land text,
  add column if not exists website text,
  add column if not exists telefon_vorwahl text,
  add column if not exists telefon_nummer text,
  add column if not exists email text,
  add column if not exists steuernummer text,
  add column if not exists umsatzsteuer_id text,
  add column if not exists handelsregisternummer text,
  add column if not exists registergericht text;

update public.organizations
set updated_at = created_at
where updated_at is null;

alter table public.organizations
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_status_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_status_check
      check (status is null or status in ('interessent', 'aktiver_mandant'));
  end if;
end;
$$;

create table if not exists public.ansprechpartner (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  vorname text not null,
  nachname text not null,
  position text,
  email text,
  telefon_vorwahl text,
  telefon_nummer text,
  ist_geschaeftsfuehrer boolean not null default false,
  ist_hauptansprechpartner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bankverbindungen (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  kontoinhaber text not null,
  bankname text not null,
  iban text not null,
  bic text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  modul text not null,
  unique (organization_id, modul)
);

create table if not exists public.organization_automatisierungen (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  automatisierung text not null,
  unique (organization_id, automatisierung)
);

create index if not exists idx_ansprechpartner_organization_id
  on public.ansprechpartner (organization_id);

create index if not exists idx_bankverbindungen_organization_id
  on public.bankverbindungen (organization_id);

create index if not exists idx_organization_modules_organization_id
  on public.organization_modules (organization_id);

create index if not exists idx_organization_automatisierungen_organization_id
  on public.organization_automatisierungen (organization_id);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists ansprechpartner_set_updated_at on public.ansprechpartner;
create trigger ansprechpartner_set_updated_at
before update on public.ansprechpartner
for each row execute function public.set_updated_at();

drop trigger if exists bankverbindungen_set_updated_at on public.bankverbindungen;
create trigger bankverbindungen_set_updated_at
before update on public.bankverbindungen
for each row execute function public.set_updated_at();

create or replace function public.create_mandant_onboarding(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_contact jsonb;
  v_abrechnungsbeginn date;
begin
  if payload is null then
    raise exception 'Payload fehlt';
  end if;

  if nullif(trim(payload->>'status'), '') is null then
    raise exception 'Status fehlt';
  end if;

  if nullif(trim(payload #>> '{unternehmen,firmenname}'), '') is null then
    raise exception 'Firmenname fehlt';
  end if;

  if nullif(trim(payload->>'abrechnungsbeginn'), '') is not null then
    v_abrechnungsbeginn := (payload->>'abrechnungsbeginn')::date;
  end if;

  insert into public.organizations (
    name,
    status,
    einrichtungsgebuehr,
    monatlicher_grundpreis,
    rabatt_in_prozent,
    vertragslaufzeit,
    abrechnungsbeginn,
    individuelle_automatisierungswuensche,
    rechtsform,
    strasse,
    hausnummer,
    plz,
    ort,
    land,
    website,
    telefon_vorwahl,
    telefon_nummer,
    email,
    steuernummer,
    umsatzsteuer_id,
    handelsregisternummer,
    registergericht
  )
  values (
    payload #>> '{unternehmen,firmenname}',
    payload->>'status',
    nullif(trim(payload->>'einrichtungsgebuehr'), ''),
    nullif(trim(payload->>'monatlicher_grundpreis'), ''),
    nullif(trim(payload->>'rabatt_in_prozent'), ''),
    nullif(trim(payload->>'vertragslaufzeit'), ''),
    v_abrechnungsbeginn,
    nullif(trim(payload->>'individuelle_automatisierungswuensche'), ''),
    payload #>> '{unternehmen,rechtsform}',
    payload #>> '{unternehmen,strasse}',
    nullif(trim(payload #>> '{unternehmen,hausnummer}'), ''),
    payload #>> '{unternehmen,plz}',
    payload #>> '{unternehmen,ort}',
    payload #>> '{unternehmen,land}',
    nullif(trim(payload #>> '{unternehmen,website}'), ''),
    nullif(trim(payload #>> '{unternehmen,telefon_vorwahl}'), ''),
    nullif(trim(payload #>> '{unternehmen,telefon_nummer}'), ''),
    nullif(trim(payload #>> '{unternehmen,email}'), ''),
    nullif(trim(payload #>> '{steuerdaten,steuernummer}'), ''),
    nullif(trim(payload #>> '{steuerdaten,umsatzsteuer_id}'), ''),
    nullif(trim(payload #>> '{steuerdaten,handelsregisternummer}'), ''),
    nullif(trim(payload #>> '{steuerdaten,registergericht}'), '')
  )
  returning id into v_organization_id;

  for v_contact in
    select value from jsonb_array_elements(coalesce(payload->'contacts', '[]'::jsonb))
  loop
    insert into public.ansprechpartner (
      organization_id,
      vorname,
      nachname,
      position,
      email,
      telefon_vorwahl,
      telefon_nummer,
      ist_geschaeftsfuehrer,
      ist_hauptansprechpartner
    )
    values (
      v_organization_id,
      v_contact->>'vorname',
      v_contact->>'nachname',
      nullif(trim(v_contact->>'position'), ''),
      nullif(trim(v_contact->>'email'), ''),
      nullif(trim(v_contact->>'telefon_vorwahl'), ''),
      nullif(trim(v_contact->>'telefon_nummer'), ''),
      coalesce((v_contact->>'ist_geschaeftsfuehrer')::boolean, false),
      coalesce((v_contact->>'ist_hauptansprechpartner')::boolean, false)
    );
  end loop;

  if payload->'bankverbindung' is not null
     and payload->'bankverbindung' <> 'null'::jsonb then
    insert into public.bankverbindungen (
      organization_id,
      kontoinhaber,
      bankname,
      iban,
      bic
    )
    values (
      v_organization_id,
      payload #>> '{bankverbindung,kontoinhaber}',
      payload #>> '{bankverbindung,bankname}',
      payload #>> '{bankverbindung,iban}',
      payload #>> '{bankverbindung,bic}'
    );
  end if;

  insert into public.organization_modules (organization_id, modul)
  select v_organization_id, value::text
  from jsonb_array_elements_text(coalesce(payload->'module', '[]'::jsonb));

  insert into public.organization_automatisierungen (organization_id, automatisierung)
  select v_organization_id, value::text
  from jsonb_array_elements_text(coalesce(payload->'automatisierungen', '[]'::jsonb));

  return v_organization_id;
exception
  when others then
    raise;
end;
$$;

grant execute on function public.create_mandant_onboarding(jsonb) to service_role;
