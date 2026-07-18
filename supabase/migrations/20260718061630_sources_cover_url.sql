-- Cover image for a source (a book): a URL shown at the left of its card in the
-- sources list. Nullable — a source without a cover just renders no image.
-- Points at a public Supabase Storage object (bucket: book-covers). `if not
-- exists` keeps a later `supabase db push` a safe no-op if the column was already
-- added out-of-band.
alter table sources add column if not exists cover_url text;
