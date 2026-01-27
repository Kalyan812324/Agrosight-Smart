-- Create farm_finances table to store user expense/profit data
CREATE TABLE public.farm_finances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Expense categories (stored as JSONB for flexibility)
  expense_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  other_expenses JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Totals (computed but stored for quick access)
  total_expense NUMERIC NOT NULL DEFAULT 0,
  
  -- Prediction data (from yield predictor or manual)
  predicted_yield NUMERIC,
  yield_unit TEXT DEFAULT 'kg',
  predicted_price NUMERIC,
  price_unit TEXT DEFAULT 'per kg',
  crop_type TEXT,
  
  -- Revenue and profit calculations
  expected_revenue NUMERIC,
  net_profit_loss NUMERIC,
  profit_loss_percentage NUMERIC,
  break_even_price NUMERIC,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.farm_finances ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own finance data
CREATE POLICY "Users can view their own finances"
  ON public.farm_finances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own finances"
  ON public.farm_finances
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own finances"
  ON public.farm_finances
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own finances"
  ON public.farm_finances
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger for auto-updating updated_at timestamp
CREATE TRIGGER update_farm_finances_updated_at
  BEFORE UPDATE ON public.farm_finances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster user lookups
CREATE INDEX idx_farm_finances_user_id ON public.farm_finances(user_id);