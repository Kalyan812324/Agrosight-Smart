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

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return new Response(
        JSON.stringify({ error: "Invalid coordinates provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch location name using reverse geocoding
    const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
    const geocodeResponse = await fetch(geocodeUrl, {
      headers: { "User-Agent": "FarmSmartForecasts/1.0" }
    });
    
    let locationName = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
    if (geocodeResponse.ok) {
      const geocodeData = await geocodeResponse.json();
      const address = geocodeData.address || {};
      const city = address.city || address.town || address.village || address.county || address.state_district;
      const state = address.state;
      const country = address.country;
      
      if (city && state) {
        locationName = `${city}, ${state}`;
      } else if (city) {
        locationName = city;
      } else if (state) {
        locationName = state;
      }
      if (country && country !== "India") {
        locationName += `, ${country}`;
      }
    }

    // Fetch weather data from Open-Meteo API
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset&timezone=auto`;
    
    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      console.error("Open-Meteo API error:", weatherResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch weather data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const weatherData = await weatherResponse.json();
    
    // Add location name to the response
    const response = {
      ...weatherData,
      location_name: locationName,
      coordinates: { latitude, longitude }
    };

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
