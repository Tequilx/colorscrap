-- ColorScrap: schema ขั้นที่ 7 (SPEC §7.2)
-- วางทั้งไฟล์ใน Supabase Dashboard → SQL Editor แล้วกด Run รันซ้ำได้ (idempotent)

-- ---------------------------------------------------------------------------
-- ตาราง
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar text not null default 'cat'
    check (avatar in ('cat','plant','cloud','moon','flower','fish','mug','star')),
  cover_color text not null default '#9E2F2A',
  likes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  local_date date not null,            -- วันที่ตามเวลาเครื่องผู้ใช้ ใช้จัดกลุ่มรายวัน
  local_time time not null,            -- เวลาตามเครื่องผู้ใช้ ใช้วางบนเส้นเวลา
  emotion text not null                -- อารมณ์ล่าสุดของแผ่น (= emotions[ล่าสุด])
    check (emotion in ('happy','calm','excited','warm','sad','angry','anxious','tired')),
  emotions text[] not null             -- อารมณ์ที่หยดลงแผ่นนี้ตามลำดับ (อย่างน้อย 1 ค่า)
    check (cardinality(emotions) >= 1
      and emotions <@ array['happy','calm','excited','warm','sad','angry','anxious','tired']
      and emotions[cardinality(emotions)] = emotion),
  intensity smallint not null check (intensity between 0 and 2),
  colors jsonb not null                -- [{"hex":"#5FA3C8","ratio":0.42}, ...] สีที่ดูดจากภาพ (ratio รวม 1)
    check (jsonb_typeof(colors) = 'array' and jsonb_array_length(colors) between 1 and 5),
  shifted boolean not null default false,
  image_path text not null,            -- {user_id}/{id}.{ext} ตามชนิดไฟล์จริง (webp/jpg/png) ใน bucket paintings
  thumb_path text not null             -- {user_id}/{id}_thumb.{ext}
);

create index if not exists entries_user_date on public.entries (user_id, local_date, local_time);

-- updated_at ของ profiles
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: เห็นและแก้ได้เฉพาะแถวของตัวเอง
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.entries  enable row level security;

drop policy if exists "own profile" on public.profiles;
drop policy if exists "profiles select own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles delete own" on public.profiles;

create policy "profiles select own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles delete own" on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

drop policy if exists "own entries" on public.entries;
drop policy if exists "entries select own" on public.entries;
drop policy if exists "entries insert own" on public.entries;
drop policy if exists "entries update own" on public.entries;
drop policy if exists "entries delete own" on public.entries;

create policy "entries select own" on public.entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "entries insert own" on public.entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "entries update own" on public.entries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "entries delete own" on public.entries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage: bucket paintings แบบ private
-- รับ webp เป็นหลัก; jpeg/png เผื่อ Safari รุ่นเก่าที่ canvas เข้ารหัส WebP ไม่ได้ (src/lib/exportImage.js)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('paintings', 'paintings', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- เข้าถึงได้เฉพาะไฟล์ในโฟลเดอร์ที่ชื่อตรงกับ auth.uid() ({user_id}/...)
drop policy if exists "paintings select own" on storage.objects;
drop policy if exists "paintings insert own" on storage.objects;
drop policy if exists "paintings update own" on storage.objects;
drop policy if exists "paintings delete own" on storage.objects;

create policy "paintings select own" on storage.objects
  for select to authenticated
  using (bucket_id = 'paintings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "paintings insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'paintings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "paintings update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'paintings' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'paintings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "paintings delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'paintings' and (storage.foldername(name))[1] = (select auth.uid())::text);
