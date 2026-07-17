-- RPC: create_angebot
-- Atomare Anlage eines Angebotsentwurfs (Container + Version 1 + Positionen).
-- Referenz: docs/angebote-datenmodell.md (Abschnitt „RPC: create_angebot“)

create or replace function public.create_angebot(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_angebot_id uuid;
  v_version_id uuid;
  v_version jsonb;
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

  if nullif(trim(payload->>'organization_id'), '') is null then
    raise exception 'organization_id fehlt';
  end if;

  begin
    v_organization_id := (payload->>'organization_id')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'organization_id ist ungültig';
  end;

  if not exists (
    select 1
    from public.organizations
    where id = v_organization_id
  ) then
    raise exception 'Organization nicht gefunden: %', v_organization_id;
  end if;

  v_version := payload->'version';
  if v_version is null or jsonb_typeof(v_version) <> 'object' then
    raise exception 'version fehlt oder ist ungültig';
  end if;

  v_empfaenger := v_version->'empfaenger';
  if v_empfaenger is null or jsonb_typeof(v_empfaenger) <> 'object' then
    raise exception 'version.empfaenger fehlt oder ist ungültig';
  end if;

  if nullif(trim(v_empfaenger->>'firmenname'), '') is null then
    raise exception 'version.empfaenger.firmenname fehlt';
  end if;

  if payload->'positionen' is null or jsonb_typeof(payload->'positionen') <> 'array' then
    raise exception 'positionen fehlt oder ist kein Array';
  end if;

  if jsonb_array_length(payload->'positionen') = 0 then
    raise exception 'Mindestens eine Position erforderlich';
  end if;

  if nullif(trim(v_version->>'angebot_datum'), '') is not null then
    begin
      v_angebot_datum := (v_version->>'angebot_datum')::date;
    exception
      when invalid_text_representation then
        raise exception 'version.angebot_datum ist ungültig';
    end;
  else
    v_angebot_datum := current_date;
  end if;

  if nullif(trim(v_version->>'gueltig_bis'), '') is not null then
    begin
      v_gueltig_bis := (v_version->>'gueltig_bis')::date;
    exception
      when invalid_text_representation then
        raise exception 'version.gueltig_bis ist ungültig';
    end;
  else
    v_gueltig_bis := v_angebot_datum + 30;
  end if;

  if v_gueltig_bis < v_angebot_datum then
    raise exception 'version.gueltig_bis muss >= version.angebot_datum sein';
  end if;

  for v_position in
    select value from jsonb_array_elements(payload->'positionen')
  loop
    if jsonb_typeof(v_position) <> 'object' then
      raise exception 'Jede Position muss ein JSON-Objekt sein';
    end if;

    if v_position->>'position_nr' is null or trim(v_position->>'position_nr') = '' then
      raise exception 'position_nr fehlt in einer Position';
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

    if v_position_nr = any (v_seen_position_nrs) then
      raise exception 'position_nr % ist doppelt', v_position_nr;
    end if;

    v_seen_position_nrs := array_append(v_seen_position_nrs, v_position_nr);

    if nullif(trim(v_position->>'bezeichnung'), '') is null then
      raise exception 'bezeichnung fehlt in Position %', v_position_nr;
    end if;

    if v_position->>'menge' is null or trim(v_position->>'menge') = '' then
      raise exception 'menge fehlt in Position %', v_position_nr;
    end if;

    begin
      v_menge := (v_position->>'menge')::numeric(12, 3);
    exception
      when invalid_text_representation then
        raise exception 'menge ist ungültig in Position %', v_position_nr;
    end;

    if v_menge <= 0 then
      raise exception 'menge muss > 0 sein in Position %', v_position_nr;
    end if;

    if v_position->>'einzelpreis_netto_cents' is null
       or trim(v_position->>'einzelpreis_netto_cents') = '' then
      raise exception 'einzelpreis_netto_cents fehlt in Position %', v_position_nr;
    end if;

    begin
      v_einzelpreis_netto_cents := (v_position->>'einzelpreis_netto_cents')::bigint;
    exception
      when invalid_text_representation then
        raise exception 'einzelpreis_netto_cents ist ungültig in Position %', v_position_nr;
    end;

    if v_einzelpreis_netto_cents < 0 then
      raise exception 'einzelpreis_netto_cents muss >= 0 sein in Position %', v_position_nr;
    end if;

    if v_position->>'rabatt_prozent' is null or trim(v_position->>'rabatt_prozent') = '' then
      v_rabatt_prozent := 0;
    else
      begin
        v_rabatt_prozent := (v_position->>'rabatt_prozent')::numeric(5, 2);
      exception
        when invalid_text_representation then
          raise exception 'rabatt_prozent ist ungültig in Position %', v_position_nr;
      end;

      if v_rabatt_prozent < 0 or v_rabatt_prozent > 100 then
        raise exception 'rabatt_prozent muss zwischen 0 und 100 liegen in Position %', v_position_nr;
      end if;
    end if;

    if v_position->>'umsatzsteuer_satz' is null or trim(v_position->>'umsatzsteuer_satz') = '' then
      raise exception 'umsatzsteuer_satz fehlt in Position %', v_position_nr;
    end if;

    begin
      v_umsatzsteuer_satz := (v_position->>'umsatzsteuer_satz')::smallint;
    exception
      when invalid_text_representation then
        raise exception 'umsatzsteuer_satz ist ungültig in Position %', v_position_nr;
    end;

    if v_umsatzsteuer_satz not in (0, 7, 19) then
      raise exception 'umsatzsteuer_satz muss 0, 7 oder 19 sein in Position %', v_position_nr;
    end if;
  end loop;

  insert into public.angebote (
    organization_id,
    status,
    angebotsnummer
  )
  values (
    v_organization_id,
    'entwurf',
    null
  )
  returning id into v_angebot_id;

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
    ist_eingefroren
  )
  values (
    v_angebot_id,
    1,
    v_angebot_datum,
    v_gueltig_bis,
    nullif(trim(v_version->>'betreff'), ''),
    nullif(trim(v_version->>'einleitungstext'), ''),
    nullif(trim(v_version->>'schlusstext'), ''),
    trim(v_empfaenger->>'firmenname'),
    nullif(trim(v_empfaenger->>'rechtsform'), ''),
    nullif(trim(v_empfaenger->>'strasse'), ''),
    nullif(trim(v_empfaenger->>'hausnummer'), ''),
    nullif(trim(v_empfaenger->>'plz'), ''),
    nullif(trim(v_empfaenger->>'ort'), ''),
    coalesce(nullif(trim(v_empfaenger->>'land'), ''), 'Deutschland'),
    nullif(trim(v_empfaenger->>'ansprechpartner'), ''),
    nullif(trim(v_empfaenger->>'email'), ''),
    nullif(trim(v_empfaenger->>'telefon'), ''),
    nullif(trim(v_empfaenger->>'umsatzsteuer_id'), ''),
    false
  )
  returning id into v_version_id;

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
      v_version_id,
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

  return v_angebot_id;
exception
  when others then
    raise;
end;
$$;

grant execute on function public.create_angebot(jsonb) to service_role;
