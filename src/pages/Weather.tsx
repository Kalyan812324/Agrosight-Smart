import { useState } from "react";
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
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WeatherData {
  location: {
    name: string;
    lat: number;
    lon: number;
  };
  current: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
    wind_speed: number;
    clouds: number;
    weather: {
      description: string;
      icon: string;
    };
    sunrise: number;
    sunset: number;
  };
  forecast: {
    daily: Array<{
      date: string;
      temp_max: number;
      temp_min: number;
      weather: string;
      rain_probability: number;
    }>;
    hourly: Array<{
      time: string;
      temp: number;
      humidity: number;
      rain_probability: number;
    }>;
  };
  agricultural_insights: {
    irrigation: {
      priority: string;
      recommendation: string;
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
  };
  optimal_activities: string[];
  warnings?: string[];
}

const Weather = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState(false);
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const { toast } = useToast();

  const fetchWeather = async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://xllpedrhhzoljkfvkgef.supabase.co/functions/v1/get-weather",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ latitude, longitude }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch weather data");
      }

      const data = await response.json();
      setWeatherData(data);
      toast({
        title: "Weather data updated",
        description: "Successfully fetched latest weather information",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch weather data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Please enter coordinates manually",
        variant: "destructive",
      });
      setManualInput(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeather(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        toast({
          title: "Location permission denied",
          description: "Please enter coordinates manually",
          variant: "destructive",
        });
        setManualInput(true);
      }
    );
  };

  const handleManualSubmit = () => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      toast({
        title: "Invalid coordinates",
        description: "Please enter valid latitude and longitude",
        variant: "destructive",
      });
      return;
    }

    fetchWeather(latitude, longitude);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Smart Weather Forecast
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Real-time weather predictions for better farming decisions
          </p>
          
          {!weatherData && (
            <Button
              onClick={getCurrentLocation}
              disabled={loading}
              variant="hero"
              size="lg"
              className="mb-4"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading Weather...
                </>
              ) : (
                <>
                  <Cloud className="mr-2 h-5 w-5" />
                  Get Current Weather
                </>
              )}
            </Button>
          )}

          {manualInput && !weatherData && (
            <Card className="max-w-md mx-auto p-6 mt-4">
              <h3 className="text-lg font-semibold mb-4">Enter Location Manually</h3>
              <div className="space-y-4">
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full px-4 py-2 rounded-md border border-border bg-background"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  className="w-full px-4 py-2 rounded-md border border-border bg-background"
                />
                <Button onClick={handleManualSubmit} className="w-full" variant="hero">
                  Get Weather
                </Button>
              </div>
            </Card>
          )}
        </div>

        {weatherData && (
          <div className="space-y-8 animate-fade-in">
            {/* Refresh Button */}
            <div className="flex justify-end">
              <Button
                onClick={() => fetchWeather(weatherData.location.lat, weatherData.location.lon)}
                disabled={loading}
                variant="outline"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh Weather
              </Button>
            </div>

            {/* Current Weather Card */}
            <Card className="p-6 bg-gradient-primary text-primary-foreground">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-5 w-5" />
                    <h2 className="text-2xl font-bold">{weatherData.location.name}</h2>
                  </div>
                  <p className="text-sm opacity-90">
                    {weatherData.location.lat.toFixed(2)}°, {weatherData.location.lon.toFixed(2)}°
                  </p>
                </div>
                <Sun className="h-12 w-12" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-6xl font-bold mb-2">
                    {Math.round(weatherData.current.temp)}°C
                  </div>
                  <p className="text-lg opacity-90">
                    Feels like {Math.round(weatherData.current.feels_like)}°C
                  </p>
                  <p className="text-xl mt-2 capitalize">
                    {weatherData.current.weather.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-80">Humidity</p>
                      <p className="font-semibold">{weatherData.current.humidity}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wind className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-80">Wind</p>
                      <p className="font-semibold">{weatherData.current.wind_speed} m/s</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gauge className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-80">Pressure</p>
                      <p className="font-semibold">{weatherData.current.pressure} hPa</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    <div>
                      <p className="text-sm opacity-80">Clouds</p>
                      <p className="font-semibold">{weatherData.current.clouds}%</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 mt-6 pt-6 border-t border-primary-foreground/20">
                <div className="flex items-center gap-2">
                  <Sunrise className="h-5 w-5" />
                  <div>
                    <p className="text-sm opacity-80">Sunrise</p>
                    <p className="font-semibold">{formatTime(weatherData.current.sunrise)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Sunset className="h-5 w-5" />
                  <div>
                    <p className="text-sm opacity-80">Sunset</p>
                    <p className="font-semibold">{formatTime(weatherData.current.sunset)}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Weather Warnings */}
            {weatherData.warnings && weatherData.warnings.length > 0 && (
              <div className="space-y-2">
                {weatherData.warnings.map((warning, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Agricultural Insights */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Agricultural Insights</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 bg-blue-500/10 border-blue-500/20">
                  <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Irrigation Status</h3>
                  <p className="text-sm font-medium mb-1">
                    Priority: {weatherData.agricultural_insights.irrigation.priority}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {weatherData.agricultural_insights.irrigation.recommendation}
                  </p>
                </Card>

                <Card className="p-4 bg-orange-500/10 border-orange-500/20">
                  <h3 className="font-semibold text-orange-600 dark:text-orange-400 mb-2">Crop Stress</h3>
                  <p className="text-sm font-medium mb-1">
                    Level: {weatherData.agricultural_insights.crop_stress.level}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {weatherData.agricultural_insights.crop_stress.details}
                  </p>
                </Card>

                <Card className="p-4 bg-red-500/10 border-red-500/20">
                  <h3 className="font-semibold text-red-600 dark:text-red-400 mb-2">Pest Risk</h3>
                  <p className="text-sm font-medium mb-1">
                    Level: {weatherData.agricultural_insights.pest_risk.level}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {weatherData.agricultural_insights.pest_risk.details}
                  </p>
                </Card>

                <Card className="p-4 bg-purple-500/10 border-purple-500/20">
                  <h3 className="font-semibold text-purple-600 dark:text-purple-400 mb-2">Disease Risk</h3>
                  <p className="text-sm font-medium mb-1">
                    Level: {weatherData.agricultural_insights.disease_risk.level}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {weatherData.agricultural_insights.disease_risk.details}
                  </p>
                </Card>
              </div>
            </div>

            {/* Optimal Activities */}
            {weatherData.optimal_activities && weatherData.optimal_activities.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Optimal Activities Today</h2>
                <div className="flex flex-wrap gap-2">
                  {weatherData.optimal_activities.map((activity, index) => (
                    <Badge key={index} variant="secondary" className="bg-accent text-accent-foreground">
                      {activity}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 7-Day Forecast */}
            <div>
              <h2 className="text-2xl font-bold mb-4">7-Day Forecast</h2>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {weatherData.forecast.daily.map((day, index) => (
                  <Card key={index} className="min-w-[150px] p-4 text-center">
                    <p className="font-semibold mb-2">{formatDate(day.date)}</p>
                    <CloudRain className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="text-sm text-muted-foreground mb-2 capitalize">{day.weather}</p>
                    <div className="flex justify-center gap-2 text-sm">
                      <span className="font-semibold">{Math.round(day.temp_max)}°</span>
                      <span className="text-muted-foreground">{Math.round(day.temp_min)}°</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Rain: {day.rain_probability}%
                    </p>
                  </Card>
                ))}
              </div>
            </div>

            {/* Hourly Forecast */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Hourly Forecast (Next 24 Hours)</h2>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left">Time</th>
                        <th className="px-4 py-3 text-left">Temperature</th>
                        <th className="px-4 py-3 text-left">Humidity</th>
                        <th className="px-4 py-3 text-left">Rain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weatherData.forecast.hourly.map((hour, index) => (
                        <tr key={index} className="border-t border-border">
                          <td className="px-4 py-3">{hour.time}</td>
                          <td className="px-4 py-3">{Math.round(hour.temp)}°C</td>
                          <td className="px-4 py-3">{hour.humidity}%</td>
                          <td className="px-4 py-3">{hour.rain_probability}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Weather;
