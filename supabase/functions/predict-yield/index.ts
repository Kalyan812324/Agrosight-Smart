import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PredictionRequest {
  crop: string;
  state: string;
  district?: string;
  soilType: string;
  rainfall: number;
  area: number;
  season: string;
  temperature?: number;
  humidity?: number;
  irrigationType?: string;
  fertilizerUsage?: string;
  previousCrop?: string;
}

// Comprehensive crop database with scientific yield data (tons/hectare)
const cropDatabase: Record<string, {
  baseYield: number;
  optimalTemp: [number, number];
  optimalRainfall: [number, number];
  optimalHumidity: [number, number];
  growingDays: number;
  waterRequirement: number;
  bestSoils: string[];
  bestSeasons: string[];
}> = {
  "Rice": {
    baseYield: 4.2,
    optimalTemp: [25, 35],
    optimalRainfall: [1000, 2000],
    optimalHumidity: [60, 80],
    growingDays: 120,
    waterRequirement: 1500,
    bestSoils: ["Alluvial", "Clayey", "Black"],
    bestSeasons: ["Kharif"]
  },
  "Wheat": {
    baseYield: 3.5,
    optimalTemp: [15, 25],
    optimalRainfall: [400, 700],
    optimalHumidity: [40, 60],
    growingDays: 120,
    waterRequirement: 450,
    bestSoils: ["Alluvial", "Loamy", "Black"],
    bestSeasons: ["Rabi"]
  },
  "Cotton": {
    baseYield: 2.0,
    optimalTemp: [21, 30],
    optimalRainfall: [700, 1200],
    optimalHumidity: [50, 70],
    growingDays: 180,
    waterRequirement: 700,
    bestSoils: ["Black", "Alluvial"],
    bestSeasons: ["Kharif"]
  },
  "Sugarcane": {
    baseYield: 75,
    optimalTemp: [20, 35],
    optimalRainfall: [1500, 2500],
    optimalHumidity: [70, 85],
    growingDays: 365,
    waterRequirement: 2000,
    bestSoils: ["Alluvial", "Loamy", "Black"],
    bestSeasons: ["Kharif", "Rabi"]
  },
  "Maize": {
    baseYield: 5.5,
    optimalTemp: [21, 30],
    optimalRainfall: [500, 800],
    optimalHumidity: [50, 70],
    growingDays: 100,
    waterRequirement: 500,
    bestSoils: ["Loamy", "Alluvial", "Red"],
    bestSeasons: ["Kharif", "Rabi"]
  },
  "Barley": {
    baseYield: 2.8,
    optimalTemp: [12, 22],
    optimalRainfall: [300, 500],
    optimalHumidity: [35, 55],
    growingDays: 110,
    waterRequirement: 400,
    bestSoils: ["Loamy", "Alluvial"],
    bestSeasons: ["Rabi"]
  },
  "Gram": {
    baseYield: 1.2,
    optimalTemp: [15, 25],
    optimalRainfall: [400, 600],
    optimalHumidity: [40, 60],
    growingDays: 100,
    waterRequirement: 350,
    bestSoils: ["Loamy", "Alluvial", "Black"],
    bestSeasons: ["Rabi"]
  },
  "Groundnut": {
    baseYield: 2.2,
    optimalTemp: [25, 30],
    optimalRainfall: [500, 700],
    optimalHumidity: [50, 60],
    growingDays: 120,
    waterRequirement: 500,
    bestSoils: ["Sandy Loam", "Red", "Alluvial"],
    bestSeasons: ["Kharif", "Rabi"]
  },
  "Soybean": {
    baseYield: 2.5,
    optimalTemp: [20, 30],
    optimalRainfall: [600, 1000],
    optimalHumidity: [60, 70],
    growingDays: 100,
    waterRequirement: 450,
    bestSoils: ["Black", "Alluvial", "Loamy"],
    bestSeasons: ["Kharif"]
  },
  "Sunflower": {
    baseYield: 1.8,
    optimalTemp: [20, 28],
    optimalRainfall: [500, 750],
    optimalHumidity: [50, 65],
    growingDays: 90,
    waterRequirement: 400,
    bestSoils: ["Black", "Alluvial", "Red"],
    bestSeasons: ["Rabi", "Kharif"]
  },
  "Potato": {
    baseYield: 25,
    optimalTemp: [15, 22],
    optimalRainfall: [500, 700],
    optimalHumidity: [70, 80],
    growingDays: 90,
    waterRequirement: 500,
    bestSoils: ["Sandy Loam", "Loamy", "Alluvial"],
    bestSeasons: ["Rabi"]
  },
  "Onion": {
    baseYield: 18,
    optimalTemp: [15, 25],
    optimalRainfall: [600, 750],
    optimalHumidity: [60, 70],
    growingDays: 130,
    waterRequirement: 400,
    bestSoils: ["Loamy", "Alluvial", "Sandy Loam"],
    bestSeasons: ["Rabi", "Kharif"]
  },
  "Tomato": {
    baseYield: 30,
    optimalTemp: [20, 27],
    optimalRainfall: [400, 600],
    optimalHumidity: [60, 80],
    growingDays: 75,
    waterRequirement: 600,
    bestSoils: ["Loamy", "Sandy Loam", "Alluvial"],
    bestSeasons: ["Rabi", "Zaid"]
  },
  "Mustard": {
    baseYield: 1.5,
    optimalTemp: [10, 25],
    optimalRainfall: [300, 500],
    optimalHumidity: [40, 60],
    growingDays: 120,
    waterRequirement: 350,
    bestSoils: ["Loamy", "Alluvial", "Sandy Loam"],
    bestSeasons: ["Rabi"]
  },
  "Turmeric": {
    baseYield: 8,
    optimalTemp: [25, 30],
    optimalRainfall: [1500, 2000],
    optimalHumidity: [70, 90],
    growingDays: 270,
    waterRequirement: 1500,
    bestSoils: ["Loamy", "Alluvial", "Red"],
    bestSeasons: ["Kharif"]
  },
  "Chilli": {
    baseYield: 2.5,
    optimalTemp: [20, 30],
    optimalRainfall: [600, 1200],
    optimalHumidity: [60, 80],
    growingDays: 150,
    waterRequirement: 600,
    bestSoils: ["Loamy", "Black", "Alluvial"],
    bestSeasons: ["Kharif", "Rabi"]
  }
};

