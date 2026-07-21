-- RPC: erstelle_neue_angebotsversion
-- Kopiert die höchste Angebotsversion inkl. Positionen als neue offene Version.
-- Keine Angebotsnummern- oder Statusänderung am Container.

create or replace function public.erstelle_neue_angebotsversion(p_angebot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_open_version_count integer;
  v_source_version record;
  v_new_version_id uuid;
  v_new_version_nr integer;
  v_position_count integer;
begin
  if p_angebot_id is null then
    raise exception 'angebot_id fehlt';
  end if;

  select a.status
  into v_status
  from public.angebote a
  where a.id = p_angebot_id
  for update;

  if not found then
    raise exception 'Angebot nicht gefunden: %', p_angebot_id;
  end if;

  if v_status = 'entwurf' then
    raise exception 'Neue Version ist nur bei Status ungleich entwurf möglich, ist: %', v_status;
  end if;

  select count(*)
  into v_open_version_count
  from public.angebot_versionen av
  where av.angebot_id = p_angebot_id
    and av.ist_eingefroren = false;

  if v_open_version_count <> 0 then
    raise exception
      'Es darf keine offene Version vorhanden sein, gefunden: %',
      v_open_version_count;
  end if;

  select *
  into v_source_version
  from public.angebot_versionen av
  where av.angebot_id = p_angebot_id
  order by av.version_nr desc
  limit 1;

  if not found then
    raise exception 'Keine Basisversion zum Kopieren gefunden';
  end if;

  v_new_version_nr := v_source_version.version_nr + 1;

  select count(*)
  into v_position_count
  from public.angebot_positionen ap
  where ap.angebot_version_id = v_source_version.id;

  if v_position_count < 1 then
    raise exception 'Basisversion enthält keine Positionen';
  end if;

  insert into public.angebot_versionen (
    angebot_id,
    version_nr,
    angebot_datum,
    gueltig_bis,
    betreff,
    einleitungstext,
    schlusstext,
    empfaenger_firmenname,
    empfaenger_rechtsform,
    empfaenger_strasse,
    empfaenger_hausnummer,
    empfaenger_plz,
    empfaenger_ort,
    empfaenger_land,
    empfaenger_ansprechpartner,
    empfaenger_email,
    empfaenger_telefon,
    empfaenger_umsatzsteuer_id,
    ist_eingefroren,
    freigegeben_am,
    versendet_am,
    angenommen_am,
    pdf_storage_path,
    pdf_erstellt_am
  )
  values (
    p_angebot_id,
    v_new_version_nr,
    v_source_version.angebot_datum,
    v_source_version.gueltig_bis,
    v_source_version.betreff,
    v_source_version.einleitungstext,
    v_source_version.schlusstext,
    v_source_version.empfaenger_firmenname,
    v_source_version.empfaenger_rechtsform,
    v_source_version.empfaenger_strasse,
    v_source_version.empfaenger_hausnummer,
    v_source_version.empfaenger_plz,
    v_source_version.empfaenger_ort,
    v_source_version.empfaenger_land,
    v_source_version.empfaenger_ansprechpartner,
    v_source_version.empfaenger_email,
    v_source_version.empfaenger_telefon,
    v_source_version.empfaenger_umsatzsteuer_id,
    false,
    null,
    null,
    null,
    null,
    null
  )
  returning id into v_new_version_id;

  insert into public.angebot_positionen (
    angebot_version_id,
    position_nr,
    bezeichnung,
    beschreibung,
    menge,
    einheit,
    einzelpreis_netto_cents,
    rabatt_prozent,
    umsatzsteuer_satz
  )
  select
    v_new_version_id,
    ap.position_nr,
    ap.bezeichnung,
    ap.beschreibung,
    ap.menge,
    ap.einheit,
    ap.einzelpreis_netto_cents,
    ap.rabatt_prozent,
    ap.umsatzsteuer_satz
  from public.angebot_positionen ap
  where ap.angebot_version_id = v_source_version.id
  order by ap.position_nr;

  return v_new_version_id;
exception
  when others then
    raise;
end;
$$;

grant execute on function public.erstelle_neue_angebotsversion(uuid) to service_role;

-- Bearbeitung offener Versionen auch bei Container-Status != entwurf (z. B. nach neuer Version)

create or replace function public.update_angebot_entwurf(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_angebot_id uuid;
  v_expected_updated_at timestamptz;
  v_version record;
  v_open_version_count integer;
  v_version_json jsonb;
  v_empfaenger jsonb;
  v_position jsonb;
  v_angebot_datum date;
  v_gueltig_bis date;
  v_position_nr integer;
  v_menge numeric(12, 3);
  v_einzelpreis_netto_cents bigint;
  v_rabatt_prozent numeric(5, 2);
  v_umsatzsteuer_satz smallint;
  v_seen_position_nrs integer[] := '{}';
begin
  if payload is null then
    raise exception 'Payload fehlt';
  end if;

  if jsonb_typeof(payload) <> 'object' then
    raise exception 'Payload muss ein JSON-Objekt sein';
  end if;

  if nullif(trim(payload->>'angebot_id'), '') is null then
    raise exception 'angebot_id fehlt';
  end if;

  begin
    v_angebot_id := (payload->>'angebot_id')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'angebot_id ist ungültig';
  end;

  if nullif(trim(payload->>'version_updated_at'), '') is null then
    raise exception 'version_updated_at fehlt';
  end if;

  begin
    v_expected_updated_at := (payload->>'version_updated_at')::timestamptz;
  exception
    when invalid_text_representation then
      raise exception 'version_updated_at ist ungültig';
  end;

  perform 1
  from public.angebote
  where id = v_angebot_id
  for update;

  if not found then
    raise exception 'Angebot nicht gefunden: %', v_angebot_id;
  end if;

  select count(*)
  into v_open_version_count
  from public.angebot_versionen
  where angebot_id = v_angebot_id
    and ist_eingefroren = false;

  if v_open_version_count <> 1 then
    raise exception 'Es muss genau eine offene Version vorhanden sein (gefunden: %)', v_open_version_count;
  end if;

  select *
  into v_version
  from public.angebot_versionen
  where angebot_id = v_angebot_id
    and ist_eingefroren = false
  for update;

  if v_version.updated_at is distinct from v_expected_updated_at then
    raise exception 'VERSION_CONFLICT: Die Angebotsversion wurde zwischenzeitlich geändert. Bitte laden Sie die Seite neu.';
  end if;

  v_version_json := payload->'version';
  if v_version_json is null or jsonb_typeof(v_version_json) <> 'object' then
    raise exception 'version fehlt oder ist ungültig';
  end if;

  v_empfaenger := v_version_json->'empfaenger';
  if v_empfaenger is null or jsonb_typeof(v_empfaenger) <> 'object' then
    raise exception 'version.empfaenger fehlt oder ist ungültig';
  end if;

  if nullif(trim(v_empfaenger->>'firmenname'), '') is null then
    raise exception 'version.empfaenger.firmenname fehlt';
  end if;

  if nullif(trim(v_version_json->>'angebot_datum'), '') is null then
    raise exception 'version.angebot_datum fehlt';
  end if;

  begin
    v_angebot_datum := (v_version_json->>'angebot_datum')::date;
  exception
    when invalid_text_representation then
      raise exception 'version.angebot_datum ist ungültig';
  end;

  if nullif(trim(v_version_json->>'gueltig_bis'), '') is null then
    raise exception 'version.gueltig_bis fehlt';
  end if;

  begin
    v_gueltig_bis := (v_version_json->>'gueltig_bis')::date;
  exception
    when invalid_text_representation then
      raise exception 'version.gueltig_bis ist ungültig';
  end;

  if v_gueltig_bis < v_angebot_datum then
    raise exception 'version.gueltig_bis muss >= version.angebot_datum sein';
  end if;

  if payload->'positionen' is null or jsonb_typeof(payload->'positionen') <> 'array' then
    raise exception 'positionen fehlt oder ist ungültig';
  end if;

  if jsonb_array_length(payload->'positionen') < 1 then
    raise exception 'Mindestens eine Position erforderlich';
  end if;

  for v_position in
    select value from jsonb_array_elements(payload->'positionen')
  loop
    if nullif(trim(v_position->>'position_nr'), '') is null then
      raise exception 'position_nr fehlt';
    end if;

    begin
      v_position_nr := (v_position->>'position_nr')::integer;
    exception
      when invalid_text_representation then
        raise exception 'position_nr ist ungültig';
    end;

    if v_position_nr < 1 then
      raise exception 'position_nr muss >= 1 sein';
    end if;

    if v_position_nr = any(v_seen_position_nrs) then
      raise exception 'position_nr % ist doppelt', v_position_nr;
    end if;

    v_seen_position_nrs := array_append(v_seen_position_nrs, v_position_nr);

    if nullif(trim(v_position->>'bezeichnung'), '') is null then
      raise exception 'bezeichnung fehlt für position_nr %', v_position_nr;
    end if;

    if nullif(trim(v_position->>'menge'), '') is null then
      raise exception 'menge fehlt für position_nr %', v_position_nr;
    end if;

    begin
      v_menge := (v_position->>'menge')::numeric(12, 3);
    exception
      when invalid_text_representation then
        raise exception 'menge ist ungültig für position_nr %', v_position_nr;
    end;

    if v_menge <= 0 then
      raise exception 'menge muss > 0 sein für position_nr %', v_position_nr;
    end if;

    if nullif(trim(v_position->>'einzelpreis_netto_cents'), '') is null then
      raise exception 'einzelpreis_netto_cents fehlt für position_nr %', v_position_nr;
    end if;

    begin
      v_einzelpreis_netto_cents := (v_position->>'einzelpreis_netto_cents')::bigint;
    exception
      when invalid_text_representation then
        raise exception 'einzelpreis_netto_cents ist ungültig für position_nr %', v_position_nr;
    end;

    if v_einzelpreis_netto_cents < 0 then
      raise exception 'einzelpreis_netto_cents muss >= 0 sein für position_nr %', v_position_nr;
    end if;

    if v_position->>'rabatt_prozent' is null or trim(v_position->>'rabatt_prozent') = '' then
      v_rabatt_prozent := 0;
    else
      begin
        v_rabatt_prozent := (v_position->>'rabatt_prozent')::numeric(5, 2);
      exception
        when invalid_text_representation then
          raise exception 'rabatt_prozent ist ungültig für position_nr %', v_position_nr;
      end;
    end if;

    if v_rabatt_prozent < 0 or v_rabatt_prozent > 100 then
      raise exception 'rabatt_prozent muss zwischen 0 und 100 liegen für position_nr %', v_position_nr;
    end if;

    if nullif(trim(v_position->>'umsatzsteuer_satz'), '') is null then
      raise exception 'umsatzsteuer_satz fehlt für position_nr %', v_position_nr;
    end if;

    begin
      v_umsatzsteuer_satz := (v_position->>'umsatzsteuer_satz')::smallint;
    exception
      when invalid_text_representation then
        raise exception 'umsatzsteuer_satz ist ungültig für position_nr %', v_position_nr;
    end;

    if v_umsatzsteuer_satz not in (0, 7, 19) then
      raise exception 'umsatzsteuer_satz ist ungültig für position_nr %', v_position_nr;
    end if;
  end loop;

  update public.angebot_versionen
  set
    angebot_datum = v_angebot_datum,
    gueltig_bis = v_gueltig_bis,
    betreff = nullif(trim(v_version_json->>'betreff'), ''),
    einleitungstext = nullif(trim(v_version_json->>'einleitungstext'), ''),
    schlusstext = nullif(trim(v_version_json->>'schlusstext'), ''),
    empfaenger_firmenname = trim(v_empfaenger->>'firmenname'),
    empfaenger_rechtsform = nullif(trim(v_empfaenger->>'rechtsform'), ''),
    empfaenger_strasse = nullif(trim(v_empfaenger->>'strasse'), ''),
    empfaenger_hausnummer = nullif(trim(v_empfaenger->>'hausnummer'), ''),
    empfaenger_plz = nullif(trim(v_empfaenger->>'plz'), ''),
    empfaenger_ort = nullif(trim(v_empfaenger->>'ort'), ''),
    empfaenger_land = coalesce(nullif(trim(v_empfaenger->>'land'), ''), 'Deutschland'),
    empfaenger_ansprechpartner = nullif(trim(v_empfaenger->>'ansprechpartner'), ''),
    empfaenger_email = nullif(trim(v_empfaenger->>'email'), ''),
    empfaenger_telefon = nullif(trim(v_empfaenger->>'telefon'), ''),
    empfaenger_umsatzsteuer_id = nullif(trim(v_empfaenger->>'umsatzsteuer_id'), '')
  where id = v_version.id;

  delete from public.angebot_positionen
  where angebot_version_id = v_version.id;

  for v_position in
    select value from jsonb_array_elements(payload->'positionen')
  loop
    v_position_nr := (v_position->>'position_nr')::integer;
    v_menge := (v_position->>'menge')::numeric(12, 3);
    v_einzelpreis_netto_cents := (v_position->>'einzelpreis_netto_cents')::bigint;

    if v_position->>'rabatt_prozent' is null or trim(v_position->>'rabatt_prozent') = '' then
      v_rabatt_prozent := 0;
    else
      v_rabatt_prozent := (v_position->>'rabatt_prozent')::numeric(5, 2);
    end if;

    v_umsatzsteuer_satz := (v_position->>'umsatzsteuer_satz')::smallint;

    insert into public.angebot_positionen (
      angebot_version_id,
      position_nr,
      bezeichnung,
      beschreibung,
      menge,
      einheit,
      einzelpreis_netto_cents,
      rabatt_prozent,
      umsatzsteuer_satz
    )
    values (
      v_version.id,
      v_position_nr,
      trim(v_position->>'bezeichnung'),
      nullif(trim(v_position->>'beschreibung'), ''),
      v_menge,
      coalesce(nullif(trim(v_position->>'einheit'), ''), 'Stk.'),
      v_einzelpreis_netto_cents,
      v_rabatt_prozent,
      v_umsatzsteuer_satz
    );
  end loop;
exception
  when others then
    raise;
end;
$$;

grant execute on function public.update_angebot_entwurf(jsonb) to service_role;
