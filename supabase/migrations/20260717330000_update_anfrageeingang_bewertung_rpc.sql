-- Migration 3.1b (Teil 2): RPC update_anfrageeingang_bewertung
--
-- Neue Objekte:
--   public.update_anfrageeingang_bewertung(...)
--
-- Unverändert: Tabellenstrukturen, /admin-RPCs, andere operative RPCs
-- Keine finalen Zuordnungs-FKs, kein zuordnungsstatus=bestaetigt (ADR-0008, ADR-0018)
--
-- Referenz: docs/fachkonzept/14-spezifikation-migration-3-anfrageeingang.md
--           docs/fachkonzept/15-spezifikation-m31-anfrageeingang-serverlogik.md
--           ADR-0008, ADR-0018, ADR-0019

-- ---------------------------------------------------------------------------
-- RPC: update_anfrageeingang_bewertung
-- ---------------------------------------------------------------------------

create or replace function public.update_anfrageeingang_bewertung(
  p_mandant_id uuid,
  p_anfrageeingang_id uuid,
  p_strukturierte_daten jsonb,
  p_zuordnungsstatus text,
  p_zuordnungsgrund jsonb,
  p_zuordnungskandidaten jsonb,
  p_vollstaendigkeitsstatus text,
  p_fehlende_angaben jsonb,
  p_confidence_score numeric default null,
  p_dringlichkeit text default 'normal',
  p_manuelle_pruefung_erforderlich boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.anfrageeingaenge%rowtype;
  v_neuer_status text;
  v_manuelle_pruefung boolean;
  v_elem jsonb;
  v_match_count integer := 0;
  v_typ text;
  v_typ_list text[] := '{}';
  v_distinct_typ_count integer;
begin
  if p_mandant_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'mandant_id'
    );
  end if;

  if p_anfrageeingang_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'anfrageeingang_id'
    );
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_mandant_id
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'field', 'mandant_id'
    );
  end if;

  if p_strukturierte_daten is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'strukturierte_daten'
    );
  end if;

  if p_zuordnungsstatus is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'zuordnungsstatus'
    );
  end if;

  if p_zuordnungsgrund is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'zuordnungsgrund'
    );
  end if;

  if p_zuordnungskandidaten is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'zuordnungskandidaten'
    );
  end if;

  if p_vollstaendigkeitsstatus is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'vollstaendigkeitsstatus'
    );
  end if;

  if p_fehlende_angaben is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'fehlende_angaben'
    );
  end if;

  if jsonb_typeof(p_strukturierte_daten) <> 'object' then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'strukturierte_daten'
    );
  end if;

  if jsonb_typeof(p_zuordnungsgrund) <> 'object' then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'zuordnungsgrund'
    );
  end if;

  if jsonb_typeof(p_zuordnungskandidaten) <> 'array' then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'zuordnungskandidaten'
    );
  end if;

  if jsonb_typeof(p_fehlende_angaben) <> 'array' then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'fehlende_angaben'
    );
  end if;

  if p_zuordnungsstatus = 'bestaetigt' then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'zuordnungsstatus'
    );
  end if;

  if p_zuordnungsstatus not in (
    'kein_treffer',
    'eindeutig',
    'moeglicher_treffer',
    'mehrere_treffer',
    'konflikt',
    'nicht_erforderlich'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'zuordnungsstatus'
    );
  end if;

  if p_vollstaendigkeitsstatus not in (
    'unbekannt',
    'unvollstaendig',
    'ausreichend_fuer_rueckfrage',
    'ausreichend_fuer_vorgang',
    'vollstaendig'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'vollstaendigkeitsstatus'
    );
  end if;

  if p_dringlichkeit not in ('niedrig', 'normal', 'hoch', 'dringend') then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'dringlichkeit'
    );
  end if;

  if p_confidence_score is not null
    and (p_confidence_score < 0 or p_confidence_score > 1) then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'confidence_score'
    );
  end if;

  -- Zwei-Merkmale-Regel (ADR-0008): Strukturprüfung bei eindeutig
  if p_zuordnungsstatus = 'eindeutig' then
    if not (p_zuordnungsgrund ? 'merkmale')
      or jsonb_typeof(p_zuordnungsgrund->'merkmale') <> 'array' then
      return jsonb_build_object(
        'ok', false,
        'code', 'insufficient_data',
        'field', 'zuordnungsgrund'
      );
    end if;

    if p_zuordnungsgrund ? 'widersprueche'
      and jsonb_typeof(p_zuordnungsgrund->'widersprueche') = 'array'
      and jsonb_array_length(p_zuordnungsgrund->'widersprueche') > 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'insufficient_data',
        'field', 'zuordnungsgrund'
      );
    end if;

    for v_elem in
      select value
      from jsonb_array_elements(p_zuordnungsgrund->'merkmale')
    loop
      if coalesce(v_elem->>'ergebnis', '') = 'uebereinstimmung'
        and nullif(trim(v_elem->>'typ'), '') is not null then
        v_match_count := v_match_count + 1;
        v_typ := trim(v_elem->>'typ');
        if not v_typ = any (v_typ_list) then
          v_typ_list := array_append(v_typ_list, v_typ);
        end if;
      end if;
    end loop;

    v_distinct_typ_count := coalesce(array_length(v_typ_list, 1), 0);

    if v_match_count < 2 or v_distinct_typ_count < 2 then
      return jsonb_build_object(
        'ok', false,
        'code', 'insufficient_data',
        'field', 'zuordnungsgrund'
      );
    end if;
  end if;

  select ae.*
  into v_row
  from public.anfrageeingaenge ae
  where ae.id = p_anfrageeingang_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'field', 'anfrageeingang_id'
    );
  end if;

  if v_row.mandant_id is distinct from p_mandant_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'cross_tenant_reference',
      'field', 'anfrageeingang_id'
    );
  end if;

  if v_row.status not in (
    'neu',
    'analysiert',
    'wartet_auf_informationen',
    'zur_manuellen_pruefung'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'status'
    );
  end if;

  -- manuelle_pruefung_erforderlich: RPC setzt bei Prüfpflicht-Status deterministisch true
  if p_zuordnungsstatus in ('moeglicher_treffer', 'mehrere_treffer', 'konflikt') then
    v_manuelle_pruefung := true;
  else
    v_manuelle_pruefung := p_manuelle_pruefung_erforderlich;
  end if;

  -- Statusermittlung (Priorität: manuelle Prüfung > fehlende Infos > analysiert)
  if p_zuordnungsstatus in ('konflikt', 'mehrere_treffer', 'moeglicher_treffer') then
    v_neuer_status := 'zur_manuellen_pruefung';
  elsif p_vollstaendigkeitsstatus in ('unvollstaendig', 'ausreichend_fuer_rueckfrage') then
    v_neuer_status := 'wartet_auf_informationen';
  else
    v_neuer_status := 'analysiert';
  end if;

  update public.anfrageeingaenge
  set
    strukturierte_daten = p_strukturierte_daten,
    zuordnungsstatus = p_zuordnungsstatus,
    zuordnungsgrund = p_zuordnungsgrund,
    zuordnungskandidaten = p_zuordnungskandidaten,
    vollstaendigkeitsstatus = p_vollstaendigkeitsstatus,
    fehlende_angaben = p_fehlende_angaben,
    confidence_score = p_confidence_score,
    dringlichkeit = p_dringlichkeit,
    manuelle_pruefung_erforderlich = v_manuelle_pruefung,
    status = v_neuer_status,
    zuletzt_bearbeitet_am = now()
  where id = p_anfrageeingang_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'updated',
    'anfrageeingang_id', p_anfrageeingang_id,
    'status', v_neuer_status,
    'zuordnungsstatus', p_zuordnungsstatus,
    'vollstaendigkeitsstatus', p_vollstaendigkeitsstatus,
    'manuelle_pruefung_erforderlich', v_manuelle_pruefung
  );
