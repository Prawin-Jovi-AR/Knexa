-- KNEXA complete Supabase setup
-- Run this in a new Supabase project's SQL Editor.
-- This creates the application schema, secure RLS policies, realistic seed data,
-- and a profile trigger for every future Supabase Auth user.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key,
    email text unique not null,
    full_name text not null default 'KNEXA User',
    username text unique not null,
    country text,
    gender text,
    avatar_url text,
    bio text not null default '',
    followers_count integer not null default 0 check (followers_count >= 0),
    following_count integer not null default 0 check (following_count >= 0),
    connections_count integer not null default 0 check (connections_count >= 0),
    skills_shared_count integer not null default 0 check (skills_shared_count >= 0),
    skills_learning_count integer not null default 0 check (skills_learning_count >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.skills_shared (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
    skill_name text not null, category text not null default 'General', experience_level text not null default 'Beginner',
    confidence integer not null default 50 check (confidence between 0 and 100), years_of_experience numeric(4,1) not null default 0 check (years_of_experience >= 0),
    created_at timestamptz not null default now()
);
create table if not exists public.skills_learning (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
    skill_name text not null, category text not null default 'General', progress integer not null default 0 check (progress between 0 and 100),
    learning_goal text not null default 'Build practical confidence', created_at timestamptz not null default now()
);
create table if not exists public.skills_exploring (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
    skill_name text not null, category text not null default 'General', reason_for_interest text not null default 'Curious to learn', created_at timestamptz not null default now()
);
create table if not exists public.posts (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
    content text not null, category text not null default 'General', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.goals (
    id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
    title text not null, target_date date, status text not null default 'active', created_at timestamptz not null default now()
);
create table if not exists public.connections (
    id uuid primary key default gen_random_uuid(), requester_id uuid not null references public.profiles(id) on delete cascade,
    receiver_id uuid not null references public.profiles(id) on delete cascade, status text not null default 'pending', created_at timestamptz not null default now(),
    constraint connections_not_self check (requester_id <> receiver_id)
);
create table if not exists public.followers (
    id uuid primary key default gen_random_uuid(), follower_id uuid not null references public.profiles(id) on delete cascade,
    following_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(),
    constraint followers_not_self check (follower_id <> following_id), unique (follower_id, following_id)
);
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles(id) on delete cascade,
    receiver_id uuid not null references public.profiles(id) on delete cascade, content text not null, created_at timestamptz not null default now()
);
create table if not exists public.skill_requests (
    id uuid primary key default gen_random_uuid(), requester_id uuid not null references public.profiles(id) on delete cascade,
    receiver_id uuid not null references public.profiles(id) on delete cascade, requested_skill text not null, message text not null default '', status text not null default 'pending', created_at timestamptz not null default now()
);
create table if not exists public.communities (
    id uuid primary key default gen_random_uuid(), name text not null, description text, category text not null default 'General',
    creator_id uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.community_members (
    id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade, joined_at timestamptz not null default now(), unique (community_id, user_id)
);
create table if not exists public.community_messages (
    id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade, content text not null, created_at timestamptz not null default now()
);

alter table public.communities add column if not exists category text not null default 'General';

create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists skills_shared_user_idx on public.skills_shared(user_id);
create index if not exists skills_learning_user_idx on public.skills_learning(user_id);
create index if not exists skills_exploring_user_idx on public.skills_exploring(user_id);
create unique index if not exists skills_shared_user_name_idx on public.skills_shared(user_id, skill_name);
create unique index if not exists skills_learning_user_name_idx on public.skills_learning(user_id, skill_name);
create unique index if not exists skills_exploring_user_name_idx on public.skills_exploring(user_id, skill_name);
create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists posts_user_idx on public.posts(user_id);
create index if not exists connections_requester_idx on public.connections(requester_id);
create index if not exists connections_receiver_idx on public.connections(receiver_id);
create index if not exists messages_participants_idx on public.messages(sender_id, receiver_id, created_at desc);
create index if not exists goals_user_created_idx on public.goals(user_id, created_at desc);
create index if not exists community_messages_idx on public.community_messages(community_id, created_at desc);

create unique index if not exists connections_pair_idx on public.connections(least(requester_id, receiver_id), greatest(requester_id, receiver_id));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email, username, full_name)
        values (new.id, coalesce(new.email, new.id::text),
            coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'user_' || left(replace(new.id::text, '-', ''), 12)),
            coalesce(new.raw_user_meta_data ->> 'full_name', 'KNEXA User'))
    on conflict (id) do update set email = excluded.email, updated_at = now();
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Trigger functions for followers count
create or replace function public.handle_new_follower()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    return new;
end;
$$;

