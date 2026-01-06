import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, TrendingUp, TrendingDown, Minus, Calendar, 
  Activity, Target, AlertTriangle, Zap, Database, Brain
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Forecast {
  target_date: string;
  horizon_days: number;
  predicted_min: number;
  predicted_modal: number;
  predicted_max: number;
  confidence_lower: number;
  confidence_upper: number;
}

interface ModelPrediction {
  arima_prediction?: number;
  xgboost_prediction?: number;
  lstm_prediction?: number;
  ensemble_prediction: number;
}

interface ForecastResult {
  success: boolean;
  source: string;
  request: {
    state: string;
    district: string;
    market: string;
    commodity: string;
    horizon: number;
  };
  historical_summary: {
    days_analyzed: number;
    latest_price: number;
    latest_date: string;
    price_range?: { min: number; max: number };
  };
  forecasts: Forecast[];
  model_used: string;
  model_version: string;
  feature_importance: Record<string, number>;
  top_drivers: Array<{ driver: string; impact: string; strength: number }>;
  statistics: {
    historical_mean: number;
    historical_std: number;
    trend_per_day: number;
    trend_r_squared?: number;
    momentum_7d: number;
    volatility_7d: number;
    coefficient_of_variation?: number;
  };
  model_weights?: Record<string, number>;
  model_predictions?: ModelPrediction;
}

