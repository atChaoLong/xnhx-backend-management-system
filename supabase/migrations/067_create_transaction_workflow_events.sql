-- Create an append-only workflow event table for refund/transaction audit trails.
CREATE TABLE IF NOT EXISTS public.transaction_workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transaction_records(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL CHECK (
    action IN (
      'submitted',
      'verify_amount',
      'mark_paid',
      'verify_performance',
      'reject',
      'status_change'
    )
  ),
  from_status TEXT,
  to_status TEXT,
  actor_id UUID,
  actor_name TEXT,
  actor_role TEXT,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_transaction_workflow_events_transaction_id
  ON public.transaction_workflow_events(transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_workflow_events_action
  ON public.transaction_workflow_events(action);

CREATE INDEX IF NOT EXISTS idx_transaction_workflow_events_actor_id
  ON public.transaction_workflow_events(actor_id);

ALTER TABLE public.transaction_workflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transaction workflow events"
  ON public.transaction_workflow_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert transaction workflow events"
  ON public.transaction_workflow_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE public.transaction_workflow_events IS '退费/异动流程操作流水';
COMMENT ON COLUMN public.transaction_workflow_events.transaction_id IS '关联退费/异动记录ID';
COMMENT ON COLUMN public.transaction_workflow_events.action IS '流程动作';
COMMENT ON COLUMN public.transaction_workflow_events.from_status IS '操作前状态';
COMMENT ON COLUMN public.transaction_workflow_events.to_status IS '操作后状态';
COMMENT ON COLUMN public.transaction_workflow_events.actor_id IS '操作人ID';
COMMENT ON COLUMN public.transaction_workflow_events.actor_name IS '操作人姓名';
COMMENT ON COLUMN public.transaction_workflow_events.actor_role IS '操作人角色';
COMMENT ON COLUMN public.transaction_workflow_events.note IS '操作备注';
