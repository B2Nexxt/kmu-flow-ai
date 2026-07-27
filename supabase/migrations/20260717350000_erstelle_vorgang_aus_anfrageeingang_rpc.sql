-- Migration 3.1b (Teil 4): RPC erstelle_vorgang_aus_anfrageeingang
--
-- Neue Objekte:
--   public.erstelle_vorgang_aus_anfrageeingang(...)
--
-- Unverändert: Tabellenstrukturen, /admin-RPCs, andere operative RPCs
-- Atomare Vorgangserzeugung aus bereit_fuer_vorgang + bestaetigt (ADR-0019)
--
-- Referenz: docs/fachkonzept/15-spezifikation-m31-anfrageeingang-serverlogik.md
--           docs/adr/ADR-0019-atomare-ueberfuehrung-anfrageeingang-vorgang.md

-- ---------------------------------------------------------------------------
-- RPC: erstelle_vorgang_aus_anfrageeingang
-- ---------------------------------------------------------------------------

create or replace function public.erstelle_vorgang_aus_anfrageeingang(
  p_mandant_id uuid,
  p_anfrageeingang_id uuid,
  p_vorgangstyp text default 'anfrage',
  p_titel text default null,
  p_beschreibung text default null,
  p_prioritaet text default null,
  p_beteiligte jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.anfrageeingaenge%rowtype;
  v_vorgangstyp text;
  v_titel text;
  v_beschreibung text;
  v_prioritaet text;
  v_jahr integer;
  v_seq integer;
  v_vorgangsnummer text;
  v_vorgang_id uuid;
  v_beteiligte_anzahl integer := 0;
  v_vorgang_row public.vorgaenge%rowtype;
  v_entry jsonb;
  v_kunde_id uuid;
  v_rolle text;
  v_ist_haupt boolean;
  v_notizen text;
  v_kunde_mandant_id uuid;
  v_kunde_aktiv boolean;
  v_kunde_status text;
  v_has_anfragender boolean := false;
  v_has_hauptbeteiligter boolean := false;
  v_has_zugeordnet_kunde boolean := false;
  v_haupt_pro_rolle jsonb := '{}'::jsonb;
  v_seen_pairs text[] := '{}'::text[];
  v_pair_key text;
  v_haupt_count integer;
  v_anliegen_wert jsonb;
  v_idx integer;
  v_staging_kunde_ids uuid[] := '{}'::uuid[];
  v_staging_rollen text[] := '{}'::text[];
  v_staging_haupt boolean[] := '{}'::boolean[];
  v_staging_notizen text[] := '{}'::text[];
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

  if p_vorgangstyp is null or length(trim(p_vorgangstyp)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'vorgangstyp'
    );
  end if;

  v_vorgangstyp := trim(p_vorgangstyp);

  if v_vorgangstyp not in (
    'anfrage',
    'folgeanfrage',
    'notfall',
    'service',
    'reklamation',
    'sonstiges'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'vorgangstyp'
    );
  end if;

  if p_beschreibung is not null and length(trim(p_beschreibung)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'beschreibung'
    );
  end if;

  v_beschreibung := case
    when p_beschreibung is null then null
    else trim(p_beschreibung)
  end;

  if p_prioritaet is not null then
    if length(trim(p_prioritaet)) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'prioritaet'
      );
    end if;

    v_prioritaet := trim(p_prioritaet);

    if v_prioritaet not in ('niedrig', 'normal', 'hoch', 'dringend') then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'prioritaet'
      );
    end if;
  end if;

  if p_beteiligte is not null then
    if jsonb_typeof(p_beteiligte) <> 'array' then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'beteiligte'
      );
    end if;

    if jsonb_array_length(p_beteiligte) = 0 then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'beteiligte'
      );
    end if;
  end if;

  if p_titel is not null and length(trim(p_titel)) = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'validation_error',
      'field', 'titel'
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

  -- Idempotenz: bereits konvertiert
  if v_row.zugeordneter_vorgang_id is not null then
    select v.*
    into v_vorgang_row
    from public.vorgaenge v
    where v.id = v_row.zugeordneter_vorgang_id;

    if not found then
      raise exception
        'erstelle_vorgang_aus_anfrageeingang: zugeordneter_vorgang_id ohne Vorgang (Dateninkonsistenz)';
    end if;

    if v_vorgang_row.mandant_id is distinct from p_mandant_id then
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
      'vorgang_id', v_vorgang_row.id,
      'vorgangsnummer', v_vorgang_row.vorgangsnummer
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

  if v_row.zuordnungsstatus is distinct from 'bestaetigt' then
    return jsonb_build_object(
      'ok', false,
      'code', 'assignment_not_confirmed',
      'field', 'zuordnungsstatus'
    );
  end if;

  if v_row.zugeordnet_kunde_id is null or v_row.zugeordnet_gebaeude_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'assignment_not_confirmed',
      'field', 'zuordnung'
    );
  end if;

  if v_row.vollstaendigkeitsstatus not in ('ausreichend_fuer_vorgang', 'vollstaendig') then
    return jsonb_build_object(
      'ok', false,
      'code', 'insufficient_data',
      'field', 'vollstaendigkeitsstatus'
    );
  end if;

  if v_row.status is distinct from 'bereit_fuer_vorgang' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status_transition',
      'field', 'status'
    );
  end if;

  -- Titel ableiten (vor Nummernvergabe)
  if p_titel is not null then
    v_titel := trim(p_titel);
  else
    v_anliegen_wert := v_row.strukturierte_daten #> '{felder,anliegen,wert}';

    if v_anliegen_wert is not null
      and jsonb_typeof(v_anliegen_wert) = 'string'
      and length(trim(v_anliegen_wert #>> '{}')) > 0 then
      v_titel := trim(v_anliegen_wert #>> '{}');
    elsif v_row.betreff is not null and length(trim(v_row.betreff)) > 0 then
      v_titel := trim(v_row.betreff);
    else
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'titel'
      );
    end if;
  end if;

  -- Priorität ableiten
  if p_prioritaet is null then
    v_prioritaet := v_row.dringlichkeit;
  end if;

  -- Beteiligtenvalidierung (vollständig vor Nummernvergabe)
  if p_beteiligte is not null then
    v_idx := 0;

    for v_entry in
      select value
      from jsonb_array_elements(p_beteiligte) as t(value)
    loop
      v_idx := v_idx + 1;

      if jsonb_typeof(v_entry) <> 'object' then
        return jsonb_build_object(
          'ok', false,
          'code', 'validation_error',
          'field', 'beteiligte'
        );
      end if;

      if v_entry->>'kunde_id' is null or length(trim(v_entry->>'kunde_id')) = 0 then
        return jsonb_build_object(
          'ok', false,
          'code', 'validation_error',
          'field', 'kunde_id'
        );
      end if;

      begin
        v_kunde_id := (v_entry->>'kunde_id')::uuid;
      exception
        when invalid_text_representation then
          return jsonb_build_object(
            'ok', false,
            'code', 'validation_error',
            'field', 'kunde_id'
          );
      end;

      if v_entry->>'rolle' is null or length(trim(v_entry->>'rolle')) = 0 then
        return jsonb_build_object(
          'ok', false,
          'code', 'validation_error',
          'field', 'rolle'
        );
      end if;

      v_rolle := trim(v_entry->>'rolle');

      if v_rolle not in (
        'anfragender',
        'auftraggeber',
        'ansprechpartner',
        'angebotsempfaenger',
        'rechnungsempfaenger',
        'eigentuemer',
        'mieter',
        'hausverwaltung',
        'zahlungspflichtiger',
        'sonstiges'
      ) then
        return jsonb_build_object(
          'ok', false,
          'code', 'validation_error',
          'field', 'rolle'
        );
      end if;

      if v_entry ? 'ist_hauptbeteiligter' then
        if jsonb_typeof(v_entry->'ist_hauptbeteiligter') <> 'boolean' then
          return jsonb_build_object(
            'ok', false,
            'code', 'validation_error',
            'field', 'ist_hauptbeteiligter'
          );
        end if;
        v_ist_haupt := (v_entry->>'ist_hauptbeteiligter')::boolean;
      else
        v_ist_haupt := false;
      end if;

      if v_entry ? 'notizen' and v_entry->'notizen' is not null then
        if jsonb_typeof(v_entry->'notizen') <> 'string' then
          return jsonb_build_object(
            'ok', false,
            'code', 'validation_error',
            'field', 'notizen'
          );
        end if;

        v_notizen := trim(v_entry->>'notizen');

        if length(v_notizen) = 0 then
          return jsonb_build_object(
            'ok', false,
            'code', 'validation_error',
            'field', 'notizen'
          );
        end if;
      else
        v_notizen := null;
      end if;

      v_pair_key := v_kunde_id::text || '|' || v_rolle;

      if v_pair_key = any (v_seen_pairs) then
        return jsonb_build_object(
          'ok', false,
          'code', 'conflict',
          'field', 'beteiligte'
        );
      end if;

      v_seen_pairs := array_append(v_seen_pairs, v_pair_key);

      if v_ist_haupt then
        v_haupt_count := coalesce((v_haupt_pro_rolle ->> v_rolle)::integer, 0);

        if v_haupt_count >= 1 then
          return jsonb_build_object(
            'ok', false,
            'code', 'conflict',
            'field', 'beteiligte'
          );
        end if;

        v_haupt_pro_rolle := jsonb_set(
          v_haupt_pro_rolle,
          array[v_rolle],
          to_jsonb(v_haupt_count + 1),
          true
        );
        v_has_hauptbeteiligter := true;
      end if;

      if v_rolle = 'anfragender' then
        v_has_anfragender := true;
      end if;

      if v_kunde_id = v_row.zugeordnet_kunde_id then
        v_has_zugeordnet_kunde := true;
      end if;

      select k.mandant_id, k.aktiv, k.kundenstatus
      into v_kunde_mandant_id, v_kunde_aktiv, v_kunde_status
      from public.kunden k
      where k.id = v_kunde_id;

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

      v_staging_kunde_ids := array_append(v_staging_kunde_ids, v_kunde_id);
      v_staging_rollen := array_append(v_staging_rollen, v_rolle);
      v_staging_haupt := array_append(v_staging_haupt, v_ist_haupt);
      v_staging_notizen := array_append(v_staging_notizen, v_notizen);
    end loop;

    if not v_has_zugeordnet_kunde then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'beteiligte'
      );
    end if;

    if not v_has_anfragender then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'beteiligte'
      );
    end if;

    if not v_has_hauptbeteiligter then
      return jsonb_build_object(
        'ok', false,
        'code', 'validation_error',
        'field', 'beteiligte'
      );
    end if;
  end if;

  -- Vorgangsnummer atomar vergeben
  v_jahr := extract(year from v_row.empfangen_am)::integer;

  insert into public.vorgangsnummer_sequenzen (
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
    set letzter_wert = public.vorgangsnummer_sequenzen.letzter_wert + 1
  returning public.vorgangsnummer_sequenzen.letzter_wert into v_seq;

  v_vorgangsnummer := format(
    'VG-%s-%s',
    v_jahr,
    lpad(v_seq::text, 4, '0')
  );

  -- Vorgang anlegen
  insert into public.vorgaenge (
    mandant_id,
    vorgangsnummer,
    vorgangstyp,
    status,
    gebaeude_id,
    einheit_id,
    parent_vorgang_id,
    titel,
    beschreibung,
    quelle,
    prioritaet,
    eingegangen_am,
    aktiv
  )
  values (
    p_mandant_id,
    v_vorgangsnummer,
    v_vorgangstyp,
    'neu',
    v_row.zugeordnet_gebaeude_id,
    v_row.zugeordnet_einheit_id,
    null,
    v_titel,
    v_beschreibung,
    'anfrageeingang',
    v_prioritaet,
    v_row.empfangen_am,
    true
  )
  returning id into v_vorgang_id;

  -- Beteiligte anlegen
  if p_beteiligte is null then
    insert into public.vorgang_beteiligte (
      mandant_id,
      vorgang_id,
      kunde_id,
      rolle,
      ist_hauptbeteiligter
    )
    values (
      p_mandant_id,
      v_vorgang_id,
      v_row.zugeordnet_kunde_id,
      'anfragender',
      true
    );

    v_beteiligte_anzahl := 1;
  else
    for v_idx in 1 .. coalesce(array_length(v_staging_kunde_ids, 1), 0)
    loop
      insert into public.vorgang_beteiligte (
        mandant_id,
        vorgang_id,
        kunde_id,
        rolle,
        ist_hauptbeteiligter,
        notizen
      )
      values (
        p_mandant_id,
        v_vorgang_id,
        v_staging_kunde_ids[v_idx],
        v_staging_rollen[v_idx],
        v_staging_haupt[v_idx],
        v_staging_notizen[v_idx]
      );

      v_beteiligte_anzahl := v_beteiligte_anzahl + 1;
    end loop;
  end if;

  -- Anfrageeingang abschließen
  update public.anfrageeingaenge
  set
    zugeordneter_vorgang_id = v_vorgang_id,
    status = 'in_vorgang_ueberfuehrt',
    beendet_am = now(),
    zuletzt_bearbeitet_am = now(),
    manuelle_pruefung_erforderlich = false
  where id = p_anfrageeingang_id;

  return jsonb_build_object(
    'ok', true,
    'code', 'created',
    'idempotent', false,
    'anfrageeingang_id', p_anfrageeingang_id,
    'vorgang_id', v_vorgang_id,
    'vorgangsnummer', v_vorgangsnummer,
    'status', 'neu',
    'beteiligte_anzahl', v_beteiligte_anzahl
  );
end;
$$;

comment on function public.erstelle_vorgang_aus_anfrageeingang(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) is
  'Erzeugt atomar einen Vorgang aus bereit_fuer_vorgang + bestaetigtem Anfrageeingang. '
  'Vergibt VG-YYYY-NNNN, legt Beteiligte an, schließt Eingang ab. Idempotenz bei Replay. '
  'Nur Service Role.';

-- ---------------------------------------------------------------------------
-- Berechtigungen: kein PUBLIC/anon/authenticated
-- ---------------------------------------------------------------------------

revoke all on function public.erstelle_vorgang_aus_anfrageeingang(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) from public;

revoke all on function public.erstelle_vorgang_aus_anfrageeingang(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) from anon;

revoke all on function public.erstelle_vorgang_aus_anfrageeingang(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) from authenticated;

grant execute on function public.erstelle_vorgang_aus_anfrageeingang(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb
) to service_role;