create or replace function public.handle_remove_follower()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
    update public.profiles set followers_count = followers_count - 1 where id = old.following_id;
    update public.profiles set following_count = following_count - 1 where id = old.follower_id;
    return old;
end;
$$;

drop trigger if exists on_follower_added on public.followers;
create trigger on_follower_added after insert on public.followers
for each row execute procedure public.handle_new_follower();

drop trigger if exists on_follower_removed on public.followers;
create trigger on_follower_removed after delete on public.followers
for each row execute procedure public.handle_remove_follower();

-- RLS: public discovery reads require a real Supabase Auth session.
-- Every write is restricted to the authenticated user's own identity.
alter table public.profiles enable row level security;
alter table public.skills_shared enable row level security;
alter table public.skills_learning enable row level security;
alter table public.skills_exploring enable row level security;
alter table public.posts enable row level security;
alter table public.goals enable row level security;
alter table public.connections enable row level security;
alter table public.followers enable row level security;
alter table public.messages enable row level security;
alter table public.skill_requests enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_messages enable row level security;

drop policy if exists skills_shared_read on public.skills_shared;
drop policy if exists skills_shared_write on public.skills_shared;
drop policy if exists skills_learning_read on public.skills_learning;
drop policy if exists skills_learning_write on public.skills_learning;
drop policy if exists skills_exploring_read on public.skills_exploring;
drop policy if exists skills_exploring_write on public.skills_exploring;
drop policy if exists posts_read on public.posts;
drop policy if exists posts_write on public.posts;
drop policy if exists goals_read on public.goals;
drop policy if exists goals_write on public.goals;
drop policy if exists connections_read on public.connections;
drop policy if exists connections_write on public.connections;
drop policy if exists connections_update on public.connections;
drop policy if exists followers_read on public.followers;
drop policy if exists followers_write on public.followers;
drop policy if exists followers_delete on public.followers;
drop policy if exists messages_read on public.messages;
drop policy if exists messages_write on public.messages;
drop policy if exists skill_requests_read on public.skill_requests;
drop policy if exists skill_requests_write on public.skill_requests;
drop policy if exists skill_requests_update on public.skill_requests;
drop policy if exists communities_read on public.communities;
drop policy if exists communities_write on public.communities;
drop policy if exists community_members_read on public.community_members;
drop policy if exists community_members_write on public.community_members;
drop policy if exists community_messages_read on public.community_messages;
drop policy if exists community_messages_write on public.community_messages;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Skills, posts and goals use the same owner rule.
create policy skills_shared_read on public.skills_shared for select to authenticated using (true);
create policy skills_shared_write on public.skills_shared for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy skills_learning_read on public.skills_learning for select to authenticated using (true);
create policy skills_learning_write on public.skills_learning for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy skills_exploring_read on public.skills_exploring for select to authenticated using (true);
create policy skills_exploring_write on public.skills_exploring for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy posts_read on public.posts for select to authenticated using (true);
create policy posts_write on public.posts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy goals_read on public.goals for select to authenticated using (user_id = auth.uid());
create policy goals_write on public.goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy connections_read on public.connections for select to authenticated using (requester_id = auth.uid() or receiver_id = auth.uid());
create policy connections_write on public.connections for insert to authenticated with check (requester_id = auth.uid());
create policy connections_update on public.connections for update to authenticated using (receiver_id = auth.uid() or requester_id = auth.uid()) with check (receiver_id = auth.uid() or requester_id = auth.uid());
create policy connections_delete on public.connections for delete to authenticated using (requester_id = auth.uid() or receiver_id = auth.uid());
create policy followers_read on public.followers for select to authenticated using (true);
create policy followers_write on public.followers for insert to authenticated with check (follower_id = auth.uid());
create policy followers_delete on public.followers for delete to authenticated using (follower_id = auth.uid());
create policy messages_read on public.messages for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy messages_write on public.messages for insert to authenticated with check (sender_id = auth.uid());
create policy messages_update on public.messages for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy messages_delete on public.messages for delete to authenticated using (sender_id = auth.uid());

