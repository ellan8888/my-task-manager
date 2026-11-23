-- 037_chat_media.sql — kirim foto dari My Task + simpan foto/video chat di penyimpanan sendiri
--
-- 1) chat_outbox.files: lampiran balasan [{path, name, mime, size}] — path di bucket chat-media (out/…)
--    Satu baris outbox = satu foto ATAU satu teks. name dibuat unik (IMG_<acak>.jpg) supaya pesan yang
--    kembali dari Itemku bisa dicocokkan persis ke baris outbox-nya (anti kirim dobel).
alter table public.chat_outbox add column if not exists files jsonb not null default '[]'::jsonb;

-- 2) Bucket privat untuk foto/video chat (out/ = kiriman My Task, in/ = salinan dari Itemku)
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-media', 'chat-media', false, 26214400)
on conflict (id) do nothing;

-- 3) Link file PubNub lama membawa kunci akses (auth=…): dibuang oleh web saat ditampilkan
--    (/api/chat/messages → cleanFiles), dan pesan baru disimpan tanpa kunci. Data lama tidak diubah
--    supaya migrasi ini tidak butuh persetujuan perintah yang mengubah data.

-- 4) Ambil antrean: sekarang ikut mengembalikan files, dan pencocokan "sudah muncul di Itemku"
--    membedakan teks vs foto (foto dicocokkan lewat nama file unik).
-- Nama baru (_v2) supaya tidak perlu DROP fungsi lama; web memakai _v2, yang lama tidak dipakai lagi.
create or replace function public.chat_outbox_claim_v2(p_limit integer default 5)
returns table(id bigint, conversation_id text, text text, created_by text, order_id text, files jsonb)
language plpgsql
set search_path to 'public'
as $function$
begin
  with hit as (
    select o.id, (
      select cm.tt from chat_messages cm
       where cm.conversation_id = o.conversation_id and cm.sender = 'seller'
         and cm.sent_at >= o.created_at - interval '1 minute'
         and not exists (select 1 from chat_outbox x where x.timetoken = cm.tt)
         and case
               when jsonb_array_length(o.files) > 0 then
                 cm.files is not null and position((o.files -> 0 ->> 'name') in cm.files::text) > 0
               else
                 coalesce(jsonb_array_length(cm.files), 0) = 0
                 and chat_outbox_norm(cm.text) = chat_outbox_norm(o.text)
             end
       order by cm.sent_at limit 1) as tt
      from chat_outbox o
     where o.status in ('pending', 'sending', 'failed') and o.created_at > now() - interval '2 days'
       and (o.status <> 'sending' or o.claimed_at < now() - interval '20 seconds')
  )
  update chat_outbox o
     set status = 'sent', done_at = now(), timetoken = hit.tt, error = null
    from hit
   where o.id = hit.id and hit.tt is not null;
  -- bot berhenti di tengah kirim → kembali ke antrean
  update chat_outbox o set status = 'pending', claimed_at = null, attempts = o.attempts + 1, next_try_at = now(),
         error = 'Bot berhenti saat mengirim — dicoba lagi'
   where o.status = 'sending' and o.claimed_at < now() - interval '3 minutes';
  return query
  with picked as (
    select o.id from chat_outbox o
     where o.status = 'pending' and (o.next_try_at is null or o.next_try_at <= now())
     order by o.created_at, o.id
     limit greatest(1, least(p_limit, 10))
     for update skip locked
  )
  update chat_outbox o set status = 'sending', claimed_at = now()
    from picked
   where o.id = picked.id
  returning o.id, o.conversation_id, o.text, o.created_by,
            (select c.order_id from chat_conversations c where c.conversation_id = o.conversation_id),
            o.files;
end;
$function$;
