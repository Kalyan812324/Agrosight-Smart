import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import FloatingVoiceButton from "./components/FloatingVoiceButton";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import YieldPredictor from "./pages/YieldPredictor";
import MarketForecast from "./pages/MarketForecast";
import LoanCalculator from "./pages/LoanCalculator";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/yield-predictor" element={<YieldPredictor />} />
          <Route path="/market-forecast" element={<MarketForecast />} />
          <Route path="/loan-calculator" element={<LoanCalculator />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <FloatingVoiceButton />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
