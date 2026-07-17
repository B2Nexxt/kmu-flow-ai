-- Status "inaktiv" für organizations erlauben

alter table public.organizations
  drop constraint if exists organizations_status_check;

alter table public.organizations
  add constraint organizations_status_check
  check (
    status is null
    or status in ('interessent', 'aktiver_mandant', 'inaktiv')
  );
