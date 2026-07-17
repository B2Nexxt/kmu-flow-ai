-- Angebotsmodul V1
--
-- Tabellen:
--   angebotsnummer_sequenzen  (globale Jahressequenz, Vergabe erst in späterer RPC)
--   angebote                  (Container: Identität, Status, Mandantenbezug)
--   angebot_versionen         (versionierter Inhalt inkl. Empfänger-Snapshot)
--   angebot_positionen        (Positionen je Version)
--
-- Trennung Container / Version:
--   angebote.status           = aktueller Gesamtzustand des Vorgangs (Workflow)
--   angebot_versionen         = unveränderliche Historie einzelner Fassungen (nach Versand/Annahme)
--   Neue Version → angebote.status = 'entwurf'; alte Fassungen bleiben ist_eingefroren = true
--
-- Kein angebote.aktuelle_version_id (kein zirkulärer FK).
-- Bearbeitbare Version (höchstens eine pro Angebot, DB: partieller UNIQUE-Index):
--   SELECT * FROM angebot_versionen
--   WHERE angebot_id = :id AND ist_eingefroren = false
--   ORDER BY version_nr DESC LIMIT 1;
--
-- Anzeige-Version ohne offenen Entwurf:
--   angenommene_version_id → versendete_version_id → höchste eingefrorene version_nr
--
-- Versandhistorie: jede Version speichert freigegeben_am, versendet_am, angenommen_am.
-- angebote.versendete_version_id = aktuell maßgebliche versendete Version (wird bei erneutem Versand aktualisiert).
--
-- Referenz: docs/angebote-datenmodell.md

-- ---------------------------------------------------------------------------
-- 1. Globale Angebotsnummern-Sequenz (pro Kalenderjahr)
-- ---------------------------------------------------------------------------

create table if not exists public.angebotsnummer_sequenzen (
  jahr integer primary key,
  letzte_nummer integer not null default 0,
  constraint angebotsnummer_sequenzen_jahr_check
    check (jahr >= 2000 and jahr <= 9999),
  constraint angebotsnummer_sequenzen_letzte_nummer_check
    check (letzte_nummer >= 0 and letzte_nummer <= 9999)
);

comment on table public.angebotsnummer_sequenzen is
  'Globale Jahressequenz für Angebotsnummern (AN-YYYY-NNNN). '
  'Atomare Vergabe erfolgt in einer späteren RPC via SELECT … FOR UPDATE.';

-- ---------------------------------------------------------------------------
-- 2. Angebote (Container)
-- ---------------------------------------------------------------------------

create table if not exists public.angebote (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  angebotsnummer text,
  status text not null default 'entwurf',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint angebote_status_check
    check (status in (
      'entwurf',
      'freigegeben',
      'versendet',
      'angenommen',
      'abgelehnt',
      'abgelaufen'
    )),
  constraint angebote_angebotsnummer_format_check
    check (angebotsnummer is null or angebotsnummer ~ '^AN-[0-9]{4}-[0-9]{4}$')
);

comment on table public.angebote is
  'Logischer Angebots-Container (Identität, Workflow-Status). '
  'status = aktueller Gesamtzustand; Inhalte und Historie liegen in angebot_versionen. '
  'angebotsnummer bleibt NULL bis zur Freigabe (spätere RPC).';

comment on column public.angebote.organization_id is
  'Mandantenbezug (organizations.id). ON DELETE RESTRICT verhindert Löschen bei referenzierten Angeboten.';

create unique index if not exists angebote_angebotsnummer_key
  on public.angebote (angebotsnummer);

create index if not exists idx_angebote_organization_id
  on public.angebote (organization_id);

create index if not exists idx_angebote_status
  on public.angebote (status);

create index if not exists idx_angebote_created_at
  on public.angebote (created_at desc);

drop trigger if exists angebote_set_updated_at on public.angebote;
create trigger angebote_set_updated_at
before update on public.angebote
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Angebotsversionen
-- ---------------------------------------------------------------------------

create table if not exists public.angebot_versionen (
  id uuid primary key default gen_random_uuid(),
  angebot_id uuid not null references public.angebote (id) on delete cascade,
  version_nr integer not null,
  angebot_datum date not null,
  gueltig_bis date not null,
  betreff text,
  einleitungstext text,
  schlusstext text,
  empfaenger_firmenname text not null,
  empfaenger_rechtsform text,
  empfaenger_strasse text,
  empfaenger_hausnummer text,
  empfaenger_plz text,
  empfaenger_ort text,
  empfaenger_land text not null default 'Deutschland',
  empfaenger_ansprechpartner text,
  empfaenger_email text,
  empfaenger_telefon text,
  empfaenger_umsatzsteuer_id text,
  ist_eingefroren boolean not null default false,
  freigegeben_am timestamptz,
  versendet_am timestamptz,
  angenommen_am timestamptz,
  pdf_storage_path text,
  pdf_erstellt_am timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint angebot_versionen_angebot_id_version_nr_key
    unique (angebot_id, version_nr),
  constraint angebot_versionen_version_nr_check
    check (version_nr >= 1),
  constraint angebot_versionen_gueltig_bis_check
    check (gueltig_bis >= angebot_datum)
);

