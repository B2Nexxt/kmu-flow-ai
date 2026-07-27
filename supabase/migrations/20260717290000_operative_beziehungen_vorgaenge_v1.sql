-- Migration 2: Operative Beziehungen und Vorgangskontext (Kundenplattform /)
--
-- Ergänzt M1-Tabellen:
--   kunden.kundenstatus, UNIQUE (mandant_id, id)
--   einheiten UNIQUE (mandant_id, id), UNIQUE (mandant_id, gebaeude_id, id)
--
-- Neue Tabellen:
--   kunden_objekt_beziehungen, vorgaenge, vorgang_beteiligte
--
-- Unverändert: organizations, customers, angebote, organization_members, /admin-RPCs
-- Keine RLS-Policies für anon/authenticated (Absicht — Service Role serverseitig).
--
-- Referenz: docs/fachkonzept/13-spezifikation-migration-2-beziehungen-und-vorgaenge.md
--           ADR-0013, ADR-0014, ADR-0015, ADR-0016, ADR-0017

-- ---------------------------------------------------------------------------
-- 1. Ergänzungen public.kunden
-- ---------------------------------------------------------------------------

alter table public.kunden
  add column if not exists kundenstatus text not null default 'bestaetigt';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kunden_kundenstatus_check'
      and conrelid = 'public.kunden'::regclass
  ) then
    alter table public.kunden
      add constraint kunden_kundenstatus_check
      check (kundenstatus in ('vorlaeufig', 'bestaetigt'));
  end if;
end;
$$;

create unique index if not exists kunden_mandant_id_id_key
  on public.kunden (mandant_id, id);

comment on column public.kunden.kundenstatus is
  'vorlaeufig = unvollständig/unbestätigt; bestaetigt = identität geklärt (ADR-0017).';

-- ---------------------------------------------------------------------------
-- 2. Ergänzungen public.einheiten (Composite-FK-Parent-Keys)
-- ---------------------------------------------------------------------------

create unique index if not exists einheiten_mandant_id_id_key
  on public.einheiten (mandant_id, id);

create unique index if not exists einheiten_mandant_gebaeude_id_key
  on public.einheiten (mandant_id, gebaeude_id, id);

-- ---------------------------------------------------------------------------
-- 3. Tabelle kunden_objekt_beziehungen
-- ---------------------------------------------------------------------------

create table if not exists public.kunden_objekt_beziehungen (
  id uuid primary key default gen_random_uuid(),
  mandant_id uuid not null references public.organizations (id) on delete restrict,
  kunde_id uuid not null,
  gebaeude_id uuid not null,
  einheit_id uuid,
  rolle text not null,
  gueltig_ab date not null,
  gueltig_bis date,
  aktiv boolean not null default true,
  quelle text,
  bestaetigt_am timestamptz,
  notizen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kunden_objekt_beziehungen_rolle_check
    check (rolle in (
      'eigentuemer',
      'mieter',
      'hausverwaltung',
      'nutzer',
      'sonstiges'
    )),
  constraint kunden_objekt_beziehungen_gueltig_check
    check (gueltig_bis is null or gueltig_bis >= gueltig_ab),
  constraint kunden_objekt_beziehungen_aktiv_beendet_check
    check (aktiv = true or gueltig_bis is not null),
  constraint kunden_objekt_beziehungen_quelle_not_empty_if_set
    check (quelle is null or length(trim(quelle)) > 0),
  constraint kunden_objekt_beziehungen_notizen_not_empty_if_set
    check (notizen is null or length(trim(notizen)) > 0),
  constraint kunden_objekt_beziehungen_mandant_kunde_fkey
    foreign key (mandant_id, kunde_id)
    references public.kunden (mandant_id, id)
    on delete restrict,
  constraint kunden_objekt_beziehungen_mandant_gebaeude_fkey
    foreign key (mandant_id, gebaeude_id)
    references public.gebaeude (mandant_id, id)
    on delete restrict,
  constraint kunden_objekt_beziehungen_mandant_gebaeude_einheit_fkey
    foreign key (mandant_id, gebaeude_id, einheit_id)
    references public.einheiten (mandant_id, gebaeude_id, id)
    match simple
    on delete restrict
);

comment on table public.kunden_objekt_beziehungen is
  'Dauerhafte/zeitliche Rollen Kunde ↔ Gebäude/Einheit. Mehrere Mieter pro Einheit erlaubt (WG). '
  'Composite-FK (mandant_id, gebaeude_id, einheit_id): bei einheit_id NULL greift nur Gebäude-FK.';

create unique index if not exists kunden_objekt_beziehungen_aktiv_einheit_key
  on public.kunden_objekt_beziehungen (mandant_id, kunde_id, gebaeude_id, einheit_id, rolle)
  where aktiv = true and einheit_id is not null;

