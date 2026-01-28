import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Plus,
  Trash2,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  Sprout,
  BarChart3,
  Target,
  Save,
  Loader2,
  RefreshCw,
  Link2,
  Cloud,
  CloudOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useFarmFinance } from "@/hooks/useFarmFinance";

// Types
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

interface PredictionData {
  predictedYield: number | null;
  yieldUnit: string;
  predictedPrice: number | null;
  priceUnit: string;
  cropType: string | null;
  isFromYieldPredictor: boolean;
}

// Utility functions for formatting
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatPercentage = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

// Initial expense categories
const initialExpenseCategories: ExpenseCategory[] = [
  { id: 'labor', name: 'Labor / Workers Cost', amount: 0, isRequired: true },
  { id: 'fertilizer', name: 'Fertilizer Cost', amount: 0, isRequired: true },
  { id: 'seeds', name: 'Seeds Cost', amount: 0, isRequired: true },
  { id: 'pesticides', name: 'Pesticides Cost', amount: 0, isRequired: true },
  { id: 'irrigation', name: 'Irrigation Cost', amount: 0, isRequired: true },
  { id: 'transportation', name: 'Transportation Cost', amount: 0, isRequired: true },
];

const ExpenseAnalyzer = () => {
  const navigate = useNavigate();
  const { 
    data: savedData, 
    loading, 
    saving, 
    saveFinanceData, 
    clearFinanceData,
    lastSaved,
    isAuthenticated 
  } = useFarmFinance();
  
  // State for expense categories
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(initialExpenseCategories);
  const [otherExpenses, setOtherExpenses] = useState<OtherExpense[]>([]);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // State for AI predictions
  const [predictions, setPredictions] = useState<PredictionData>({
    predictedYield: null,
    yieldUnit: 'kg',
    predictedPrice: null,
    priceUnit: 'per kg',
    cropType: null,
    isFromYieldPredictor: false,
  });

  // Load saved data from database when available
  useEffect(() => {
    if (savedData) {
      // Load expense categories from saved data
      if (savedData.expense_categories && Array.isArray(savedData.expense_categories)) {
        const savedCategories = savedData.expense_categories as ExpenseCategory[];
        // Merge with initial categories to ensure all required fields exist
        const mergedCategories = initialExpenseCategories.map(cat => {
          const saved = savedCategories.find(s => s.id === cat.id);
          return saved ? { ...cat, amount: saved.amount } : cat;
        });
        setExpenseCategories(mergedCategories);
      }
      
      // Load other expenses
      if (savedData.other_expenses && Array.isArray(savedData.other_expenses)) {
        setOtherExpenses(savedData.other_expenses as OtherExpense[]);
      }
      
      // Load predictions
      setPredictions({
        predictedYield: savedData.predicted_yield || null,
        yieldUnit: savedData.yield_unit || 'kg',
        predictedPrice: savedData.predicted_price || null,
        priceUnit: savedData.price_unit || 'per kg',
        cropType: savedData.crop_type || null,
        isFromYieldPredictor: !!savedData.predicted_yield,
      });
      
      setHasUnsavedChanges(false);
    }
  }, [savedData]);

  // Load yield prediction from localStorage (set by YieldPredictor) - only if no saved data
  useEffect(() => {
    if (!savedData) {
      const savedPrediction = localStorage.getItem('yieldPredictionForExpenseAnalyzer');
      if (savedPrediction) {
        try {
          const parsed = JSON.parse(savedPrediction);
          setPredictions(prev => ({
            ...prev,
            predictedYield: parsed.totalProduction || null,
            yieldUnit: 'kg',
            predictedPrice: parsed.pricePerKg || null,
            priceUnit: 'per kg',
            cropType: parsed.cropType || null,
            isFromYieldPredictor: true,
          }));
          setHasUnsavedChanges(true);
        } catch (e) {
          console.error('Failed to parse saved prediction:', e);
        }
      }
    }
  }, [savedData]);

  // Handle expense category change
  const handleExpenseChange = useCallback((id: string, value: string) => {
    const numValue = Math.max(0, parseFloat(value) || 0);
    setExpenseCategories(prev => 
      prev.map(cat => cat.id === id ? { ...cat, amount: numValue } : cat)
    );
    setHasUnsavedChanges(true);
  }, []);

  // Handle other expense change
  const handleOtherExpenseChange = useCallback((id: string, field: 'name' | 'amount', value: string) => {
    setOtherExpenses(prev =>
      prev.map(exp => {
        if (exp.id !== id) return exp;
        if (field === 'amount') {
          return { ...exp, amount: Math.max(0, parseFloat(value) || 0) };
        }
        return { ...exp, name: value };
      })
    );
    setHasUnsavedChanges(true);
  }, []);

  // Add other expense
  const addOtherExpense = useCallback(() => {
    if (!newExpenseName.trim()) return;
    const newExpense: OtherExpense = {
      id: `other-${Date.now()}`,
      name: newExpenseName.trim(),
      amount: 0,
    };
    setOtherExpenses(prev => [...prev, newExpense]);
    setNewExpenseName('');
    setHasUnsavedChanges(true);
  }, [newExpenseName]);

  // Remove other expense
  const removeOtherExpense = useCallback((id: string) => {
    setOtherExpenses(prev => prev.filter(exp => exp.id !== id));
    setHasUnsavedChanges(true);
  }, []);

  // Handle prediction changes
  const handlePredictionChange = useCallback((field: keyof PredictionData, value: string) => {
    const numValue = parseFloat(value);
    setPredictions(prev => ({
      ...prev,
      [field]: isNaN(numValue) ? null : Math.max(0, numValue),
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Calculate financial metrics
  const financialMetrics = useMemo(() => {
    const totalCategoryExpenses = expenseCategories.reduce((sum, cat) => sum + cat.amount, 0);
    const totalOtherExpenses = otherExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalExpense = totalCategoryExpenses + totalOtherExpenses;

    const { predictedYield, predictedPrice } = predictions;
    
    // Check if calculations are possible
    const canCalculateRevenue = predictedYield !== null && predictedYield > 0 && predictedPrice !== null;
    const expectedRevenue = canCalculateRevenue ? predictedYield * predictedPrice! : null;
    
    // Net profit/loss
    const netProfitLoss = expectedRevenue !== null ? expectedRevenue - totalExpense : null;
    
    // Profit/Loss percentage
    const profitLossPercentage = netProfitLoss !== null && totalExpense > 0 
      ? (netProfitLoss / totalExpense) * 100 
      : null;
    
    // Break-even price
    const breakEvenPrice = predictedYield !== null && predictedYield > 0 
      ? totalExpense / predictedYield 
      : null;

    // Status determination
    let status: 'profit' | 'loss' | 'breakeven' | 'unknown' = 'unknown';
    if (netProfitLoss !== null) {
      if (netProfitLoss > 0) status = 'profit';
      else if (netProfitLoss < 0) status = 'loss';
      else status = 'breakeven';
    }

    return {
      totalExpense,
      expectedRevenue,
      netProfitLoss,
      profitLossPercentage,
      breakEvenPrice,
      status,
      canCalculateRevenue,
      hasZeroYield: predictedYield === 0,
      hasZeroExpense: totalExpense === 0,
    };
  }, [expenseCategories, otherExpenses, predictions]);

  // Save data to database
  const handleSave = useCallback(async () => {
    const ok = await saveFinanceData({
      expense_categories: expenseCategories,
      other_expenses: otherExpenses,
      total_expense: financialMetrics.totalExpense,
      predicted_yield: predictions.predictedYield,
      yield_unit: predictions.yieldUnit,
      predicted_price: predictions.predictedPrice,
      price_unit: predictions.priceUnit,
      crop_type: predictions.cropType,
      expected_revenue: financialMetrics.expectedRevenue,
      net_profit_loss: financialMetrics.netProfitLoss,
      profit_loss_percentage: financialMetrics.profitLossPercentage,
      break_even_price: financialMetrics.breakEvenPrice,
    });
    if (ok) setHasUnsavedChanges(false);
  }, [saveFinanceData, expenseCategories, otherExpenses, financialMetrics, predictions]);

  // Reset all data
  const handleReset = useCallback(async () => {
    await clearFinanceData();
    setExpenseCategories(initialExpenseCategories);
    setOtherExpenses([]);
    setPredictions({
      predictedYield: null,
      yieldUnit: 'kg',
      predictedPrice: null,
      priceUnit: 'per kg',
      cropType: null,
      isFromYieldPredictor: false,
    });
    setHasUnsavedChanges(false);
  }, [clearFinanceData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'profit': return 'text-green-600 dark:text-green-400';
      case 'loss': return 'text-red-600 dark:text-red-400';
      case 'breakeven': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'profit': return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
      case 'loss': return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
      case 'breakeven': return 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800';
      default: return 'bg-muted/50 border-border';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-primary p-3 rounded-xl">
                <Calculator className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-primary">
                  Farm Expense & Profit Analyzer
                </h1>
                <p className="text-muted-foreground text-lg">
                  Calculate your exact profit or loss with AI-powered predictions
                </p>
              </div>
            </div>
            
            {/* Save/Sync Controls */}
            <div className="flex items-center gap-3">
              {loading && (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </Badge>
              )}
              
              {!loading && isAuthenticated && (
                <>
                  {hasUnsavedChanges ? (
                    <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
                      <CloudOff className="h-3 w-3" />
                      Unsaved changes
                    </Badge>
                  ) : lastSaved ? (
                    <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
                      <Cloud className="h-3 w-3" />
                      Saved
                    </Badge>
                  ) : null}
                  
                  <Button 
                    onClick={handleSave}
                    disabled={saving || !hasUnsavedChanges}
                    className="gap-2"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={handleReset}
                    disabled={saving}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reset
                  </Button>
                </>
              )}
              
              {!isAuthenticated && (
                <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
                  <AlertCircle className="h-3 w-3" />
                  Login to save data
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Expense Entry */}
          <div className="lg:col-span-2 space-y-6">
            {/* Expense Entry Section */}
            <Card className="bg-gradient-card border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-primary" />
                  Expense Entry
                </CardTitle>
                <CardDescription>
                  Enter all your farming expenses in INR (₹). Empty fields are treated as ₹0.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mandatory Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {expenseCategories.map((category) => (
                    <div key={category.id} className="space-y-2">
                      <Label htmlFor={category.id} className="flex items-center gap-2">
                        {category.name}
                        <Badge variant="outline" className="text-xs">Required</Badge>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                        <Input
                          id={category.id}
                          type="number"
                          min="0"
                          placeholder="0"
                          value={category.amount || ''}
                          onChange={(e) => handleExpenseChange(category.id, e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-6" />

                {/* Other Expenses */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Other Expenses (Optional)</Label>
                  </div>
                  
                  {otherExpenses.map((expense) => (
                    <div key={expense.id} className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Expense Name</Label>
                        <Input
                          value={expense.name}
                          onChange={(e) => handleOtherExpenseChange(expense.id, 'name', e.target.value)}
                          placeholder="Expense name"
                        />
                      </div>
                      <div className="w-32 space-y-1">
                        <Label className="text-xs text-muted-foreground">Amount (₹)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={expense.amount || ''}
                            onChange={(e) => handleOtherExpenseChange(expense.id, 'amount', e.target.value)}
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOtherExpense(expense.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter new expense name..."
                      value={newExpenseName}
                      onChange={(e) => setNewExpenseName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addOtherExpense()}
                    />
                    <Button onClick={addOtherExpense} disabled={!newExpenseName.trim()}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Prediction Section */}
            <Card className="bg-gradient-card border-0 shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sprout className="h-5 w-5 text-primary" />
                      AI Prediction Data
                    </CardTitle>
                    <CardDescription>
                      {predictions.isFromYieldPredictor 
                        ? `Connected to Yield Predictor${predictions.cropType ? ` • ${predictions.cropType}` : ''}`
                        : 'Get predictions from Yield Predictor or enter manually'}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/yield-predictor')}
                    className="gap-2"
                  >
                    <Link2 className="h-4 w-4" />
                    Go to Yield Predictor
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {predictions.isFromYieldPredictor && (
                  <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Yield data loaded from your saved prediction
                      {predictions.cropType && <Badge variant="outline" className="ml-2">{predictions.cropType}</Badge>}
                    </p>
                  </div>
                )}
                
                {!predictions.isFromYieldPredictor && predictions.predictedYield === null && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      No prediction found. Use the Yield Predictor first to auto-fill, or enter values manually below.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="yield" className="flex items-center gap-2">
                      Predicted Crop Yield
                      {predictions.isFromYieldPredictor && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0">
                          From Yield Predictor
                        </Badge>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="yield"
                          type="number"
                          min="0"
                          value={predictions.predictedYield ?? ''}
                          onChange={(e) => {
                            handlePredictionChange('predictedYield', e.target.value);
                            setPredictions(prev => ({ ...prev, isFromYieldPredictor: false }));
                          }}
                          placeholder="Enter yield in kg"
                        />
                      </div>
                      <Input
                        value={predictions.yieldUnit}
                        onChange={(e) => {
                          setPredictions(prev => ({ ...prev, yieldUnit: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        className="w-24"
                        placeholder="Unit"
                        disabled
                      />
                    </div>
                    {predictions.predictedYield !== null && predictions.predictedYield > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Your crop is predicted to yield {predictions.predictedYield.toLocaleString('en-IN')} kg
                      </p>
                    )}
                    {predictions.predictedYield === 0 && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Zero yield means no revenue can be calculated
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price" className="flex items-center gap-2">
                      Predicted Market Price
                      <Badge className="bg-primary/10 text-primary border-0">AI Predicted</Badge>
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                        <Input
                          id="price"
                          type="number"
                          min="0"
                          value={predictions.predictedPrice ?? ''}
                          onChange={(e) => handlePredictionChange('predictedPrice', e.target.value)}
                          placeholder="Enter price"
                          className="pl-8"
                        />
                      </div>
                      <Input
                        value={predictions.priceUnit}
                        onChange={(e) => {
                          setPredictions(prev => ({ ...prev, priceUnit: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        className="w-24"
                        placeholder="Unit"
                      />
                    </div>
                  </div>
                </div>

                {!financialMetrics.canCalculateRevenue && predictions.predictedYield !== 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Please enter valid prediction values to calculate profit/loss
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results Dashboard */}
          <div className="space-y-6">
            {/* Main Profit/Loss Card */}
            <Card className={cn(
              "border shadow-card transition-all",
              getStatusBgColor(financialMetrics.status)
            )}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Profit & Loss Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Net Profit/Loss - Hero Display */}
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-1">Net Profit / Loss</p>
                  {financialMetrics.netProfitLoss !== null ? (
                    <>
                      <p className={cn(
                        "text-4xl font-bold",
                        getStatusColor(financialMetrics.status)
                      )}>
                        {financialMetrics.netProfitLoss >= 0 ? '+' : '−'}₹{Math.abs(financialMetrics.netProfitLoss).toLocaleString('en-IN')}
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        {financialMetrics.status === 'profit' && (
                          <>
                            <TrendingUp className="h-5 w-5 text-green-600" />
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              Profit
                            </Badge>
                          </>
                        )}
                        {financialMetrics.status === 'loss' && (
                          <>
                            <TrendingDown className="h-5 w-5 text-red-600" />
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                              Loss
                            </Badge>
                          </>
                        )}
                        {financialMetrics.status === 'breakeven' && (
                          <>
                            <Minus className="h-5 w-5 text-yellow-600" />
                            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                              Break-even
                            </Badge>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-4">
                      <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        {financialMetrics.hasZeroYield 
                          ? "Cannot calculate revenue (yield is 0)"
                          : "Enter prediction data to calculate"}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Financial Breakdown */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Investment</span>
                    <span className="font-semibold text-lg">
                      {formatCurrency(financialMetrics.totalExpense)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Expected Revenue</span>
                    <span className="font-semibold text-lg">
                      {financialMetrics.expectedRevenue !== null 
                        ? formatCurrency(financialMetrics.expectedRevenue)
                        : '—'}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Profit/Loss %</span>
                    <span className={cn(
                      "font-semibold text-lg",
                      financialMetrics.profitLossPercentage !== null && financialMetrics.profitLossPercentage >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}>
                      {financialMetrics.profitLossPercentage !== null 
                        ? formatPercentage(financialMetrics.profitLossPercentage)
                        : '—'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      Break-even Price
                    </span>
                    <span className="font-semibold text-lg">
                      {financialMetrics.breakEvenPrice !== null 
                        ? `₹${financialMetrics.breakEvenPrice.toFixed(2)} ${predictions.priceUnit}`
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Warnings */}
                {financialMetrics.hasZeroExpense && financialMetrics.expectedRevenue !== null && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      No expenses entered. Profit equals full revenue.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gradient-card border-0 shadow-card">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Yield</p>
                  <p className="text-xl font-bold text-primary">
                    {predictions.predictedYield !== null 
                      ? `${predictions.predictedYield.toLocaleString()} ${predictions.yieldUnit}`
                      : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-card border-0 shadow-card">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Price</p>
                  <p className="text-xl font-bold text-primary">
                    {predictions.predictedPrice !== null 
                      ? `₹${predictions.predictedPrice} ${predictions.priceUnit}`
                      : '—'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Info Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-primary mb-1">
                      {isAuthenticated ? 'Auto-Save to Cloud' : 'Login Required'}
                    </p>
                    <p className="text-muted-foreground">
                      {isAuthenticated 
                        ? "Your expense data is saved securely and syncs across devices. Click 'Save' to persist your changes."
                        : "Login to save your expense data securely. Your data will persist across sessions."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseAnalyzer;
