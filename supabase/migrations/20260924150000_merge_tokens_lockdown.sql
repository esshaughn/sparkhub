-- merge_tokens is only ever touched by prepare_merge() / complete_merge(), which
-- run as the table owner. Row-level security already hid every row, but the
-- default table grants still let any client *query* it. Close it at the door.
revoke all on table public.merge_tokens from anon, authenticated;
