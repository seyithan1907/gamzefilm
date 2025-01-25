-- Kullanıcı tercihleri tablosu
create table if not exists public.user_preferences (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    ai_enabled boolean default true,
    turkish_content boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id)
);

-- RLS politikaları
alter table public.user_preferences enable row level security;

create policy "Kullanıcılar kendi tercihlerini görebilir"
    on public.user_preferences for select
    using (auth.uid() = user_id);

create policy "Kullanıcılar kendi tercihlerini düzenleyebilir"
    on public.user_preferences for insert
    with check (auth.uid() = user_id);

create policy "Kullanıcılar kendi tercihlerini güncelleyebilir"
    on public.user_preferences for update
    using (auth.uid() = user_id);

-- Güncelleme zamanını otomatik güncelle
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger handle_updated_at
    before update on public.user_preferences
    for each row
    execute procedure public.handle_updated_at(); 