end;
$$;

comment on function public.update_anfrageeingang_bewertung(
  uuid,
  uuid,
  jsonb,
  text,
  jsonb,
  jsonb,
  text,
  jsonb,
  numeric,
  text,
  boolean
) is
  'Speichert Bewertungsmetadaten ohne finale Zuordnung. zuordnungsstatus=bestaetigt verboten. '
  'Zwei-Merkmale-Strukturprüfung bei eindeutig (ADR-0008). Status deterministisch aus Zuordnung/Vollständigkeit. '
  'Nur serverseitig über Service Role.';

-- ---------------------------------------------------------------------------
-- Berechtigungen: kein PUBLIC/anon/authenticated
-- ---------------------------------------------------------------------------

revoke all on function public.update_anfrageeingang_bewertung(
  uuid,
  uuid,
  jsonb,
  text,
  jsonb,
  jsonb,
  text,
  jsonb,
  numeric,
  text,
  boolean
) from public;

revoke all on function public.update_anfrageeingang_bewertung(
  uuid,
  uuid,
  jsonb,
  text,
  jsonb,
  jsonb,
  text,
  jsonb,
  numeric,
  text,
  boolean
) from anon;

revoke all on function public.update_anfrageeingang_bewertung(
  uuid,
  uuid,
  jsonb,
  text,
  jsonb,
  jsonb,
  text,
  jsonb,
  numeric,
  text,
  boolean
) from authenticated;

grant execute on function public.update_anfrageeingang_bewertung(
  uuid,
  uuid,
  jsonb,
  text,
  jsonb,
  jsonb,
  text,
  jsonb,
  numeric,
  text,
  boolean
) to service_role;
