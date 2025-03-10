create table public.watched_movies (id uuid default uuid_generate_v4() primary key, user_id uuid references auth.users(id) on delete cascade not null, movie_id integer not null, movie_data jsonb not null, created_at timestamp with time zone default timezone('utc'::text, now()) not null, unique(user_id, movie_id)); alter table public.watched_movies enable row level security; create policy \
Users
can
view
their
own
watched
movies.\ on public.watched_movies for select using ( auth.uid() = user_id ); create policy \Users
can
insert
their
own
watched
movies.\ on public.watched_movies for insert with check ( auth.uid() = user_id ); create policy \Users
can
delete
their
own
watched
movies.\ on public.watched_movies for delete using ( auth.uid() = user_id );
