import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import FloatingVoiceButton from "./components/FloatingVoiceButton";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Weather from "./pages/Weather";
import YieldPredictor from "./pages/YieldPredictor";
import MarketForecast from "./pages/MarketForecast";
import LoanCalculator from "./pages/LoanCalculator";
import ExpenseAnalyzer from "./pages/ExpenseAnalyzer";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";

// Configure QueryClient with retry and error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <Navigation />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              
              {/* Protected Routes - Require Authentication */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Dashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/weather" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Weather />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/yield-predictor" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <YieldPredictor />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/market-forecast" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <MarketForecast />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/loan-calculator" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <LoanCalculator />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/expense-analyzer" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <ExpenseAnalyzer />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <FloatingVoiceButton />
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
