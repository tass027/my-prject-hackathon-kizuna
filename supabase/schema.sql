-- Mieru — schéma Supabase (Membre 2). À coller dans Supabase > SQL Editor > New query > Run.
-- Règles d'accès volontairement simples pour le hackathon : quiconque connaît l'identifiant
-- d'un compteur (obtenu via son code de partage) peut le lire et y écrire.

create extension if not exists pgcrypto;

create table if not exists compteurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  code_partage text unique not null,
  index_depart numeric not null,
  seuil_kwh_mois numeric not null default 200,
  cree_le timestamptz not null default now()
);

create table if not exists membres (
  id uuid primary key default gen_random_uuid(),
  compteur_id uuid not null references compteurs(id) on delete cascade,
  prenom text not null,
  role text not null default 'membre' check (role in ('createur', 'membre', 'suivi_distance')),
  rejoint_le timestamptz not null default now()
);

create table if not exists releves (
  id uuid primary key default gen_random_uuid(),
  compteur_id uuid not null references compteurs(id) on delete cascade,
  membre_id uuid references membres(id) on delete set null,
  index_kwh numeric not null,
  source text not null check (source in ('ocr', 'manuel', 'ocr_corrige')),
  confiance_ocr numeric,
  photo_chemin text,
  photo_sha256 text,
  pris_le timestamptz,
  recu_le timestamptz not null default now()   -- date serveur : la preuve
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  compteur_id uuid not null references compteurs(id) on delete cascade,
  membre_id uuid references membres(id) on delete set null,
  texte text not null check (char_length(texte) <= 120),
  cree_le timestamptz not null default now()
);

create table if not exists kakeibo (
  id uuid primary key default gen_random_uuid(),
  compteur_id uuid not null references compteurs(id) on delete cascade,
  mois date not null,
  objectif_kwh numeric not null,
  evenements jsonb not null default '[]',
  amelioration text,
  bilan jsonb,
  unique (compteur_id, mois)
);

-- recu_le est fixé par le serveur, même si le client envoie autre chose.
create or replace function fixer_recu_le() returns trigger language plpgsql as $$
begin new.recu_le := now(); return new; end $$;
drop trigger if exists releves_recu_le on releves;
create trigger releves_recu_le before insert on releves for each row execute function fixer_recu_le();