// State-wise yield modifiers based on agricultural conditions
const stateModifiers: Record<string, number> = {
  "Punjab": 1.25,
  "Haryana": 1.20,
  "Uttar Pradesh": 1.15,
  "Andhra Pradesh": 1.12,
  "Tamil Nadu": 1.10,
  "Karnataka": 1.08,
  "Maharashtra": 1.05,
  "Gujarat": 1.10,
  "Madhya Pradesh": 1.02,
  "Bihar": 1.00,
  "West Bengal": 1.08,
  "Rajasthan": 0.92,
  "Odisha": 1.00,
  "Telangana": 1.08,
  "Kerala": 1.05,
  "Assam": 0.95,
  "Jharkhand": 0.95,
  "Chhattisgarh": 0.98
};

// Soil quality modifiers
const soilModifiers: Record<string, number> = {
  "Alluvial": 1.15,
  "Black": 1.12,
  "Red": 0.95,
  "Laterite": 0.88,
  "Desert": 0.75,
  "Mountain": 0.82,
  "Saline": 0.70,
  "Loamy": 1.18,
  "Sandy Loam": 1.05,
  "Clayey": 0.95,
  "Sandy": 0.80,
  "Peaty": 0.85
};

// Irrigation modifiers
const irrigationModifiers: Record<string, number> = {
  "Drip": 1.25,
  "Sprinkler": 1.18,
  "Canal": 1.10,
  "Tube Well": 1.12,
  "Rain-fed": 0.85,
  "Flood": 1.00
};

// Fertilizer usage modifiers
const fertilizerModifiers: Record<string, number> = {
  "Organic": 1.05,
  "Chemical": 1.15,
  "Mixed": 1.20,
  "Minimal": 0.85,
  "None": 0.70
};

function calculateOptimalFactor(value: number, optimalRange: [number, number]): number {
  const [min, max] = optimalRange;
  const optimal = (min + max) / 2;
  const range = max - min;
  
  if (value >= min && value <= max) {
    // Within optimal range - score based on proximity to center
    const distanceFromOptimal = Math.abs(value - optimal);
    return 1 - (distanceFromOptimal / range) * 0.1;
  } else if (value < min) {
    // Below optimal
    const deficit = (min - value) / min;
    return Math.max(0.5, 1 - deficit * 0.5);
  } else {
    // Above optimal
    const excess = (value - max) / max;
    return Math.max(0.5, 1 - excess * 0.5);
  }
}

