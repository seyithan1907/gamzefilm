-- Kullanıcı tercihleri tablosu
create table public.user_preferences (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    genre_stats jsonb default '{}'::jsonb,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id)
);

-- RLS politikaları
alter table public.user_preferences enable row level security;

create policy "users_can_view_own_preferences"
    on public.user_preferences for select
    using (auth.uid() = user_id);

create policy "users_can_insert_own_preferences"
    on public.user_preferences for insert
    with check (auth.uid() = user_id);

create policy "users_can_update_own_preferences"
    on public.user_preferences for update
    using (auth.uid() = user_id);

-- İndeksler
create index user_preferences_user_id_idx on public.user_preferences(user_id); 