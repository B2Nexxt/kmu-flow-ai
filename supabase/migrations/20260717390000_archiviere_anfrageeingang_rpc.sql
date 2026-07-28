-- Migration 3.1b (Teil 7): RPC archiviere_anfrageeingang
--
-- Neue Objekte:
--   public.archiviere_anfrageeingang(...)
--
-- Unverändert: Tabellenstrukturen, /admin-RPCs, andere operative RPCs
-- Archivierung orthogonal zum Prozessstatus (M1/M2-Konvention aktiv/archiviert_am)
--
-- Referenz: docs/fachkonzept/14-spezifikation-migration-3-anfrageeingang.md
--           docs/fachkonzept/15-spezifikation-m31-anfrageeingang-serverlogik.md
--           docs/adr/ADR-0016-operative-objektgrundlagen-rls-archivierung.md

-- ---------------------------------------------------------------------------
-- RPC: archiviere_anfrageeingang
-- ---------------------------------------------------------------------------

create or replace function public.archiviere_anfrageeingang(
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
  v_archiviert_am timestamptz;
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

  if v_row.aktiv is distinct from true and v_row.archiviert_am is not null then
    return jsonb_build_object(
      'ok', true,
      'code', 'already_archived',
      'idempotent', true,
      'anfrageeingang_id', p_anfrageeingang_id,
      'archiviert_am', v_row.archiviert_am
    );
  end if;

  v_archiviert_am := now();

  update public.anfrageeingaenge
  set
    aktiv = false,
    archiviert_am = v_archiviert_am
  where id = p_anfrageeingang_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'archived',
    'idempotent', false,
    'anfrageeingang_id', p_anfrageeingang_id,
    'archiviert_am', v_archiviert_am
  );
end;
$$;

comment on function public.archiviere_anfrageeingang(
  uuid,
  uuid
) is
  'Archiviert einen Anfrageeingang (aktiv=false, archiviert_am=now()). '
  'Orthogonal zum Prozessstatus — terminal darf archiviert werden. Idempotenz bei Replay. Nur Service Role.';

-- ---------------------------------------------------------------------------
-- Berechtigungen: kein PUBLIC/anon/authenticated
-- ---------------------------------------------------------------------------

revoke all on function public.archiviere_anfrageeingang(
  uuid,
  uuid
) from public;

revoke all on function public.archiviere_anfrageeingang(
  uuid,
  uuid
) from anon;

revoke all on function public.archiviere_anfrageeingang(
  uuid,
  uuid
) from authenticated;

grant execute on function public.archiviere_anfrageeingang(
  uuid,
  uuid
) to service_role;
