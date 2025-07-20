import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, Calculator, Upload, Sprout, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const features = [
    {
      title: "Crop Yield Predictor",
      description: "Get AI-powered predictions for your crop yields based on soil, weather, and farming data",
      icon: TrendingUp,
      href: "/yield-predictor",
      color: "text-green-600"
    },
    {
      title: "Market Price Forecaster",
      description: "Forecast market prices for the next 7-15 days to plan your sales strategy",
      icon: BarChart3,
      href: "/market-forecast",
      color: "text-blue-600"
    },
    {
      title: "Loan Calculator",
      description: "Calculate EMI, compare interest rates, and plan your agricultural loans",
      icon: Calculator,
      href: "/loan-calculator",
      color: "text-purple-600"
    }
  ];

  const quickStats = [
    { label: "Active Predictions", value: "12", icon: Sprout },
    { label: "Avg. Yield Accuracy", value: "94%", icon: TrendingUp },
    { label: "Market Alerts", value: "3", icon: BarChart3 },
    { label: "Savings Potential", value: "₹25K", icon: DollarSign }
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            Welcome to AgroSight Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Your smart farming companion for data-driven agricultural decisions
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {quickStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="bg-gradient-card border-0 shadow-card hover:shadow-glow transition-all duration-300">
                <CardContent className="flex items-center p-6">
                  <div className="bg-primary/10 p-3 rounded-lg mr-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="bg-gradient-card border-0 shadow-card hover:shadow-glow transition-all duration-300 group">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Icon className={`h-8 w-8 ${feature.color}`} />
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={feature.href}>Try Now</Link>
                    </Button>
                  </div>
                  <CardTitle className="text-xl font-semibold group-hover:text-primary transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base mb-4">
                    {feature.description}
                  </CardDescription>
                  <Button variant="hero" className="w-full" asChild>
                    <Link to={feature.href}>Get Started</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Upload Section */}
        <Card className="bg-gradient-card border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-6 w-6 text-primary" />
              <span>Quick Data Upload</span>
            </CardTitle>
            <CardDescription>
              Upload your CSV files for batch predictions and analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="h-12 w-12 text-primary mx-auto mb-4" />
              <p className="text-lg font-medium text-primary mb-2">
                Drop your CSV files here or click to browse
              </p>
              <p className="text-muted-foreground mb-4">
                Supports crop data, weather data, and market price files
              </p>
              <Button variant="outline">
                Choose Files
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;