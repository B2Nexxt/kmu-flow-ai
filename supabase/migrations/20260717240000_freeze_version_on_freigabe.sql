-- RPC: freigeben_angebot
-- Ergänzung: Freigegebene Version wird eingefroren (ist_eingefroren = true).
-- Referenz: docs/angebote-datenmodell.md (Abschnitt „RPC: freigeben_angebot“)

create or replace function public.freigeben_angebot(p_angebot_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_angebotsnummer text;
  v_open_version_count integer;
  v_version_id uuid;
  v_angebot_datum date;
  v_gueltig_bis date;
  v_position_count integer;
  v_jahr integer;
  v_letzte_nummer integer;
begin
  if p_angebot_id is null then
    raise exception 'angebot_id fehlt';
  end if;

  select a.status, a.angebotsnummer
  into v_status, v_angebotsnummer
  from public.angebote a
  where a.id = p_angebot_id
  for update;

  if not found then
    raise exception 'Angebot nicht gefunden: %', p_angebot_id;
  end if;

  if v_status <> 'entwurf' then
    raise exception 'Angebot muss Status entwurf haben, ist: %', v_status;
  end if;

  if v_angebotsnummer is not null then
    raise exception 'Angebot hat bereits eine Angebotsnummer: %', v_angebotsnummer;
  end if;

  select count(*)
  into v_open_version_count
  from public.angebot_versionen av
  where av.angebot_id = p_angebot_id
    and av.ist_eingefroren = false;

  if v_open_version_count <> 1 then
    raise exception
      'Genau eine offene Version erforderlich, gefunden: %',
      v_open_version_count;
  end if;

  select
    av.id,
    av.angebot_datum,
    av.gueltig_bis
  into
    v_version_id,
    v_angebot_datum,
    v_gueltig_bis
  from public.angebot_versionen av
  where av.angebot_id = p_angebot_id
    and av.ist_eingefroren = false
  order by av.version_nr desc
  limit 1;

  if v_angebot_datum is null then
    raise exception 'angebot_datum fehlt in der offenen Version';
  end if;

  if v_gueltig_bis is null then
    raise exception 'gueltig_bis fehlt in der offenen Version';
  end if;

  if v_gueltig_bis < v_angebot_datum then
    raise exception 'gueltig_bis muss >= angebot_datum sein';
  end if;

  perform 1
  from public.angebot_versionen av
  where av.id = v_version_id
    and nullif(trim(av.empfaenger_firmenname), '') is not null
    and nullif(trim(av.empfaenger_strasse), '') is not null
    and nullif(trim(av.empfaenger_plz), '') is not null
    and nullif(trim(av.empfaenger_ort), '') is not null
    and nullif(trim(av.empfaenger_land), '') is not null;

  if not found then
    raise exception
      'Empfänger-Snapshot unvollständig (firmenname, strasse, plz, ort, land erforderlich)';
  end if;

  select count(*)
  into v_position_count
  from public.angebot_positionen ap
  where ap.angebot_version_id = v_version_id;

  if v_position_count < 1 then
    raise exception 'Mindestens eine Position erforderlich';
  end if;

  v_jahr := extract(year from current_date)::integer;

  insert into public.angebotsnummer_sequenzen (jahr, letzte_nummer)
  values (v_jahr, 0)
  on conflict (jahr) do nothing;

  select ans.letzte_nummer
  into v_letzte_nummer
  from public.angebotsnummer_sequenzen ans
  where ans.jahr = v_jahr
  for update;

  v_letzte_nummer := v_letzte_nummer + 1;

  if v_letzte_nummer > 9999 then
    raise exception 'Angebotsnummernkreis für Jahr % erschöpft', v_jahr;
  end if;

  update public.angebotsnummer_sequenzen
  set letzte_nummer = v_letzte_nummer
  where jahr = v_jahr;

  v_angebotsnummer := 'AN-'
    || v_jahr::text
    || '-'
    || lpad(v_letzte_nummer::text, 4, '0');

  update public.angebote
  set
    status = 'freigegeben',
    angebotsnummer = v_angebotsnummer
  where id = p_angebot_id;

  update public.angebot_versionen
  set
    freigegeben_am = now(),
    ist_eingefroren = true
  where id = v_version_id;

  return v_angebotsnummer;
exception
  when others then
    raise;
end;
$$;

grant execute on function public.freigeben_angebot(uuid) to service_role;
