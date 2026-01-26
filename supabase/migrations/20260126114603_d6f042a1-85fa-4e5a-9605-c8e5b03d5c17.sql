-- Fix profiles table: Add explicit policy to deny anonymous access
-- First drop existing policies and recreate with proper security
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create new policies that explicitly require authentication
CREATE POLICY "Authenticated users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Authenticated users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Authenticated users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Fix user_farms table: Ensure policies explicitly use authenticated role
DROP POLICY IF EXISTS "Authenticated users can view their own farms" ON public.user_farms;
DROP POLICY IF EXISTS "Authenticated users can insert their own farms" ON public.user_farms;
DROP POLICY IF EXISTS "Authenticated users can update their own farms" ON public.user_farms;
DROP POLICY IF EXISTS "Authenticated users can delete their own farms" ON public.user_farms;

-- Recreate with explicit authenticated role
CREATE POLICY "Authenticated users can view their own farms"
ON public.user_farms
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert their own farms"
ON public.user_farms
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own farms"
ON public.user_farms
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own farms"
ON public.user_farms
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);