-- Somente no cluster descartável criado por test_rls.py. Nunca executar no Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth, public to anon, authenticated, service_role;

create schema test_support;
grant usage on schema test_support to anon, authenticated, service_role;

create function test_support.ok(condition boolean, label text)
returns void language plpgsql security invoker as $$
begin
  if condition is distinct from true then
    raise exception 'FAIL: %', label;
  end if;
  raise notice 'PASS: %', label;
end;
$$;

create function test_support.affected(statement text, expected bigint, label text)
returns void language plpgsql security invoker as $$
declare
  rows_changed bigint;
begin
  execute statement;
  get diagnostics rows_changed = row_count;
  perform test_support.ok(rows_changed = expected, label);
end;
$$;

create function test_support.denied(statement text, label text)
returns void language plpgsql security invoker as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    raise notice 'PASS: %', label;
    return;
  end;
  raise exception 'FAIL: operação deveria ser negada: %', label;
end;
$$;

-- Sentinela: a migration não pode modificar políticas/grants de outras tabelas.
create table public.fora_do_escopo (id bigint);
alter table public.fora_do_escopo enable row level security;
create policy sentinela on public.fora_do_escopo for select to anon using (true);
