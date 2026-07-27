-- Migration 3: Operativer Anfrageeingang (Kundenplattform /)
--
-- Neue Objekte:
--   public.anfrageeingaenge_protect_raw_content()
--   public.anfrageeingaenge
--
-- Unverändert: organizations, customers, angebote, M1/M2-Tabellen, /admin-RPCs
-- Keine RLS-Policies für anon/authenticated (Absicht — Service Role serverseitig).
--
-- Referenz: docs/fachkonzept/14-spezifikation-migration-3-anfrageeingang.md
--           ADR-0008, ADR-0018

-- ---------------------------------------------------------------------------
-- 1. Trigger-Funktion: Rohinhalt-Sperre (B1)
-- ---------------------------------------------------------------------------
-- Kein CHECK mit now() für rohinhalt_gesperrt_am <= now() — now() in CHECKs ist
-- zeitabhängig und ungeeignet; Zukunftsprüfung nur in dieser Trigger-Funktion.

create or replace function public.anfrageeingaenge_protect_raw_content()
returns trigger
language plpgsql
volatile
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.rohinhalt_gesperrt_am is not null and new.rohinhalt_gesperrt_am > now() then
      raise exception
        'anfrageeingaenge: rohinhalt_gesperrt_am darf nicht in der Zukunft liegen';
    end if;

    if new.status <> 'neu' and new.rohinhalt_gesperrt_am is null then
      new.rohinhalt_gesperrt_am := now();
    end if;

    return new;
  end if;

  -- UPDATE
  if old.rohinhalt_gesperrt_am is not null then
    if new.rohinhalt is distinct from old.rohinhalt then
      raise exception
        'anfrageeingaenge: rohinhalt ist gesperrt (seit %) und darf nicht geändert werden',
        old.rohinhalt_gesperrt_am;
    end if;

    if new.rohinhalt_gesperrt_am is distinct from old.rohinhalt_gesperrt_am then
      raise exception
        'anfrageeingaenge: rohinhalt_gesperrt_am darf nach der Sperre nicht geändert oder zurückgesetzt werden';
    end if;

    return new;
  end if;

  -- OLD.rohinhalt_gesperrt_am IS NULL
  if new.rohinhalt_gesperrt_am is not null and new.rohinhalt_gesperrt_am > now() then
    raise exception
      'anfrageeingaenge: rohinhalt_gesperrt_am darf nicht in der Zukunft liegen';
  end if;

  if old.status = 'neu' and new.status <> 'neu' then
    new.rohinhalt_gesperrt_am := coalesce(new.rohinhalt_gesperrt_am, now());
  end if;

  return new;
end;
$$;

comment on function public.anfrageeingaenge_protect_raw_content() is
  'Sperrt rohinhalt beim Verlassen von status=neu. Rückkehr zu neu hebt Sperre nicht auf. '
  'Läuft BEFORE INSERT OR UPDATE vor CHECK-Auswertung.';

-- ---------------------------------------------------------------------------
-- 2. Tabelle anfrageeingaenge (35 Spalten)
-- ---------------------------------------------------------------------------

