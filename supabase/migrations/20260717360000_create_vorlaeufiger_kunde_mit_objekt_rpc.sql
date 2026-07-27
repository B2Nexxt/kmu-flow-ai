-- Migration 3.1b (Teil 5): RPC create_vorlaeufiger_kunde_mit_objekt
--
-- Neue Objekte:
--   public.create_vorlaeufiger_kunde_mit_objekt(...)
--
-- Unverändert: Tabellenstrukturen, /admin-RPCs, andere operative RPCs
-- Atomare Neuanlage vorläufiger Kunde + Objekt + Eingangszuordnung (ADR-0008, ADR-0018)
--
-- Referenz: docs/fachkonzept/15-spezifikation-m31-anfrageeingang-serverlogik.md
--           docs/adr/ADR-0008-automatische-zuordnungslogik.md

-- ---------------------------------------------------------------------------
-- RPC: create_vorlaeufiger_kunde_mit_objekt
-- ---------------------------------------------------------------------------

create or replace function public.create_vorlaeufiger_kunde_mit_objekt(
  p_mandant_id uuid,
  p_anfrageeingang_id uuid,
  p_kundentyp text,
  p_firmenname text default null,
  p_vorname text default null,
  p_nachname text default null,
  p_anzeigename text default null,
  p_email text default null,
  p_telefon text default null,
  p_mobil text default null,
  p_umsatzsteuer_id text default null,
  p_kunden_notizen text default null,
  p_strasse text default null,
  p_hausnummer text default null,
  p_adresszusatz text default null,
  p_plz text default null,
  p_ort text default null,
  p_land text default 'Deutschland',
  p_gebaeudeart text default null,
  p_gebaeudebezeichnung text default null,
  p_einheit_anlegen boolean default false,
  p_einheit_bezeichnung text default null,
  p_einheit_typ text default null,
  p_einheit_nummer text default null,
  p_einheit_etage text default null,
  p_einheit_lage text default null,
  p_objektrolle text default null,
  p_bestaetigungsquelle text default 'neuanlage'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.anfrageeingaenge%rowtype;
  v_kundentyp text;
  v_anzeigename text;
  v_bestaetigungsquelle text;
  v_land text;
  v_gebaeudeart text;
  v_neuer_status text;
  v_neuer_grund jsonb;
  v_seq integer;
  v_kundennummer text;
  v_kunde_id uuid;
  v_adresse_id uuid;
  v_gebaeude_id uuid;
  v_einheit_id uuid;
  v_beziehung_id uuid;
  v_gebaeude_row public.gebaeude%rowtype;
  v_email_norm text;
  v_telefon_norm text;
  v_mobil_norm text;
  v_vorname_norm text;
  v_nachname_norm text;
  v_firmenname_norm text;
  v_anzeigename_norm text;
  v_adress_fingerprint text;
  v_kunde_email_id uuid;
  v_kunde_phone_id uuid;
  v_kunde_name_id uuid;
  v_addr_match boolean := false;
  v_hit_count integer := 0;
  v_match_types text[] := '{}'::text[];
  v_has_contact boolean := false;
begin
  -- Grundvalidierung
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

  if p_kundentyp is null or length(trim(p_kundentyp)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'kundentyp'
    );
  end if;

  v_kundentyp := trim(p_kundentyp);

  if v_kundentyp not in ('privatperson', 'unternehmen', 'sonstiges') then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'kundentyp'
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

  -- Idempotenz: bereits bestätigt (vor Neuanlage-Statusprüfung, z. B. bereit_fuer_vorgang)
  if v_row.zuordnungsstatus = 'bestaetigt' then
    if v_row.zugeordnet_kunde_id is null or v_row.zugeordnet_gebaeude_id is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'conflict',
        'field', 'zuordnung'
      );
    end if;

    select g.*
    into v_gebaeude_row
    from public.gebaeude g
    where g.id = v_row.zugeordnet_gebaeude_id
      and g.mandant_id = p_mandant_id;

    select k.kundennummer
    into v_kundennummer
    from public.kunden k
    where k.id = v_row.zugeordnet_kunde_id;

    return jsonb_build_object(
      'ok', true,
      'code', 'already_confirmed',
      'idempotent', true,
      'kunde_id', v_row.zugeordnet_kunde_id,
      'kundennummer', v_kundennummer,
      'adresse_id', v_gebaeude_row.adresse_id,
      'gebaeude_id', v_row.zugeordnet_gebaeude_id,
      'einheit_id', v_row.zugeordnet_einheit_id,
      'kunden_objekt_beziehung_id', null,
      'anfrageeingang_id', p_anfrageeingang_id,
      'status', v_row.status,
      'zuordnungsstatus', 'bestaetigt'
    );
  end if;

  if v_row.status in ('neu', 'bereit_fuer_vorgang', 'in_vorgang_ueberfuehrt', 'verworfen') then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'status'
    );
  end if;

  if v_row.status not in (
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

  if v_row.zuordnungsstatus = 'nicht_erforderlich' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'zuordnungsstatus'
    );
  end if;

  if v_row.zuordnungsstatus not in (
    'kein_treffer',
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

  -- Kundendaten validieren
  if v_kundentyp = 'privatperson' then
    if p_vorname is null or length(trim(p_vorname)) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'vorname'
      );
    end if;

    if p_nachname is null or length(trim(p_nachname)) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'nachname'
      );
    end if;
  elsif v_kundentyp = 'unternehmen' then
    if p_firmenname is null or length(trim(p_firmenname)) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'firmenname'
      );
    end if;
  else
    if p_anzeigename is null or length(trim(p_anzeigename)) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'anzeigename'
      );
    end if;
  end if;

  -- Dummywerte (definierte Liste, normalisiert)
  if p_vorname is not null
    and public.normalize_operative_text(p_vorname) in (
      'unbekannt', 'n/a', 'na', 'test', 'platzhalter'
    ) then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'vorname');
  end if;

  if p_nachname is not null
    and public.normalize_operative_text(p_nachname) in (
      'unbekannt', 'n/a', 'na', 'test', 'platzhalter'
    ) then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'nachname');
  end if;

  if p_firmenname is not null
    and public.normalize_operative_text(p_firmenname) in (
      'unbekannt', 'n/a', 'na', 'test', 'platzhalter'
    ) then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'firmenname');
  end if;

  if p_anzeigename is not null
    and public.normalize_operative_text(p_anzeigename) in (
      'unbekannt', 'n/a', 'na', 'test', 'platzhalter'
    ) then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'anzeigename');
  end if;

  if p_email is not null
    and public.normalize_operative_text(p_email) in (
      'unbekannt', 'n/a', 'na', 'test', 'platzhalter'
    ) then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'email');
  end if;

  if p_telefon is not null
    and public.normalize_operative_text(p_telefon) in (
      'unbekannt', 'n/a', 'na', 'test', 'platzhalter'
    ) then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'telefon');
  end if;

  if p_mobil is not null
    and public.normalize_operative_text(p_mobil) in (
      'unbekannt', 'n/a', 'na', 'test', 'platzhalter'
    ) then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'mobil');
  end if;

  -- Anzeigename ableiten
  if p_anzeigename is not null and length(trim(p_anzeigename)) > 0 then
    v_anzeigename := trim(p_anzeigename);
  elsif v_kundentyp = 'privatperson' then
    v_anzeigename := trim(p_vorname) || ' ' || trim(p_nachname);
  elsif v_kundentyp = 'unternehmen' then
    v_anzeigename := trim(p_firmenname);
  else
    v_anzeigename := trim(p_anzeigename);
  end if;

  if length(trim(v_anzeigename)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'anzeigename'
    );
  end if;

  -- Mindestens eine Kontaktmöglichkeit
  v_has_contact :=
    (p_email is not null and length(trim(p_email)) > 0
      and public.normalize_operative_text(p_email) not in (
        'unbekannt', 'n/a', 'na', 'test', 'platzhalter'
      ))
    or (p_telefon is not null and length(trim(p_telefon)) > 0
      and public.normalize_operative_text(p_telefon) not in (
        'unbekannt', 'n/a', 'na', 'test', 'platzhalter'
      ))
    or (p_mobil is not null and length(trim(p_mobil)) > 0
      and public.normalize_operative_text(p_mobil) not in (
        'unbekannt', 'n/a', 'na', 'test', 'platzhalter'
      ));

  if not v_has_contact then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'kontakt'
    );
  end if;

  if p_kunden_notizen is not null and length(trim(p_kunden_notizen)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'kunden_notizen'
    );
  end if;

  if p_umsatzsteuer_id is not null and length(trim(p_umsatzsteuer_id)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'umsatzsteuer_id'
    );
  end if;

  -- Adresse und Gebäude
  if p_strasse is null or length(trim(p_strasse)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'strasse');
  end if;

  if p_hausnummer is null or length(trim(p_hausnummer)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'hausnummer');
  end if;

  if p_plz is null or length(trim(p_plz)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'plz');
  end if;

  if p_ort is null or length(trim(p_ort)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'ort');
  end if;

  v_land := coalesce(nullif(trim(p_land), ''), 'Deutschland');

  if length(trim(v_land)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'land');
  end if;

  if p_adresszusatz is not null and length(trim(p_adresszusatz)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'adresszusatz');
  end if;

  if p_gebaeudeart is null or length(trim(p_gebaeudeart)) = 0 then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'gebaeudeart');
  end if;

  v_gebaeudeart := trim(p_gebaeudeart);

  if v_gebaeudeart not in (
    'einfamilienhaus',
    'mehrfamilienhaus',
    'wohn_und_geschaeftshaus',
    'gewerbeobjekt',
    'industrieobjekt',
    'oeffentliches_gebaeude',
    'nebengebaeude',
    'sonstiges'
  ) then
    return jsonb_build_object('ok', false, 'code', 'validation_error', 'field', 'gebaeudeart');
  end if;

  if p_gebaeudebezeichnung is not null and length(trim(p_gebaeudebezeichnung)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'gebaeudebezeichnung'
    );
  end if;

  -- Optionale Einheit
  if p_einheit_anlegen is distinct from true then
    if coalesce(length(trim(p_einheit_bezeichnung)), 0) > 0
      or coalesce(length(trim(p_einheit_typ)), 0) > 0
      or coalesce(length(trim(p_einheit_nummer)), 0) > 0
      or coalesce(length(trim(p_einheit_etage)), 0) > 0
      or coalesce(length(trim(p_einheit_lage)), 0) > 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'einheit_anlegen'
      );
    end if;
  else
    if p_einheit_bezeichnung is null or length(trim(p_einheit_bezeichnung)) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'einheit_bezeichnung'
      );
    end if;

    if p_einheit_typ is null or length(trim(p_einheit_typ)) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'einheit_typ'
      );
    end if;

    if trim(p_einheit_typ) not in (
      'wohnung',
      'gewerbeeinheit',
      'gemeinschaftsbereich',
      'funktionsbereich',
      'gebaeudeteil',
      'sonstiges'
    ) then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'einheit_typ'
      );
    end if;

    if p_einheit_nummer is not null and length(trim(p_einheit_nummer)) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'einheit_nummer'
      );
    end if;

    if p_einheit_etage is not null and length(trim(p_einheit_etage)) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'einheit_etage'
      );
    end if;

    if p_einheit_lage is not null and length(trim(p_einheit_lage)) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'einheit_lage'
      );
    end if;
  end if;

  -- Objektrolle
  if p_objektrolle is not null and length(trim(p_objektrolle)) > 0 then
    if trim(p_objektrolle) not in (
      'eigentuemer',
      'mieter',
      'hausverwaltung',
      'nutzer',
      'sonstiges'
    ) then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'objektrolle'
      );
    end if;
  end if;

  -- Dublettenprüfung V1 (kein Auto-Merge, keine Fuzzy-Suche)
  v_email_norm := case
    when p_email is not null and length(trim(p_email)) > 0
      then public.normalize_operative_text(p_email)
    else null
  end;

  v_telefon_norm := case
    when p_telefon is not null and length(trim(p_telefon)) > 0
      then public.normalize_operative_text(p_telefon)
    else null
  end;

  v_mobil_norm := case
    when p_mobil is not null and length(trim(p_mobil)) > 0
      then public.normalize_operative_text(p_mobil)
    else null
  end;

  v_vorname_norm := case
    when p_vorname is not null then public.normalize_operative_text(p_vorname)
    else null
  end;

  v_nachname_norm := case
    when p_nachname is not null then public.normalize_operative_text(p_nachname)
    else null
  end;

  v_firmenname_norm := case
    when p_firmenname is not null then public.normalize_operative_text(p_firmenname)
    else null
  end;

  v_anzeigename_norm := public.normalize_operative_text(v_anzeigename);

  v_adress_fingerprint := public.build_adress_fingerprint(
    public.normalize_operative_text(p_strasse),
    public.normalize_hausnummer(p_hausnummer),
    public.normalize_operative_text(p_plz),
    public.normalize_operative_text(p_ort),
    public.normalize_land(v_land)
  );

  if v_email_norm is not null then
    select k.id
    into v_kunde_email_id
    from public.kunden k
    where k.mandant_id = p_mandant_id
      and k.aktiv = true
      and k.email is not null
      and public.normalize_operative_text(k.email) = v_email_norm
    limit 1;

    if v_kunde_email_id is not null then
      v_hit_count := v_hit_count + 1;
      v_match_types := array_append(v_match_types, 'email');
    end if;
  end if;

  if v_telefon_norm is not null or v_mobil_norm is not null then
    select k.id
    into v_kunde_phone_id
    from public.kunden k
    where k.mandant_id = p_mandant_id
      and k.aktiv = true
      and (
        (v_telefon_norm is not null and k.telefon is not null
          and public.normalize_operative_text(k.telefon) = v_telefon_norm)
        or (v_telefon_norm is not null and k.mobil is not null
          and public.normalize_operative_text(k.mobil) = v_telefon_norm)
        or (v_mobil_norm is not null and k.telefon is not null
          and public.normalize_operative_text(k.telefon) = v_mobil_norm)
        or (v_mobil_norm is not null and k.mobil is not null
          and public.normalize_operative_text(k.mobil) = v_mobil_norm)
      )
    limit 1;

    if v_kunde_phone_id is not null then
      v_hit_count := v_hit_count + 1;
      v_match_types := array_append(v_match_types, 'telefon');
    end if;
  end if;

  if v_kundentyp = 'privatperson' then
    select k.id
    into v_kunde_name_id
    from public.kunden k
    where k.mandant_id = p_mandant_id
      and k.aktiv = true
      and k.kundentyp = 'privatperson'
      and public.normalize_operative_text(k.vorname) = v_vorname_norm
      and public.normalize_operative_text(k.nachname) = v_nachname_norm
    limit 1;
  elsif v_kundentyp = 'unternehmen' then
    select k.id
    into v_kunde_name_id
    from public.kunden k
    where k.mandant_id = p_mandant_id
      and k.aktiv = true
      and k.kundentyp = 'unternehmen'
      and public.normalize_operative_text(k.firmenname) = v_firmenname_norm
    limit 1;
  else
    select k.id
    into v_kunde_name_id
    from public.kunden k
    where k.mandant_id = p_mandant_id
      and k.aktiv = true
      and public.normalize_operative_text(k.anzeigename) = v_anzeigename_norm
    limit 1;
  end if;

  if v_kunde_name_id is not null then
    v_hit_count := v_hit_count + 1;
    v_match_types := array_append(v_match_types, 'name');
  end if;

  select exists (
    select 1
    from public.adressen a
    where a.mandant_id = p_mandant_id
      and a.aktiv = true
      and a.adress_fingerprint = v_adress_fingerprint
  )
  into v_addr_match;

  if v_addr_match then
    v_hit_count := v_hit_count + 1;
    v_match_types := array_append(v_match_types, 'adress_fingerprint');
  end if;

  -- Widerspruch: unterschiedliche Kunden-IDs über Merkmale
  if v_kunde_email_id is not null
    and v_kunde_name_id is not null
    and v_kunde_email_id is distinct from v_kunde_name_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'dublettenpruefung',
      'requires_manual_review', true,
      'match_count', v_hit_count,
      'match_types', to_jsonb(v_match_types)
    );
  end if;

  if v_kunde_email_id is not null
    and v_kunde_phone_id is not null
    and v_kunde_email_id is distinct from v_kunde_phone_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'dublettenpruefung',
      'requires_manual_review', true,
      'match_count', v_hit_count,
      'match_types', to_jsonb(v_match_types)
    );
  end if;

  if v_kunde_phone_id is not null
    and v_kunde_name_id is not null
    and v_kunde_phone_id is distinct from v_kunde_name_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'dublettenpruefung',
      'requires_manual_review', true,
      'match_count', v_hit_count,
      'match_types', to_jsonb(v_match_types)
    );
  end if;

  -- Zwei unabhängige Treffer (ADR-0008) — gleiche Adresse allein reicht nicht
  if v_hit_count >= 2 then
    return jsonb_build_object(
      'ok', false,
      'code', 'conflict',
      'field', 'dublettenpruefung',
      'requires_manual_review', true,
      'match_count', v_hit_count,
      'match_types', to_jsonb(v_match_types)
    );
  end if;

  -- Kundennummer atomar vergeben
  insert into public.kundennummer_sequenzen (
    mandant_id,
    letzter_wert
  )
  values (
    p_mandant_id,
    1
  )
  on conflict (mandant_id)
  do update
    set letzter_wert = public.kundennummer_sequenzen.letzter_wert + 1
  returning public.kundennummer_sequenzen.letzter_wert into v_seq;

  v_kundennummer := format('K-%s', lpad(v_seq::text, 6, '0'));

  insert into public.kunden (
    mandant_id,
    kundennummer,
    kundentyp,
    firmenname,
    vorname,
    nachname,
    anzeigename,
    email,
    telefon,
    mobil,
    umsatzsteuer_id,
    notizen,
    kundenstatus,
    aktiv
  )
  values (
    p_mandant_id,
    v_kundennummer,
    v_kundentyp,
    case when p_firmenname is null then null else trim(p_firmenname) end,
    case when p_vorname is null then null else trim(p_vorname) end,
    case when p_nachname is null then null else trim(p_nachname) end,
    v_anzeigename,
    case when p_email is null then null else trim(p_email) end,
    case when p_telefon is null then null else trim(p_telefon) end,
    case when p_mobil is null then null else trim(p_mobil) end,
    case when p_umsatzsteuer_id is null then null else trim(p_umsatzsteuer_id) end,
    case when p_kunden_notizen is null then null else trim(p_kunden_notizen) end,
    'vorlaeufig',
    true
  )
  returning id into v_kunde_id;

  insert into public.adressen (
    mandant_id,
    strasse,
    hausnummer,
    adresszusatz,
    plz,
    ort,
    land,
    aktiv
  )
  values (
    p_mandant_id,
    trim(p_strasse),
    trim(p_hausnummer),
    case when p_adresszusatz is null then null else trim(p_adresszusatz) end,
    trim(p_plz),
    trim(p_ort),
    v_land,
    true
  )
  returning id into v_adresse_id;

  insert into public.gebaeude (
    mandant_id,
    adresse_id,
    gebaeudeart,
    gebaeudebezeichnung,
    aktiv
  )
  values (
    p_mandant_id,
    v_adresse_id,
    v_gebaeudeart,
    case when p_gebaeudebezeichnung is null then null else trim(p_gebaeudebezeichnung) end,
    true
  )
  returning id into v_gebaeude_id;

  if p_einheit_anlegen is true then
    insert into public.einheiten (
      mandant_id,
      gebaeude_id,
      bezeichnung,
      einheit_typ,
      nummer,
      etage,
      lage,
      aktiv
    )
    values (
      p_mandant_id,
      v_gebaeude_id,
      trim(p_einheit_bezeichnung),
      trim(p_einheit_typ),
      case when p_einheit_nummer is null then null else trim(p_einheit_nummer) end,
      case when p_einheit_etage is null then null else trim(p_einheit_etage) end,
      case when p_einheit_lage is null then null else trim(p_einheit_lage) end,
      true
    )
    returning id into v_einheit_id;
  else
    v_einheit_id := null;
  end if;

  if p_objektrolle is not null and length(trim(p_objektrolle)) > 0 then
    insert into public.kunden_objekt_beziehungen (
      mandant_id,
      kunde_id,
      gebaeude_id,
      einheit_id,
      rolle,
      gueltig_ab,
      aktiv,
      quelle,
      bestaetigt_am
    )
    values (
      p_mandant_id,
      v_kunde_id,
      v_gebaeude_id,
      v_einheit_id,
      trim(p_objektrolle),
      current_date,
      true,
      v_bestaetigungsquelle,
      now()
    )
    returning id into v_beziehung_id;
  else
    v_beziehung_id := null;
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
      'zeitpunkt', to_jsonb(now()),
      'art', 'neuanlage'
    ),
    true
  );

  update public.anfrageeingaenge
  set
    zugeordnet_kunde_id = v_kunde_id,
    zugeordnet_gebaeude_id = v_gebaeude_id,
    zugeordnet_einheit_id = v_einheit_id,
    zuordnungsstatus = 'bestaetigt',
    zuordnungsgrund = v_neuer_grund,
    manuelle_pruefung_erforderlich = false,
    status = v_neuer_status,
    zuletzt_bearbeitet_am = now()
  where id = p_anfrageeingang_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'created',
    'kunde_id', v_kunde_id,
    'kundennummer', v_kundennummer,
    'adresse_id', v_adresse_id,
    'gebaeude_id', v_gebaeude_id,
    'einheit_id', v_einheit_id,
    'kunden_objekt_beziehung_id', v_beziehung_id,
    'anfrageeingang_id', p_anfrageeingang_id,
    'status', v_neuer_status,
    'zuordnungsstatus', 'bestaetigt'
  );
end;
$$;

comment on function public.create_vorlaeufiger_kunde_mit_objekt(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) is
  'Legt atomar vorläufigen Kunden, Adresse, Gebäude, optional Einheit/Objektbeziehung an '
  'und bestätigt Anfrageeingang-Zuordnung. V1-Dublettenprüfung ohne Auto-Merge (ADR-0008). '
  'Nur Service Role.';

-- ---------------------------------------------------------------------------
-- Berechtigungen: kein PUBLIC/anon/authenticated
-- ---------------------------------------------------------------------------

revoke all on function public.create_vorlaeufiger_kunde_mit_objekt(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;

revoke all on function public.create_vorlaeufiger_kunde_mit_objekt(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from anon;

revoke all on function public.create_vorlaeufiger_kunde_mit_objekt(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from authenticated;

grant execute on function public.create_vorlaeufiger_kunde_mit_objekt(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;
