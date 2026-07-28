-- Migration: organization_members — Self-Read RLS V1
--
-- Schließt anon-SELECT auf public.organization_members und führt eine
-- nicht-rekursive Self-Read-Policy für authenticated ein.
--
-- Kontext: Tabelle ist zum Zeitpunkt dieser Migration noch nicht produktiv
-- genutzt (0 Zeilen laut Projektstand). Bestehende Ist-Policies sind nicht
-- vollständig dokumentiert — daher werden alle Policies dynamisch entfernt
-- und durch genau eine V1-Policy ersetzt.
--
-- Enthält ausschließlich:
--   - Entfernung aller bestehenden Policies auf organization_members
--   - REVOKE/GRANT für anon und authenticated
--   - Self-Read-Policy organization_members_select_own_active
--
-- Bewusst unangetastet:
--   - Tabellenschema, Constraints, Indizes, Trigger
--   - Foreign Keys, Composite PK
--   - RLS-Status (bleibt ENABLED)
--   - service_role (Bypass + CRUD serverseitig)
--   - Policies auf anderen Tabellen, /admin, RPCs
--
-- Referenz: docs/fachkonzept/16-auth-und-mandantenkontext-operative-plattform.md
--           ADR-0020
-- Voraussetzung: 20260717410000_organization_members_operativ_v1.sql

-- ---------------------------------------------------------------------------
-- 1. Schema-Vorprüfung
-- ---------------------------------------------------------------------------

do $$
declare
  v_required_column text;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'organization_members'
  ) then
    raise exception
      'organization_members RLS V1: Tabelle public.organization_members fehlt';
  end if;

  foreach v_required_column in array array['user_id', 'aktiv']
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'organization_members'
        and column_name = v_required_column
    ) then
      raise exception
        'organization_members RLS V1: Pflichtspalte public.organization_members.% fehlt — '
        'zuerst 20260717410000_organization_members_operativ_v1.sql ausführen',
        v_required_column;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'organization_members'
      and c.relrowsecurity = true
  ) then
    raise exception
      'organization_members RLS V1: Row Level Security ist nicht aktiviert';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Bestehende Policies entfernen (Namen nicht voraussetzen)
-- ---------------------------------------------------------------------------

do $$
declare
  v_policy record;
begin
  for v_policy in
    select p.polname as policy_name
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'organization_members'
  loop
    execute format(
      'drop policy if exists %I on public.organization_members',
      v_policy.policy_name
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Grants (anon schließen, authenticated nur SELECT)
-- ---------------------------------------------------------------------------

revoke all on table public.organization_members from anon;
revoke all on table public.organization_members from authenticated;
grant select on table public.organization_members to authenticated;

-- service_role: unverändert — serverseitiger Bypass und CRUD für Membership-Verwaltung

-- ---------------------------------------------------------------------------
-- 4. Self-Read-Policy (nicht rekursiv — kein Subquery auf organization_members)
-- ---------------------------------------------------------------------------

create policy organization_members_select_own_active
  on public.organization_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and aktiv = true
  );

comment on policy organization_members_select_own_active
  on public.organization_members is
  'Authenticated liest nur eigene aktive Mitgliedschaften (user_id = auth.uid()). '
  'Keine Rekursion. Schreibzugriff nur serverseitig via service_role.';

-- ---------------------------------------------------------------------------
-- 5. Abschlussprüfung
-- ---------------------------------------------------------------------------

do $$
declare
  v_policy_count integer;
begin
  select count(*)
  into v_policy_count
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'organization_members';

  if v_policy_count <> 1 then
    raise exception
      'organization_members RLS V1: Erwartet genau 1 Policy, gefunden %',
      v_policy_count;
  end if;

  if not exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'organization_members'
      and p.polname = 'organization_members_select_own_active'
  ) then
    raise exception
      'organization_members RLS V1: Policy organization_members_select_own_active fehlt';
  end if;
end;
$$;
