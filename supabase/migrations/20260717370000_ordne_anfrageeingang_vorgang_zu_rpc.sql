-- Migration 3.1b (Teil 5): RPC ordne_anfrageeingang_vorgang_zu
--
-- Neue Objekte:
--   public.ordne_anfrageeingang_vorgang_zu(...)
--
-- Unverändert: Tabellenstrukturen, /admin-RPCs, andere operative RPCs
-- Ordnet einen Anfrageeingang einem bestehenden Vorgang zu (ADR-0018, ADR-0019)
--
-- Referenz: docs/fachkonzept/15-spezifikation-m31-anfrageeingang-serverlogik.md
--           docs/adr/ADR-0018-anfrageeingang-vor-vorgang.md
--           docs/adr/ADR-0019-atomare-ueberfuehrung-anfrageeingang-vorgang.md

-- ---------------------------------------------------------------------------
-- RPC: ordne_anfrageeingang_vorgang_zu
-- ---------------------------------------------------------------------------

create or replace function public.ordne_anfrageeingang_vorgang_zu(
  p_mandant_id uuid,
  p_anfrageeingang_id uuid,
  p_vorgang_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.anfrageeingaenge%rowtype;
  v_vorgang public.vorgaenge%rowtype;
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

  if p_vorgang_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'vorgang_id'
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

  -- Idempotenz vor pauschaler Status-Ablehnung (in_vorgang_ueberfuehrt)
  if v_row.zugeordneter_vorgang_id is not null then
    if v_row.zugeordneter_vorgang_id is distinct from p_vorgang_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'conflict',
        'field', 'zugeordneter_vorgang_id'
      );
    end if;

    select v.*
    into v_vorgang
    from public.vorgaenge v
    where v.id = v_row.zugeordneter_vorgang_id;

    if not found then
      raise exception
        'ordne_anfrageeingang_vorgang_zu: zugeordneter_vorgang_id ohne Vorgang (Dateninkonsistenz)';
    end if;

    if v_vorgang.mandant_id is distinct from p_mandant_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'cross_tenant_reference',
        'field', 'anfrageeingang_id'
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'code', 'already_converted',
      'idempotent', true,
      'anfrageeingang_id', p_anfrageeingang_id,
      'vorgang_id', v_vorgang.id,
      'vorgangsnummer', v_vorgang.vorgangsnummer
    );
  end if;

  if v_row.aktiv is distinct from true then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'anfrageeingang_id'
    );
  end if;

  if v_row.status in ('in_vorgang_ueberfuehrt', 'verworfen') then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'status'
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

  -- Vorgang prüfen
  select v.*
  into v_vorgang
  from public.vorgaenge v
  where v.id = p_vorgang_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'field', 'vorgang_id'
    );
  end if;

  if v_vorgang.mandant_id is distinct from p_mandant_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'cross_tenant_reference',
      'field', 'vorgang_id'
    );
  end if;

  if v_vorgang.aktiv is distinct from true or v_vorgang.archiviert_am is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'vorgang_id'
    );
  end if;

  if v_vorgang.status = 'abgebrochen' then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'vorgang_id'
    );
  end if;

  -- Objektkontext: nur wenn Eingang bereits finale Objekt-FKs hat
  if v_row.zugeordnet_gebaeude_id is not null
    and v_vorgang.gebaeude_id is distinct from v_row.zugeordnet_gebaeude_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'objektkontext'
    );
  end if;

  if v_row.zugeordnet_einheit_id is not null
    and v_vorgang.einheit_id is distinct from v_row.zugeordnet_einheit_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'objektkontext'
    );
  end if;

  -- Anfrageeingang abschließen (nur zulässige Felder)
  update public.anfrageeingaenge
  set
    zugeordneter_vorgang_id = p_vorgang_id,
    status = 'in_vorgang_ueberfuehrt',
    beendet_am = now(),
    zuletzt_bearbeitet_am = now(),
    manuelle_pruefung_erforderlich = false
  where id = p_anfrageeingang_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'assigned',
    'idempotent', false,
    'anfrageeingang_id', p_anfrageeingang_id,
    'vorgang_id', v_vorgang.id,
    'vorgangsnummer', v_vorgang.vorgangsnummer,
    'status', 'in_vorgang_ueberfuehrt'
  );
end;
$$;

comment on function public.ordne_anfrageeingang_vorgang_zu(
  uuid,
  uuid,
  uuid
) is
  'Ordnet einen Anfrageeingang einem bestehenden Vorgang zu (Ergänzungsmail/Telefonnotiz). '
  'Kein neuer Vorgang, keine Beteiligten, keine Nummernvergabe. Idempotenz bei Replay. '
  'Nur Service Role.';

-- ---------------------------------------------------------------------------
-- Berechtigungen: kein PUBLIC/anon/authenticated
-- ---------------------------------------------------------------------------

revoke all on function public.ordne_anfrageeingang_vorgang_zu(
  uuid,
  uuid,
  uuid
) from public;

revoke all on function public.ordne_anfrageeingang_vorgang_zu(
  uuid,
  uuid,
  uuid
) from anon;

revoke all on function public.ordne_anfrageeingang_vorgang_zu(
  uuid,
  uuid,
  uuid
) from authenticated;

grant execute on function public.ordne_anfrageeingang_vorgang_zu(
  uuid,
  uuid,
  uuid
) to service_role;