function calculateConfidence(factors: number[]): number {
  // Calculate confidence based on how many factors are near optimal
  const avgFactor = factors.reduce((a, b) => a + b, 0) / factors.length;
  const variance = factors.reduce((sum, f) => sum + Math.pow(f - avgFactor, 2), 0) / factors.length;
  
  // Higher average and lower variance = higher confidence
  const baseConfidence = 70;
  const factorBonus = (avgFactor - 0.8) * 50;
  const variancePenalty = variance * 30;
  
  return Math.min(98, Math.max(60, Math.round(baseConfidence + factorBonus - variancePenalty)));
}

function generateRecommendations(
  data: PredictionRequest,
  cropInfo: typeof cropDatabase[string],
  factors: { soil: number; rainfall: number; temp: number; humidity: number; season: number }
): string[] {
  const recommendations: string[] = [];
  
  // Soil recommendations
  if (factors.soil < 0.9) {
    if (!cropInfo.bestSoils.includes(data.soilType)) {
      recommendations.push(`Consider soil amendments - ${cropInfo.bestSoils.slice(0, 2).join(" or ")} soil is optimal for ${data.crop}`);
    }
    recommendations.push("Conduct comprehensive soil testing for NPK levels and pH balance");
  }
  
  // Rainfall/Water recommendations
  if (factors.rainfall < 0.85) {
    if (data.rainfall < cropInfo.optimalRainfall[0]) {
      recommendations.push(`Implement supplemental irrigation - ${data.crop} requires ${cropInfo.optimalRainfall[0]}-${cropInfo.optimalRainfall[1]}mm water`);
      recommendations.push("Consider drip irrigation to maximize water efficiency");
    } else {
      recommendations.push("Ensure proper drainage to prevent waterlogging");
      recommendations.push("Consider raised bed cultivation for better water management");
    }
  }
  
  // Temperature recommendations
  if (factors.temp < 0.85) {
    recommendations.push(`Adjust planting time to match optimal temperature range (${cropInfo.optimalTemp[0]}-${cropInfo.optimalTemp[1]}°C)`);
    if (data.temperature && data.temperature > cropInfo.optimalTemp[1]) {
      recommendations.push("Use mulching and shade nets to reduce heat stress");
    }
  }
  
  // Season recommendations
  if (factors.season < 0.9) {
    recommendations.push(`${cropInfo.bestSeasons.join(" or ")} season is optimal for ${data.crop} cultivation`);
  }
  
  // General best practices
  recommendations.push("Use certified high-yielding variety (HYV) seeds for better productivity");
  recommendations.push("Apply integrated pest management (IPM) practices");
  recommendations.push("Monitor crop health weekly and maintain crop diary");
  
  // Fertilizer specific
  if (data.fertilizerUsage === "None" || data.fertilizerUsage === "Minimal") {
    recommendations.push("Implement balanced fertilization based on soil test recommendations");
  }
  
  // Irrigation specific
  if (data.irrigationType === "Rain-fed") {
    recommendations.push("Consider micro-irrigation systems for drought resilience");
  }
  
  return recommendations.slice(0, 8);
}

