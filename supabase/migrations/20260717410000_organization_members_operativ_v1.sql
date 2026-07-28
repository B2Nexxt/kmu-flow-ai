-- Migration: organization_members — operative V1-Erweiterung
--
-- Erweitert die vorbestehende Tabelle public.organization_members für den
-- operativen Mandantenkontext (Auth-Sprint). Greenfield-Rollen-CHECK auf Basis
-- leerer Tabelle (0 Zeilen zum Zeitpunkt der Spezifikation).
--
-- Enthält ausschließlich:
--   - Spalten aktiv, updated_at
--   - Entfernung role-Default
--   - Austausch Rollen-CHECK (Legacy → operative V1-Rollen)
--   - Index auf user_id
--   - updated_at-Trigger
--
-- Bewusst unangetastet:
--   - Composite PK (organization_id, user_id)
--   - bestehende Foreign Keys (kein ON DELETE geändert)
--   - RLS-Status, Policies, Grants
--   - organizations, customers, angebote, operative Fachtabellen, RPCs, /admin
--
-- RLS-Hinweis: Bestehende Policies werden in diesem Schritt nicht geändert.
-- Self-Read-Policy und operative RLS-Policies folgen in separater Migration.
-- Eine mögliche anon-SELECT-Freigabe wird im nächsten Schritt geschlossen.
--
-- Referenz: docs/fachkonzept/16-auth-und-mandantenkontext-operative-plattform.md
--           ADR-0020

-- ---------------------------------------------------------------------------
-- 1. Schema-Vorprüfung
-- ---------------------------------------------------------------------------

do $$
declare
  v_required_column text;
  v_role_check_count integer;
  v_role_check_name text;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'organization_members'
  ) then
    raise exception
      'organization_members V1: Tabelle public.organization_members fehlt';
  end if;

  foreach v_required_column in array array[
    'organization_id', 'user_id', 'role', 'created_at'
  ]
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'organization_members'
        and column_name = v_required_column
    ) then
      raise exception
        'organization_members V1: Pflichtspalte public.organization_members.% fehlt',
        v_required_column;
    end if;
  end loop;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_members'
      and column_name = 'aktiv'
  ) then
    raise exception
      'organization_members V1: Spalte aktiv existiert bereits — '
      'Migration vermutlich bereits angewendet';
  end if;

  if exists (
    select 1
    from public.organization_members
    limit 1
  ) then
    raise exception
      'organization_members V1: Tabelle ist nicht leer — '
      'Greenfield-Rollenänderung erfordert 0 Zeilen; kein automatisches Mapping';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
  ) then
    raise exception
      'organization_members V1: public.set_updated_at() fehlt — '
      'zuerst Mandanten-Onboarding-Migration ausführen';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Spalte aktiv
-- ---------------------------------------------------------------------------

alter table public.organization_members
  add column aktiv boolean not null default true;

comment on column public.organization_members.aktiv is
  'Mitgliedschaft ist nur bei aktiv=true für den operativen Mandantenkontext verwendbar.';

-- ---------------------------------------------------------------------------
-- 3. Spalte updated_at
-- ---------------------------------------------------------------------------

alter table public.organization_members
  add column updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 4. Rollen-Default entfernen (explizite Rolle pro Mitgliedschaft)
-- ---------------------------------------------------------------------------

alter table public.organization_members
  alter column role drop default;

-- ---------------------------------------------------------------------------
-- 5. Rollen-CHECK ersetzen (Legacy member/admin/owner → operative V1-Rollen)
-- ---------------------------------------------------------------------------

do $$
declare
  v_role_check_count integer;
  v_role_check_name text;
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'organization_members_operative_role_check'
      and conrelid = 'public.organization_members'::regclass
  ) then
    raise exception
      'organization_members V1: Constraint organization_members_operative_role_check '
      'existiert bereits — Migration vermutlich bereits angewendet';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'organization_members_role_check'
      and conrelid = 'public.organization_members'::regclass
  ) then
    alter table public.organization_members
      drop constraint organization_members_role_check;
  else
    select count(*), min(c.conname)
    into v_role_check_count, v_role_check_name
    from pg_constraint c
    where c.conrelid = 'public.organization_members'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~* '[[:<:]]role[[:>:]]';

    if v_role_check_count > 1 then
      raise exception
        'organization_members V1: Mehrere CHECK-Constraints auf role gefunden — '
        'manuell klären, bevor ein neuer Rollen-CHECK angelegt wird';
    end if;

    if v_role_check_count = 1 then
      execute format(
        'alter table public.organization_members drop constraint %I',
        v_role_check_name
      );
    end if;
  end if;
end;
$$;

alter table public.organization_members
  add constraint organization_members_operative_role_check
  check (role in (
    'mandanten_admin',
    'buero',
    'bauleiter',
    'monteur'
  ));

comment on constraint organization_members_operative_role_check
  on public.organization_members is
  'Operative V1-Rollen für Mandantenmitgliedschaft (ADR-0020). '
  'Legacy-Werte member/admin/owner sind nicht mehr erlaubt.';

-- ---------------------------------------------------------------------------
-- 6. Index user_id (Membership-Lookups über auth.uid())
-- ---------------------------------------------------------------------------

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

-- ---------------------------------------------------------------------------
-- 7. updated_at-Trigger
-- ---------------------------------------------------------------------------

drop trigger if exists organization_members_set_updated_at
  on public.organization_members;

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();
