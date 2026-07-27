-- Migration 3.1b (Teil 3): RPC bestaetige_anfrageeingang_zuordnung
--
-- Neue Objekte:
--   public.bestaetige_anfrageeingang_zuordnung(...)
--
-- Unverändert: Tabellenstrukturen, /admin-RPCs, andere operative RPCs
-- Finale Zuordnung ausschließlich über diese RPC (ADR-0008, ADR-0018, ADR-0019)
--
-- Referenz: docs/fachkonzept/14-spezifikation-migration-3-anfrageeingang.md
--           docs/fachkonzept/15-spezifikation-m31-anfrageeingang-serverlogik.md

-- ---------------------------------------------------------------------------
-- RPC: bestaetige_anfrageeingang_zuordnung
-- ---------------------------------------------------------------------------

create or replace function public.bestaetige_anfrageeingang_zuordnung(
  p_mandant_id uuid,
  p_anfrageeingang_id uuid,
  p_kunde_id uuid,
  p_gebaeude_id uuid,
  p_einheit_id uuid default null,
  p_bestaetigungsquelle text default 'manuell'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.anfrageeingaenge%rowtype;
  v_bestaetigungsquelle text;
  v_neuer_status text;
  v_neuer_grund jsonb;
  v_kunde_mandant_id uuid;
  v_kunde_aktiv boolean;
  v_kunde_status text;
  v_gebaeude_mandant_id uuid;
  v_gebaeude_aktiv boolean;
  v_einheit_mandant_id uuid;
  v_einheit_gebaeude_id uuid;
  v_einheit_aktiv boolean;
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

  if p_kunde_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'kunde_id'
    );
  end if;

  if p_gebaeude_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'gebaeude_id'
    );
  end if;

  if p_bestaetigungsquelle is null or length(trim(p_bestaetigungsquelle)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'bestaetigungsquelle'
    );
  end if;

  v_bestaetigungsquelle := trim(p_bestaetigungsquelle);

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

  if v_row.aktiv is distinct from true then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'anfrageeingang_id'
    );
  end if;

  if v_row.zugeordneter_vorgang_id is not null then
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

  -- Idempotenz: bereits bestätigte identische Zuordnung
  if v_row.zuordnungsstatus = 'bestaetigt' then
    if v_row.zugeordnet_kunde_id = p_kunde_id
      and v_row.zugeordnet_gebaeude_id = p_gebaeude_id
      and v_row.zugeordnet_einheit_id is not distinct from p_einheit_id then
      return jsonb_build_object(
        'ok', true,
        'code', 'already_confirmed',
        'idempotent', true,
        'anfrageeingang_id', p_anfrageeingang_id,
        'kunde_id', p_kunde_id,
        'gebaeude_id', p_gebaeude_id,
        'einheit_id', p_einheit_id,
        'status', v_row.status,
        'zuordnungsstatus', 'bestaetigt'
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'zuordnung'
    );
  end if;

  if v_row.status = 'neu' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'status'
    );
  end if;

  if v_row.status = 'bereit_fuer_vorgang' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'status'
    );
  end if;

  if v_row.zuordnungsstatus = 'nicht_erforderlich' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'zuordnungsstatus'
    );
  end if;

  if v_row.zuordnungsstatus not in (
    'kein_treffer',
    'eindeutig',
    'moeglicher_treffer',
    'mehrere_treffer',
    'konflikt'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'zuordnungsstatus'
    );
  end if;

  -- Kunde prüfen
  select k.mandant_id, k.aktiv, k.kundenstatus
  into v_kunde_mandant_id, v_kunde_aktiv, v_kunde_status
  from public.kunden k
  where k.id = p_kunde_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'field', 'kunde_id'
    );
  end if;

  if v_kunde_mandant_id is distinct from p_mandant_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'cross_tenant_reference',
      'field', 'kunde_id'
    );
  end if;

  if v_kunde_aktiv is distinct from true then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'kunde_id'
    );
  end if;

  if v_kunde_status not in ('vorlaeufig', 'bestaetigt') then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'kunde_id'
    );
  end if;

  -- Gebäude prüfen
  select g.mandant_id, g.aktiv
  into v_gebaeude_mandant_id, v_gebaeude_aktiv
  from public.gebaeude g
  where g.id = p_gebaeude_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'field', 'gebaeude_id'
    );
  end if;

  if v_gebaeude_mandant_id is distinct from p_mandant_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'cross_tenant_reference',
      'field', 'gebaeude_id'
    );
  end if;

  if v_gebaeude_aktiv is distinct from true then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'gebaeude_id'
    );
  end if;

  -- Einheit prüfen (optional)
  if p_einheit_id is not null then
    select e.mandant_id, e.gebaeude_id, e.aktiv
    into v_einheit_mandant_id, v_einheit_gebaeude_id, v_einheit_aktiv
    from public.einheiten e
    where e.id = p_einheit_id;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'not_found',
        'field', 'einheit_id'
      );
    end if;

    if v_einheit_mandant_id is distinct from p_mandant_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'cross_tenant_reference',
        'field', 'einheit_id'
      );
    end if;

    if v_einheit_gebaeude_id is distinct from p_gebaeude_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'conflict',
        'field', 'einheit_id'
      );
    end if;

    if v_einheit_aktiv is distinct from true then
      return jsonb_build_object(
        'ok', false,
        'code', 'conflict',
        'field', 'einheit_id'
      );
    end if;
  end if;

  if v_row.vollstaendigkeitsstatus in ('ausreichend_fuer_vorgang', 'vollstaendig') then
    v_neuer_status := 'bereit_fuer_vorgang';
  else
    v_neuer_status := 'wartet_auf_informationen';
  end if;

  v_neuer_grund := jsonb_set(
    coalesce(v_row.zuordnungsgrund, '{}'::jsonb),
    '{bestaetigung}',
    jsonb_build_object(
      'quelle', v_bestaetigungsquelle,
      'zeitpunkt', to_jsonb(now())
    ),
    true
  );

  update public.anfrageeingaenge
  set
    zugeordnet_kunde_id = p_kunde_id,
    zugeordnet_gebaeude_id = p_gebaeude_id,
    zugeordnet_einheit_id = p_einheit_id,
    zuordnungsstatus = 'bestaetigt',
    zuordnungsgrund = v_neuer_grund,
    manuelle_pruefung_erforderlich = false,
    status = v_neuer_status,
    zuletzt_bearbeitet_am = now()
  where id = p_anfrageeingang_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'confirmed',
    'idempotent', false,
    'anfrageeingang_id', p_anfrageeingang_id,
    'kunde_id', p_kunde_id,
    'gebaeude_id', p_gebaeude_id,
    'einheit_id', p_einheit_id,
    'status', v_neuer_status,
    'zuordnungsstatus', 'bestaetigt'
  );
end;
$$;

comment on function public.bestaetige_anfrageeingang_zuordnung(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text
) is
  'Bestätigt finale Kunde/Gebäude/Einheit-Zuordnung atomar. Kein status=neu, kein nicht_erforderlich. '
  'Idempotenz bei identischer Zuordnung. Zielstatus aus vollstaendigkeitsstatus. Nur Service Role.';

-- ---------------------------------------------------------------------------
-- Berechtigungen: kein PUBLIC/anon/authenticated
-- ---------------------------------------------------------------------------

revoke all on function public.bestaetige_anfrageeingang_zuordnung(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text
) from public;

revoke all on function public.bestaetige_anfrageeingang_zuordnung(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text
) from anon;

revoke all on function public.bestaetige_anfrageeingang_zuordnung(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text
) from authenticated;

grant execute on function public.bestaetige_anfrageeingang_zuordnung(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text
) to service_role;