function generateRiskAssessment(
  data: PredictionRequest,
  factors: { soil: number; rainfall: number; temp: number; humidity: number; season: number }
): { level: string; factors: string[]; mitigation: string[] } {
  const riskFactors: string[] = [];
  const mitigation: string[] = [];
  
  if (factors.rainfall < 0.8) {
    if (data.rainfall < 500) {
      riskFactors.push("High drought risk due to low rainfall");
      mitigation.push("Implement water harvesting and drip irrigation");
    } else {
      riskFactors.push("Flood/waterlogging risk from excess rainfall");
      mitigation.push("Ensure proper drainage and raised bed cultivation");
    }
  }
  
  if (factors.temp < 0.8) {
    riskFactors.push("Temperature stress risk affecting crop growth");
    mitigation.push("Use temperature-tolerant varieties and adjust planting dates");
  }
  
  if (factors.soil < 0.85) {
    riskFactors.push("Suboptimal soil conditions may limit yield potential");
    mitigation.push("Apply appropriate soil amendments and organic matter");
  }
  
  if (data.humidity && (data.humidity > 80 || data.humidity < 40)) {
    riskFactors.push("Humidity-related disease risk (fungal infections)");
    mitigation.push("Apply preventive fungicides and ensure proper spacing");
  }
  
  if (factors.season < 0.8) {
    riskFactors.push("Off-season cultivation increases weather-related risks");
    mitigation.push("Use protected cultivation or climate-controlled practices");
  }
  
  const avgFactor = Object.values(factors).reduce((a, b) => a + b, 0) / 5;
  const level = avgFactor > 0.9 ? "Low" : avgFactor > 0.75 ? "Medium" : "High";
  
  if (riskFactors.length === 0) {
    riskFactors.push("No significant risks identified");
    mitigation.push("Continue with standard best practices");
  }
  
  return { level, factors: riskFactors, mitigation };
}

