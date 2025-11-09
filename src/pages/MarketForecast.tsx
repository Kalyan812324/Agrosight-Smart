import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, TrendingUp, TrendingDown, Minus, Calendar, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MarketData {
  State: string;
  District: string;
  Market: string;
  Commodity: string;
  Variety: string;
  Grade: string;
  Arrival_Date: string;
  Min_Price: string;
  Max_Price: string;
  Modal_Price: string;
}

const MarketForecast = () => {
  const { toast } = useToast();
  const [selectedCrop, setSelectedCrop] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";
  const API_URL = `https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24?api-key=${API_KEY}&format=json&limit=1000`;

  const fetchMarketData = async () => {
    if (!selectedCrop) {
      toast({
        title: "Select a Crop",
        description: "Please select a crop to view market prices",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      
      if (data.records) {
        // Filter data by selected crop and state
        let filtered = data.records.filter((record: MarketData) => 
          record.Commodity.toLowerCase().includes(selectedCrop.toLowerCase())
        );

        if (selectedState && selectedState !== "all") {
          filtered = filtered.filter((record: MarketData) => 
            record.State.toLowerCase() === selectedState.toLowerCase()
          );
        }

        // Sort by date (most recent first)
        filtered.sort((a: MarketData, b: MarketData) => {
          const dateA = new Date(a.Arrival_Date.split('/').reverse().join('-'));
          const dateB = new Date(b.Arrival_Date.split('/').reverse().join('-'));
          return dateB.getTime() - dateA.getTime();
        });

        setMarketData(filtered.slice(0, 50)); // Show latest 50 records
        
        toast({
          title: "Data Loaded",
          description: `Found ${filtered.length} market price records for ${selectedCrop}`
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch market data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStats = () => {
    if (marketData.length === 0) return null;

    const prices = marketData.map(d => parseFloat(d.Modal_Price));
    const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const latestPrice = prices[0];

    // Calculate trend
    const recentPrices = prices.slice(0, 5);
    const olderPrices = prices.slice(5, 10);
    const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const olderAvg = olderPrices.reduce((a, b) => a + b, 0) / (olderPrices.length || 1);
    const trend = recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'stable';

    return { avgPrice, minPrice, maxPrice, latestPrice, trend };
  };

  const stats = getStats();

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            Real-Time Market Prices
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Live agricultural commodity prices from Government of India markets across the country.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Filters */}
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                <span>Market Data Filters</span>
              </CardTitle>
              <CardDescription>
                Select crop and state to view real market prices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Crop/Commodity</label>
                  <Select onValueChange={setSelectedCrop}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select crop" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rice">Rice</SelectItem>
                      <SelectItem value="Wheat">Wheat</SelectItem>
                      <SelectItem value="Maize">Maize</SelectItem>
                      <SelectItem value="Cotton">Cotton</SelectItem>
                      <SelectItem value="Onion">Onion</SelectItem>
                      <SelectItem value="Potato">Potato</SelectItem>
                      <SelectItem value="Tomato">Tomato</SelectItem>
                      <SelectItem value="Mataki">Mataki</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">State (Optional)</label>
                  <Select onValueChange={setSelectedState}>
                    <SelectTrigger>
                      <SelectValue placeholder="All states" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All States</SelectItem>
                      <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                      <SelectItem value="Punjab">Punjab</SelectItem>
                      <SelectItem value="Haryana">Haryana</SelectItem>
                      <SelectItem value="Karnataka">Karnataka</SelectItem>
                      <SelectItem value="Tamil Nadu">Tamil Nadu</SelectItem>
                      <SelectItem value="Andhra Pradesh">Andhra Pradesh</SelectItem>
                      <SelectItem value="Telangana">Telangana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button 
                    variant="hero" 
                    className="w-full" 
                    onClick={fetchMarketData}
                    disabled={isLoading}
                  >
                    {isLoading ? "Loading..." : "Get Market Prices"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          {stats && (
            <Card className="bg-gradient-card border-0 shadow-card">
              <CardHeader>
                <CardTitle>Price Statistics</CardTitle>
                <CardDescription>Based on {marketData.length} recent market records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-primary/5 p-4 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Latest Price</p>
                    <p className="text-2xl font-bold text-primary">₹{stats.latestPrice}</p>
                  </div>
                  <div className="bg-accent/10 p-4 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Average Price</p>
                    <p className="text-2xl font-bold">₹{stats.avgPrice}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Min Price</p>
                    <p className="text-2xl font-bold text-green-600">₹{stats.minPrice}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Max Price</p>
                    <p className="text-2xl font-bold text-red-600">₹{stats.maxPrice}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center space-x-2">
                  {getTrendIcon(stats.trend)}
                  <span className={`font-semibold ${getTrendColor(stats.trend)}`}>
                    {stats.trend === 'up' ? 'Prices trending upward' : stats.trend === 'down' ? 'Prices trending downward' : 'Prices stable'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Market Data Table */}
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-6 w-6 text-primary" />
                <span>Market Price Records</span>
              </CardTitle>
              <CardDescription>
                {marketData.length > 0 ? `Showing ${marketData.length} latest records` : "Select crop to view market data"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {marketData.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Select a crop and click "Get Market Prices" to view real market data
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>District</TableHead>
                        <TableHead>Market</TableHead>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Variety</TableHead>
                        <TableHead className="text-right">Min Price</TableHead>
                        <TableHead className="text-right">Max Price</TableHead>
                        <TableHead className="text-right">Modal Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketData.map((record, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{record.Arrival_Date}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span>{record.State}</span>
                            </div>
                          </TableCell>
                          <TableCell>{record.District}</TableCell>
                          <TableCell>{record.Market}</TableCell>
                          <TableCell className="font-medium">{record.Commodity}</TableCell>
                          <TableCell>{record.Variety}</TableCell>
                          <TableCell className="text-right text-green-600">₹{record.Min_Price}</TableCell>
                          <TableCell className="text-right text-red-600">₹{record.Max_Price}</TableCell>
                          <TableCell className="text-right font-bold">₹{record.Modal_Price}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MarketForecast;