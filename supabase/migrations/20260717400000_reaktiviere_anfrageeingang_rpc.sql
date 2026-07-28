-- Migration 3.1b (Teil 8): RPC reaktiviere_anfrageeingang
--
-- Neue Objekte:
--   public.reaktiviere_anfrageeingang(...)
--
-- Unverändert: Tabellenstrukturen, /admin-RPCs, andere operative RPCs
-- Reaktivierung betrifft nur aktiv/archiviert_am — orthogonal zum Prozessstatus
--
-- Referenz: docs/fachkonzept/14-spezifikation-migration-3-anfrageeingang.md
--           docs/fachkonzept/15-spezifikation-m31-anfrageeingang-serverlogik.md
--           docs/adr/ADR-0016-operative-objektgrundlagen-rls-archivierung.md

-- ---------------------------------------------------------------------------
-- RPC: reaktiviere_anfrageeingang
-- ---------------------------------------------------------------------------

create or replace function public.reaktiviere_anfrageeingang(
  p_mandant_id uuid,
  p_anfrageeingang_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.anfrageeingaenge%rowtype;
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

  if v_row.aktiv is true and v_row.archiviert_am is null then
    return jsonb_build_object(
      'ok', true,
      'code', 'already_active',
      'idempotent', true,
      'anfrageeingang_id', p_anfrageeingang_id,
      'status', v_row.status
    );
  end if;

  if (v_row.aktiv is distinct from true and v_row.archiviert_am is null)
     or (v_row.aktiv is true and v_row.archiviert_am is not null) then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'archivierung'
    );
  end if;

  update public.anfrageeingaenge
  set
    aktiv = true,
    archiviert_am = null
  where id = p_anfrageeingang_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'reactivated',
    'idempotent', false,
    'anfrageeingang_id', p_anfrageeingang_id,
    'status', v_row.status
  );
end;
$$;

comment on function public.reaktiviere_anfrageeingang(
  uuid,
  uuid
) is
  'Reaktiviert einen archivierten Anfrageeingang (aktiv=true, archiviert_am=NULL). '
  'Orthogonal zum Prozessstatus — fachlicher Status und Zuordnungen bleiben unverändert. '
  'Idempotenz bei Replay. Nur Service Role.';

-- ---------------------------------------------------------------------------
-- Berechtigungen: kein PUBLIC/anon/authenticated
-- ---------------------------------------------------------------------------

revoke all on function public.reaktiviere_anfrageeingang(
  uuid,
  uuid
) from public;

revoke all on function public.reaktiviere_anfrageeingang(
  uuid,
  uuid
) from anon;

revoke all on function public.reaktiviere_anfrageeingang(
  uuid,
  uuid
) from authenticated;

grant execute on function public.reaktiviere_anfrageeingang(
  uuid,
  uuid
) to service_role;