function generateFinancialProjection(
  crop: string,
  predictedYield: number,
  area: number,
  totalProduction: number
): { estimatedRevenue: number; estimatedCost: number; estimatedProfit: number; costBreakdown: Record<string, number>; pricePerQuintal: number } {
  // Market price estimates (INR per quintal) - based on typical MSP and market rates
  const pricePerQuintal: Record<string, number> = {
    "Rice": 2300,
    "Wheat": 2275,
    "Cotton": 6800,
    "Sugarcane": 350,
    "Maize": 2090,
    "Barley": 1850,
    "Gram": 5450,
    "Groundnut": 6550,
    "Soybean": 4600,
    "Sunflower": 6760,
    "Potato": 1200,
    "Onion": 1500,
    "Tomato": 2000,
    "Mustard": 5650,
    "Turmeric": 8500,
    "Chilli": 12000
  };
  
  // Cost estimates (INR per hectare)
  const costPerHectare: Record<string, number> = {
    "Rice": 45000,
    "Wheat": 35000,
    "Cotton": 55000,
    "Sugarcane": 85000,
    "Maize": 32000,
    "Barley": 28000,
    "Gram": 25000,
    "Groundnut": 40000,
    "Soybean": 30000,
    "Sunflower": 28000,
    "Potato": 120000,
    "Onion": 75000,
    "Tomato": 95000,
    "Mustard": 25000,
    "Turmeric": 150000,
    "Chilli": 80000
  };
  
  const price = pricePerQuintal[crop] || 3000;
  const costBase = costPerHectare[crop] || 40000;
  
  // Convert tons to quintals (1 ton = 10 quintals)
  const productionInQuintals = totalProduction * 10;
  const estimatedRevenue = Math.round(productionInQuintals * price);
  const estimatedCost = Math.round(costBase * area);
  const estimatedProfit = estimatedRevenue - estimatedCost;
  
  // Cost breakdown
  const costBreakdown = {
    "Seeds & Planting": Math.round(estimatedCost * 0.12),
    "Fertilizers": Math.round(estimatedCost * 0.22),
    "Pesticides": Math.round(estimatedCost * 0.10),
    "Labor": Math.round(estimatedCost * 0.30),
    "Irrigation": Math.round(estimatedCost * 0.15),
    "Machinery": Math.round(estimatedCost * 0.08),
    "Miscellaneous": Math.round(estimatedCost * 0.03)
  };
  
  return { estimatedRevenue, estimatedCost, estimatedProfit, costBreakdown, pricePerQuintal: price };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: PredictionRequest = await req.json();
    
    // Validate required fields
    if (!data.crop || !data.state || !data.soilType || !data.rainfall || !data.area || !data.season) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get crop data
    const cropInfo = cropDatabase[data.crop];
    if (!cropInfo) {
      return new Response(
        JSON.stringify({ error: "Unsupported crop type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Calculate individual factors
    const soilFactor = soilModifiers[data.soilType] || 1.0;
    const stateFactor = stateModifiers[data.state] || 1.0;
    const irrigationFactor = irrigationModifiers[data.irrigationType || "Rain-fed"] || 1.0;
    const fertilizerFactor = fertilizerModifiers[data.fertilizerUsage || "Mixed"] || 1.0;
    
    // Calculate optimal condition factors
    const rainfallFactor = calculateOptimalFactor(data.rainfall, cropInfo.optimalRainfall);
    const tempFactor = data.temperature 
      ? calculateOptimalFactor(data.temperature, cropInfo.optimalTemp) 
      : 0.95; // Default if not provided
    const humidityFactor = data.humidity 
      ? calculateOptimalFactor(data.humidity, cropInfo.optimalHumidity) 
      : 0.95;
    
    // Season factor
    const seasonFactor = cropInfo.bestSeasons.includes(data.season) ? 1.1 : 0.85;
    
    // Calculate predicted yield
    const baseYield = cropInfo.baseYield;
    const allFactors = [
      soilFactor,
      stateFactor,
      irrigationFactor,
      fertilizerFactor,
      rainfallFactor,
      tempFactor,
      humidityFactor,
      seasonFactor
    ];
    
    // Apply slight randomization (±3%) for realism
    const randomFactor = 0.97 + Math.random() * 0.06;
    
    const predictedYield = baseYield * allFactors.reduce((a, b) => a * b, 1) * randomFactor;
    const totalProduction = predictedYield * data.area;
    
    // Calculate confidence
    const confidence = calculateConfidence([soilFactor, rainfallFactor, tempFactor, humidityFactor, seasonFactor]);
    
    // Generate recommendations
    const factorsSummary = {
      soil: soilFactor,
      rainfall: rainfallFactor,
      temp: tempFactor,
      humidity: humidityFactor,
      season: seasonFactor
    };
    
    const recommendations = generateRecommendations(data, cropInfo, factorsSummary);
    const riskAssessment = generateRiskAssessment(data, factorsSummary);
    const financialProjection = generateFinancialProjection(data.crop, predictedYield, data.area, totalProduction);
    
    // Calculate yield comparison
    const nationalAvgYield = baseYield * 0.85; // National average is typically 85% of optimal
    const yieldComparison = ((predictedYield / nationalAvgYield) - 1) * 100;
    
    const result = {
      prediction: {
        yieldPerHectare: parseFloat(predictedYield.toFixed(2)),
        totalProduction: parseFloat(totalProduction.toFixed(2)),
        unit: data.crop === "Sugarcane" || data.crop === "Potato" || data.crop === "Onion" || data.crop === "Tomato" || data.crop === "Turmeric" ? "tons" : "tons",
        confidence,
        nationalAvgYield: parseFloat(nationalAvgYield.toFixed(2)),
        yieldComparison: parseFloat(yieldComparison.toFixed(1)),
        growingDays: cropInfo.growingDays,
        waterRequirement: cropInfo.waterRequirement
      },
      analysis: {
        factors: {
          soil: { value: parseFloat((soilFactor * 100).toFixed(1)), status: soilFactor >= 1 ? "optimal" : soilFactor >= 0.9 ? "good" : "suboptimal" },
          rainfall: { value: parseFloat((rainfallFactor * 100).toFixed(1)), status: rainfallFactor >= 0.95 ? "optimal" : rainfallFactor >= 0.85 ? "good" : "suboptimal" },
          temperature: { value: parseFloat((tempFactor * 100).toFixed(1)), status: tempFactor >= 0.95 ? "optimal" : tempFactor >= 0.85 ? "good" : "suboptimal" },
          humidity: { value: parseFloat((humidityFactor * 100).toFixed(1)), status: humidityFactor >= 0.95 ? "optimal" : humidityFactor >= 0.85 ? "good" : "suboptimal" },
          season: { value: parseFloat((seasonFactor * 100).toFixed(1)), status: seasonFactor >= 1 ? "optimal" : "suboptimal" }
        },
        optimalConditions: {
          temperature: cropInfo.optimalTemp,
          rainfall: cropInfo.optimalRainfall,
          humidity: cropInfo.optimalHumidity,
          soils: cropInfo.bestSoils,
          seasons: cropInfo.bestSeasons
        }
      },
      recommendations,
      riskAssessment,
      financialProjection,
      metadata: {
        model: "AgriYield-v2.0-Advanced",
        timestamp: new Date().toISOString(),
        inputData: data
      }
    };
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Prediction error:", err);
    return new Response(
      JSON.stringify({ error: "Prediction failed", details: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});