create policy skill_requests_read on public.skill_requests for select to authenticated using (requester_id = auth.uid() or receiver_id = auth.uid());
create policy skill_requests_write on public.skill_requests for insert to authenticated with check (requester_id = auth.uid());
create policy skill_requests_update on public.skill_requests for update to authenticated using (receiver_id = auth.uid() or requester_id = auth.uid()) with check (receiver_id = auth.uid() or requester_id = auth.uid());
create policy communities_read on public.communities for select to authenticated using (true);
create policy communities_write on public.communities for insert to authenticated with check (creator_id = auth.uid());
create policy community_members_read on public.community_members for select to authenticated using (true);
create policy community_members_write on public.community_members for insert to authenticated with check (user_id = auth.uid());
create policy community_messages_read on public.community_messages for select to authenticated using (true);
create policy community_messages_write on public.community_messages for insert to authenticated with check (user_id = auth.uid());
create policy community_messages_update on public.community_messages for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy community_messages_delete on public.community_messages for delete to authenticated using (user_id = auth.uid());

-- 20 varied public test profiles. These are data fixtures, not login accounts.
insert into public.profiles (id,email,full_name,username,country,gender,bio) values
('00000000-0000-0000-0000-000000000001','ava@knexa.test','Ava Morgan','ava_morgan','US','female','Product designer exploring accessible technology.'),
('00000000-0000-0000-0000-000000000002','liam@knexa.test','Liam Chen','liam_chen','CA','male','Backend builder and lifelong photographer.'),
('00000000-0000-0000-0000-000000000003','sofia@knexa.test','Sofia Patel','sofia_patel','IN','female','Data storyteller learning product strategy.'),
('00000000-0000-0000-0000-000000000004','noah@knexa.test','Noah Williams','noah_w','UK','male','JavaScript developer and public speaker.'),
('00000000-0000-0000-0000-000000000005','mia@knexa.test','Mia Rodriguez','mia_rodriguez','US','female','Writer interested in machine learning.'),
('00000000-0000-0000-0000-000000000006','oliver@knexa.test','Oliver Smith','oliver_s','AU','male','Robotics hobbyist and Python mentor.'),
('00000000-0000-0000-0000-000000000007','emma@knexa.test','Emma Brown','emma_brown','UK','female','UX researcher learning frontend development.'),
('00000000-0000-0000-0000-000000000008','ethan@knexa.test','Ethan Davis','ethan_davis','CA','male','Cloud engineer exploring leadership.'),
('00000000-0000-0000-0000-000000000009','isabella@knexa.test','Isabella Garcia','isabella_g','US','female','Illustrator learning brand strategy.'),
('00000000-0000-0000-0000-000000000010','james@knexa.test','James Wilson','james_w','IN','male','Marketing analyst and Excel power user.'),
('00000000-0000-0000-0000-000000000011','amelia@knexa.test','Amelia Taylor','amelia_t','AU','female','Language learner and community organizer.'),
('00000000-0000-0000-0000-000000000012','ben@knexa.test','Ben Martin','ben_martin','US','male','Mobile developer interested in design systems.'),
('00000000-0000-0000-0000-000000000013','charlotte@knexa.test','Charlotte Lee','charlotte_l','UK','female','Cybersecurity learner and teacher.'),
('00000000-0000-0000-0000-000000000014','daniel@knexa.test','Daniel King','daniel_k','CA','male','Video editor learning storytelling.'),
('00000000-0000-0000-0000-000000000015','harper@knexa.test','Harper Scott','harper_s','US','female','Researcher sharing academic writing skills.'),
('00000000-0000-0000-0000-000000000016','henry@knexa.test','Henry Adams','henry_adams','AU','male','DevOps engineer learning Kubernetes.'),
('00000000-0000-0000-0000-000000000017','evelyn@knexa.test','Evelyn Baker','evelyn_b','IN','female','Artist exploring 3D modeling.'),
('00000000-0000-0000-0000-000000000018','jack@knexa.test','Jack Hall','jack_hall','UK','male','Teacher learning data visualization.'),
('00000000-0000-0000-0000-000000000019','ella@knexa.test','Ella Young','ella_young','CA','female','Entrepreneur sharing business planning.'),
('00000000-0000-0000-0000-000000000020','michael@knexa.test','Michael Turner','michael_t','US','male','Frontend developer exploring AI tools.')
on conflict (id) do update set email=excluded.email, full_name=excluded.full_name, username=excluded.username, country=excluded.country, gender=excluded.gender, bio=excluded.bio, updated_at=now();

insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000001','Figma','Design','Expert',92,6) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000002','Python','Programming','Advanced',86,5) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000003','Data Analysis','Data','Advanced',82,4) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000004','JavaScript','Programming','Advanced',89,6) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000005','Writing','Communication','Expert',94,8) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000006','Robotics','Technology','Intermediate',73,3) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000007','User Research','Design','Advanced',84,5) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000008','AWS','Technology','Expert',91,7) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000009','Illustration','Design','Advanced',80,5) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000010','Excel','Business','Expert',95,9) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000011','Spanish','Languages','Advanced',88,7) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000012','React','Programming','Advanced',87,4) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000013','Cybersecurity','Technology','Intermediate',70,2) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000014','Video Editing','Media','Advanced',83,6) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000015','Academic Writing','Communication','Expert',93,10) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000016','Docker','Technology','Advanced',85,5) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000017','Blender','Design','Intermediate',68,2) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000018','Data Visualization','Data','Advanced',81,4) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000019','Business Planning','Business','Advanced',86,6) on conflict (user_id,skill_name) do nothing;
insert into public.skills_shared (user_id,skill_name,category,experience_level,confidence,years_of_experience) values ('00000000-0000-0000-0000-000000000020','TypeScript','Programming','Advanced',90,5) on conflict (user_id,skill_name) do nothing;

insert into public.skills_learning (user_id,skill_name,category,progress,learning_goal) values
('00000000-0000-0000-0000-000000000001','Accessibility','Design',72,'Design inclusive interfaces'),('00000000-0000-0000-0000-000000000002','Photography','Media',48,'Create a portrait portfolio'),('00000000-0000-0000-0000-000000000003','Product Management','Business',64,'Lead a small product launch'),('00000000-0000-0000-0000-000000000004','React','Programming',81,'Build reusable interfaces'),('00000000-0000-0000-0000-000000000005','Machine Learning','Data',37,'Train a useful classifier'),('00000000-0000-0000-0000-000000000006','Python','Programming',56,'Automate robot controls'),('00000000-0000-0000-0000-000000000007','JavaScript','Programming',69,'Ship an interactive prototype'),('00000000-0000-0000-0000-000000000008','Public Speaking','Communication',43,'Present technical ideas clearly'),('00000000-0000-0000-0000-000000000009','Brand Strategy','Business',61,'Build a consistent brand'),('00000000-0000-0000-0000-000000000010','SQL','Data',76,'Analyze business performance'),('00000000-0000-0000-0000-000000000011','French','Languages',52,'Hold everyday conversations'),('00000000-0000-0000-0000-000000000012','UI Design','Design',84,'Improve design system skills'),('00000000-0000-0000-0000-000000000013','Python','Programming',29,'Build security automations'),('00000000-0000-0000-0000-000000000014','Storytelling','Communication',66,'Improve narrative structure'),('00000000-0000-0000-0000-000000000015','Data Science','Data',45,'Publish a research project'),('00000000-0000-0000-0000-000000000016','Kubernetes','Technology',58,'Deploy a production service'),('00000000-0000-0000-0000-000000000017','3D Modeling','Design',34,'Model a small environment'),('00000000-0000-0000-0000-000000000018','Python','Programming',63,'Create clear dashboards'),('00000000-0000-0000-0000-000000000019','Marketing Analytics','Business',71,'Measure campaign results'),('00000000-0000-0000-0000-000000000020','Machine Learning','Data',49,'Add AI to a web app')
on conflict (user_id, skill_name) do nothing;

