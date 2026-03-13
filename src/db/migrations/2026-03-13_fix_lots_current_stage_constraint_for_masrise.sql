-- Fix older databases where lots.current_stage is text with a check constraint
-- that does not include the new 'masrise' stage.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lots_current_stage_check'
      AND conrelid = 'public.lots'::regclass
  ) THEN
    ALTER TABLE public.lots DROP CONSTRAINT lots_current_stage_check;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.lots
    ADD CONSTRAINT lots_current_stage_check
    CHECK (
      current_stage IN (
        'grey_inward',
        'checking',
        'bleaching',
        'masrise',
        'dyeing',
        'stenter',
        'finishing',
        'folding',
        'completed'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

SELECT pg_notify('pgrst', 'reload schema');
