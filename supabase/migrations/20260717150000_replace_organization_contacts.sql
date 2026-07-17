-- Atomares Ersetzen der Ansprechpartner einer Organization
-- contacts-JSON: identisches Format wie payload.contacts in create_mandant_onboarding

create or replace function public.replace_organization_contacts(
  p_organization_id uuid,
  p_contacts jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact jsonb;
begin
  if p_organization_id is null then
    raise exception 'Organization-ID fehlt';
  end if;

  if p_contacts is null then
    raise exception 'Contacts-JSON fehlt';
  end if;

  if jsonb_typeof(p_contacts) <> 'array' then
    raise exception 'Contacts-JSON muss ein Array sein';
  end if;

  if jsonb_array_length(p_contacts) = 0 then
    raise exception 'Contacts-Array darf nicht leer sein';
  end if;

  if not exists (
    select 1
    from public.organizations
    where id = p_organization_id
  ) then
    raise exception 'Organization nicht gefunden: %', p_organization_id;
  end if;

  delete from public.ansprechpartner
  where organization_id = p_organization_id;

  for v_contact in
    select value from jsonb_array_elements(p_contacts)
  loop
    if jsonb_typeof(v_contact) <> 'object' then
      raise exception 'Jeder Contacts-Eintrag muss ein JSON-Objekt sein';
    end if;

    insert into public.ansprechpartner (
      organization_id,
      vorname,
      nachname,
      position,
      email,
      telefon_vorwahl,
      telefon_nummer,
      ist_geschaeftsfuehrer,
      ist_hauptansprechpartner
    )
    values (
      p_organization_id,
      v_contact->>'vorname',
      v_contact->>'nachname',
      nullif(trim(v_contact->>'position'), ''),
      nullif(trim(v_contact->>'email'), ''),
      nullif(trim(v_contact->>'telefon_vorwahl'), ''),
      nullif(trim(v_contact->>'telefon_nummer'), ''),
      coalesce((v_contact->>'ist_geschaeftsfuehrer')::boolean, false),
      coalesce((v_contact->>'ist_hauptansprechpartner')::boolean, false)
    );
  end loop;

  return p_organization_id;
exception
  when others then
    raise;
end;
$$;

grant execute on function public.replace_organization_contacts(uuid, jsonb) to service_role;
