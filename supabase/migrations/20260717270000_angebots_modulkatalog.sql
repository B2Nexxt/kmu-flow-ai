-- Angebots-Modulkatalog (Schema-Grundlage)
--
-- Tabellen:
--   leistungsmodule          (fester Angebots-Katalog)
-- Erweiterungen:
--   angebot_positionen       (leistungsmodul_id, preisart als Snapshot)
--
-- Keine Seed-Daten. Keine RPC-Änderungen.
-- Referenz: docs/angebote-modulkatalog.md

-- ---------------------------------------------------------------------------
-- 1. Leistungsmodule (Angebots-Katalog)
-- ---------------------------------------------------------------------------

create table if not exists public.leistungsmodule (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  beschreibung text,
  einzelpreis_netto_cents bigint not null,
  einheit text not null default 'Stk.',
  umsatzsteuer_satz smallint not null,
  preisart text not null,
  aktiv boolean not null default true,
  sortierung integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leistungsmodule_code_key unique (code),
  constraint leistungsmodule_code_check
    check (length(trim(code)) > 0),
  constraint leistungsmodule_name_check
    check (length(trim(name)) > 0),
  constraint leistungsmodule_einzelpreis_netto_cents_check
    check (einzelpreis_netto_cents >= 0),
  constraint leistungsmodule_umsatzsteuer_satz_check
    check (umsatzsteuer_satz in (0, 7, 19)),
  constraint leistungsmodule_preisart_check
    check (preisart in ('einmalig', 'monatlich')),
  constraint leistungsmodule_sortierung_check
    check (sortierung >= 0)
);

comment on table public.leistungsmodule is
  'Fester Angebots-Katalog für Leistungsmodule (einmalig oder monatlich). '
  'Unabhängig von organization_modules. Kein Hard-Delete bei Verwendung in Angeboten.';

comment on column public.leistungsmodule.code is
  'Global eindeutiger Schlüssel. Nach erster Angebotsverwendung nicht mehr änderbar (Admin-Logik, später).';

comment on column public.leistungsmodule.preisart is
  'einmalig = Einmalpreis; monatlich = Preis pro Monat (V1: kein quartals-/jährliches Intervall).';

comment on column public.leistungsmodule.aktiv is
  'Nur aktive Module sind für neue Angebotspositionen auswählbar (RPC-Logik, später).';

create index if not exists idx_leistungsmodule_aktiv_sortierung
  on public.leistungsmodule (aktiv, sortierung, name);

drop trigger if exists leistungsmodule_set_updated_at on public.leistungsmodule;
create trigger leistungsmodule_set_updated_at
before update on public.leistungsmodule
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Angebotspositionen erweitern
-- ---------------------------------------------------------------------------

alter table public.angebot_positionen
  add column if not exists leistungsmodul_id uuid,
  add column if not exists preisart text;

comment on column public.angebot_positionen.leistungsmodul_id is
  'Optionaler Bezug zum Leistungsmodul-Katalog. NULL = Legacy-Position ohne Modulbezug.';

comment on column public.angebot_positionen.preisart is
  'Snapshot der Preisart (einmalig | monatlich) zum Zeitpunkt der Positionsanlage. NULL bei Legacy-Positionen.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'angebot_positionen_leistungsmodul_id_fkey'
  ) then
    alter table public.angebot_positionen
      add constraint angebot_positionen_leistungsmodul_id_fkey
      foreign key (leistungsmodul_id)
      references public.leistungsmodule (id)
      on delete restrict;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'angebot_positionen_preisart_check'
  ) then
    alter table public.angebot_positionen
      add constraint angebot_positionen_preisart_check
      check (preisart is null or preisart in ('einmalig', 'monatlich'));
  end if;
end;
$$;

create unique index if not exists angebot_positionen_version_id_leistungsmodul_id_key
  on public.angebot_positionen (angebot_version_id, leistungsmodul_id)
  where leistungsmodul_id is not null;

create index if not exists idx_angebot_positionen_leistungsmodul_id
  on public.angebot_positionen (leistungsmodul_id);
