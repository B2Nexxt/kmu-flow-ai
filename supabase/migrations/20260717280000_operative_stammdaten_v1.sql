-- Migration 1: Operative Stammdaten (Kundenplattform /)
--
-- Neue Tabellen (FK → organizations.id = SaaS-Mandant):
--   kunden, adressen, gebaeude, einheiten
--
-- Unverändert: organizations, customers, angebote, organization_members, bestehende RPCs
-- Kein Backfill. Keine RLS-Policies für anon/authenticated (Absicht — Service Role serverseitig).
--
-- Referenz: docs/fachkonzept/12-spezifikation-migration-1-operative-stammdaten.md
--           ADR-0013, ADR-0014, ADR-0015, ADR-0016

-- ---------------------------------------------------------------------------
-- 1. Normalisierungsfunktionen
-- ---------------------------------------------------------------------------

-- Hinweis Unicode-NFC: PostgreSQL bietet ohne zusätzliche Extension (z. B. unaccent,
-- icu) keine echte Unicode-NFC-Normalisierung. M1 nutzt daher lower/trim/Whitespace-
-- Reduktion — ausreichend für deterministische Dublettensuche in V1.

create or replace function public.normalize_operative_text(value text)
returns text
language sql
immutable
security invoker
set search_path = public
as $$
  select case
    when value is null then null
    else trim(regexp_replace(lower(trim(value)), '\s+', ' ', 'g'))
  end;
$$;

comment on function public.normalize_operative_text(text) is
  'Operative Textnormalisierung: trim, lowercase, Whitespace reduzieren. '
  'Keine Straßen-/Umlaut-/PLZ-Korrektur. Kein echtes Unicode-NFC ohne Extension.';

create or replace function public.normalize_hausnummer(value text)
returns text
language sql
immutable
security invoker
set search_path = public
as $$
  select case
    when value is null then null
    else regexp_replace(public.normalize_operative_text(value), '\s', '', 'g')
  end;
$$;

comment on function public.normalize_hausnummer(text) is
  'Hausnummer: normalize_operative_text plus Entfernen aller internen Whitespaces (z. B. " 12 a " → "12a").';

create or replace function public.normalize_land(value text)
returns text
language sql
immutable
security invoker
set search_path = public
as $$
  select case
    when value is null then null
    else trim(regexp_replace(lower(trim(value)), '\s+', ' ', 'g'))
  end;
$$;

comment on function public.normalize_land(text) is
  'Land: trim, lowercase, Whitespace reduzieren. Keine Alias-Liste (Deutschland/DE/Germany) in M1.';

create or replace function public.build_adress_fingerprint(
  p_strasse text,
  p_hausnummer text,
  p_plz text,
  p_ort text,
  p_land text
)
returns text
language sql
immutable
security invoker
set search_path = public
as $$
  select p_strasse || '|' || p_hausnummer || '|' || p_plz || '|' || p_ort || '|' || p_land;
$$;

comment on function public.build_adress_fingerprint(text, text, text, text, text) is
  'Stabiler pipe-delimited Fingerprint: strasse|hausnummer|plz|ort|land. Kein Hash, kein mandant_id, kein adresszusatz.';

create or replace function public.adressen_normalize_row()
returns trigger
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  new.strasse_normalisiert := public.normalize_operative_text(new.strasse);
  new.hausnummer_normalisiert := public.normalize_hausnummer(new.hausnummer);
  new.plz_normalisiert := public.normalize_operative_text(new.plz);
  new.ort_normalisiert := public.normalize_operative_text(new.ort);
  new.land_normalisiert := public.normalize_land(new.land);
  new.adress_fingerprint := public.build_adress_fingerprint(
    new.strasse_normalisiert,
    new.hausnummer_normalisiert,
    new.plz_normalisiert,
    new.ort_normalisiert,
    new.land_normalisiert
  );
  return new;
end;
$$;