create unique index if not exists kunden_objekt_beziehungen_aktiv_gebaeude_key
  on public.kunden_objekt_beziehungen (mandant_id, kunde_id, gebaeude_id, rolle)
  where aktiv = true and einheit_id is null;

create index if not exists idx_kunden_objekt_beziehungen_mandant_kunde
  on public.kunden_objekt_beziehungen (mandant_id, kunde_id);

create index if not exists idx_kunden_objekt_beziehungen_mandant_gebaeude
  on public.kunden_objekt_beziehungen (mandant_id, gebaeude_id);

create index if not exists idx_kunden_objekt_beziehungen_mandant_einheit
  on public.kunden_objekt_beziehungen (mandant_id, einheit_id)
  where einheit_id is not null;

create index if not exists idx_kunden_objekt_beziehungen_mandant_rolle_aktiv
  on public.kunden_objekt_beziehungen (mandant_id, rolle, aktiv);

create index if not exists idx_kunden_objekt_beziehungen_mandant_gueltig
  on public.kunden_objekt_beziehungen (mandant_id, gueltig_ab, gueltig_bis);

-- ---------------------------------------------------------------------------
-- 4. Tabelle vorgaenge
-- ---------------------------------------------------------------------------

create table if not exists public.vorgaenge (
  id uuid primary key default gen_random_uuid(),
  mandant_id uuid not null references public.organizations (id) on delete restrict,
  vorgangsnummer text not null,
  vorgangstyp text not null,
  status text not null default 'neu',
  gebaeude_id uuid not null,
  einheit_id uuid,
  parent_vorgang_id uuid,
  titel text not null,
  beschreibung text,
  quelle text,
  prioritaet text not null default 'normal',
  eingegangen_am timestamptz not null default now(),
  beendet_am timestamptz,
  aktiv boolean not null default true,
  archiviert_am timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vorgaenge_mandant_id_id_key unique (mandant_id, id),
  constraint vorgaenge_vorgangstyp_check
    check (vorgangstyp in (
      'anfrage',
      'folgeanfrage',
      'notfall',
      'service',
      'reklamation',
      'sonstiges'
    )),
  constraint vorgaenge_status_check
    check (status in (
      'neu',
      'in_klaerung',
      'bereit',
      'in_bearbeitung',
      'wartet_auf_extern',
      'abgeschlossen',
      'abgebrochen'
    )),
  constraint vorgaenge_prioritaet_check
    check (prioritaet in ('niedrig', 'normal', 'hoch', 'dringend')),
  constraint vorgaenge_vorgangsnummer_not_empty
    check (length(trim(vorgangsnummer)) > 0),
  constraint vorgaenge_titel_not_empty
    check (length(trim(titel)) > 0),
  constraint vorgaenge_beschreibung_not_empty_if_set
    check (beschreibung is null or length(trim(beschreibung)) > 0),
  constraint vorgaenge_quelle_not_empty_if_set
    check (quelle is null or length(trim(quelle)) > 0),
  constraint vorgaenge_beendet_check
    check (
      (
        status in ('abgeschlossen', 'abgebrochen')
        and beendet_am is not null
      )
      or (
        status not in ('abgeschlossen', 'abgebrochen')
        and beendet_am is null
      )
    ),
  constraint vorgaenge_aktiv_archiviert_check
    check (
      (aktiv = true and archiviert_am is null)
      or (aktiv = false and archiviert_am is not null)
    ),
  constraint vorgaenge_parent_not_self_check
    check (parent_vorgang_id is null or parent_vorgang_id <> id),
  constraint vorgaenge_mandant_gebaeude_fkey
    foreign key (mandant_id, gebaeude_id)
    references public.gebaeude (mandant_id, id)
    on delete restrict,
  constraint vorgaenge_mandant_gebaeude_einheit_fkey
    foreign key (mandant_id, gebaeude_id, einheit_id)
    references public.einheiten (mandant_id, gebaeude_id, id)
    match simple
    on delete restrict,
  constraint vorgaenge_mandant_parent_fkey
    foreign key (mandant_id, parent_vorgang_id)
    references public.vorgaenge (mandant_id, id)
    on delete restrict
);

comment on table public.vorgaenge is
  'Operativer Vorgangskontext. Kein kunde_id — Rollen über vorgang_beteiligte. '
  'Zyklische parent_vorgang_id-Ketten werden in M2 nicht per Trigger verhindert.';

comment on constraint vorgaenge_parent_not_self_check on public.vorgaenge is
  'Direkte Selbstreferenz verboten; mehrstufige Zyklen: bewusste M2-Grenze, Server/Review.';

create unique index if not exists vorgaenge_mandant_vorgangsnummer_key
  on public.vorgaenge (mandant_id, vorgangsnummer);

