-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Profiles Table (extends Supabase Auth auth.users)
create table
  public.profiles (
    id uuid references auth.users on delete cascade not null primary key,
    username text unique,
    created_at timestamp with time zone default timezone ('utc'::text, now()) not null
  );

-- Enable RLS on Profiles
alter table public.profiles enable row level security;
create policy "Users can view own profile." on profiles for select using (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- Function to handle new user signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Create Students Table
create table
  public.students (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    name text not null,
    phone text,
    balance numeric default 0 not null,
    created_at timestamp with time zone default timezone ('utc'::text, now()) not null
  );

-- Enable RLS on Students
alter table public.students enable row level security;
create policy "Users can manage their own students." on public.students
  for all using (auth.uid() = user_id);


-- 3. Create Courses Table
create table
  public.courses (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    name text not null,
    default_hours numeric default 1 not null,
    description text,
    created_at timestamp with time zone default timezone ('utc'::text, now()) not null
  );

-- Enable RLS on Courses
alter table public.courses enable row level security;
create policy "Users can manage their own courses." on public.courses
  for all using (auth.uid() = user_id);


-- 4. Create Purchases Table
create table
  public.purchases (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    student_id uuid references public.students(id) on delete cascade not null,
    course_id uuid references public.courses(id) on delete cascade not null,
    hours_bought numeric not null,
    date timestamp with time zone default timezone ('utc'::text, now()) not null
  );

-- Enable RLS on Purchases
alter table public.purchases enable row level security;
create policy "Users can manage their own purchases." on public.purchases
  for all using (auth.uid() = user_id);


-- 5. Create Signins Table
create table
  public.signins (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    student_id uuid references public.students(id) on delete cascade not null,
    course_id uuid references public.courses(id) on delete cascade not null,
    hours_deducted numeric not null,
    date timestamp with time zone default timezone ('utc'::text, now()) not null
  );

-- Enable RLS on Signins
alter table public.signins enable row level security;
create policy "Users can manage their own signins." on public.signins
  for all using (auth.uid() = user_id);

-- 6. Array Support for active courses
-- In Supabase/PostgreSQL, instead of a JSON array, we can use a many-to-many relationship
-- table, but for simplicity to match localstorage migration, we can add an array column 
-- to the students table.
alter table public.students add column current_courses uuid[] default array[]::uuid[];
