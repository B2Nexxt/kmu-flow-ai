-- Migration: Operative Read-RLS V1 — anfrageeingaenge, vorgaenge, vorgang_beteiligte
--
-- Führt SELECT-Policies für authenticated ein (Membership über organization_members).
-- Keine Schreib-Policies — Fachschreibvorgänge bleiben serverseitig via service_role/RPCs.
--
-- Mandantenverhalten:
--   RLS erlaubt Lesezugriff auf alle Mandanten mit aktiver Mitgliedschaft.
--   Die UI filtert zusätzlich serverseitig auf ctx.mandantId (.eq('mandant_id', …)).
--   Der HttpOnly-Cookie ist für RLS nicht sichtbar — kein Ersatz für Membership-Prüfung.
--
-- Rekursion:
--   organization_members: Self-Read (user_id = auth.uid(), aktiv = true) — unverändert.
--   Fachtabellen: EXISTS auf organization_members (nur lesend).
--   Keine Rückabfrage von organization_members auf Fachtabellen → keine Zirkularität.
--
-- Enthält ausschließlich RLS/Grants für:
--   public.anfrageeingaenge
--   public.vorgaenge
--   public.vorgang_beteiligte
--
-- Bewusst unangetastet:
--   organization_members (Policies/Grants)
--   kunden, adressen, gebaeude, einheiten, kunden_objekt_beziehungen
--   RPCs, /admin, Tabellenschema
--
-- Referenz: docs/fachkonzept/16-auth-und-mandantenkontext-operative-plattform.md
--           ADR-0020
-- Voraussetzung: 20260717420000_organization_members_self_rls_v1.sql

-- ---------------------------------------------------------------------------
-- 1. Schema-Vorprüfung
-- ---------------------------------------------------------------------------

do $$
declare
  v_table text;
  v_required_column text;
begin
  foreach v_table in array array[
    'anfrageeingaenge',
    'vorgaenge',
    'vorgang_beteiligte'
  ]
  loop
    if not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = v_table
    ) then
      raise exception
        'operative Read RLS V1: Tabelle public.% fehlt',
        v_table;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = 'mandant_id'
    ) then
      raise exception
        'operative Read RLS V1: Spalte public.%.mandant_id fehlt',
        v_table;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
        and c.relrowsecurity = true
    ) then
      raise exception
        'operative Read RLS V1: RLS ist nicht aktiviert auf public.%',
        v_table;
    end if;
  end loop;

  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'organization_members'
  ) then
    raise exception
      'operative Read RLS V1: Tabelle public.organization_members fehlt';
  end if;

  foreach v_required_column in array array[
    'user_id', 'organization_id', 'aktiv'
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
        'operative Read RLS V1: Spalte public.organization_members.% fehlt',
        v_required_column;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'anfrageeingaenge'
      and p.polname = 'anfrageeingaenge_select_active_members'
  ) then
    raise exception
      'operative Read RLS V1: Policy anfrageeingaenge_select_active_members existiert bereits — '
      'Migration vermutlich bereits angewendet';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Bestehende Policies entfernen (Namen nicht voraussetzen)
-- ---------------------------------------------------------------------------

do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'anfrageeingaenge',
    'vorgaenge',
    'vorgang_beteiligte'
  ]
  loop
    for v_policy in
      select p.polname as policy_name
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_table
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        v_policy.policy_name,
        v_table
      );
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Grants (anon schließen, authenticated nur SELECT)
-- ---------------------------------------------------------------------------

revoke all on table public.anfrageeingaenge from anon;
revoke all on table public.anfrageeingaenge from authenticated;
grant select on table public.anfrageeingaenge to authenticated;

revoke all on table public.vorgaenge from anon;
revoke all on table public.vorgaenge from authenticated;
grant select on table public.vorgaenge to authenticated;

revoke all on table public.vorgang_beteiligte from anon;
revoke all on table public.vorgang_beteiligte from authenticated;
grant select on table public.vorgang_beteiligte to authenticated;

-- service_role: unverändert — Bypass + serverseitiges CRUD/RPC

-- ---------------------------------------------------------------------------
-- 4. SELECT-Policies (Membership, keine Rollenfilter in V1)
-- ---------------------------------------------------------------------------

create policy anfrageeingaenge_select_active_members
  on public.anfrageeingaenge
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = anfrageeingaenge.mandant_id
        and om.aktiv = true
    )
  );

comment on policy anfrageeingaenge_select_active_members
  on public.anfrageeingaenge is
  'Authenticated SELECT bei aktiver Mandantenmitgliedschaft. UI filtert zusätzlich ctx.mandantId.';

create policy vorgaenge_select_active_members
  on public.vorgaenge
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = vorgaenge.mandant_id
        and om.aktiv = true
    )
  );

comment on policy vorgaenge_select_active_members
  on public.vorgaenge is
  'Authenticated SELECT bei aktiver Mandantenmitgliedschaft. UI filtert zusätzlich ctx.mandantId.';

create policy vorgang_beteiligte_select_active_members
  on public.vorgang_beteiligte
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = vorgang_beteiligte.mandant_id
        and om.aktiv = true
    )
  );

comment on policy vorgang_beteiligte_select_active_members
  on public.vorgang_beteiligte is
  'Authenticated SELECT bei aktiver Mandantenmitgliedschaft. UI filtert zusätzlich ctx.mandantId.';

-- ---------------------------------------------------------------------------
-- 5. Abschlussprüfung
-- ---------------------------------------------------------------------------

do $$
declare
  v_check record;
  v_policy_count integer;
begin
  for v_check in
    select *
    from (
      values
        ('anfrageeingaenge', 'anfrageeingaenge_select_active_members'),
        ('vorgaenge', 'vorgaenge_select_active_members'),
        ('vorgang_beteiligte', 'vorgang_beteiligte_select_active_members')
    ) as checks (table_name, policy_name)
  loop
    select count(*)
    into v_policy_count
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = v_check.table_name;

    if v_policy_count <> 1 then
      raise exception
        'operative Read RLS V1: public.% — erwartet genau 1 Policy, gefunden %',
        v_check.table_name,
        v_policy_count;
    end if;

    if not exists (
      select 1
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_check.table_name
        and p.polname = v_check.policy_name
    ) then
      raise exception
        'operative Read RLS V1: Policy % auf public.% fehlt',
        v_check.policy_name,
        v_check.table_name;
    end if;
  end loop;
end;
$$;
