-- 038 — baris antrean foto tidak punya teks: teks boleh kosong asal ada lampiran
alter table public.chat_outbox
  drop constraint chat_outbox_text_check,
  add constraint chat_outbox_text_check
    check (char_length(text) <= 2000 and (char_length(text) >= 1 or jsonb_array_length(files) > 0));
