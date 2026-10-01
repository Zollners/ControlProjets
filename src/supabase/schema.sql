-- VoltFlow ERP — Schema Supabase (PostgreSQL)
-- Espelha as entidades do Base44. Execute no SQL Editor do Supabase.
create extension if not exists "uuid-ossp";

-- ============ TABELAS ============
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  nome text not null,
  cliente text not null,
  tensao_nominal text,
  corrente_curto_circuito text,
  norma_aplicavel text,
  status text default 'Em Orçamentação',
  progresso numeric,
  data_conclusao date,
  descricao text,
  altura numeric,
  largura numeric,
  comprimento numeric,
  dissipacao_termica_total_componentes numeric,
  dissipacao_passiva_painel numeric,
  is_insercao_manual_termica boolean default false,
  dissipacao_manual_override numeric
);

create table if not exists components (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  fabricante text not null,
  modelo text not null,
  part_number text not null,
  categoria text not null,
  codigo_erp text,
  cod_totvs text,
  tensao text,
  corrente text,
  capacidade_ruptura text,
  dissipacao_termica numeric,
  especificacoes text
);

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  projeto_id uuid references projects(id) on delete cascade,
  titulo text not null,
  fase text,
  status text,
  responsavel text,
  descricao text,
  data_inicio date,
  data_fim date,
  progresso numeric,
  ordem numeric,
  dependencias jsonb default '[]'::jsonb
);

create table if not exists bom_items (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  projeto_id uuid references projects(id) on delete cascade,
  componente_id uuid references components(id) on delete set null,
  quantidade numeric not null,
  tag text,
  observacao text,
  cod_totvs text,
  codigo_item text,
  descricao text
);

create table if not exists mtds (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  projeto_id uuid not null references projects(id) on delete cascade,
  numero_projeto text,
  norma_referencia jsonb default '[]'::jsonb,
  frequencia_hz numeric,
  tensao_isolamento_ui text,
  tensao_impulso_uimp text,
  corrente_nominal_in numeric,
  sistema_aterramento text,
  protocolos_rede jsonb default '[]'::jsonb,
  protocolos_campo jsonb default '[]'::jsonb,
  descricao_io text,
  motores jsonb default '[]'::jsonb,
  potencia_total text,
  especificacao_partidas text,
  tensao_comando text,
  categoria_seguranca text,
  equipamentos_seguranca jsonb default '[]'::jsonb,
  forma_separacao text,
  grau_protecao_ip text,
  grau_impacto_ik text,
  tipo_instalacao text,
  ventilacao text,
  temperatura_max numeric,
  altitude numeric,
  cor_pintura text,
  dissipacao_componentes_w numeric,
  notas_ricas text
);

create table if not exists project_notes (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  projeto_id uuid not null references projects(id) on delete cascade,
  conteudo_rico text,
  checklist jsonb default '[]'::jsonb
);

create table if not exists as_built_records (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  projeto_id uuid not null references projects(id) on delete cascade,
  descricao text not null,
  responsavel text not null,
  data date not null,
  status text not null
);

create table if not exists project_shares (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  projeto_id uuid not null,
  projeto_nome text,
  shared_with_email text not null,
  permissao text not null,
  status text not null default 'pendente'
);

create table if not exists calendar_events (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  titulo text not null,
  descricao text,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  tipo text not null,
  responsavel text
);

create table if not exists notes (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  titulo text not null,
  conteudo text not null,
  cor text
);

create table if not exists cabinets (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  modelo text not null,
  fabricante text,
  largura numeric not null,
  altura numeric not null,
  profundidade numeric not null,
  ip_protecao text,
  observacoes text
);

create table if not exists naming_standards (
  id uuid primary key default uuid_generate_v4(),
  created_date timestamptz default now(),
  updated_date timestamptz default now(),
  created_by_id uuid,
  tipo text not null,
  mascara text not null,
  descricao text not null,
  exemplo text
);

-- ============ ÍNDICES ============
create index if not exists idx_tasks_projeto on tasks(projeto_id);
create index if not exists idx_bom_projeto on bom_items(projeto_id);
create index if not exists idx_mtd_projeto on mtds(projeto_id);
create index if not exists idx_notes_projeto on project_notes(projeto_id);
create index if not exists idx_asbuilt_projeto on as_built_records(projeto_id);
create index if not exists idx_shares_projeto on project_shares(projeto_id);
create index if not exists idx_shares_email on project_shares(shared_with_email);

-- ============ TRIGGER updated_date ============
create or replace function set_updated_date() returns trigger as $$
begin new.updated_date = now(); return new; end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'projects','components','tasks','bom_items','mtds','project_notes',
    'as_built_records','project_shares','calendar_events','notes','cabinets','naming_standards'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s', t);
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_date()', t);
  end loop;
end $$;

-- ============ RLS BÁSICO (ajuste conforme necessidade) ============
-- Altere estas políticas para refletir o isolamento desejado no Supabase.
-- Exemplo: cada usuário vê/gerencia apenas seus registros.
-- alter table projects enable row level security;
-- create policy "owner_all_projects" on projects for all using (created_by_id = auth.uid());