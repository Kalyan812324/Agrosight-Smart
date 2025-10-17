-- Create enum for app roles (security best practice)
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Crop predictions table with comprehensive tracking
CREATE TABLE public.crop_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  crop_type text NOT NULL,
  state text NOT NULL,
  district text,
  soil_type text NOT NULL,
  area_hectares decimal NOT NULL,
  rainfall_mm decimal NOT NULL,
  season text NOT NULL,
  temperature decimal,
  humidity decimal,
  predicted_yield decimal NOT NULL,
  total_production decimal NOT NULL,
  confidence_score integer CHECK (confidence_score >= 0 AND confidence_score <= 100),
  recommendations jsonb,
  risk_assessment jsonb,
  financial_projection jsonb,
  created_at timestamp with time zone DEFAULT now(),
  actual_yield decimal,
  notes text
);

ALTER TABLE public.crop_predictions ENABLE ROW LEVEL SECURITY;

-- RLS policies for crop_predictions
CREATE POLICY "Users can view their own predictions"
ON public.crop_predictions FOR SELECT
USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can insert their own predictions"
ON public.crop_predictions FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can update their own predictions"
ON public.crop_predictions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all predictions"
ON public.crop_predictions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Historical yields data table
CREATE TABLE public.historical_yields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_type text NOT NULL,
  state text NOT NULL,
  district text,
  year integer NOT NULL,
  avg_yield decimal NOT NULL,
  rainfall_mm decimal,
  soil_type text,
  temperature decimal,
  data_source text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.historical_yields ENABLE ROW LEVEL SECURITY;

-- Public read access to historical data
CREATE POLICY "Historical data is viewable by everyone"
ON public.historical_yields FOR SELECT
USING (true);

CREATE POLICY "Admins can manage historical data"
ON public.historical_yields FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- User farms table
CREATE TABLE public.user_farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  farm_name text NOT NULL,
  state text NOT NULL,
  district text,
  location jsonb,
  soil_test_results jsonb,
  total_area decimal NOT NULL,
  crops_grown text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.user_farms ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_farms
CREATE POLICY "Users can view their own farms"
ON public.user_farms FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own farms"
ON public.user_farms FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own farms"
ON public.user_farms FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own farms"
ON public.user_farms FOR DELETE
USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_farms updated_at
CREATE TRIGGER update_user_farms_updated_at
BEFORE UPDATE ON public.user_farms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_crop_predictions_user_id ON public.crop_predictions(user_id);
CREATE INDEX idx_crop_predictions_created_at ON public.crop_predictions(created_at DESC);
CREATE INDEX idx_historical_yields_crop_state ON public.historical_yields(crop_type, state);
CREATE INDEX idx_user_farms_user_id ON public.user_farms(user_id);