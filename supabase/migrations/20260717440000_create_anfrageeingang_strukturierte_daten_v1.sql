-- Migration 3.1b (Teil 1b): create_anfrageeingang um p_strukturierte_daten erweitern
--
-- Additiv: p_strukturierte_daten jsonb DEFAULT '{}'::jsonb
-- Keine Änderung an vollstaendigkeitsstatus / manuelle_pruefung_erforderlich (bleiben wie bisher)
-- Bestehende Aufrufe ohne neuen Parameter bleiben kompatibel.

create or replace function public.create_anfrageeingang(
  p_mandant_id uuid,
  p_kanal text,
  p_betreff text default null,
  p_rohinhalt text default null,
  p_absender_name text default null,
  p_absender_email text default null,
  p_absender_telefon text default null,
  p_empfangen_am timestamptz default null,
  p_kanal_externe_id text default null,
  p_inhalt_hash text default null,
  p_parent_anfrageeingang_id uuid default null,
  p_konversation_id uuid default null,
  p_strukturierte_daten jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_kanal text;
  v_betreff text;
  v_rohinhalt text;
  v_absender_name text;
  v_absender_email text;
  v_absender_telefon text;
  v_kanal_externe_id text;
  v_inhalt_hash text;
  v_empfangen_am timestamptz;
  v_strukturierte_daten jsonb;
  v_jahr integer;
  v_seq integer;
  v_eingangsnummer text;
  v_anfrageeingang_id uuid;
  v_existing_id uuid;
  v_existing_nummer text;
  v_parent_mandant_id uuid;
begin
  if p_mandant_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'mandant_id'
    );
  end if;

  if p_kanal is null or length(trim(p_kanal)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'kanal'
    );
  end if;

  v_kanal := trim(p_kanal);

  if v_kanal not in (
    'telefon',
    'email',
    'kontaktformular',
    'whatsapp',
    'sms',
    'persoenlich',
    'empfehlung',
    'sonstiges'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'kanal'
    );
  end if;

  v_betreff := nullif(trim(p_betreff), '');
  v_rohinhalt := nullif(trim(p_rohinhalt), '');
  v_absender_name := nullif(trim(p_absender_name), '');
  v_absender_email := nullif(trim(p_absender_email), '');
  v_absender_telefon := nullif(trim(p_absender_telefon), '');
  v_kanal_externe_id := nullif(trim(p_kanal_externe_id), '');
  v_inhalt_hash := nullif(trim(p_inhalt_hash), '');
  v_strukturierte_daten := coalesce(p_strukturierte_daten, '{}'::jsonb);

  if p_betreff is not null and v_betreff is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'betreff'
    );
  end if;

  if p_rohinhalt is not null and v_rohinhalt is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'rohinhalt'
    );
  end if;

  if p_absender_name is not null and v_absender_name is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'absender_name'
    );
  end if;

  if p_absender_email is not null and v_absender_email is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'absender_email'
    );
  end if;

  if p_absender_telefon is not null and v_absender_telefon is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'absender_telefon'
    );
  end if;

  if p_kanal_externe_id is not null and v_kanal_externe_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'kanal_externe_id'
    );
  end if;

  if p_inhalt_hash is not null and v_inhalt_hash is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'inhalt_hash'
    );
  end if;

  if jsonb_typeof(v_strukturierte_daten) <> 'object' then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'strukturierte_daten'
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

  v_empfangen_am := coalesce(p_empfangen_am, now());
  v_jahr := extract(year from v_empfangen_am)::integer;

  if v_jahr < 2000 or v_jahr > 9999 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'empfangen_am'
    );
  end if;

  if (
    v_rohinhalt is null
    and v_betreff is null
    and v_absender_name is null
    and v_absender_email is null
    and v_absender_telefon is null
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'inhalt'
    );
  end if;

  if p_parent_anfrageeingang_id is not null then
    select ae.mandant_id
    into v_parent_mandant_id
    from public.anfrageeingaenge ae
    where ae.id = p_parent_anfrageeingang_id;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'not_found',
        'field', 'parent_anfrageeingang_id'
      );
    end if;

    if v_parent_mandant_id is distinct from p_mandant_id then
      return jsonb_build_object(
        'ok', false,
        'code', 'cross_tenant_reference',
        'field', 'parent_anfrageeingang_id'
      );
    end if;
  end if;

  if v_kanal_externe_id is not null then
    perform pg_advisory_xact_lock(
      hashtext(p_mandant_id::text || '|' || v_kanal || '|' || v_kanal_externe_id)
    );

    select ae.id, ae.eingangsnummer
    into v_existing_id, v_existing_nummer
    from public.anfrageeingaenge ae
    where ae.mandant_id = p_mandant_id
      and ae.kanal = v_kanal
      and ae.kanal_externe_id = v_kanal_externe_id;

    if found then
      return jsonb_build_object(
        'ok', true,
        'code', 'duplicate_external_message',
        'idempotent', true,
        'anfrageeingang_id', v_existing_id,
        'eingangsnummer', v_existing_nummer
      );
    end if;
  end if;

  insert into public.eingangsnummer_sequenzen (
    mandant_id,
    jahr,
    letzter_wert
  )
  values (
    p_mandant_id,
    v_jahr,
    1
  )
  on conflict (mandant_id, jahr)
  do update
    set letzter_wert = public.eingangsnummer_sequenzen.letzter_wert + 1
  returning public.eingangsnummer_sequenzen.letzter_wert into v_seq;

  v_eingangsnummer := format(
    'AE-%s-%s',
    v_jahr,
    lpad(v_seq::text, 4, '0')
  );

  begin
    insert into public.anfrageeingaenge (
      mandant_id,
      eingangsnummer,
      kanal,
      status,
      betreff,
      rohinhalt,
      strukturierte_daten,
      absender_name,
      absender_email,
      absender_telefon,
      empfangen_am,
      kanal_externe_id,
      inhalt_hash,
      parent_anfrageeingang_id,
      konversation_id,
      zuordnungsstatus,
      vollstaendigkeitsstatus,
      dringlichkeit,
      manuelle_pruefung_erforderlich,
      aktiv
    )
    values (
      p_mandant_id,
      v_eingangsnummer,
      v_kanal,
      'neu',
      v_betreff,
      v_rohinhalt,
      v_strukturierte_daten,
      v_absender_name,
      v_absender_email,
      v_absender_telefon,
      v_empfangen_am,
      v_kanal_externe_id,
      v_inhalt_hash,
      p_parent_anfrageeingang_id,
      p_konversation_id,
      'kein_treffer',
      'unbekannt',
      'normal',
      false,
      true
    )
    returning id into v_anfrageeingang_id;
  exception
    when unique_violation then
      if v_kanal_externe_id is not null then
        select ae.id, ae.eingangsnummer
        into v_existing_id, v_existing_nummer
        from public.anfrageeingaenge ae
        where ae.mandant_id = p_mandant_id
          and ae.kanal = v_kanal
          and ae.kanal_externe_id = v_kanal_externe_id;

        if found then
          return jsonb_build_object(
            'ok', true,
            'code', 'duplicate_external_message',
            'idempotent', true,
            'anfrageeingang_id', v_existing_id,
            'eingangsnummer', v_existing_nummer
          );
        end if;
      end if;

      raise;
  end;

  return jsonb_build_object(
    'ok', true,
    'code', 'created',
    'idempotent', false,
    'anfrageeingang_id', v_anfrageeingang_id,
    'eingangsnummer', v_eingangsnummer
  );
end;
$$;

comment on function public.create_anfrageeingang(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  uuid,
  uuid,
  jsonb
) is
  'Legt operativen Anfrageeingang an (status=neu), vergibt AE-YYYY-NNNN atomar. '
  'Optional p_strukturierte_daten (Objekt, Default {}). '
  'Idempotent bei gleicher mandant_id+kanal+kanal_externe_id. Nur Service Role (ADR-0019).';

revoke all on function public.create_anfrageeingang(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  uuid,
  uuid,
  jsonb
) from public;

revoke all on function public.create_anfrageeingang(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  uuid,
  uuid,
  jsonb
) from anon;

revoke all on function public.create_anfrageeingang(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  uuid,
  uuid,
  jsonb
) from authenticated;

grant execute on function public.create_anfrageeingang(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  uuid,
  uuid,
  jsonb
) to service_role;