-- Accès hackathon
alter table compteurs enable row level security;
alter table membres enable row level security;
alter table releves enable row level security;
alter table messages enable row level security;
alter table kakeibo enable row level security;
do $$ declare t text; begin
  foreach t in array array['compteurs','membres','releves','messages','kakeibo'] loop
    execute format('drop policy if exists hackathon_%1$s on %1$s', t);
    execute format('create policy hackathon_%1$s on %1$s for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Temps réel (mode Kizuna)
alter publication supabase_realtime add table releves, membres, messages;

-- Photos des relevés
insert into storage.buckets (id, name, public) values ('releves', 'releves', true)
on conflict (id) do nothing;
drop policy if exists hackathon_photos_lecture on storage.objects;
create policy hackathon_photos_lecture on storage.objects for select to anon, authenticated using (bucket_id = 'releves');
drop policy if exists hackathon_photos_envoi on storage.objects;
create policy hackathon_photos_envoi on storage.objects for insert to anon, authenticated with check (bucket_id = 'releves');

-- =====================================================================
-- Partage volontaire avec la STEG (tableau de bord collectif)
-- Un enregistrement par compteur. Le client présélectionne 'anonyme' mais demande une confirmation explicite.
-- 'contact' est conservé pour les anciens consentements. 'nomme' inclut le nom courant du compteur, absent de la vue du tableau.
-- Aucun nom ni code de partage n'est exposé au tableau de bord : il lit la vue steg_foyers.
-- Cette configuration de démonstration autorise les clients de l'application à lire partages_steg.
-- =====================================================================
create table if not exists partages_steg (
  compteur_id uuid primary key references compteurs(id) on delete cascade,
  niveau text not null default 'aucun' check (niveau in ('aucun', 'anonyme', 'contact', 'nomme')),
  ville text not null,
  type_logement text check (type_logement in ('appartement', 'maison')),
  personnes int check (personnes between 1 and 15),
  nom_foyer text,
  consenti_le timestamptz,
  modifie_le timestamptz not null default now()
);
alter table partages_steg add column if not exists nom_foyer text;
alter table partages_steg drop constraint if exists partages_steg_niveau_check;
alter table partages_steg add constraint partages_steg_niveau_check check (niveau in ('aucun', 'anonyme', 'contact', 'nomme'));
alter table partages_steg enable row level security;
drop policy if exists hackathon_partages_steg on partages_steg;
create policy hackathon_partages_steg on partages_steg for all to anon, authenticated using (true) with check (true);

-- Vue lue par le tableau de bord : relevés des seuls foyers qui partagent, sans nom ni code.
create or replace view steg_foyers as
select p.compteur_id, p.niveau, p.ville, p.type_logement, p.personnes,
       c.index_depart, c.cree_le,
       coalesce(json_agg(json_build_object('index', r.index_kwh, 'prisLe', r.pris_le, 'recuLe', r.recu_le) order by r.recu_le)
                filter (where r.id is not null), '[]') as releves
from partages_steg p
join compteurs c on c.id = p.compteur_id
left join releves r on r.compteur_id = p.compteur_id
where p.niveau <> 'aucun'
group by p.compteur_id, p.niveau, p.ville, p.type_logement, p.personnes, c.index_depart, c.cree_le;
-- En production : réserver steg_foyers au rôle STEG authentifié, et retirer l'accès anon aux tables.

-- =====================================================================
-- Production photovoltaïque : données par foyer non lisibles par les clients.
-- Le tableau ne peut lire que des agrégats d'au moins cinq foyers par ville et par mois.
-- =====================================================================
create table if not exists steg_pv_contributions (
  compteur_id uuid not null references compteurs(id) on delete cascade,
  mois date not null check (extract(day from mois) = 1),
  ville text not null,
  production_estimee_kwh numeric not null check (production_estimee_kwh >= 0),
  export_mesure_kwh numeric check (export_mesure_kwh >= 0),
  modifie_le timestamptz not null default now(),
  primary key (compteur_id, mois)
);
alter table steg_pv_contributions enable row level security;
revoke all on table steg_pv_contributions from anon, authenticated;

create or replace function public.soumettre_pv_agrege(
  p_compteur_id uuid,
  p_mois date,
  p_ville text,
  p_production_estimee_kwh numeric,
  p_export_mesure_kwh numeric,
  p_partager boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not p_partager then
    delete from steg_pv_contributions where compteur_id = p_compteur_id;
    return;
  end if;

  if p_mois is null or extract(day from p_mois) <> 1
     or p_ville not in ('tunis', 'ariana', 'ben-arous', 'bizerte', 'nabeul', 'sousse', 'monastir', 'mahdia', 'sfax', 'kairouan', 'beja', 'jendouba', 'le-kef', 'siliana', 'kasserine', 'sidi-bouzid', 'gafsa', 'tozeur', 'kebili', 'gabes', 'medenine', 'tataouine')
     or p_production_estimee_kwh is null or p_production_estimee_kwh < 0
     or (p_export_mesure_kwh is not null and p_export_mesure_kwh < 0) then
    raise exception 'Données photovoltaïques invalides';
  end if;

  if not exists (
    select 1 from partages_steg
    where compteur_id = p_compteur_id and niveau <> 'aucun'
  ) then
    raise exception 'Le partage STEG doit être actif';
  end if;

  insert into steg_pv_contributions (
    compteur_id, mois, ville, production_estimee_kwh, export_mesure_kwh, modifie_le
  ) values (
    p_compteur_id, p_mois, p_ville, p_production_estimee_kwh, p_export_mesure_kwh, now()
  )
  on conflict (compteur_id, mois) do update set
    ville = excluded.ville,
    production_estimee_kwh = excluded.production_estimee_kwh,
    export_mesure_kwh = excluded.export_mesure_kwh,
    modifie_le = now();
end
$$;
revoke all on function public.soumettre_pv_agrege(uuid, date, text, numeric, numeric, boolean) from public;
grant execute on function public.soumettre_pv_agrege(uuid, date, text, numeric, numeric, boolean) to anon, authenticated;

create or replace function public.retirer_pv_si_partage_arrete() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.niveau = 'aucun' then
    delete from steg_pv_contributions where compteur_id = new.compteur_id;
  end if;
  return new;
end
$$;
drop trigger if exists partages_steg_arret_pv on partages_steg;
create trigger partages_steg_arret_pv
after insert or update on partages_steg
for each row execute function public.retirer_pv_si_partage_arrete();

create or replace view public.steg_pv_agregats as
select
  mois,
  ville,
  count(*)::integer as foyers_pv,
  round(sum(production_estimee_kwh), 1) as production_estimee_kwh,
  case when count(export_mesure_kwh) >= 5
    then round(sum(export_mesure_kwh), 1)
    else null
  end as export_mesure_kwh
from steg_pv_contributions
group by mois, ville
having count(*) >= 5;
grant select on public.steg_pv_agregats to anon, authenticated;

-- =====================================================================
-- Version « partage obligatoire » : réseau, délestage ciblé, avis STEG
-- Le partage est une condition d'utilisation (niveau 'nomme', date d'acceptation dans consenti_le).
-- Base légale visée : convention foyer–STEG (loi organique 2004-63, art. 29) + déclaration INPDP.
-- =====================================================================
alter table partages_steg add column if not exists prioritaire boolean not null default false; -- équipement médical : jamais coupé
alter table partages_steg add column if not exists pv_kwc numeric check (pv_kwc > 0);
alter table partages_steg add column if not exists pv_injection_kwh numeric check (pv_injection_kwh >= 0); -- mois en cours

drop view if exists steg_foyers;
create view steg_foyers as
select p.compteur_id, p.niveau, p.ville, p.type_logement, p.personnes, p.nom_foyer, p.prioritaire, p.consenti_le,
       p.pv_kwc, p.pv_injection_kwh as pv_injection,
       c.index_depart, c.cree_le,
       coalesce(json_agg(json_build_object('index', r.index_kwh, 'prisLe', r.pris_le, 'recuLe', r.recu_le) order by r.recu_le)
                filter (where r.id is not null), '[]') as releves
from partages_steg p
join compteurs c on c.id = p.compteur_id
left join releves r on r.compteur_id = p.compteur_id
where p.niveau = 'nomme'
group by p.compteur_id, p.niveau, p.ville, p.type_logement, p.personnes, p.nom_foyer, p.prioritaire, p.consenti_le, p.pv_kwc, p.pv_injection_kwh, c.index_depart, c.cree_le;

-- Avis envoyés par la STEG à un foyer : alerte, limitation, coupure, rétablissement.
create table if not exists avis_steg (
  id uuid primary key default gen_random_uuid(),
  compteur_id uuid not null references compteurs(id) on delete cascade,
  type text not null check (type in ('alerte', 'limite', 'coupe', 'retabli')),
  debut timestamptz,
  fin timestamptz check (fin is null or fin <= debut + interval '60 minutes'), -- une heure au plus
  raisons text[],
  envoye_le timestamptz not null default now(),
  lu_le timestamptz
);
alter table avis_steg enable row level security;
drop policy if exists hackathon_avis_steg on avis_steg;
create policy hackathon_avis_steg on avis_steg for all to anon, authenticated using (true) with check (true);
do $$ begin alter publication supabase_realtime add table avis_steg; exception when others then null; end $$;
-- En production : seul le rôle STEG authentifié écrit dans avis_steg et lit steg_foyers ; un foyer ne lit que ses propres avis.
