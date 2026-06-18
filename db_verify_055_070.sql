select 'teacher_exceptions' as check_name, to_regclass('public.teacher_exceptions') is not null as ok;
select 'teacher_exception_events' as check_name, to_regclass('public.teacher_exception_events') is not null as ok;
select 'classin_callback_events' as check_name, to_regclass('public.classin_callback_events') is not null as ok;
select 'transaction_workflow_events' as check_name, to_regclass('public.transaction_workflow_events') is not null as ok;
select 'generate_teacher_code' as check_name, to_regprocedure('public.generate_teacher_code()') is not null as ok;
select 'generate_lead_report_number' as check_name, to_regprocedure('public.generate_lead_report_number(text)') is not null as ok;
select 'formal_orders.trial_lesson_id' as check_name, exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'formal_orders' and column_name = 'trial_lesson_id') as ok;
select 'trial_lessons.student_id' as check_name, exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'trial_lessons' and column_name = 'student_id') as ok;
select 'teacher_candidates.bank_account' as check_name, exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'teacher_candidates' and column_name = 'bank_account') as ok;