create or replace function public.einheiten_normalize_bezeichnung_row()
returns trigger
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  new.bezeichnung_normalisiert := public.normalize_operative_text(new.bezeichnung);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tabelle kunden
-- ---------------------------------------------------------------------------

create table if not exists public.kunden (
  id uuid primary key default gen_random_uuid(),
  mandant_id uuid not null references public.organizations (id) on delete restrict,
  kundennummer text not null,
  kundentyp text not null,
  firmenname text,
  vorname text,
  nachname text,
  anzeigename text not null,
  email text,
  telefon text,
  mobil text,
  umsatzsteuer_id text,
  notizen text,
  aktiv boolean not null default true,
  archiviert_am timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kunden_kundentyp_check
    check (kundentyp in ('privatperson', 'unternehmen', 'sonstiges')),
  constraint kunden_kundennummer_not_empty
    check (length(trim(kundennummer)) > 0),
  constraint kunden_anzeigename_not_empty
    check (length(trim(anzeigename)) > 0),
  constraint kunden_typ_privatperson_check
    check (
      kundentyp <> 'privatperson'
      or (
        vorname is not null and length(trim(vorname)) > 0
        and nachname is not null and length(trim(nachname)) > 0
      )
    ),
  constraint kunden_typ_unternehmen_check
    check (
      kundentyp <> 'unternehmen'
      or (firmenname is not null and length(trim(firmenname)) > 0)
    ),
  constraint kunden_firmenname_not_empty_if_set
    check (firmenname is null or length(trim(firmenname)) > 0),
  constraint kunden_vorname_not_empty_if_set
    check (vorname is null or length(trim(vorname)) > 0),
  constraint kunden_nachname_not_empty_if_set
    check (nachname is null or length(trim(nachname)) > 0),
  constraint kunden_email_not_empty_if_set
    check (email is null or length(trim(email)) > 0),
  constraint kunden_telefon_not_empty_if_set
    check (telefon is null or length(trim(telefon)) > 0),
  constraint kunden_mobil_not_empty_if_set
    check (mobil is null or length(trim(mobil)) > 0),
  constraint kunden_umsatzsteuer_id_not_empty_if_set
    check (umsatzsteuer_id is null or length(trim(umsatzsteuer_id)) > 0),
  constraint kunden_notizen_not_empty_if_set
    check (notizen is null or length(trim(notizen)) > 0),
  constraint kunden_aktiv_archiviert_check
    check (
      (aktiv = true and archiviert_am is null)
      or (aktiv = false and archiviert_am is not null)
    )
);

comment on table public.kunden is
  'Endkunden der operativen Handwerksplattform (/). Mandantenscharf über mandant_id → organizations.id.';

create unique index if not exists kunden_mandant_kundennummer_key
  on public.kunden (mandant_id, kundennummer);

create index if not exists idx_kunden_mandant_aktiv
  on public.kunden (mandant_id, aktiv);

create index if not exists idx_kunden_mandant_anzeigename_lower
  on public.kunden (mandant_id, lower(anzeigename));

-- ---------------------------------------------------------------------------
-- 3. Tabelle adressen
-- ---------------------------------------------------------------------------

