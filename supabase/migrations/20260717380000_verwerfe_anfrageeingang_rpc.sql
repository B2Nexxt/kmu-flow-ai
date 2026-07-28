-- Migration 3.1b (Teil 6): RPC verwerfe_anfrageeingang
--
-- Neue Objekte:
--   public.verwerfe_anfrageeingang(...)
--
-- Unverändert: Tabellenstrukturen, /admin-RPCs, andere operative RPCs
-- Terminaler Prozessstatus verworfen (ADR-0018, ADR-0019)
--
-- Referenz: docs/fachkonzept/14-spezifikation-migration-3-anfrageeingang.md
--           docs/fachkonzept/15-spezifikation-m31-anfrageeingang-serverlogik.md
--           docs/adr/ADR-0018-anfrageeingang-vor-vorgang.md
--           docs/adr/ADR-0019-atomare-ueberfuehrung-anfrageeingang-vorgang.md

-- ---------------------------------------------------------------------------
-- RPC: verwerfe_anfrageeingang
-- ---------------------------------------------------------------------------

create or replace function public.verwerfe_anfrageeingang(
  p_mandant_id uuid,
  p_anfrageeingang_id uuid,
  p_grund text,
  p_quelle text default 'manuell'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.anfrageeingaenge%rowtype;
  v_grund text;
  v_quelle text;
  v_neuer_grund jsonb;
  v_beendet_am timestamptz;
begin
  -- Grundvalidierung (vor Sperre)
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

  if p_grund is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'grund'
    );
  end if;

  v_grund := trim(p_grund);

  if length(v_grund) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'grund'
    );
  end if;

  if p_quelle is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'quelle'
    );
  end if;

  v_quelle := trim(p_quelle);

  if length(v_quelle) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'quelle'
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

  -- Anfrageeingang sperren
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

  -- Idempotenz: bereits verworfen — Grund bleibt unverändert
  if v_row.status = 'verworfen' then
    return jsonb_build_object(
      'ok', true,
      'code', 'already_discarded',
      'idempotent', true,
      'anfrageeingang_id', p_anfrageeingang_id,
      'status', 'verworfen',
      'beendet_am', v_row.beendet_am
    );
  end if;

  -- Konflikt: bereits einem Vorgang zugeordnet
  if v_row.zugeordneter_vorgang_id is not null or v_row.status = 'in_vorgang_ueberfuehrt' then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'zugeordneter_vorgang_id'
    );
  end if;

  if v_row.aktiv is distinct from true then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'aktiv'
    );
  end if;

  if v_row.status not in (
    'neu',
    'analysiert',
    'wartet_auf_informationen',
    'zur_manuellen_pruefung',
    'bereit_fuer_vorgang'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'status'
    );
  end if;

  v_neuer_grund := jsonb_set(
    coalesce(v_row.zuordnungsgrund, '{}'::jsonb),
    '{verwerfung}',
    jsonb_build_object(
      'grund', v_grund,
      'quelle', v_quelle,
      'zeitpunkt', to_jsonb(now())
    ),
    true
  );

  v_beendet_am := now();

  update public.anfrageeingaenge
  set
    status = 'verworfen',
    beendet_am = v_beendet_am,
    zuletzt_bearbeitet_am = v_beendet_am,
    manuelle_pruefung_erforderlich = false,
    zuordnungsgrund = v_neuer_grund
  where id = p_anfrageeingang_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'discarded',
    'idempotent', false,
    'anfrageeingang_id', p_anfrageeingang_id,
    'status', 'verworfen',
    'beendet_am', v_beendet_am
  );
end;
$$;

comment on function public.verwerfe_anfrageeingang(
  uuid,
  uuid,
  text,
  text
) is
  'Verwirft einen Anfrageeingang terminal (status=verworfen). Archivierung bleibt orthogonal. '
  'Kein Verwerfen nach Vorgangszuordnung. Idempotenz bei Replay. Nur Service Role.';

-- ---------------------------------------------------------------------------
-- Berechtigungen: kein PUBLIC/anon/authenticated
-- ---------------------------------------------------------------------------

revoke all on function public.verwerfe_anfrageeingang(
  uuid,
  uuid,
  text,
  text
) from public;

revoke all on function public.verwerfe_anfrageeingang(
  uuid,
  uuid,
  text,
  text
) from anon;

revoke all on function public.verwerfe_anfrageeingang(
  uuid,
  uuid,
  text,
  text
) from authenticated;

grant execute on function public.verwerfe_anfrageeingang(
  uuid,
  uuid,
  text,
  text
) to service_role;
