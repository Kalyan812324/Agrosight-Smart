-- Fix RLS policies for crop_predictions (remove anonymous access)
DROP POLICY IF EXISTS "Users can view their own predictions" ON public.crop_predictions;
DROP POLICY IF EXISTS "Users can insert their own predictions" ON public.crop_predictions;

-- Recreate policies without anonymous access
CREATE POLICY "Users can view their own predictions" 
ON public.crop_predictions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own predictions" 
ON public.crop_predictions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Make user_id NOT NULL to prevent data integrity issues
ALTER TABLE public.crop_predictions 
ALTER COLUMN user_id SET NOT NULL;

-- Add RLS policies for user_roles table
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" 
ON public.user_roles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));