/* Disabled malformed long seed; replaced below with separate statements.
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values
('00000000-0000-0000-0000-000000000001','Service Design','Design','Map better end-to-end experiences'),('00000000-00000000-0000-0000-000000000002','Jazz Piano','Music','Learn improvisation and rhythm'),('00000000-0000-0000-0000-000000000003','Climate Science','Science','Understand practical climate solutions'),('00000000-0000-0000-0000-000000000004','Game Development','Technology','Design a small playable world'),('00000000-0000-0000-0000-000000000005','Podcasting','Media','Tell thoughtful long-form stories'),('00000000-0000-0000-0000-000000000006','Electronics','Technology','Build useful physical prototypes'),('00000000-0000-0000-0000-000000000007','Information Architecture','Design','Organize complex content clearly'),('00000000-0000-0000-0000-000000000008','Team Coaching','Business','Help teams work more effectively'),('00000000-0000-0000-0000-000000000009','Ceramics','Art','Practice a hands-on creative craft'),('00000000-0000-0000-0000-000000000010','Economics','Business','Connect analysis to real decisions'),('00000000-0000-0000-0000-000000000011','Japanese','Languages','Explore a new writing system'),('00000000-0000-0000-0000-000000000012','Motion Design','Media','Make interfaces feel more expressive'),('00000000-0000-0000-0000-000000000013','Ethical Hacking','Technology','Learn defensive security methods'),('00000000-0000-0000-0000-000000000014','Color Grading','Media','Improve visual mood and continuity'),('00000000-0000-0000-0000-000000000015','Public Policy','Society','Understand how research becomes action'),('00000000-0000-0000-0000-000000000016','Infrastructure as Code','Technology','Make deployments repeatable'),('00000000-0000-0000-0000-000000000017','Animation','Art','Bring characters to life'),('00000000-0000-0000-0000-000000000018','Statistics','Data','Make stronger analytical conclusions'),('00000000-0000-0000-0000-000000000019','Negotiation','Business','Build better partnership outcomes'),('00000000-0000-0000-0000-000000000020','Natural Language Processing','Data','Explore language-focused AI')
on conflict (user_id, skill_name) do nothing; */

insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000001','Service Design','Design','Map better end-to-end experiences') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000002','Jazz Piano','Music','Learn improvisation and rhythm') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000003','Climate Science','Science','Understand practical climate solutions') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000004','Game Development','Technology','Design a small playable world') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000005','Podcasting','Media','Tell thoughtful long-form stories') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000006','Electronics','Technology','Build useful physical prototypes') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000007','Information Architecture','Design','Organize complex content clearly') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000008','Team Coaching','Business','Help teams work more effectively') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000009','Ceramics','Art','Practice a hands-on creative craft') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000010','Economics','Business','Connect analysis to real decisions') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000011','Japanese','Languages','Explore a new writing system') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000012','Motion Design','Media','Make interfaces more expressive') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000013','Ethical Hacking','Technology','Learn defensive security methods') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000014','Color Grading','Media','Improve visual mood and continuity') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000015','Public Policy','Society','Understand how research becomes action') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000016','Infrastructure as Code','Technology','Make deployments repeatable') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000017','Animation','Art','Bring characters to life') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000018','Statistics','Data','Make stronger analytical conclusions') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000019','Negotiation','Business','Build better partnership outcomes') on conflict (user_id,skill_name) do nothing;
insert into public.skills_exploring (user_id,skill_name,category,reason_for_interest) values ('00000000-0000-0000-0000-000000000020','Natural Language Processing','Data','Explore language-focused AI') on conflict (user_id,skill_name) do nothing;

