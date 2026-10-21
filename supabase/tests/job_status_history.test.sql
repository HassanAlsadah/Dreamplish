-- Database tests for job status history (run after supabase/schema.sql). Paste into the Supabase SQL Editor and Run.
-- Everything happens in one transaction that is rolled back, so nothing is left behind.
-- Raises an error (and stops) if any check fails; prints "ALL HISTORY TESTS PASSED" otherwise.
begin;

do $$
declare
  v_user uuid;
  v_company uuid;
  v_job uuid;
  v_job2 uuid;
  v_job3 uuid;
  v_row uuid;
  v_assessment uuid;
  v_count int;
  v_failed boolean;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then raise exception 'need at least one user to run the tests'; end if;

  insert into public.companies (name, normalized_name) values ('History Test Co', 'history test co ' || gen_random_uuid())
  returning id into v_company;

  -- 1. Creating a job writes exactly one history row (from_status null).
  insert into public.jobs (user_id, company_id, title, status) values (v_user, v_company, 'Test role', 'applied')
  returning id into v_job;
  select count(*) into v_count from public.job_status_history where job_id = v_job;
  if v_count <> 1 then raise exception 'insert: expected 1 history row, got %', v_count; end if;
  perform 1 from public.job_status_history where job_id = v_job and from_status is null and to_status = 'applied';
  if not found then raise exception 'insert: first row should be null → applied'; end if;

  -- 2. A status update writes exactly one more row, with from/to set.
  update public.jobs set status = 'interview' where id = v_job;
  select count(*) into v_count from public.job_status_history where job_id = v_job;
  if v_count <> 2 then raise exception 'status update: expected 2 rows, got %', v_count; end if;
  perform 1 from public.job_status_history where job_id = v_job and from_status = 'applied' and to_status = 'interview';
  if not found then raise exception 'status update: missing applied → interview row'; end if;

  -- 3. Changes that don't touch the status write nothing.
  update public.jobs set notes = 'just a note', position = position + 1 where id = v_job;
  select count(*) into v_count from public.job_status_history where job_id = v_job;
  if v_count <> 2 then raise exception 'non-status update: expected still 2 rows, got %', v_count; end if;

  -- 4. Rounds (migration 0013): a new interview type in the same column writes one row each;
  --    the same type again, or clearing it, writes nothing.
  update public.jobs set stage_detail = 'HR interview' where id = v_job;
  select count(*) into v_count from public.job_status_history where job_id = v_job;
  if v_count <> 3 then raise exception 'round 1: expected 3 rows, got %', v_count; end if;
  update public.jobs set stage_detail = 'HR interview' where id = v_job;
  update public.jobs set stage_detail = 'Technical interview' where id = v_job;
  select count(*) into v_count from public.job_status_history where job_id = v_job;
  if v_count <> 4 then raise exception 'round 2: expected 4 rows, got %', v_count; end if;
  perform 1 from public.job_status_history
  where job_id = v_job and from_status = 'interview' and to_status = 'interview'
    and step_kind = 'interview' and step_type = 'Technical interview';
  if not found then raise exception 'round 2: missing interview step row with the new type'; end if;
  update public.jobs set stage_detail = null where id = v_job;
  select count(*) into v_count from public.job_status_history where job_id = v_job;
  if v_count <> 4 then raise exception 'clearing the type: expected still 4 rows, got %', v_count; end if;

  -- 5. Adding steps by hand (migration 0014): one row each, the same type twice is allowed,
  --    the trigger doesn't log it a second time, and future dates are refused.
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform public.add_job_step(v_job, 'interview', 'Technical interview', now() - interval '1 hour', 'Called by Sara');
  perform public.add_job_step(v_job, 'interview', 'Technical interview');
  perform public.add_job_step(v_job, 'call', 'HR call');
  select count(*) into v_count from public.job_status_history where job_id = v_job;
  if v_count <> 7 then raise exception 'add_job_step: expected 7 rows, got %', v_count; end if;
  perform 1 from public.job_status_history
  where job_id = v_job and step_kind = 'interview' and step_type = 'Technical interview' and note = 'Called by Sara';
  if not found then raise exception 'add_job_step: missing row with kind, type and note'; end if;
  perform 1 from public.jobs where id = v_job and status = 'interview' and stage_id is null and stage_detail = 'HR call';
  if not found then raise exception 'add_job_step: a step in the same column should not move the job'; end if;
  begin
    perform public.add_job_step(v_job, 'interview', 'Final interview', now() + interval '1 day');
    v_failed := false;
  exception when others then
    v_failed := sqlerrm = 'future_date';
  end;
  if not v_failed then raise exception 'add_job_step: a future date should be refused'; end if;

  -- 6. Steps move the job: Interview from Application → Interview column; a Call never moves it;
  --    Assessment → the Assessment column (if the user has one). One history row per step.
  insert into public.jobs (user_id, company_id, title, status) values (v_user, v_company, 'Second role', 'applied')
  returning id into v_job2;
  perform public.add_job_step(v_job2, 'call', 'Recruiter screen');
  perform 1 from public.jobs where id = v_job2 and status = 'applied';
  if not found then raise exception 'call step: the job should not move'; end if;
  perform public.add_job_step(v_job2, 'interview', 'HR interview');
  perform 1 from public.jobs where id = v_job2 and status = 'interview' and stage_id is null;
  if not found then raise exception 'interview step: the job should move to Interview'; end if;
  perform 1 from public.job_status_history
  where job_id = v_job2 and from_status = 'applied' and to_status = 'interview' and step_kind = 'interview';
  if not found then raise exception 'interview step: missing applied → interview row'; end if;
  select id into v_assessment from public.board_stages where user_id = v_user and preset = 'assessment' limit 1;
  if v_assessment is not null then
    perform public.add_job_step(v_job2, 'assessment', 'Coding test');
    perform 1 from public.jobs where id = v_job2 and stage_id = v_assessment;
    if not found then raise exception 'assessment step: the job should move to Assessment'; end if;
  end if;
  select count(*) into v_count from public.job_status_history where job_id = v_job2;
  if v_count <> (case when v_assessment is null then 3 else 4 end) then
    raise exception 'steps that move: expected one row per step, got %', v_count;
  end if;

  -- 7. The application point follows Date applied (migration 0017), both ways.
  insert into public.jobs (user_id, company_id, title, status, date_applied)
  values (v_user, v_company, 'Third role', 'applied', current_date - 10)
  returning id into v_job3;
  select id into v_row from public.job_status_history where job_id = v_job3;
  perform 1 from public.job_status_history where id = v_row and (changed_at at time zone 'utc')::date = current_date - 10;
  if not found then raise exception 'application date: new job should be dated on its Date applied'; end if;
  update public.jobs set date_applied = current_date - 20 where id = v_job3;
  perform 1 from public.job_status_history where id = v_row and (changed_at at time zone 'utc')::date = current_date - 20;
  if not found then raise exception 'application date: changing Date applied should move the application point'; end if;
  -- (Before the job was added to Dreamplish, so it needs the confirmation flag.)
  perform public.set_status_change_date(v_row, now() - interval '5 days', null, true, current_date - 5);
  perform 1 from public.jobs where id = v_job3 and date_applied = current_date - 5;
  if not found then raise exception 'application date: editing the application point should update Date applied'; end if;
  select count(*) into v_count from public.job_status_history where job_id = v_job3;
  if v_count <> 1 then raise exception 'application date: should not add rows, got %', v_count; end if;

  -- 8. Backfill gives every pre-existing job exactly one row (no job has zero rows).
  select count(*) into v_count from public.jobs j
  where not exists (select 1 from public.job_status_history h where h.job_id = j.id);
  if v_count <> 0 then raise exception 'backfill: % jobs have no history', v_count; end if;

  raise notice 'ALL HISTORY TESTS PASSED';
end $$;

rollback;