create table if not exists public.adressen (
  id uuid primary key default gen_random_uuid(),
  mandant_id uuid not null references public.organizations (id) on delete restrict,
  strasse text not null,
  hausnummer text not null,
  adresszusatz text,
  plz text not null,
  ort text not null,
  land text not null default 'Deutschland',
  strasse_normalisiert text not null,
  hausnummer_normalisiert text not null,
  plz_normalisiert text not null,
  ort_normalisiert text not null,
  land_normalisiert text not null,
  adress_fingerprint text not null,
  aktiv boolean not null default true,
  archiviert_am timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adressen_mandant_id_id_key unique (mandant_id, id),
  constraint adressen_strasse_not_empty
    check (length(trim(strasse)) > 0),
  constraint adressen_hausnummer_not_empty
    check (length(trim(hausnummer)) > 0),
  constraint adressen_plz_not_empty
    check (length(trim(plz)) > 0),
  constraint adressen_ort_not_empty
    check (length(trim(ort)) > 0),
  constraint adressen_land_not_empty
    check (length(trim(land)) > 0),
  constraint adressen_adresszusatz_not_empty_if_set
    check (adresszusatz is null or length(trim(adresszusatz)) > 0),
  constraint adressen_strasse_normalisiert_not_empty
    check (length(trim(strasse_normalisiert)) > 0),
  constraint adressen_hausnummer_normalisiert_not_empty
    check (length(trim(hausnummer_normalisiert)) > 0),
  constraint adressen_plz_normalisiert_not_empty
    check (length(trim(plz_normalisiert)) > 0),
  constraint adressen_ort_normalisiert_not_empty
    check (length(trim(ort_normalisiert)) > 0),
  constraint adressen_land_normalisiert_not_empty
    check (length(trim(land_normalisiert)) > 0),
  constraint adressen_fingerprint_not_empty
    check (length(trim(adress_fingerprint)) > 0),
  constraint adressen_aktiv_archiviert_check
    check (
      (aktiv = true and archiviert_am is null)
      or (aktiv = false and archiviert_am is not null)
    )
);

comment on table public.adressen is
  'Mandantenbezogene Standortadressen. Normalisierung und Fingerprint per DB-Trigger (Source of Truth).';

create index if not exists idx_adressen_mandant_fingerprint
  on public.adressen (mandant_id, adress_fingerprint);

create index if not exists idx_adressen_mandant_aktiv
  on public.adressen (mandant_id, aktiv);

create index if not exists idx_adressen_mandant_plz_ort
  on public.adressen (mandant_id, plz_normalisiert, ort_normalisiert);

-- ---------------------------------------------------------------------------
-- 4. Tabelle gebaeude
-- ---------------------------------------------------------------------------

create table if not exists public.gebaeude (
  id uuid primary key default gen_random_uuid(),
  mandant_id uuid not null references public.organizations (id) on delete restrict,
  adresse_id uuid not null,
  gebaeudeart text not null,
  gebaeudebezeichnung text,
  technische_stammdaten jsonb not null default '{}'::jsonb,
  aktiv boolean not null default true,
  archiviert_am timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gebaeude_mandant_id_id_key unique (mandant_id, id),
  constraint gebaeude_mandant_adresse_fkey
    foreign key (mandant_id, adresse_id)
    references public.adressen (mandant_id, id)
    on delete restrict,
  constraint gebaeude_gebaeudeart_check
    check (gebaeudeart in (
      'einfamilienhaus',
      'mehrfamilienhaus',
      'wohn_und_geschaeftshaus',
      'gewerbeobjekt',
      'industrieobjekt',
      'oeffentliches_gebaeude',
      'nebengebaeude',
      'sonstiges'
    )),
  constraint gebaeude_bezeichnung_not_empty
    check (gebaeudebezeichnung is null or length(trim(gebaeudebezeichnung)) > 0),
  constraint gebaeude_aktiv_archiviert_check
    check (
      (aktiv = true and archiviert_am is null)
      or (aktiv = false and archiviert_am is not null)
    )
);

comment on table public.gebaeude is
  'Gebäude/Objekte an mandantenbezogenen Adressen (1:n). gebaeudebezeichnung bedingt optional — Servervalidierung später.';

create index if not exists idx_gebaeude_mandant_adresse
  on public.gebaeude (mandant_id, adresse_id);

create index if not exists idx_gebaeude_mandant_aktiv
  on public.gebaeude (mandant_id, aktiv);

-- ---------------------------------------------------------------------------
-- 5. Tabelle einheiten
-- ---------------------------------------------------------------------------