create index if not exists idx_vorgaenge_mandant_status_aktiv
  on public.vorgaenge (mandant_id, status, aktiv);

create index if not exists idx_vorgaenge_mandant_vorgangstyp
  on public.vorgaenge (mandant_id, vorgangstyp);

create index if not exists idx_vorgaenge_mandant_gebaeude
  on public.vorgaenge (mandant_id, gebaeude_id);

create index if not exists idx_vorgaenge_mandant_einheit
  on public.vorgaenge (mandant_id, einheit_id)
  where einheit_id is not null;

create index if not exists idx_vorgaenge_mandant_parent
  on public.vorgaenge (mandant_id, parent_vorgang_id)
  where parent_vorgang_id is not null;

create index if not exists idx_vorgaenge_mandant_prioritaet_eingegangen
  on public.vorgaenge (mandant_id, prioritaet, eingegangen_am);

create index if not exists idx_vorgaenge_mandant_eingegangen_desc
  on public.vorgaenge (mandant_id, eingegangen_am desc);

-- ---------------------------------------------------------------------------
-- 5. Tabelle vorgang_beteiligte
-- ---------------------------------------------------------------------------

create table if not exists public.vorgang_beteiligte (
  id uuid primary key default gen_random_uuid(),
  mandant_id uuid not null references public.organizations (id) on delete restrict,
  vorgang_id uuid not null,
  kunde_id uuid not null,
  rolle text not null,
  ist_hauptbeteiligter boolean not null default false,
  gueltig_ab timestamptz,
  gueltig_bis timestamptz,
  notizen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vorgang_beteiligte_rolle_check
    check (rolle in (
      'anfragender',
      'auftraggeber',
      'ansprechpartner',
      'angebotsempfaenger',
      'rechnungsempfaenger',
      'eigentuemer',
      'mieter',
      'hausverwaltung',
      'zahlungspflichtiger',
      'sonstiges'
    )),
  constraint vorgang_beteiligte_gueltig_check
    check (
      gueltig_bis is null
      or gueltig_ab is null
      or gueltig_bis >= gueltig_ab
    ),
  constraint vorgang_beteiligte_notizen_not_empty_if_set
    check (notizen is null or length(trim(notizen)) > 0),
  constraint vorgang_beteiligte_mandant_vorgang_fkey
    foreign key (mandant_id, vorgang_id)
    references public.vorgaenge (mandant_id, id)
    on delete restrict,
  constraint vorgang_beteiligte_mandant_kunde_fkey
    foreign key (mandant_id, kunde_id)
    references public.kunden (mandant_id, id)
    on delete restrict,
  constraint vorgang_beteiligte_mandant_vorgang_kunde_rolle_key
    unique (mandant_id, vorgang_id, kunde_id, rolle)
);

comment on table public.vorgang_beteiligte is
  'Rollen an einem Vorgang — Source of Truth für Anfragender, Auftraggeber, Rechnungsempfänger, …';

create unique index if not exists vorgang_beteiligte_hauptbeteiligter_key
  on public.vorgang_beteiligte (mandant_id, vorgang_id, rolle)
  where ist_hauptbeteiligter = true;

create index if not exists idx_vorgang_beteiligte_mandant_vorgang
  on public.vorgang_beteiligte (mandant_id, vorgang_id);

create index if not exists idx_vorgang_beteiligte_mandant_kunde
  on public.vorgang_beteiligte (mandant_id, kunde_id);

create index if not exists idx_vorgang_beteiligte_mandant_rolle
  on public.vorgang_beteiligte (mandant_id, rolle);

create index if not exists idx_vorgang_beteiligte_mandant_vorgang_rolle
  on public.vorgang_beteiligte (mandant_id, vorgang_id, rolle);

-- ---------------------------------------------------------------------------
-- 6. updated_at-Trigger
-- ---------------------------------------------------------------------------

drop trigger if exists kunden_objekt_beziehungen_set_updated_at on public.kunden_objekt_beziehungen;
create trigger kunden_objekt_beziehungen_set_updated_at
before update on public.kunden_objekt_beziehungen
for each row execute function public.set_updated_at();

drop trigger if exists vorgaenge_set_updated_at on public.vorgaenge;
create trigger vorgaenge_set_updated_at
before update on public.vorgaenge
for each row execute function public.set_updated_at();

drop trigger if exists vorgang_beteiligte_set_updated_at on public.vorgang_beteiligte;
create trigger vorgang_beteiligte_set_updated_at
before update on public.vorgang_beteiligte
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security (ENABLE only — keine Policies in M2)
-- ---------------------------------------------------------------------------

alter table public.kunden_objekt_beziehungen enable row level security;
alter table public.vorgaenge enable row level security;
alter table public.vorgang_beteiligte enable row level security;
