-- SyllabusSync Database Schema
-- Run this SQL in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Profiles table
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  timezone text default 'America/Los_Angeles',
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- 2. Courses table
create table courses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  color_hex text not null default '#4A90D9',
  semester text,
  created_at timestamptz default now()
);
alter table courses enable row level security;
create policy "Users can CRUD own courses" on courses for all using (auth.uid() = user_id);

-- 3. Syllabuses table
create table syllabuses (
  id uuid default gen_random_uuid() primary key,
  course_id uuid references courses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  file_url text,
  file_type text,
  parse_status text default 'pending',
  uploaded_at timestamptz default now()
);
alter table syllabuses enable row level security;
create policy "Users can CRUD own syllabuses" on syllabuses for all using (auth.uid() = user_id);

-- 4. Calendar Events table
create table calendar_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  course_id uuid references courses on delete cascade not null,
  syllabus_id uuid references syllabuses on delete set null,
  title text not null,
  event_type text default 'other',
  due_date date,
  due_time time,
  notes text,
  date_confidence text,
  needs_review boolean default false,
  ai_extracted boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table calendar_events enable row level security;
create policy "Users can CRUD own events" on calendar_events for all using (auth.uid() = user_id);

-- 5. Storage bucket for syllabuses
insert into storage.buckets (id, name, public) values ('syllabuses', 'syllabuses', false);
create policy "Users can upload own syllabuses" on storage.objects for insert with check (bucket_id = 'syllabuses' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can view own syllabuses" on storage.objects for select using (bucket_id = 'syllabuses' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete own syllabuses" on storage.objects for delete using (bucket_id = 'syllabuses' and auth.uid()::text = (storage.foldername(name))[1]);