create table if not exists public.anfrageeingaenge (
  id uuid primary key default gen_random_uuid(),
  mandant_id uuid not null references public.organizations (id) on delete restrict,
  eingangsnummer text not null,
  kanal text not null,
  status text not null default 'neu',
  betreff text,
  rohinhalt text,
  rohinhalt_gesperrt_am timestamptz,
  strukturierte_daten jsonb not null default '{}'::jsonb,
  absender_name text,
  absender_email text,
  absender_telefon text,
  empfangen_am timestamptz not null default now(),
  zuletzt_bearbeitet_am timestamptz,
  zugeordnet_kunde_id uuid,
  zugeordnet_gebaeude_id uuid,
  zugeordnet_einheit_id uuid,
  erzeugter_vorgang_id uuid,
  zuordnungsstatus text not null default 'kein_treffer',
  zuordnungsgrund jsonb not null default '{}'::jsonb,
  zuordnungskandidaten jsonb not null default '[]'::jsonb,
  vollstaendigkeitsstatus text not null default 'unbekannt',
  fehlende_angaben jsonb not null default '[]'::jsonb,
  confidence_score numeric(5, 4),
  dringlichkeit text not null default 'normal',
  manuelle_pruefung_erforderlich boolean not null default false,
  kanal_externe_id text,
  inhalt_hash text,
  parent_anfrageeingang_id uuid,
  konversation_id uuid,
  beendet_am timestamptz,
  aktiv boolean not null default true,
  archiviert_am timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anfrageeingaenge_mandant_id_id_key unique (mandant_id, id),
  constraint anfrageeingaenge_kanal_check
    check (kanal in (
      'telefon',
      'email',
      'kontaktformular',
      'whatsapp',
      'sms',
      'persoenlich',
      'empfehlung',
      'sonstiges'
    )),
  constraint anfrageeingaenge_status_check
    check (status in (
      'neu',
      'analysiert',
      'wartet_auf_informationen',
      'zur_manuellen_pruefung',
      'bereit_fuer_vorgang',
      'in_vorgang_ueberfuehrt',
      'verworfen'
    )),
  constraint anfrageeingaenge_zuordnungsstatus_check
    check (zuordnungsstatus in (
      'kein_treffer',
      'eindeutig',
      'moeglicher_treffer',
      'mehrere_treffer',
      'konflikt',
      'bestaetigt',
      'nicht_erforderlich'
    )),
  constraint anfrageeingaenge_vollstaendigkeitsstatus_check
    check (vollstaendigkeitsstatus in (
      'unbekannt',
      'unvollstaendig',
      'ausreichend_fuer_rueckfrage',
      'ausreichend_fuer_vorgang',
      'vollstaendig'
    )),
  constraint anfrageeingaenge_dringlichkeit_check
    check (dringlichkeit in ('niedrig', 'normal', 'hoch', 'dringend')),
  constraint anfrageeingaenge_eingangsnummer_not_empty
    check (length(trim(eingangsnummer)) > 0),
  constraint anfrageeingaenge_betreff_not_empty_if_set
    check (betreff is null or length(trim(betreff)) > 0),
  constraint anfrageeingaenge_rohinhalt_not_empty_if_set
    check (rohinhalt is null or length(trim(rohinhalt)) > 0),
  constraint anfrageeingaenge_absender_name_not_empty_if_set
    check (absender_name is null or length(trim(absender_name)) > 0),
  constraint anfrageeingaenge_absender_email_not_empty_if_set
    check (absender_email is null or length(trim(absender_email)) > 0),
  constraint anfrageeingaenge_absender_telefon_not_empty_if_set
    check (absender_telefon is null or length(trim(absender_telefon)) > 0),
  constraint anfrageeingaenge_kanal_externe_id_not_empty_if_set
    check (kanal_externe_id is null or length(trim(kanal_externe_id)) > 0),
  constraint anfrageeingaenge_inhalt_hash_not_empty_if_set
    check (inhalt_hash is null or length(trim(inhalt_hash)) > 0),
  constraint anfrageeingaenge_strukturierte_daten_object
    check (jsonb_typeof(strukturierte_daten) = 'object'),
  constraint anfrageeingaenge_zuordnungsgrund_object
    check (jsonb_typeof(zuordnungsgrund) = 'object'),
  constraint anfrageeingaenge_zuordnungskandidaten_array
    check (jsonb_typeof(zuordnungskandidaten) = 'array'),
  constraint anfrageeingaenge_fehlende_angaben_array
    check (jsonb_typeof(fehlende_angaben) = 'array'),
  constraint anfrageeingaenge_confidence_score_check
    check (
      confidence_score is null
      or (confidence_score >= 0 and confidence_score <= 1)
    ),
  constraint anfrageeingaenge_beendet_check
    check (
      (
        status in ('in_vorgang_ueberfuehrt', 'verworfen')
        and beendet_am is not null
      )
      or (
        status not in ('in_vorgang_ueberfuehrt', 'verworfen')
        and beendet_am is null
      )
    ),
  constraint anfrageeingaenge_vorgang_status_check
    check (
      (
        erzeugter_vorgang_id is not null
        and status = 'in_vorgang_ueberfuehrt'
      )
      or (
        erzeugter_vorgang_id is null
        and status <> 'in_vorgang_ueberfuehrt'
      )
    ),
  constraint anfrageeingaenge_aktiv_archiviert_check
    check (
      (aktiv = true and archiviert_am is null)
      or (aktiv = false and archiviert_am is not null)
    ),
  constraint anfrageeingaenge_rohinhalt_sperre_check
    check (status = 'neu' or rohinhalt_gesperrt_am is not null),
  constraint anfrageeingaenge_zuordnungs_fk_check
    check (
      (
        zuordnungsstatus = 'bestaetigt'
        and zugeordnet_kunde_id is not null
        and zugeordnet_gebaeude_id is not null
      )
      or (
        zuordnungsstatus <> 'bestaetigt'
        and zugeordnet_kunde_id is null
        and zugeordnet_gebaeude_id is null
        and zugeordnet_einheit_id is null
      )
    ),
  constraint anfrageeingaenge_parent_not_self_check
    check (parent_anfrageeingang_id is null or parent_anfrageeingang_id <> id),
  constraint anfrageeingaenge_mandant_kunde_fkey
    foreign key (mandant_id, zugeordnet_kunde_id)
    references public.kunden (mandant_id, id)
    on delete restrict,
  constraint anfrageeingaenge_mandant_gebaeude_fkey
    foreign key (mandant_id, zugeordnet_gebaeude_id)
    references public.gebaeude (mandant_id, id)
    on delete restrict,
  constraint anfrageeingaenge_mandant_gebaeude_einheit_fkey
    foreign key (mandant_id, zugeordnet_gebaeude_id, zugeordnet_einheit_id)
    references public.einheiten (mandant_id, gebaeude_id, id)
    match simple
    on delete restrict,
  constraint anfrageeingaenge_mandant_vorgang_fkey
    foreign key (mandant_id, erzeugter_vorgang_id)
    references public.vorgaenge (mandant_id, id)
    on delete restrict,
  constraint anfrageeingaenge_mandant_parent_fkey
    foreign key (mandant_id, parent_anfrageeingang_id)
    references public.anfrageeingaenge (mandant_id, id)
    on delete restrict
);

