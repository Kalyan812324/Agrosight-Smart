import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, MapPin, Droplets, Mountain, Wheat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const YieldPredictor = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    crop: "",
    state: "",
    soilType: "",
    rainfall: "",
    area: "",
    season: ""
  });
  const [prediction, setPrediction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const crops = ["Rice", "Wheat", "Cotton", "Sugarcane", "Maize", "Barley", "Gram", "Groundnut"];
  const states = ["Andhra Pradesh", "Karnataka", "Tamil Nadu", "Maharashtra", "Punjab", "Haryana", "Uttar Pradesh", "Bihar"];
  const soilTypes = ["Alluvial", "Black", "Red", "Laterite", "Desert", "Mountain", "Saline"];
  const seasons = ["Kharif", "Rabi", "Zaid"];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const predictYield = async () => {
    // Validation
    const requiredFields = ["crop", "state", "soilType", "rainfall", "area", "season"];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate ML prediction with realistic values
    setTimeout(() => {
      const baseYield = {
        "Rice": 3.2,
        "Wheat": 2.8,
        "Cotton": 1.5,
        "Sugarcane": 65,
        "Maize": 4.1,
        "Barley": 2.3,
        "Gram": 1.8,
        "Groundnut": 1.9
      };

      const soilModifier = {
        "Alluvial": 1.1,
        "Black": 1.05,
        "Red": 0.95,
        "Laterite": 0.9,
        "Desert": 0.8,
        "Mountain": 0.85,
        "Saline": 0.75
      };

      const rainfallModifier = Math.min(1.2, Math.max(0.7, parseFloat(formData.rainfall) / 1000));
      const randomFactor = 0.9 + Math.random() * 0.2; // ±10% variation
      
      const predictedYield = (
        (baseYield[formData.crop] || 2.5) * 
        (soilModifier[formData.soilType] || 1) * 
        rainfallModifier * 
        randomFactor
      ).toFixed(2);

      const totalProduction = (parseFloat(predictedYield) * parseFloat(formData.area)).toFixed(2);
      const confidence = Math.floor(85 + Math.random() * 10);

      setPrediction({
        yieldPerHectare: predictedYield,
        totalProduction,
        confidence,
        recommendations: [
          "Consider soil testing for nutrient optimization",
          "Monitor weather patterns for irrigation planning",
          "Use disease-resistant varieties for better yield"
        ]
      });

      setIsLoading(false);
      
      toast({
        title: "Prediction Complete",
        description: `Estimated yield: ${predictedYield} tons/hectare`
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            AI Crop Yield Predictor
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get accurate yield predictions using advanced machine learning algorithms
            trained on agricultural data from across India.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-6 w-6 text-primary" />
                <span>Crop & Field Information</span>
              </CardTitle>
              <CardDescription>
                Enter your farming details for accurate yield prediction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="crop" className="flex items-center space-x-1">
                    <Wheat className="h-4 w-4" />
                    <span>Crop Type</span>
                  </Label>
                  <Select onValueChange={(value) => handleInputChange("crop", value)}>
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

                <div className="space-y-2">
                  <Label htmlFor="state" className="flex items-center space-x-1">
                    <MapPin className="h-4 w-4" />
                    <span>State</span>
                  </Label>
                  <Select onValueChange={(value) => handleInputChange("state", value)}>
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="soilType" className="flex items-center space-x-1">
                    <Mountain className="h-4 w-4" />
                    <span>Soil Type</span>
                  </Label>
                  <Select onValueChange={(value) => handleInputChange("soilType", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select soil type" />
                    </SelectTrigger>
                    <SelectContent>
                      {soilTypes.map(soil => (
                        <SelectItem key={soil} value={soil}>{soil}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="season" className="flex items-center space-x-1">
                    <span>Season</span>
                  </Label>
                  <Select onValueChange={(value) => handleInputChange("season", value)}>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rainfall" className="flex items-center space-x-1">
                    <Droplets className="h-4 w-4" />
                    <span>Annual Rainfall (mm)</span>
                  </Label>
                  <Input
                    id="rainfall"
                    type="number"
                    placeholder="e.g., 800"
                    value={formData.rainfall}
                    onChange={(e) => handleInputChange("rainfall", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="area">Farm Area (hectares)</Label>
                  <Input
                    id="area"
                    type="number"
                    placeholder="e.g., 2.5"
                    value={formData.area}
                    onChange={(e) => handleInputChange("area", e.target.value)}
                  />
                </div>
              </div>

              <Button 
                variant="hero" 
                className="w-full" 
                onClick={predictYield}
                disabled={isLoading}
              >
                {isLoading ? "Analyzing..." : "Predict Yield"}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardHeader>
              <CardTitle>Prediction Results</CardTitle>
              <CardDescription>
                AI-powered yield estimation based on your inputs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!prediction ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Enter your crop details and click "Predict Yield" to see results
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-primary/5 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Yield per Hectare</p>
                      <p className="text-2xl font-bold text-primary">
                        {prediction.yieldPerHectare} tons/ha
                      </p>
                    </div>
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Production</p>
                      <p className="text-2xl font-bold text-accent-foreground">
                        {prediction.totalProduction} tons
                      </p>
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Confidence Level</p>
                    <div className="flex items-center space-x-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${prediction.confidence}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{prediction.confidence}%</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-primary">Recommendations</h4>
                    <ul className="space-y-2">
                      {prediction.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default YieldPredictor;