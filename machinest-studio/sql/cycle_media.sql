-- Thumbnail and brief description for every cycle (Turning Studio and Milling Studio)
alter table cycles add column if not exists thumbnail_url text;
alter table cycles add column if not exists description text;

-- Public bucket for the thumbnails (uploads go through the app's admin API)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cycle-thumbs', 'cycle-thumbs', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true;
