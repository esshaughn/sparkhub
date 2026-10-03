-- Joining Torrez Fitness (its invite link, code TORREZ) joins Torrez Fitness only (owner, 2026-10-03). Until now
-- join_group() also added Hub on Hunters through this row (20261013000000_join_also.sql). People who already joined
-- keep the memberships they have; the join_also table and join_group() stay for any group that wants it later.
delete from public.join_also j
 using public.groups t
 where t.id = j.group_id and t.code = 'TORREZ';