create table if not exists public.einheiten (
  id uuid primary key default gen_random_uuid(),
  mandant_id uuid not null references public.organizations (id) on delete restrict,
  gebaeude_id uuid not null,
  bezeichnung text not null,
  bezeichnung_normalisiert text not null,
  einheit_typ text not null,
  nummer text,
  etage text,
  lage text,
  technische_stammdaten jsonb not null default '{}'::jsonb,
  aktiv boolean not null default true,
  archiviert_am timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint einheiten_mandant_gebaeude_fkey
    foreign key (mandant_id, gebaeude_id)
    references public.gebaeude (mandant_id, id)
    on delete restrict,
  constraint einheiten_einheit_typ_check
    check (einheit_typ in (
      'wohnung',
      'gewerbeeinheit',
      'gemeinschaftsbereich',
      'funktionsbereich',
      'gebaeudeteil',
      'sonstiges'
    )),
  constraint einheiten_bezeichnung_not_empty
    check (length(trim(bezeichnung)) > 0),
  constraint einheiten_bezeichnung_normalisiert_not_empty
    check (length(trim(bezeichnung_normalisiert)) > 0),
  constraint einheiten_nummer_not_empty_if_set
    check (nummer is null or length(trim(nummer)) > 0),
  constraint einheiten_etage_not_empty_if_set
    check (etage is null or length(trim(etage)) > 0),
  constraint einheiten_lage_not_empty_if_set
    check (lage is null or length(trim(lage)) > 0),
  constraint einheiten_aktiv_archiviert_check
    check (
      (aktiv = true and archiviert_am is null)
      or (aktiv = false and archiviert_am is not null)
    )
);

comment on table public.einheiten is
  'Einheiten und Objektbereiche innerhalb von Gebäuden. bezeichnung_normalisiert per DB-Trigger.';

create unique index if not exists einheiten_mandant_gebaeude_bezeichnung_aktiv_key
  on public.einheiten (mandant_id, gebaeude_id, bezeichnung_normalisiert)
  where aktiv = true;

create index if not exists idx_einheiten_mandant_gebaeude
  on public.einheiten (mandant_id, gebaeude_id);

create index if not exists idx_einheiten_mandant_aktiv
  on public.einheiten (mandant_id, aktiv);

-- ---------------------------------------------------------------------------
-- 6. updated_at-Trigger (bestehende Funktion set_updated_at)
-- ---------------------------------------------------------------------------

drop trigger if exists kunden_set_updated_at on public.kunden;
create trigger kunden_set_updated_at
before update on public.kunden
for each row execute function public.set_updated_at();

drop trigger if exists adressen_set_updated_at on public.adressen;
create trigger adressen_set_updated_at
before update on public.adressen
for each row execute function public.set_updated_at();

drop trigger if exists gebaeude_set_updated_at on public.gebaeude;
create trigger gebaeude_set_updated_at
before update on public.gebaeude
for each row execute function public.set_updated_at();

drop trigger if exists einheiten_set_updated_at on public.einheiten;
create trigger einheiten_set_updated_at
before update on public.einheiten
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Normalisierungstrigger (BEFORE INSERT OR UPDATE — vor Constraint-Prüfung)
-- ---------------------------------------------------------------------------

drop trigger if exists adressen_normalize_before_insert_update on public.adressen;
create trigger adressen_normalize_before_insert_update
before insert or update of strasse, hausnummer, plz, ort, land
on public.adressen
for each row execute function public.adressen_normalize_row();

drop trigger if exists einheiten_normalize_bezeichnung_before_insert_update on public.einheiten;
create trigger einheiten_normalize_bezeichnung_before_insert_update
before insert or update of bezeichnung
on public.einheiten
for each row execute function public.einheiten_normalize_bezeichnung_row();

-- ---------------------------------------------------------------------------
-- 8. Row Level Security (ENABLE only — keine Policies in M1)
-- ---------------------------------------------------------------------------

alter table public.kunden enable row level security;
alter table public.adressen enable row level security;
alter table public.gebaeude enable row level security;
alter table public.einheiten enable row level security;
