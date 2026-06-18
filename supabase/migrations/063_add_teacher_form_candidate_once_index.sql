-- Keep one public teacher information submission per candidate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_details_candidate_once
  ON public.teacher_details(candidate_id)
  WHERE candidate_id IS NOT NULL;

COMMENT ON INDEX public.idx_teacher_details_candidate_once IS '同一个老师候选人只能提交一次公开信息采集表';