const MarketForecast = () => {
  const { toast } = useToast();
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedMarket, setSelectedMarket] = useState("");
  const [selectedCommodity, setSelectedCommodity] = useState("");
  const [selectedHorizon, setSelectedHorizon] = useState("7");
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mlApiUrl, setMlApiUrl] = useState(import.meta.env.VITE_ML_API_URL || "");

  const states = [
    "Andhra Pradesh", "Karnataka", "Maharashtra", "Tamil Nadu", 
    "Madhya Pradesh", "Gujarat", "Rajasthan", "Uttar Pradesh",
    "Punjab", "Haryana", "Bihar", "West Bengal", "Telangana"
  ];

  const districtsByState: Record<string, string[]> = {
    "Andhra Pradesh": ["East Godavari", "West Godavari", "Krishna", "Guntur", "Prakasam", "Nellore"],
    "Karnataka": ["Raichur", "Bellary", "Davangere", "Shimoga", "Belgaum", "Hubli-Dharwad"],
    "Maharashtra": ["Nashik", "Pune", "Ahmednagar", "Solapur", "Kolhapur", "Sangli"],
    "Tamil Nadu": ["Thanjavur", "Tiruchirapalli", "Salem", "Erode", "Coimbatore", "Madurai"],
    "Madhya Pradesh": ["Indore", "Ujjain", "Dewas", "Ratlam", "Mandsaur", "Neemuch"],
    "Gujarat": ["Rajkot", "Junagadh", "Ahmedabad", "Mehsana", "Banaskantha", "Sabarkantha"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Udaipur", "Bikaner", "Alwar"],
    "Uttar Pradesh": ["Agra", "Lucknow", "Kanpur", "Varanasi", "Allahabad", "Meerut"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Moga"],
    "Haryana": ["Karnal", "Hisar", "Sirsa", "Fatehabad", "Kurukshetra", "Ambala"],
    "Bihar": ["Patna", "Muzaffarpur", "Bhagalpur", "Darbhanga", "Gaya", "Vaishali"],
    "West Bengal": ["Bardhaman", "Hooghly", "Nadia", "Murshidabad", "Birbhum", "Malda"],
    "Telangana": ["Nizamabad", "Karimnagar", "Warangal", "Khammam", "Nalgonda", "Mahbubnagar"]
  };

  const marketsByDistrict: Record<string, string[]> = {
    "East Godavari": ["Kakinada", "Rajahmundry", "Amalapuram", "Ramachandrapuram", "Peddapuram"],
    "Raichur": ["Raichur", "Sindhanur", "Manvi", "Devadurga", "Lingasugur"],
    "Nashik": ["Nashik", "Pimpalgaon", "Lasalgaon", "Deola", "Malegaon"],
    "Thanjavur": ["Thanjavur", "Kumbakonam", "Pattukkottai", "Orathanadu", "Papanasam"],
    "Indore": ["Indore", "Mhow", "Depalpur", "Sanwer", "Hatod"],
  };

  const commodities = [
    { name: "Paddy", unit: "₹/quintal" },
    { name: "Rice", unit: "₹/quintal" },
    { name: "Wheat", unit: "₹/quintal" },
    { name: "Cotton", unit: "₹/quintal" },
    { name: "Maize", unit: "₹/quintal" },
    { name: "Onion", unit: "₹/quintal" },
    { name: "Potato", unit: "₹/quintal" },
    { name: "Tomato", unit: "₹/quintal" },
    { name: "Soybean", unit: "₹/quintal" },
    { name: "Groundnut", unit: "₹/quintal" },
    { name: "Chilli", unit: "₹/quintal" },
    { name: "Turmeric", unit: "₹/quintal" }
  ];

  const horizons = [
    { value: "1", label: "1 Day" },
    { value: "3", label: "3 Days" },
    { value: "7", label: "7 Days" },
    { value: "15", label: "15 Days" },
    { value: "30", label: "30 Days" }
  ];

  const districts = selectedState ? districtsByState[selectedState] || [] : [];
  const markets = selectedDistrict ? (marketsByDistrict[selectedDistrict] || [`${selectedDistrict} Main`]) : [];

  const generateForecast = async () => {
    if (!selectedState || !selectedMarket || !selectedCommodity) {
      toast({
        title: "Missing Selection",
        description: "Please select state, market, and commodity",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `https://xllpedrhhzoljkfvkgef.supabase.co/functions/v1/market-forecast`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: selectedState,
            district: selectedDistrict,
            market: selectedMarket,
            commodity: selectedCommodity,
            horizon: parseInt(selectedHorizon),
            ml_api_url: mlApiUrl || undefined
          })
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Forecast failed');
      }

      setForecast(data);
      toast({
        title: "Forecast Generated",
        description: `${selectedHorizon}-day forecast for ${selectedCommodity} at ${selectedMarket}`
      });
    } catch (error) {
      console.error('Forecast error:', error);
      toast({
        title: "Forecast Failed",
        description: error instanceof Error ? error.message : "Unable to generate forecast",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (current: number, predicted: number) => {
    const change = ((predicted - current) / current) * 100;
    if (change > 1) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < -1) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            Ultra Super Market Forecaster
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            ML-powered price predictions with ARIMA, XGBoost, LSTM ensemble models. 
            Connect to your external ML API for production-grade accuracy.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Selection Panel */}
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-primary" />
                <span>Mandi Selection</span>
              </CardTitle>
              <CardDescription>Choose market, commodity, and forecast horizon</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">State</label>
                <Select value={selectedState} onValueChange={(v) => { setSelectedState(v); setSelectedDistrict(""); setSelectedMarket(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">District</label>
                <Select value={selectedDistrict} onValueChange={(v) => { setSelectedDistrict(v); setSelectedMarket(""); }} disabled={!selectedState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select District" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map(district => (
                      <SelectItem key={district} value={district}>{district}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Market (Mandi)</label>
                <Select value={selectedMarket} onValueChange={setSelectedMarket} disabled={!selectedDistrict}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Market" />
                  </SelectTrigger>
                  <SelectContent>
                    {markets.map(market => (
                      <SelectItem key={market} value={market}>{market}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Commodity</label>
                <Select value={selectedCommodity} onValueChange={setSelectedCommodity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Commodity" />
                  </SelectTrigger>
                  <SelectContent>
                    {commodities.map(c => (
                      <SelectItem key={c.name} value={c.name}>{c.name} ({c.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Forecast Horizon</label>
                <Select value={selectedHorizon} onValueChange={setSelectedHorizon}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {horizons.map(h => (
                      <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">External ML API (Optional)</label>
                <input 
                  type="text"
                  value={mlApiUrl}
                  onChange={(e) => setMlApiUrl(e.target.value)}
                  placeholder="https://your-ml-api.com/forecast"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Connect your trained ARIMA/XGBoost/LSTM model
                </p>
              </div>

              <Button 
                className="w-full" 
                onClick={generateForecast}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Activity className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Generate Forecast
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            {!forecast ? (
              <Card className="bg-gradient-card border-0 shadow-card h-full">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <BarChart3 className="h-20 w-20 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-primary mb-2">Select Parameters</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Choose a state, district, market, and commodity to generate 
                    ML-powered price forecasts with confidence intervals.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-card border-0 shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <Target className="h-5 w-5 text-primary" />
                        <span>{forecast.request.commodity} @ {forecast.request.market}</span>
                      </CardTitle>
                      <CardDescription>
                        {forecast.request.state} • {forecast.historical_summary.days_analyzed} days analyzed
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {forecast.source === 'external_ml' ? 'External ML' : 'Statistical Model'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="forecast" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-4">
                      <TabsTrigger value="forecast">Forecast</TabsTrigger>
                      <TabsTrigger value="analysis">Analysis</TabsTrigger>
                      <TabsTrigger value="drivers">Drivers</TabsTrigger>
                      <TabsTrigger value="model">Model Info</TabsTrigger>
                    </TabsList>

                    <TabsContent value="forecast" className="space-y-4">
                      {/* Current Price */}
                      <div className="bg-primary/10 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-muted-foreground">Latest Price ({forecast.historical_summary.latest_date})</p>
                            <p className="text-2xl font-bold text-primary">₹{forecast.historical_summary.latest_price}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Historical Mean</p>
                            <p className="text-lg font-semibold">₹{forecast.statistics.historical_mean}</p>
                          </div>
                        </div>
                      </div>

                      {/* Forecast Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2">Date</th>
                              <th className="text-right py-2 px-2">Min</th>
                              <th className="text-right py-2 px-2">Modal</th>
                              <th className="text-right py-2 px-2">Max</th>
                              <th className="text-right py-2 px-2">95% CI</th>
                              <th className="text-center py-2 px-2">Trend</th>
                            </tr>
                          </thead>
                          <tbody>
                            {forecast.forecasts.map((f, idx) => (
                              <tr key={idx} className="border-b hover:bg-muted/50">
                                <td className="py-2 px-2 font-medium">{new Date(f.target_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                                <td className="text-right py-2 px-2 text-green-600">₹{f.predicted_min}</td>
                                <td className="text-right py-2 px-2 font-bold">₹{f.predicted_modal}</td>
                                <td className="text-right py-2 px-2 text-red-600">₹{f.predicted_max}</td>
                                <td className="text-right py-2 px-2 text-muted-foreground text-xs">
                                  ₹{f.confidence_lower} - ₹{f.confidence_upper}
                                </td>
                                <td className="text-center py-2 px-2">
                                  {getTrendIcon(forecast.historical_summary.latest_price, f.predicted_modal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>

                    <TabsContent value="analysis" className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <p className="text-xs text-muted-foreground">Trend (₹/day)</p>
                          <p className={`text-xl font-bold ${forecast.statistics.trend_per_day >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {forecast.statistics.trend_per_day >= 0 ? '+' : ''}{forecast.statistics.trend_per_day}
                          </p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <p className="text-xs text-muted-foreground">7-Day Momentum</p>
                          <p className={`text-xl font-bold ${forecast.statistics.momentum_7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {forecast.statistics.momentum_7d >= 0 ? '+' : ''}{forecast.statistics.momentum_7d}%
                          </p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <p className="text-xs text-muted-foreground">Volatility (7d)</p>
                          <p className="text-xl font-bold">{forecast.statistics.volatility_7d}%</p>
                        </div>
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <p className="text-xs text-muted-foreground">Std Deviation</p>
                          <p className="text-xl font-bold">₹{forecast.statistics.historical_std}</p>
                        </div>
                      </div>

                      {/* Additional Statistics */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {forecast.statistics.trend_r_squared !== undefined && (
                          <div className="bg-primary/5 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">Trend R² (fit quality)</p>
                            <p className="text-lg font-semibold">{(forecast.statistics.trend_r_squared * 100).toFixed(1)}%</p>
                          </div>
                        )}
                        {forecast.statistics.coefficient_of_variation !== undefined && (
                          <div className="bg-primary/5 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">Coeff. of Variation</p>
                            <p className="text-lg font-semibold">{forecast.statistics.coefficient_of_variation}%</p>
                          </div>
                        )}
                        {forecast.historical_summary.price_range && (
                          <div className="bg-primary/5 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">90-Day Range</p>
                            <p className="text-lg font-semibold">
                              ₹{forecast.historical_summary.price_range.min} - ₹{forecast.historical_summary.price_range.max}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Feature Importance */}
                      <div>
                        <h4 className="font-semibold mb-3">Feature Importance</h4>
                        <div className="space-y-2">
                          {Object.entries(forecast.feature_importance).map(([feature, importance]) => (
                            <div key={feature} className="flex items-center space-x-3">
                              <span className="w-24 text-sm capitalize">{feature.replace('_', ' ')}</span>
                              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${importance}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium w-12 text-right">{importance}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="drivers" className="space-y-4">
                      <h4 className="font-semibold">Top Price Drivers</h4>
                      {forecast.top_drivers.length > 0 ? (
                        <div className="space-y-3">
                          {forecast.top_drivers.map((driver, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center space-x-3">
                                {driver.impact === 'positive' ? (
                                  <TrendingUp className="h-5 w-5 text-green-600" />
                                ) : driver.impact === 'negative' ? (
                                  <TrendingDown className="h-5 w-5 text-red-600" />
                                ) : (
                                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                )}
                                <span>{driver.driver}</span>
                              </div>
                              <Badge className={getImpactColor(driver.impact)}>
                                {driver.strength}% impact
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No significant drivers detected</p>
                      )}

                      {/* Recommendations */}
                      <div className="mt-6 p-4 bg-primary/5 rounded-lg">
                        <h4 className="font-semibold mb-2 flex items-center">
                          <Zap className="h-4 w-4 mr-2 text-primary" />
                          Selling Recommendation
                        </h4>
                        <p className="text-sm">
                          {forecast.statistics.momentum_7d > 2 
                            ? "Strong upward momentum detected. Consider holding for higher prices over the next few days."
                            : forecast.statistics.momentum_7d < -2
                            ? "Downward pressure detected. Consider selling soon to avoid potential losses."
                            : "Market is relatively stable. Monitor daily prices for optimal selling window."
                          }
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="model" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Model Used</p>
                          <p className="font-semibold">{forecast.model_used}</p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Version</p>
                          <p className="font-semibold">{forecast.model_version}</p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Data Source</p>
                          <p className="font-semibold">{forecast.source}</p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Confidence Level</p>
                          <p className="font-semibold">95%</p>
                        </div>
                      </div>

                      {/* Model Weights (from external ML API) */}
                      {forecast.model_weights && Object.keys(forecast.model_weights).length > 0 && (
                        <div className="p-4 border rounded-lg">
                          <h4 className="font-semibold mb-3">Ensemble Model Weights</h4>
                          <div className="space-y-2">
                            {Object.entries(forecast.model_weights).map(([model, weight]) => (
                              <div key={model} className="flex items-center space-x-3">
                                <span className="w-20 text-sm uppercase">{model}</span>
                                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-accent rounded-full transition-all"
                                    style={{ width: `${(weight as number) * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium w-12 text-right">{((weight as number) * 100).toFixed(0)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Individual Model Predictions */}
                      {forecast.model_predictions && (
                        <div className="p-4 border rounded-lg">
                          <h4 className="font-semibold mb-3">Individual Model Predictions</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {forecast.model_predictions.arima_prediction && (
                              <div className="bg-muted/50 p-3 rounded-lg text-center">
                                <p className="text-xs text-muted-foreground">ARIMA</p>
                                <p className="text-lg font-bold">₹{forecast.model_predictions.arima_prediction.toFixed(0)}</p>
                              </div>
                            )}
                            {forecast.model_predictions.xgboost_prediction && (
                              <div className="bg-muted/50 p-3 rounded-lg text-center">
                                <p className="text-xs text-muted-foreground">XGBoost</p>
                                <p className="text-lg font-bold">₹{forecast.model_predictions.xgboost_prediction.toFixed(0)}</p>
                              </div>
                            )}
                            {forecast.model_predictions.lstm_prediction && (
                              <div className="bg-muted/50 p-3 rounded-lg text-center">
                                <p className="text-xs text-muted-foreground">LSTM</p>
                                <p className="text-lg font-bold">₹{forecast.model_predictions.lstm_prediction.toFixed(0)}</p>
                              </div>
                            )}
                            <div className="bg-primary/10 p-3 rounded-lg text-center">
                              <p className="text-xs text-muted-foreground">Ensemble</p>
                              <p className="text-lg font-bold text-primary">₹{forecast.model_predictions.ensemble_prediction.toFixed(0)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="p-4 border rounded-lg bg-muted/30">
                        <h4 className="font-semibold mb-2">Connect External ML API</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          For production-grade accuracy, connect your trained ensemble model (ARIMA + XGBoost + LSTM) 
                          hosted on Railway, Render, or AWS Lambda.
                        </p>
                        <div className="text-xs font-mono bg-background p-2 rounded">
                          POST /forecast<br/>
                          {`{ state, district, market, commodity, variety, horizon, features, historical_prices }`}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Set <code className="bg-background px-1 rounded">VITE_ML_API_URL</code> environment variable or enter URL above.
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketForecast;
