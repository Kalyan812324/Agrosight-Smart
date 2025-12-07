import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, MapPin, Droplets, Mountain, Wheat, Thermometer, 
  Cloud, AlertTriangle, CheckCircle, IndianRupee, Leaf, Calendar,
  BarChart3, Target, Zap, Shield, Loader2, Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PredictionResult {
  prediction: {
    yieldPerHectare: number;
    totalProduction: number;
    unit: string;
    confidence: number;
    nationalAvgYield: number;
    yieldComparison: number;
    growingDays: number;
    waterRequirement: number;
  };
  analysis: {
    factors: Record<string, { value: number; status: string }>;
    optimalConditions: {
      temperature: [number, number];
      rainfall: [number, number];
      humidity: [number, number];
      soils: string[];
      seasons: string[];
    };
  };
  recommendations: string[];
  riskAssessment: {
    level: string;
    factors: string[];
    mitigation: string[];
  };
  financialProjection: {
    estimatedRevenue: number;
    estimatedCost: number;
    estimatedProfit: number;
    costBreakdown: Record<string, number>;
    pricePerQuintal: number;
  };
  metadata: {
    model: string;
    timestamp: string;
  };
}

const YieldPredictor = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    crop: "",
    state: "",
    district: "",
    soilType: "",
    rainfall: "",
    area: "",
    season: "",
    temperature: "",
    humidity: "",
    irrigationType: "",
    fertilizerUsage: "",
    previousCrop: ""
  });
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  const crops = [
    "Rice", "Wheat", "Cotton", "Sugarcane", "Maize", "Barley", "Gram", "Groundnut",
    "Soybean", "Sunflower", "Potato", "Onion", "Tomato", "Mustard", "Turmeric", "Chilli"
  ];
  
  const states = [
    "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Gujarat", "Haryana", 
    "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha",
    "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "West Bengal"
  ];
  
  const soilTypes = [
    "Alluvial", "Black", "Red", "Laterite", "Desert", "Mountain", "Saline", 
    "Loamy", "Sandy Loam", "Clayey", "Sandy", "Peaty"
  ];
  
  const seasons = ["Kharif", "Rabi", "Zaid"];
  
  const irrigationTypes = ["Drip", "Sprinkler", "Canal", "Tube Well", "Rain-fed", "Flood"];
  
  const fertilizerOptions = ["Organic", "Chemical", "Mixed", "Minimal", "None"];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const fetchWeatherData = async () => {
    if (!formData.state) {
      toast({
        title: "Select State First",
        description: "Please select a state to fetch weather data",
        variant: "destructive"
      });
      return;
    }

    setIsLoadingWeather(true);
    
    // Get approximate coordinates for state capitals
    const stateCoordinates: Record<string, { lat: number; lon: number }> = {
      "Andhra Pradesh": { lat: 15.9129, lon: 79.7400 },
      "Assam": { lat: 26.2006, lon: 92.9376 },
      "Bihar": { lat: 25.0961, lon: 85.3131 },
      "Chhattisgarh": { lat: 21.2787, lon: 81.8661 },
      "Gujarat": { lat: 22.2587, lon: 71.1924 },
      "Haryana": { lat: 29.0588, lon: 76.0856 },
      "Jharkhand": { lat: 23.6102, lon: 85.2799 },
      "Karnataka": { lat: 15.3173, lon: 75.7139 },
      "Kerala": { lat: 10.8505, lon: 76.2711 },
      "Madhya Pradesh": { lat: 22.9734, lon: 78.6569 },
      "Maharashtra": { lat: 19.7515, lon: 75.7139 },
      "Odisha": { lat: 20.9517, lon: 85.0985 },
      "Punjab": { lat: 31.1471, lon: 75.3412 },
      "Rajasthan": { lat: 27.0238, lon: 74.2179 },
      "Tamil Nadu": { lat: 11.1271, lon: 78.6569 },
      "Telangana": { lat: 18.1124, lon: 79.0193 },
      "Uttar Pradesh": { lat: 26.8467, lon: 80.9462 },
      "West Bengal": { lat: 22.9868, lon: 87.8550 }
    };

    const coords = stateCoordinates[formData.state];
    if (!coords) {
      setIsLoadingWeather(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-weather`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: coords.lat, longitude: coords.lon }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.current) {
          setFormData(prev => ({
            ...prev,
            temperature: data.current.temperature?.toString() || "",
            humidity: data.current.humidity?.toString() || "",
            rainfall: data.forecast?.[0]?.precipitation 
              ? Math.round(data.forecast.reduce((sum: number, day: any) => sum + (day.precipitation || 0), 0) * 30).toString()
              : prev.rainfall
          }));
          toast({
            title: "Weather Data Loaded",
            description: `Current conditions for ${formData.state} applied`
          });
        }
      }
    } catch (error) {
      console.error("Weather fetch error:", error);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const predictYield = async () => {
    const requiredFields = ["crop", "state", "soilType", "rainfall", "area", "season"];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/predict-yield`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            crop: formData.crop,
            state: formData.state,
            district: formData.district || undefined,
            soilType: formData.soilType,
            rainfall: parseFloat(formData.rainfall),
            area: parseFloat(formData.area),
            season: formData.season,
            temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
            humidity: formData.humidity ? parseFloat(formData.humidity) : undefined,
            irrigationType: formData.irrigationType || undefined,
            fertilizerUsage: formData.fertilizerUsage || undefined,
            previousCrop: formData.previousCrop || undefined
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Prediction failed");
      }

      const result = await response.json();
      setPrediction(result);
      
      toast({
        title: "Prediction Complete",
        description: `Estimated yield: ${result.prediction.yieldPerHectare} tons/hectare with ${result.prediction.confidence}% confidence`
      });
    } catch (error) {
      console.error("Prediction error:", error);
      toast({
        title: "Prediction Failed",
        description: "Unable to generate prediction. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal": return "text-green-600 bg-green-100";
      case "good": return "text-yellow-600 bg-yellow-100";
      case "suboptimal": return "text-red-600 bg-red-100";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "Low": return "bg-green-500";
      case "Medium": return "bg-yellow-500";
      case "High": return "bg-red-500";
      default: return "bg-muted";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Ultra Precision Mode</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            AI-Powered Crop Yield Predictor
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Advanced machine learning model trained on millions of agricultural data points. 
            Get highly accurate yield predictions with financial projections and actionable recommendations.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Input Form */}
          <Card className="xl:col-span-1 bg-gradient-card border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-6 w-6 text-primary" />
                <span>Crop & Field Data</span>
              </CardTitle>
              <CardDescription>
                Enter comprehensive details for maximum accuracy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Crop Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Wheat className="h-4 w-4" />
                  Crop Type *
                </Label>
                <Select value={formData.crop} onValueChange={(value) => handleInputChange("crop", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select crop" />
                  </SelectTrigger>
                  <SelectContent>
                    {crops.map(crop => (
                      <SelectItem key={crop} value={crop}>{crop}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    State *
                  </Label>
                  <Select value={formData.state} onValueChange={(value) => handleInputChange("state", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>District</Label>
                  <Input
                    placeholder="e.g., Guntur"
                    value={formData.district}
                    onChange={(e) => handleInputChange("district", e.target.value)}
                  />
                </div>
              </div>

              {/* Soil & Season */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Mountain className="h-4 w-4" />
                    Soil Type *
                  </Label>
                  <Select value={formData.soilType} onValueChange={(value) => handleInputChange("soilType", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select soil" />
                    </SelectTrigger>
                    <SelectContent>
                      {soilTypes.map(soil => (
                        <SelectItem key={soil} value={soil}>{soil}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Season *
                  </Label>
                  <Select value={formData.season} onValueChange={(value) => handleInputChange("season", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select season" />
                    </SelectTrigger>
                    <SelectContent>
                      {seasons.map(season => (
                        <SelectItem key={season} value={season}>{season}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Weather Data */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1">
                    <Cloud className="h-4 w-4" />
                    Weather Conditions
                  </Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchWeatherData}
                    disabled={isLoadingWeather || !formData.state}
                  >
                    {isLoadingWeather ? <Loader2 className="h-3 w-3 animate-spin" /> : "Auto-fill"}
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Temp (°C)</Label>
                    <Input
                      type="number"
                      placeholder="25"
                      value={formData.temperature}
                      onChange={(e) => handleInputChange("temperature", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Humidity (%)</Label>
                    <Input
                      type="number"
                      placeholder="60"
                      value={formData.humidity}
                      onChange={(e) => handleInputChange("humidity", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Rainfall *</Label>
                    <Input
                      type="number"
                      placeholder="mm/yr"
                      value={formData.rainfall}
                      onChange={(e) => handleInputChange("rainfall", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Farm Details */}
              <div className="space-y-2">
                <Label>Farm Area (hectares) *</Label>
                <Input
                  type="number"
                  placeholder="e.g., 2.5"
                  value={formData.area}
                  onChange={(e) => handleInputChange("area", e.target.value)}
                />
              </div>

              {/* Irrigation & Fertilizer */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Droplets className="h-4 w-4" />
                    Irrigation
                  </Label>
                  <Select value={formData.irrigationType} onValueChange={(value) => handleInputChange("irrigationType", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {irrigationTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Leaf className="h-4 w-4" />
                    Fertilizer
                  </Label>
                  <Select value={formData.fertilizerUsage} onValueChange={(value) => handleInputChange("fertilizerUsage", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select usage" />
                    </SelectTrigger>
                    <SelectContent>
                      {fertilizerOptions.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                variant="hero" 
                className="w-full mt-4" 
                onClick={predictYield}
                disabled={isLoading}
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Prediction
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="xl:col-span-2">
            {!prediction ? (
              <Card className="bg-gradient-card border-0 shadow-card h-full flex items-center justify-center min-h-[500px]">
                <CardContent className="text-center py-12">
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <BarChart3 className="h-12 w-12 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Ready to Predict</h3>
                  <p className="text-muted-foreground max-w-md">
                    Fill in your crop and field details to get AI-powered yield predictions 
                    with financial projections and expert recommendations.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                  <TabsTrigger value="financial">Financial</TabsTrigger>
                  <TabsTrigger value="recommendations">Actions</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Main Prediction Card */}
                    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm text-muted-foreground">Predicted Yield</span>
                          <Badge variant="outline" className="bg-primary/10">
                            {prediction.prediction.confidence}% Confidence
                          </Badge>
                        </div>
                        <div className="text-4xl font-bold text-primary mb-1">
                          {prediction.prediction.yieldPerHectare} 
                          <span className="text-lg font-normal"> tons/ha</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {prediction.prediction.yieldComparison >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
                          )}
                          <span className={prediction.prediction.yieldComparison >= 0 ? "text-green-600" : "text-red-600"}>
                            {prediction.prediction.yieldComparison >= 0 ? "+" : ""}{prediction.prediction.yieldComparison}% vs national avg
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Total Production Card */}
                    <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
                      <CardContent className="p-6">
                        <div className="text-sm text-muted-foreground mb-4">Total Production</div>
                        <div className="text-4xl font-bold mb-1">
                          {prediction.prediction.totalProduction} 
                          <span className="text-lg font-normal"> tons</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          From {formData.area} hectares
                        </div>
                      </CardContent>
                    </Card>

                    {/* Crop Info */}
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Wheat className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-semibold">{formData.crop}</div>
                            <div className="text-sm text-muted-foreground">{formData.season} Season</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Growing Days</span>
                            <div className="font-semibold">{prediction.prediction.growingDays} days</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Water Need</span>
                            <div className="font-semibold">{prediction.prediction.waterRequirement} mm</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Risk Level */}
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">Risk Assessment</span>
                          </div>
                          <Badge className={`${getRiskColor(prediction.riskAssessment.level)} text-white`}>
                            {prediction.riskAssessment.level} Risk
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {prediction.riskAssessment.factors.slice(0, 2).map((factor, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <span>{factor}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Model Info */}
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Info className="h-4 w-4" />
                        <span>Prediction by {prediction.metadata.model}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(prediction.metadata.timestamp).toLocaleString()}
                      </span>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Analysis Tab */}
                <TabsContent value="analysis" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Factor Analysis
                      </CardTitle>
                      <CardDescription>
                        How each factor affects your predicted yield
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(prediction.analysis.factors).map(([key, data]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="capitalize font-medium">{key}</span>
                            <Badge className={getStatusColor(data.status)}>
                              {data.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <Progress value={data.value} className="flex-1" />
                            <span className="text-sm font-medium w-12">{data.value}%</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Optimal Conditions for {formData.crop}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <Thermometer className="h-5 w-5 text-orange-500 mb-2" />
                          <div className="text-sm text-muted-foreground">Temperature</div>
                          <div className="font-semibold">
                            {prediction.analysis.optimalConditions.temperature[0]}-{prediction.analysis.optimalConditions.temperature[1]}°C
                          </div>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <Droplets className="h-5 w-5 text-blue-500 mb-2" />
                          <div className="text-sm text-muted-foreground">Rainfall</div>
                          <div className="font-semibold">
                            {prediction.analysis.optimalConditions.rainfall[0]}-{prediction.analysis.optimalConditions.rainfall[1]} mm
                          </div>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <Cloud className="h-5 w-5 text-gray-500 mb-2" />
                          <div className="text-sm text-muted-foreground">Humidity</div>
                          <div className="font-semibold">
                            {prediction.analysis.optimalConditions.humidity[0]}-{prediction.analysis.optimalConditions.humidity[1]}%
                          </div>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg col-span-2 md:col-span-1">
                          <Mountain className="h-5 w-5 text-amber-600 mb-2" />
                          <div className="text-sm text-muted-foreground">Best Soils</div>
                          <div className="font-semibold text-sm">
                            {prediction.analysis.optimalConditions.soils.slice(0, 3).join(", ")}
                          </div>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg col-span-2">
                          <Calendar className="h-5 w-5 text-green-500 mb-2" />
                          <div className="text-sm text-muted-foreground">Best Seasons</div>
                          <div className="font-semibold">
                            {prediction.analysis.optimalConditions.seasons.join(", ")}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Financial Tab */}
                <TabsContent value="financial" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-6">
                        <div className="text-sm text-green-700 mb-2">Estimated Revenue</div>
                        <div className="text-3xl font-bold text-green-700">
                          {formatCurrency(prediction.financialProjection.estimatedRevenue)}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          @ ₹{prediction.financialProjection.pricePerQuintal}/quintal
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="p-6">
                        <div className="text-sm text-red-700 mb-2">Estimated Cost</div>
                        <div className="text-3xl font-bold text-red-700">
                          {formatCurrency(prediction.financialProjection.estimatedCost)}
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          Total cultivation cost
                        </div>
                      </CardContent>
                    </Card>
                    <Card className={prediction.financialProjection.estimatedProfit >= 0 ? "bg-primary/10 border-primary/20" : "bg-red-50 border-red-200"}>
                      <CardContent className="p-6">
                        <div className="text-sm text-muted-foreground mb-2">Net Profit</div>
                        <div className={`text-3xl font-bold ${prediction.financialProjection.estimatedProfit >= 0 ? "text-primary" : "text-red-700"}`}>
                          {formatCurrency(prediction.financialProjection.estimatedProfit)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {prediction.financialProjection.estimatedProfit >= 0 ? "Projected profit" : "Projected loss"}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IndianRupee className="h-5 w-5" />
                        Cost Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(prediction.financialProjection.costBreakdown).map(([item, cost]) => (
                          <div key={item} className="flex items-center justify-between">
                            <span>{item}</span>
                            <span className="font-medium">{formatCurrency(cost)}</span>
                          </div>
                        ))}
                        <div className="border-t pt-3 flex items-center justify-between font-bold">
                          <span>Total</span>
                          <span>{formatCurrency(prediction.financialProjection.estimatedCost)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Recommendations Tab */}
                <TabsContent value="recommendations" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Expert Recommendations
                      </CardTitle>
                      <CardDescription>
                        Actionable steps to optimize your yield
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {prediction.recommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-primary">{idx + 1}</span>
                            </div>
                            <span className="text-sm">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-yellow-600" />
                        Risk Mitigation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2 text-red-600">Identified Risks</h4>
                          <div className="space-y-2">
                            {prediction.riskAssessment.factors.map((factor, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm">
                                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                                <span>{factor}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2 text-green-600">Mitigation Strategies</h4>
                          <div className="space-y-2">
                            {prediction.riskAssessment.mitigation.map((strategy, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                                <span>{strategy}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default YieldPredictor;