insert into public.communities (name,description,category,creator_id) values
('Frontend Builders','Share practical frontend patterns and review projects.','Programming','00000000-0000-0000-0000-000000000020'),('Design Circle','A thoughtful space for UX, accessibility, and visual design.','Design','00000000-0000-0000-0000-000000000001'),('Data Explorers','Learn by turning messy questions into useful analysis.','Data','00000000-0000-0000-0000-000000000003'),('Language Exchange','Practice languages with patient conversation partners.','Languages','00000000-0000-0000-0000-000000000011'),('Career Storytellers','Improve communication, portfolios, and professional confidence.','Communication','00000000-0000-0000-0000-000000000015')
on conflict do nothing;

insert into public.posts (user_id,content,category) values
('00000000-0000-0000-0000-000000000001','I redesigned a checkout flow with keyboard navigation and clearer focus states.','Design'),
('00000000-0000-0000-0000-000000000002','A small Python automation can save hours when it removes one repeated task.','Programming'),
('00000000-0000-0000-0000-000000000003','What makes a data visualization trustworthy to you?','Data'),
('00000000-0000-0000-0000-000000000004','I am comparing state management patterns for a new React project.','Programming'),
('00000000-0000-0000-0000-000000000005','A useful writing habit: start with the reader question, not the answer.','Communication'),
('00000000-0000-0000-0000-000000000006','Looking for a partner to prototype a low-cost robotics project.','Technology'),
('00000000-0000-0000-0000-000000000007','User interviews often reveal a workflow issue that analytics hide.','Design'),
('00000000-0000-0000-0000-000000000008','Sharing a checklist for deploying a small service on AWS.','Technology'),
('00000000-0000-0000-0000-000000000009','How do you keep illustration systems consistent across a product?','Design'),
('00000000-0000-0000-0000-000000000010','A spreadsheet becomes much more useful when the question is precise.','Business');

insert into public.goals (user_id,title,target_date,status) values
('00000000-0000-0000-0000-000000000001','Publish an accessible portfolio',current_date + 20,'active'),
('00000000-0000-0000-0000-000000000002','Automate a weekly report',current_date + 14,'active'),
('00000000-0000-0000-0000-000000000003','Present a data story',current_date + 30,'active'),
('00000000-0000-0000-0000-000000000004','Ship a React feature',current_date + 18,'active'),
('00000000-0000-0000-0000-000000000005','Finish an ML course',current_date + 45,'active'),
('00000000-0000-0000-0000-000000000006','Build a robot prototype',current_date + 60,'active'),
('00000000-0000-0000-0000-000000000007','Run five usability tests',current_date + 25,'active'),
('00000000-0000-0000-0000-000000000008','Lead a technical talk',current_date + 35,'active'),
('00000000-0000-0000-0000-000000000009','Create a brand guide',current_date + 28,'active'),
('00000000-0000-0000-0000-000000000010','Build a dashboard',current_date + 21,'active');

insert into public.connections (requester_id,receiver_id,status) values
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','accepted'),
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000006','accepted'),
('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000005','pending'),
('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000012','accepted'),
('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000016','pending');

insert into public.followers (follower_id,following_id) values
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004'),
('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006'),
('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000008'),
('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000010');

insert into public.messages (sender_id,receiver_id,content) values
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','Would you like to compare notes on accessible React interfaces?'),
('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Absolutely. I can share a small component example.'),
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000006','Your robotics project sounds fun. I can help with Python automation.'),
('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000012','I would enjoy reviewing your design system work.'),
('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000016','Can you recommend a good Kubernetes learning project?');

insert into public.community_members (community_id,user_id)
select c.id, v.user_id
from public.communities c
join (values
    ('Frontend Builders','00000000-0000-0000-0000-000000000004'::uuid),
    ('Frontend Builders','00000000-0000-0000-0000-000000000012'::uuid),
    ('Design Circle','00000000-0000-0000-0000-000000000007'::uuid),
    ('Data Explorers','00000000-0000-0000-0000-000000000018'::uuid),
    ('Language Exchange','00000000-0000-0000-0000-000000000005'::uuid)
) as v(community_name,user_id) on v.community_name = c.name
on conflict (community_id,user_id) do nothing;

-- Refresh counters for seeded data.
update public.profiles p set skills_shared_count=(select count(*) from public.skills_shared s where s.user_id=p.id), skills_learning_count=(select count(*) from public.skills_learning l where l.user_id=p.id), updated_at=now();
