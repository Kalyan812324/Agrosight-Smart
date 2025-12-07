import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude } = await req.json();
    console.log(`Weather request for coordinates: ${latitude}, ${longitude}`);

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return new Response(
        JSON.stringify({ error: "Invalid coordinates provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch location name using reverse geocoding
    console.log("Fetching location name...");
    const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
    const geocodeResponse = await fetch(geocodeUrl, {
      headers: { "User-Agent": "FarmSmartForecasts/1.0" }
    });
    
    let locationName = `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
    let district = "";
    let state = "";
    let country = "";
    
    if (geocodeResponse.ok) {
      const geocodeData = await geocodeResponse.json();
      const address = geocodeData.address || {};
      district = address.city || address.town || address.village || address.county || address.state_district || "";
      state = address.state || "";
      country = address.country || "";
      
      if (district && state) {
        locationName = `${district}, ${state}`;
      } else if (district) {
        locationName = district;
      } else if (state) {
        locationName = state;
      }
      console.log(`Location resolved: ${locationName}`);
    }

    // Fetch comprehensive weather data from Open-Meteo API with agricultural parameters
    console.log("Fetching weather data from Open-Meteo...");
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,weather_code,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,soil_temperature_0cm,soil_temperature_6cm,soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,et0_fao_evapotranspiration&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,et0_fao_evapotranspiration&timezone=auto&forecast_days=10`;
    
    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      console.error("Open-Meteo API error:", weatherResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch weather data from Open-Meteo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const weatherData = await weatherResponse.json();
    console.log("Weather data received successfully");

    // Calculate agricultural insights based on weather data
    const current = weatherData.current || {};
    const daily = weatherData.daily || {};
    const hourly = weatherData.hourly || {};

    // Irrigation recommendation based on soil moisture, evapotranspiration, and precipitation
    const avgSoilMoisture = hourly.soil_moisture_0_to_1cm?.slice(0, 24).reduce((a: number, b: number) => a + b, 0) / 24 || 0;
    const todayET = daily.et0_fao_evapotranspiration?.[0] || 0;
    const todayPrecip = daily.precipitation_sum?.[0] || 0;
    const next3DaysPrecip = daily.precipitation_sum?.slice(0, 3).reduce((a: number, b: number) => a + b, 0) || 0;

    let irrigationPriority = "Low";
    let irrigationRecommendation = "Soil moisture levels are adequate. Monitor conditions.";
    
    if (avgSoilMoisture < 0.15) {
      irrigationPriority = "Critical";
      irrigationRecommendation = "Immediate irrigation required! Soil moisture critically low.";
    } else if (avgSoilMoisture < 0.25 && next3DaysPrecip < 5) {
      irrigationPriority = "High";
      irrigationRecommendation = `Irrigation recommended within 24 hours. ET loss: ${todayET.toFixed(1)}mm/day. No significant rain expected.`;
    } else if (avgSoilMoisture < 0.35 && next3DaysPrecip < 10) {
      irrigationPriority = "Medium";
      irrigationRecommendation = `Consider irrigation in 2-3 days. Current soil moisture: ${(avgSoilMoisture * 100).toFixed(0)}%.`;
    } else if (next3DaysPrecip > 15) {
      irrigationPriority = "None";
      irrigationRecommendation = `Skip irrigation. Expected rainfall: ${next3DaysPrecip.toFixed(1)}mm in next 3 days.`;
    }

    // Crop stress analysis
    const maxTemp = daily.temperature_2m_max?.[0] || 0;
    const minTemp = daily.temperature_2m_min?.[0] || 0;
    const humidity = current.relative_humidity_2m || 0;
    const windSpeed = current.wind_speed_10m || 0;

    let cropStressLevel = "Low";
    let cropStressDetails = "Conditions are favorable for crop growth.";
    
    if (maxTemp > 40 || minTemp < 5) {
      cropStressLevel = "Critical";
      cropStressDetails = maxTemp > 40 
        ? `Extreme heat stress! Max temp ${maxTemp}°C. Implement cooling measures immediately.`
        : `Frost risk! Min temp ${minTemp}°C. Protect sensitive crops.`;
    } else if (maxTemp > 35 || (humidity < 30 && maxTemp > 30)) {
      cropStressLevel = "High";
      cropStressDetails = `Heat stress likely. Consider shade nets, increased irrigation, and avoid mid-day activities.`;
    } else if (maxTemp > 32 || humidity < 40) {
      cropStressLevel = "Medium";
      cropStressDetails = `Moderate stress expected. Monitor crop wilting and increase watering frequency.`;
    }

    // Pest and disease risk based on humidity, temperature, and precipitation
    let pestRiskLevel = "Low";
    let pestRiskDetails = "Current conditions unfavorable for major pest activity.";
    let diseaseRiskLevel = "Low";
    let diseaseRiskDetails = "Low disease pressure expected.";

    if (humidity > 80 && maxTemp > 25 && maxTemp < 35) {
      pestRiskLevel = "High";
      pestRiskDetails = "High humidity and warm temperatures favor aphids, whiteflies, and mites. Scout fields daily.";
    } else if (humidity > 70 && maxTemp > 20) {
      pestRiskLevel = "Medium";
      pestRiskDetails = "Moderate pest pressure expected. Regular monitoring recommended.";
    }

    if (humidity > 85 && todayPrecip > 5) {
      diseaseRiskLevel = "Critical";
      diseaseRiskDetails = "Very high risk of fungal diseases (blight, mildew, rust). Apply preventive fungicides.";
    } else if (humidity > 80 || (humidity > 70 && todayPrecip > 2)) {
      diseaseRiskLevel = "High";
      diseaseRiskDetails = "Elevated disease risk. Ensure proper spacing and air circulation.";
    } else if (humidity > 65 && maxTemp > 25) {
      diseaseRiskLevel = "Medium";
      diseaseRiskDetails = "Monitor for early disease symptoms. Maintain field hygiene.";
    }

    // Spraying conditions
    let sprayingConditions = "Not Ideal";
    let sprayingDetails = "";
    
    if (windSpeed < 15 && humidity > 40 && humidity < 80 && current.precipitation === 0) {
      sprayingConditions = "Excellent";
      sprayingDetails = "Perfect conditions for pesticide/fertilizer application.";
    } else if (windSpeed < 20 && current.precipitation === 0) {
      sprayingConditions = "Good";
      sprayingDetails = "Acceptable for spraying. Complete applications in early morning.";
    } else {
      sprayingDetails = windSpeed >= 20 
        ? `Wind too strong (${windSpeed.toFixed(1)} km/h). Spray drift likely.`
        : "Precipitation expected. Delay spraying operations.";
    }

    // Harvesting conditions for next 3 days
    const harvestDays = [];
    for (let i = 0; i < 3; i++) {
      const dayPrecip = daily.precipitation_sum?.[i] || 0;
      const dayPrecipProb = daily.precipitation_probability_max?.[i] || 0;
      const dayWind = daily.wind_speed_10m_max?.[i] || 0;
      
      let suitability = "Good";
      if (dayPrecip > 5 || dayPrecipProb > 70) {
        suitability = "Poor";
      } else if (dayPrecip > 0 || dayPrecipProb > 40 || dayWind > 30) {
        suitability = "Fair";
      }
      harvestDays.push({
        date: daily.time?.[i],
        suitability,
        precipitation: dayPrecip,
        precipitationProbability: dayPrecipProb
      });
    }

    // Optimal farming activities
    const optimalActivities = [];
    if (current.precipitation === 0 && windSpeed < 20) optimalActivities.push("Field work");
    if (sprayingConditions === "Excellent" || sprayingConditions === "Good") optimalActivities.push("Spraying");
    if (maxTemp < 32 && minTemp > 10) optimalActivities.push("Planting");
    if (humidity < 60 && current.precipitation === 0) optimalActivities.push("Harvesting");
    if (avgSoilMoisture > 0.2 && avgSoilMoisture < 0.4) optimalActivities.push("Fertilizing");
    if (current.cloud_cover < 30) optimalActivities.push("Solar drying");
    if (windSpeed < 10 && humidity > 50) optimalActivities.push("Transplanting");

    // Weather warnings
    const warnings = [];
    if (maxTemp > 40) warnings.push({ type: "extreme_heat", message: `Extreme heat warning: ${maxTemp}°C expected` });
    if (minTemp < 5) warnings.push({ type: "frost", message: `Frost warning: ${minTemp}°C expected` });
    if (daily.wind_gusts_10m_max?.[0] > 50) warnings.push({ type: "wind", message: `Strong wind warning: Gusts up to ${daily.wind_gusts_10m_max[0]} km/h` });
    if (daily.precipitation_sum?.[0] > 50) warnings.push({ type: "heavy_rain", message: `Heavy rain warning: ${daily.precipitation_sum[0]}mm expected` });
    if (daily.uv_index_max?.[0] > 8) warnings.push({ type: "uv", message: `High UV index: ${daily.uv_index_max[0]}. Protect workers.` });
    
    // Check for prolonged dry spell
    const next7DaysPrecip = daily.precipitation_sum?.slice(0, 7).reduce((a: number, b: number) => a + b, 0) || 0;
    if (next7DaysPrecip < 5 && avgSoilMoisture < 0.25) {
      warnings.push({ type: "drought", message: "Dry spell expected. Plan irrigation accordingly." });
    }

    const response = {
      ...weatherData,
      location: {
        name: locationName,
        district,
        state,
        country,
        latitude,
        longitude
      },
      agricultural_insights: {
        irrigation: {
          priority: irrigationPriority,
          recommendation: irrigationRecommendation,
          soil_moisture: avgSoilMoisture,
          evapotranspiration: todayET
        },
        crop_stress: {
          level: cropStressLevel,
          details: cropStressDetails
        },
        pest_risk: {
          level: pestRiskLevel,
          details: pestRiskDetails
        },
        disease_risk: {
          level: diseaseRiskLevel,
          details: diseaseRiskDetails
        },
        spraying: {
          conditions: sprayingConditions,
          details: sprayingDetails,
          wind_speed: windSpeed,
          humidity
        },
        harvesting: harvestDays
      },
      optimal_activities: optimalActivities,
      warnings,
      forecast_days: 10
    };

    console.log("Sending enhanced weather response");
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Weather function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
