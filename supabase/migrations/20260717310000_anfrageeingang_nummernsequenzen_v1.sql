-- Migration 3.1a: Operative Nummernsequenzen + semantische FK-Umbenennung
--
-- Neue Tabellen:
--   public.eingangsnummer_sequenzen
--   public.vorgangsnummer_sequenzen
--   public.kundennummer_sequenzen
--
-- Anpassung anfrageeingaenge:
--   erzeugter_vorgang_id → zugeordneter_vorgang_id
--   CHECK/FK/Index semantisch umbenannt
--
-- Unverändert: organizations, customers, angebote, M1/M2-Tabellen, /admin-RPCs
-- Keine RLS-Policies für anon/authenticated (Absicht — Service Role serverseitig).
-- Keine Nummernvergabe-Funktionen oder RPCs in M3.1a.
--
-- Referenz: docs/fachkonzept/15-spezifikation-m31-anfrageeingang-serverlogik.md
--           ADR-0019

-- ---------------------------------------------------------------------------
-- 1. Schema-Vorprüfung (anfrageeingaenge)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'anfrageeingaenge'
      and column_name = 'erzeugter_vorgang_id'
  ) then
    raise exception
      'M3.1a: Spalte public.anfrageeingaenge.erzeugter_vorgang_id fehlt — unerwartetes Schema';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'anfrageeingaenge'
      and column_name = 'zugeordneter_vorgang_id'
  ) then
    raise exception
      'M3.1a: Spalte public.anfrageeingaenge.zugeordneter_vorgang_id existiert bereits — '
      'Migration bereits angewendet oder Schema abweichend';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Spaltenumbenennung anfrageeingaenge
-- ---------------------------------------------------------------------------
-- PostgreSQL passt CHECK-, FK- und Index-Definitionen beim RENAME COLUMN automatisch an.

alter table public.anfrageeingaenge
  rename column erzeugter_vorgang_id to zugeordneter_vorgang_id;

comment on column public.anfrageeingaenge.zugeordneter_vorgang_id is
  'Verweis auf den zugeordneten operativen Vorgang — unabhängig davon, ob dieser Eingang '
  'den Vorgang erzeugt hat oder nur zugeordnet wurde (ADR-0019). Mehrere Eingänge dürfen '
  'denselben Vorgang referenzieren.';

-- ---------------------------------------------------------------------------
-- 3. Semantische Umbenennung CHECK, FK und Index
-- ---------------------------------------------------------------------------

alter table public.anfrageeingaenge
  rename constraint anfrageeingaenge_vorgang_status_check
  to anfrageeingaenge_zugeordneter_vorgang_status_check;

comment on constraint anfrageeingaenge_zugeordneter_vorgang_status_check
  on public.anfrageeingaenge is
  'Bidirektional: zugeordneter_vorgang_id IS NOT NULL genau dann status = in_vorgang_ueberfuehrt.';

alter table public.anfrageeingaenge
  rename constraint anfrageeingaenge_mandant_vorgang_fkey
  to anfrageeingaenge_mandant_zugeordneter_vorgang_fkey;

alter index public.idx_anfrageeingaenge_mandant_vorgang
  rename to idx_anfrageeingaenge_zugeordneter_vorgang;

-- ---------------------------------------------------------------------------
-- 4. Tabelle eingangsnummer_sequenzen
-- ---------------------------------------------------------------------------

create table public.eingangsnummer_sequenzen (
  mandant_id uuid not null
    references public.organizations (id) on delete restrict,
  jahr integer not null,
  letzter_wert integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (mandant_id, jahr),
  constraint eingangsnummer_sequenzen_jahr_check
    check (jahr between 2000 and 9999),
  constraint eingangsnummer_sequenzen_letzter_wert_check
    check (letzter_wert >= 0)
);

comment on table public.eingangsnummer_sequenzen is
  'Mandantenbezogene Eingangsnummernsequenz je Kalenderjahr (Format AE-YYYY-NNNN). '
  'Vergabe erst in M3.1b-RPCs — kein Auto-Inkrement in M3.1a.';

-- ---------------------------------------------------------------------------
-- 5. Tabelle vorgangsnummer_sequenzen
-- ---------------------------------------------------------------------------

create table public.vorgangsnummer_sequenzen (
  mandant_id uuid not null
    references public.organizations (id) on delete restrict,
  jahr integer not null,
  letzter_wert integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (mandant_id, jahr),
  constraint vorgangsnummer_sequenzen_jahr_check
    check (jahr between 2000 and 9999),
  constraint vorgangsnummer_sequenzen_letzter_wert_check
    check (letzter_wert >= 0)
);

comment on table public.vorgangsnummer_sequenzen is
  'Mandantenbezogene Vorgangsnummernsequenz je Kalenderjahr (Format VG-YYYY-NNNN). '
  'Vergabe erst bei Vorgangserzeugung in M3.1b-RPCs.';

-- ---------------------------------------------------------------------------
-- 6. Tabelle kundennummer_sequenzen
-- ---------------------------------------------------------------------------

create table public.kundennummer_sequenzen (
  mandant_id uuid primary key
    references public.organizations (id) on delete restrict,
  letzter_wert integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kundennummer_sequenzen_letzter_wert_check
    check (letzter_wert >= 0)
);

comment on table public.kundennummer_sequenzen is
  'Mandantenweit fortlaufende Kundennummernsequenz ohne Jahresreset (Format K-NNNNNN). '
  'Vergabe erst in M3.1b-RPCs. Keine Vermischung mit Admin-Angebotsnummern.';

-- ---------------------------------------------------------------------------
-- 7. updated_at-Trigger (bestehende Funktion set_updated_at)
-- ---------------------------------------------------------------------------

drop trigger if exists eingangsnummer_sequenzen_set_updated_at
  on public.eingangsnummer_sequenzen;
create trigger eingangsnummer_sequenzen_set_updated_at
before update on public.eingangsnummer_sequenzen
for each row execute function public.set_updated_at();

drop trigger if exists vorgangsnummer_sequenzen_set_updated_at
  on public.vorgangsnummer_sequenzen;
create trigger vorgangsnummer_sequenzen_set_updated_at
before update on public.vorgangsnummer_sequenzen
for each row execute function public.set_updated_at();

drop trigger if exists kundennummer_sequenzen_set_updated_at
  on public.kundennummer_sequenzen;
create trigger kundennummer_sequenzen_set_updated_at
before update on public.kundennummer_sequenzen
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Row Level Security (ENABLE only — keine Policies in M3.1a)
-- ---------------------------------------------------------------------------

alter table public.eingangsnummer_sequenzen enable row level security;
alter table public.vorgangsnummer_sequenzen enable row level security;
alter table public.kundennummer_sequenzen enable row level security;