comment on table public.anfrageeingaenge is
  'Kanalunabhängiger Anfrageeingang vor Vorgangserzeugung (ADR-0018). '
  'Unvollständiger Eingang ist kein vorgang. Mehrere Eingänge dürfen denselben Vorgang referenzieren.';

comment on constraint anfrageeingaenge_rohinhalt_sperre_check on public.anfrageeingaenge is
  'status=neu darf trotz gesetztem rohinhalt_gesperrt_am bestehen (Rücksetzung ohne Entsperrung).';

comment on constraint anfrageeingaenge_parent_not_self_check on public.anfrageeingaenge is
  'Direkte Selbstreferenz verboten; mehrstufige Zyklen: bewusste M3-Grenze.';

create unique index if not exists anfrageeingaenge_mandant_eingangsnummer_key
  on public.anfrageeingaenge (mandant_id, eingangsnummer);

create unique index if not exists anfrageeingaenge_mandant_kanal_externe_id_key
  on public.anfrageeingaenge (mandant_id, kanal, kanal_externe_id)
  where kanal_externe_id is not null;

create index if not exists idx_anfrageeingaenge_mandant_status_aktiv
  on public.anfrageeingaenge (mandant_id, status, aktiv);

create index if not exists idx_anfrageeingaenge_mandant_zuordnungsstatus
  on public.anfrageeingaenge (mandant_id, zuordnungsstatus);

create index if not exists idx_anfrageeingaenge_mandant_vollstaendigkeit
  on public.anfrageeingaenge (mandant_id, vollstaendigkeitsstatus);

create index if not exists idx_anfrageeingaenge_mandant_dringlichkeit_empfangen
  on public.anfrageeingaenge (mandant_id, dringlichkeit, empfangen_am);

create index if not exists idx_anfrageeingaenge_mandant_empfangen_desc
  on public.anfrageeingaenge (mandant_id, empfangen_am desc);

create index if not exists idx_anfrageeingaenge_mandant_vorgang
  on public.anfrageeingaenge (mandant_id, erzeugter_vorgang_id)
  where erzeugter_vorgang_id is not null;

create index if not exists idx_anfrageeingaenge_mandant_parent
  on public.anfrageeingaenge (mandant_id, parent_anfrageeingang_id)
  where parent_anfrageeingang_id is not null;

create index if not exists idx_anfrageeingaenge_mandant_konversation
  on public.anfrageeingaenge (mandant_id, konversation_id)
  where konversation_id is not null;

create index if not exists idx_anfrageeingaenge_mandant_inhalt_hash
  on public.anfrageeingaenge (mandant_id, inhalt_hash)
  where inhalt_hash is not null;

create index if not exists idx_anfrageeingaenge_mandant_kunde
  on public.anfrageeingaenge (mandant_id, zugeordnet_kunde_id)
  where zugeordnet_kunde_id is not null;

create index if not exists idx_anfrageeingaenge_mandant_manuelle_pruefung
  on public.anfrageeingaenge (mandant_id, manuelle_pruefung_erforderlich, status);

-- ---------------------------------------------------------------------------
-- 3. Trigger
-- ---------------------------------------------------------------------------
-- Reihenfolge BEFORE UPDATE (alphabetisch): protect_raw_content vor set_updated_at.
-- protect_raw_content: INSERT OR UPDATE — setzt Sperrzeitpunkt vor CHECK-Auswertung.

drop trigger if exists anfrageeingaenge_protect_raw_content on public.anfrageeingaenge;
create trigger anfrageeingaenge_protect_raw_content
before insert or update on public.anfrageeingaenge
for each row execute function public.anfrageeingaenge_protect_raw_content();

drop trigger if exists anfrageeingaenge_set_updated_at on public.anfrageeingaenge;
create trigger anfrageeingaenge_set_updated_at
before update on public.anfrageeingaenge
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security (ENABLE only — keine Policies in M3)
-- ---------------------------------------------------------------------------

alter table public.anfrageeingaenge enable row level security;