comment on table public.angebot_versionen is
  'Unveränderliche Historie einzelner Angebotsfassungen inkl. Empfänger-Snapshot. '
  'ist_eingefroren = true ab Versand; höchstens eine offene Version (ist_eingefroren = false) pro Angebot.';

comment on column public.angebot_versionen.freigegeben_am is
  'Zeitpunkt der Freigabe dieser Fassung (status entwurf → freigegeben am Container).';

comment on column public.angebot_versionen.versendet_am is
  'Versandzeitpunkt dieser Fassung; bleibt in der Historie auch wenn versendete_version_id später wechselt.';

comment on column public.angebot_versionen.angenommen_am is
  'Annahmezeitpunkt dieser Fassung; gesetzt wenn Container-Status angenommen und dies die angenommene Version ist.';

comment on column public.angebot_versionen.pdf_storage_path is
  'Relativer Pfad im Supabase-Storage-Bucket „angebote“ (PDF-Erzeugung folgt später).';

create index if not exists idx_angebot_versionen_angebot_id
  on public.angebot_versionen (angebot_id);

create index if not exists idx_angebot_versionen_angebot_id_version_nr
  on public.angebot_versionen (angebot_id, version_nr desc);

-- Höchstens eine offene (nicht eingefrorene) Version pro Angebot
create unique index if not exists angebot_versionen_angebot_id_offene_version_key
  on public.angebot_versionen (angebot_id)
  where ist_eingefroren = false;

-- Voraussetzung für zusammengesetzte FKs auf angenommene_version_id / versendete_version_id
create unique index if not exists angebot_versionen_angebot_id_id_key
  on public.angebot_versionen (angebot_id, id);

drop trigger if exists angebot_versionen_set_updated_at on public.angebot_versionen;
create trigger angebot_versionen_set_updated_at
before update on public.angebot_versionen
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Verweise auf historische Versionen (nach angebot_versionen, kein Zirkel bei Anlage)
-- ---------------------------------------------------------------------------

alter table public.angebote
  add column if not exists angenommene_version_id uuid,
  add column if not exists versendete_version_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'angebote_angenommene_version_id_fkey'
      and conrelid = 'public.angebote'::regclass
  ) then
    alter table public.angebote
      add constraint angebote_angenommene_version_id_fkey
      foreign key (id, angenommene_version_id)
      references public.angebot_versionen (angebot_id, id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'angebote_versendete_version_id_fkey'
      and conrelid = 'public.angebote'::regclass
  ) then
    alter table public.angebote
      add constraint angebote_versendete_version_id_fkey
      foreign key (id, versendete_version_id)
      references public.angebot_versionen (angebot_id, id)
      on delete restrict;
  end if;
end;
$$;

comment on column public.angebote.angenommene_version_id is
  'Historisch angenommene Version desselben Angebots (eingefroren). '
  'Zusammengesetzter FK (id, angenommene_version_id) verhindert Verweis auf fremdes Angebot.';

comment on column public.angebote.versendete_version_id is
  'Aktuell maßgebliche versendete Version desselben Angebots (eingefroren). '
  'Wird bei erneutem Versand einer neueren Fassung aktualisiert; ältere Versionen behalten versendet_am. '
  'Zusammengesetzter FK (id, versendete_version_id) verhindert Verweis auf fremdes Angebot.';

-- ---------------------------------------------------------------------------
-- 5. Angebotspositionen
-- ---------------------------------------------------------------------------

create table if not exists public.angebot_positionen (
  id uuid primary key default gen_random_uuid(),
  angebot_version_id uuid not null references public.angebot_versionen (id) on delete cascade,
  position_nr integer not null,
  bezeichnung text not null,
  beschreibung text,
  menge numeric(12, 3) not null,
  einheit text not null default 'Stk.',
  einzelpreis_netto_cents bigint not null,
  rabatt_prozent numeric(5, 2) not null default 0,
  umsatzsteuer_satz smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint angebot_positionen_version_id_position_nr_key
    unique (angebot_version_id, position_nr),
  constraint angebot_positionen_menge_check
    check (menge > 0),
  constraint angebot_positionen_einzelpreis_netto_cents_check
    check (einzelpreis_netto_cents >= 0),
  constraint angebot_positionen_rabatt_prozent_check
    check (rabatt_prozent >= 0 and rabatt_prozent <= 100),
  constraint angebot_positionen_umsatzsteuer_satz_check
    check (umsatzsteuer_satz in (0, 7, 19))
);

comment on table public.angebot_positionen is
  'Positionen einer Angebotsversion. Summen werden nicht gespeichert, nur berechnet.';

create index if not exists idx_angebot_positionen_angebot_version_id
  on public.angebot_positionen (angebot_version_id);

drop trigger if exists angebot_positionen_set_updated_at on public.angebot_positionen;
create trigger angebot_positionen_set_updated_at
before update on public.angebot_positionen
for each row execute function public.set_updated_at();
