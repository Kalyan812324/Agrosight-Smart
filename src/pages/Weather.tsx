import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Cloud, 
  Sun, 
  CloudRain, 
  Wind, 
  Droplets, 
  Gauge, 
  Sunrise, 
  Sunset,
  MapPin,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Thermometer,
  Umbrella,
  Leaf,
  Bug,
  Sprout,
  Calendar,
  TrendingUp,
  Eye,
  CloudSun,
  Snowflake,
  CloudLightning,
  CloudFog,
  Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WeatherData {
  location: {
    name: string;
    district: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    rain: number;
    weather_code: number;
    cloud_cover: number;
    pressure_msl: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
    uv_index: number;
    is_day: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    apparent_temperature_max: number[];
    apparent_temperature_min: number[];
    sunrise: string[];
    sunset: string[];
    daylight_duration: number[];
    sunshine_duration: number[];
    uv_index_max: number[];
    precipitation_sum: number[];
    rain_sum: number[];
    precipitation_hours: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    et0_fao_evapotranspiration: number[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    soil_temperature_0cm: number[];
    soil_moisture_0_to_1cm: number[];
  };
  agricultural_insights: {
    irrigation: {
      priority: string;
      recommendation: string;
      soil_moisture: number;
      evapotranspiration: number;
    };
    crop_stress: {
      level: string;
      details: string;
    };
    pest_risk: {
      level: string;
      details: string;
    };
    disease_risk: {
      level: string;
      details: string;
    };
    spraying: {
      conditions: string;
      details: string;
      wind_speed: number;
      humidity: number;
    };
    harvesting: Array<{
      date: string;
      suitability: string;
      precipitation: number;
      precipitationProbability: number;
    }>;
  };
  optimal_activities: string[];
  warnings: Array<{ type: string; message: string }>;
}

const Weather = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const { toast } = useToast();

  const getWeatherDescription = (code: number): string => {
    const weatherCodes: { [key: number]: string } = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Foggy",
      48: "Rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      61: "Slight rain",
      63: "Moderate rain",
      65: "Heavy rain",
      66: "Freezing rain",
      67: "Heavy freezing rain",
      71: "Slight snow",
      73: "Moderate snow",
      75: "Heavy snow",
      77: "Snow grains",
      80: "Slight showers",
      81: "Moderate showers",
      82: "Violent showers",
      85: "Slight snow showers",
      86: "Heavy snow showers",
      95: "Thunderstorm",
      96: "Thunderstorm with hail",
      99: "Severe thunderstorm"
    };
    return weatherCodes[code] || "Unknown";
  };

  const getWeatherIcon = (code: number, isDay: boolean = true) => {
    if (code === 0 || code === 1) return isDay ? <Sun className="h-8 w-8 text-yellow-500" /> : <Sun className="h-8 w-8 text-yellow-300" />;
    if (code === 2) return <CloudSun className="h-8 w-8 text-yellow-400" />;
    if (code === 3) return <Cloud className="h-8 w-8 text-gray-400" />;
    if (code >= 45 && code <= 48) return <CloudFog className="h-8 w-8 text-gray-500" />;
    if (code >= 51 && code <= 67) return <CloudRain className="h-8 w-8 text-blue-500" />;
    if (code >= 71 && code <= 86) return <Snowflake className="h-8 w-8 text-blue-300" />;
    if (code >= 95) return <CloudLightning className="h-8 w-8 text-purple-500" />;
    return <Cloud className="h-8 w-8 text-gray-400" />;
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      case "none": return "bg-blue-500";
      case "excellent": return "bg-green-500";
      case "good": return "bg-emerald-500";
      case "fair": return "bg-yellow-500";
      case "poor": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const fetchWeather = async (latitude: number, longitude: number) => {
    setLoading(true);
    setLocationError(null);
    try {
      const response = await fetch(
        "https://xllpedrhhzoljkfvkgef.supabase.co/functions/v1/get-weather",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ latitude, longitude }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch weather data");
      }

      const data = await response.json();
      console.log("Weather API Response:", data);
      setWeatherData(data);
      
      toast({
        title: "Weather Updated",
        description: `Showing 10-day forecast for ${data.location?.name || "your location"}`,
      });
    } catch (error) {
      console.error("Weather fetch error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch weather data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setInitialLoading(false);
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeather(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error("Geolocation error:", error);
        let errorMessage = "Unable to get your location. ";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "Please allow location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage += "Location request timed out.";
            break;
        }
        setLocationError(errorMessage);
        setInitialLoading(false);
        setLoading(false);
        toast({
          title: "Location Error",
          description: errorMessage,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatDayName = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" });
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <Cloud className="h-20 w-20 text-primary animate-pulse mx-auto" />
            <Sun className="h-10 w-10 text-yellow-500 absolute -top-2 -right-2 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Detecting Your Location...</h2>
          <p className="text-muted-foreground">Getting precise weather data for your farm</p>
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        </div>
      </div>
    );
  }

  if (locationError && !weatherData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          <MapPin className="h-16 w-16 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Location Access Required</h2>
          <p className="text-muted-foreground">{locationError}</p>
          <Button onClick={getCurrentLocation} size="lg" className="w-full">
            <MapPin className="mr-2 h-5 w-5" />
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Ultra Precision Mode</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-2">
            Smart Weather Forecast
          </h1>
          <p className="text-lg text-muted-foreground">
            10-Day Agricultural Weather Intelligence
          </p>
        </div>

        {weatherData && (
          <div className="space-y-6 animate-fade-in">
            {/* Location & Refresh */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-full">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{weatherData.location.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {weatherData.location.latitude.toFixed(4)}°N, {weatherData.location.longitude.toFixed(4)}°E
                  </p>
                </div>
              </div>
              <Button
                onClick={getCurrentLocation}
                disabled={loading}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Warnings */}
            {weatherData.warnings && weatherData.warnings.length > 0 && (
              <div className="space-y-2">
                {weatherData.warnings.map((warning, index) => (
                  <Alert key={index} variant="destructive" className="border-red-500/50 bg-red-500/10">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertTitle className="font-semibold">Weather Alert</AlertTitle>
                    <AlertDescription>{warning.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Current Weather Hero */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-6 sm:p-8 text-primary-foreground">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Main Temperature */}
                  <div className="lg:col-span-1 flex flex-col items-center lg:items-start">
                    <div className="flex items-center gap-4 mb-4">
                      {getWeatherIcon(weatherData.current.weather_code, weatherData.current.is_day === 1)}
                      <div>
                        <div className="text-7xl font-bold tracking-tight">
                          {Math.round(weatherData.current.temperature_2m)}°
                        </div>
                        <p className="text-lg opacity-90">
                          Feels like {Math.round(weatherData.current.apparent_temperature)}°C
                        </p>
                      </div>
                    </div>
                    <p className="text-xl capitalize mb-2">
                      {getWeatherDescription(weatherData.current.weather_code)}
                    </p>
                    <div className="flex gap-4 text-sm opacity-80">
                      <span>H: {Math.round(weatherData.daily.temperature_2m_max[0])}°</span>
                      <span>L: {Math.round(weatherData.daily.temperature_2m_min[0])}°</span>
                    </div>
                  </div>

                  {/* Weather Details Grid */}
                  <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                      <Droplets className="h-5 w-5 mb-2 opacity-80" />
                      <p className="text-sm opacity-80">Humidity</p>
                      <p className="text-2xl font-bold">{weatherData.current.relative_humidity_2m}%</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                      <Wind className="h-5 w-5 mb-2 opacity-80" />
                      <p className="text-sm opacity-80">Wind</p>
                      <p className="text-2xl font-bold">{Math.round(weatherData.current.wind_speed_10m)} km/h</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                      <Gauge className="h-5 w-5 mb-2 opacity-80" />
                      <p className="text-sm opacity-80">Pressure</p>
                      <p className="text-2xl font-bold">{Math.round(weatherData.current.pressure_msl)} hPa</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                      <Sun className="h-5 w-5 mb-2 opacity-80" />
                      <p className="text-sm opacity-80">UV Index</p>
                      <p className="text-2xl font-bold">{weatherData.current.uv_index}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                      <Cloud className="h-5 w-5 mb-2 opacity-80" />
                      <p className="text-sm opacity-80">Cloud Cover</p>
                      <p className="text-2xl font-bold">{weatherData.current.cloud_cover}%</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                      <CloudRain className="h-5 w-5 mb-2 opacity-80" />
                      <p className="text-sm opacity-80">Precipitation</p>
                      <p className="text-2xl font-bold">{weatherData.current.precipitation} mm</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                      <Sunrise className="h-5 w-5 mb-2 opacity-80" />
                      <p className="text-sm opacity-80">Sunrise</p>
                      <p className="text-xl font-bold">{formatTime(weatherData.daily.sunrise[0])}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                      <Sunset className="h-5 w-5 mb-2 opacity-80" />
                      <p className="text-sm opacity-80">Sunset</p>
                      <p className="text-xl font-bold">{formatTime(weatherData.daily.sunset[0])}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tabs for Different Views */}
            <Tabs defaultValue="insights" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="insights" className="gap-2">
                  <Leaf className="h-4 w-4" />
                  Farm Insights
                </TabsTrigger>
                <TabsTrigger value="forecast" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  10-Day Forecast
                </TabsTrigger>
                <TabsTrigger value="hourly" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Hourly
                </TabsTrigger>
              </TabsList>

              {/* Agricultural Insights Tab */}
              <TabsContent value="insights" className="space-y-6">
                {/* Optimal Activities */}
                {weatherData.optimal_activities && weatherData.optimal_activities.length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Recommended Activities Today
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {weatherData.optimal_activities.map((activity, index) => (
                        <Badge key={index} variant="secondary" className="text-sm py-2 px-4">
                          {activity}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Insights Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Irrigation */}
                  <Card className="p-6 border-l-4" style={{ borderLeftColor: weatherData.agricultural_insights.irrigation.priority === "Critical" ? "#ef4444" : weatherData.agricultural_insights.irrigation.priority === "High" ? "#f97316" : weatherData.agricultural_insights.irrigation.priority === "Medium" ? "#eab308" : "#22c55e" }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Droplets className="h-6 w-6 text-blue-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Irrigation Status</h3>
                          <Badge className={`${getLevelColor(weatherData.agricultural_insights.irrigation.priority)} text-white mt-1`}>
                            {weatherData.agricultural_insights.irrigation.priority} Priority
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {weatherData.agricultural_insights.irrigation.recommendation}
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Soil Moisture</span>
                        <span className="font-medium">{(weatherData.agricultural_insights.irrigation.soil_moisture * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={weatherData.agricultural_insights.irrigation.soil_moisture * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        ET Loss: {weatherData.agricultural_insights.irrigation.evapotranspiration.toFixed(1)} mm/day
                      </p>
                    </div>
                  </Card>

                  {/* Crop Stress */}
                  <Card className="p-6 border-l-4" style={{ borderLeftColor: weatherData.agricultural_insights.crop_stress.level === "Critical" ? "#ef4444" : weatherData.agricultural_insights.crop_stress.level === "High" ? "#f97316" : weatherData.agricultural_insights.crop_stress.level === "Medium" ? "#eab308" : "#22c55e" }}>
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <Thermometer className="h-6 w-6 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Crop Stress Level</h3>
                        <Badge className={`${getLevelColor(weatherData.agricultural_insights.crop_stress.level)} text-white mt-1`}>
                          {weatherData.agricultural_insights.crop_stress.level}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {weatherData.agricultural_insights.crop_stress.details}
                    </p>
                  </Card>

                  {/* Pest Risk */}
                  <Card className="p-6 border-l-4" style={{ borderLeftColor: weatherData.agricultural_insights.pest_risk.level === "High" ? "#ef4444" : weatherData.agricultural_insights.pest_risk.level === "Medium" ? "#eab308" : "#22c55e" }}>
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <Bug className="h-6 w-6 text-red-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Pest Risk</h3>
                        <Badge className={`${getLevelColor(weatherData.agricultural_insights.pest_risk.level)} text-white mt-1`}>
                          {weatherData.agricultural_insights.pest_risk.level}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {weatherData.agricultural_insights.pest_risk.details}
                    </p>
                  </Card>

                  {/* Disease Risk */}
                  <Card className="p-6 border-l-4" style={{ borderLeftColor: weatherData.agricultural_insights.disease_risk.level === "Critical" ? "#ef4444" : weatherData.agricultural_insights.disease_risk.level === "High" ? "#f97316" : weatherData.agricultural_insights.disease_risk.level === "Medium" ? "#eab308" : "#22c55e" }}>
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Leaf className="h-6 w-6 text-purple-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Disease Risk</h3>
                        <Badge className={`${getLevelColor(weatherData.agricultural_insights.disease_risk.level)} text-white mt-1`}>
                          {weatherData.agricultural_insights.disease_risk.level}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {weatherData.agricultural_insights.disease_risk.details}
                    </p>
                  </Card>

                  {/* Spraying Conditions */}
                  <Card className="p-6 border-l-4" style={{ borderLeftColor: weatherData.agricultural_insights.spraying.conditions === "Excellent" ? "#22c55e" : weatherData.agricultural_insights.spraying.conditions === "Good" ? "#10b981" : weatherData.agricultural_insights.spraying.conditions === "Fair" ? "#eab308" : "#ef4444" }}>
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <Sprout className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Spraying Conditions</h3>
                        <Badge className={`${getLevelColor(weatherData.agricultural_insights.spraying.conditions)} text-white mt-1`}>
                          {weatherData.agricultural_insights.spraying.conditions}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {weatherData.agricultural_insights.spraying.details}
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Wind: {weatherData.agricultural_insights.spraying.wind_speed.toFixed(1)} km/h</span>
                      <span>Humidity: {weatherData.agricultural_insights.spraying.humidity}%</span>
                    </div>
                  </Card>

                  {/* Harvesting Outlook */}
                  <Card className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 bg-amber-500/10 rounded-lg">
                        <Calendar className="h-6 w-6 text-amber-500" />
                      </div>
                      <h3 className="font-semibold">Harvest Outlook (3 Days)</h3>
                    </div>
                    <div className="space-y-3">
                      {weatherData.agricultural_insights.harvesting.map((day, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="font-medium">{formatDate(day.date)}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              <Umbrella className="h-3 w-3 inline mr-1" />
                              {day.precipitationProbability}%
                            </span>
                            <Badge className={`${getLevelColor(day.suitability)} text-white`}>
                              {day.suitability}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* 10-Day Forecast Tab */}
              <TabsContent value="forecast">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    10-Day Weather Forecast
                  </h3>
                  <div className="space-y-3">
                    {weatherData.daily.time.map((date, index) => (
                      <div 
                        key={index} 
                        className={`flex items-center justify-between p-4 rounded-xl transition-colors ${index === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30 hover:bg-muted/50'}`}
                      >
                        <div className="flex items-center gap-4 min-w-[140px]">
                          {getWeatherIcon(weatherData.daily.weather_code[index])}
                          <div>
                            <p className="font-semibold">{formatDate(date)}</p>
                            <p className="text-xs text-muted-foreground">{formatDayName(date)}</p>
                          </div>
                        </div>
                        
                        <div className="hidden sm:block text-sm text-muted-foreground max-w-[150px]">
                          {getWeatherDescription(weatherData.daily.weather_code[index])}
                        </div>

                        <div className="flex items-center gap-2">
                          <Umbrella className="h-4 w-4 text-blue-500" />
                          <span className="text-sm">{weatherData.daily.precipitation_probability_max[index]}%</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <CloudRain className="h-4 w-4 text-blue-400" />
                          <span className="text-sm">{weatherData.daily.precipitation_sum[index].toFixed(1)} mm</span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-orange-500">
                            {Math.round(weatherData.daily.temperature_2m_max[index])}°
                          </span>
                          <span className="text-lg text-blue-500">
                            {Math.round(weatherData.daily.temperature_2m_min[index])}°
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              {/* Hourly Forecast Tab */}
              <TabsContent value="hourly">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    24-Hour Forecast
                  </h3>
                  <div className="overflow-x-auto">
                    <div className="flex gap-3 pb-4" style={{ minWidth: 'max-content' }}>
                      {weatherData.hourly.time.slice(0, 24).map((time, index) => {
                        const hour = new Date(time).getHours();
                        const isNow = index === 0;
                        return (
                          <div 
                            key={index}
                            className={`flex flex-col items-center p-4 rounded-xl min-w-[80px] ${isNow ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'}`}
                          >
                            <span className="text-sm font-medium mb-2">
                              {isNow ? 'Now' : `${hour}:00`}
                            </span>
                            {getWeatherIcon(weatherData.hourly.weather_code[index], hour >= 6 && hour < 18)}
                            <span className="text-lg font-bold mt-2">
                              {Math.round(weatherData.hourly.temperature_2m[index])}°
                            </span>
                            <div className="flex items-center gap-1 mt-2 text-xs text-blue-500">
                              <Umbrella className="h-3 w-3" />
                              {weatherData.hourly.precipitation_probability[index]}%
                            </div>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Droplets className="h-3 w-3" />
                              {weatherData.hourly.relative_humidity_2m[index]}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
};

export default Weather;
