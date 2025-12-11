-- Fix RLS policies on crop_predictions to remove NULL bypass vulnerability
-- Drop existing vulnerable policies
DROP POLICY IF EXISTS "Users can view their own predictions" ON public.crop_predictions;
DROP POLICY IF EXISTS "Users can insert their own predictions" ON public.crop_predictions;

-- Recreate policies without NULL bypass - require authentication
CREATE POLICY "Users can view their own predictions"
ON public.crop_predictions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own predictions"
ON public.crop_predictions FOR INSERT
WITH CHECK (auth.uid() = user_id);