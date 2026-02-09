import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface ExpenseCategory {
  id: string;
  name: string;
  amount: number;
  isRequired: boolean;
}

interface OtherExpense {
  id: string;
  name: string;
  amount: number;
}

interface FinanceData {
  expense_categories: ExpenseCategory[];
  other_expenses: OtherExpense[];
  total_expense: number;
  predicted_yield: number | null;
  yield_unit: string;
  predicted_price: number | null;
  price_unit: string;
  crop_type: string | null;
  expected_revenue: number | null;
  net_profit_loss: number | null;
  profit_loss_percentage: number | null;
  break_even_price: number | null;
}

interface FarmFinanceState {
  data: FinanceData | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  lastSaved: Date | null;
}

const SUPABASE_URL = "https://xllpedrhhzoljkfvkgef.supabase.co";

const friendlyNetworkError = (error: unknown, action: string) => {
  // Browsers throw TypeError("Failed to fetch") for CORS/preflight blocks and offline/network failures.
  if (error instanceof TypeError && /failed to fetch/i.test(error.message)) {
    return `Network error while trying to ${action}. Please check your connection and try again.`;
  }
  return error instanceof Error ? error.message : `Failed to ${action}.`;
};

export const useFarmFinance = () => {
  const { session, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  
  const [state, setState] = useState<FarmFinanceState>({
    data: null,
    loading: false,
    saving: false,
    error: null,
    lastSaved: null,
  });

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Fetch finance data on mount (when authenticated)
  const fetchFinanceData = useCallback(async () => {
    if (!session?.access_token) {
      return null;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (isMountedRef.current) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/farm-finance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data');
      }

      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          data: result.data,
          loading: false,
        }));
      }

      return result.data;
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      
      console.error('Error fetching finance data:', error);
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: friendlyNetworkError(error, 'load your saved finance data'),
        }));
      }
      return null;
    }
  }, [session?.access_token]);

  // Save finance data
  const saveFinanceData = useCallback(async (data: FinanceData): Promise<boolean> => {
    if (!session?.access_token) {
      toast({
        title: "Not authenticated",
        description: "Please log in to save your data",
        variant: "destructive",
      });
      return false;
    }

    if (isMountedRef.current) {
      setState(prev => ({ ...prev, saving: true, error: null }));
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/farm-finance`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save data');
      }

      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          data: result.data,
          saving: false,
          lastSaved: new Date(),
        }));
      }

      toast({
        title: "Data saved",
        description: "Your expense data has been saved successfully",
      });

      return true;
    } catch (error) {
      console.error('Error saving finance data:', error);
      const message = friendlyNetworkError(error, 'save your finance data');
      
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          saving: false,
          error: message,
        }));
      }
      
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      });
      
      return false;
    }
  }, [session?.access_token, toast]);

  // Clear/reset finance data
  const clearFinanceData = useCallback(async (): Promise<boolean> => {
    if (!session?.access_token) {
      return false;
    }

    if (isMountedRef.current) {
      setState(prev => ({ ...prev, saving: true, error: null }));
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/farm-finance`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to clear data');
      }

      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          data: null,
          saving: false,
        }));
      }

      toast({
        title: "Data cleared",
        description: "Your expense data has been reset",
      });

      return true;
    } catch (error) {
      console.error('Error clearing finance data:', error);
      
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          saving: false,
          error: friendlyNetworkError(error, 'clear your finance data'),
        }));
      }
      
      return false;
    }
  }, [session?.access_token, toast]);

  // Auto-fetch on auth change
  useEffect(() => {
    if (isAuthenticated) {
      fetchFinanceData();
    }
  }, [isAuthenticated, fetchFinanceData]);

  return {
    ...state,
    fetchFinanceData,
    saveFinanceData,
    clearFinanceData,
    isAuthenticated,
  };
};
