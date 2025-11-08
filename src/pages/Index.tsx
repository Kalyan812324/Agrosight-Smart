import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, Calculator, Shield, Smartphone, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-agriculture.jpg";

const Index = () => {
  const features = [
    {
      icon: TrendingUp,
      title: "AI Crop Yield Predictor",
      description: "Get accurate predictions using machine learning algorithms trained on agricultural data"
    },
    {
      icon: BarChart3,
      title: "Market Price Forecaster",
      description: "Forecast market prices for the next 7-15 days to optimize your selling strategy"
    },
    {
      icon: Calculator,
      title: "Smart Loan Calculator",
      description: "Calculate EMI, compare interest rates, and plan your agricultural financing"
    },
    {
      icon: Shield,
      title: "Data-Driven Insights",
      description: "Make informed decisions based on comprehensive agricultural analytics"
    },
    {
      icon: Smartphone,
      title: "Mobile Optimized",
      description: "Access AgroSight from anywhere with our responsive web application"
    },
    {
      icon: Globe,
      title: "Multilingual Support",
      description: "Available in multiple languages to serve farmers across different regions"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={heroImage} 
            alt="Modern agriculture with technology" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-hero/90"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-bold text-primary mb-6 leading-tight">
              Smart Farming with
              <span className="block bg-gradient-primary bg-clip-text text-transparent">
                AgroSight AI
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Empower your farming decisions with AI-powered crop yield predictions, 
              market price forecasts, and intelligent loan planning tools.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button variant="hero" size="lg" className="text-lg px-8 py-3" asChild>
                <Link to="/auth">Start Smart Farming</Link>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-3" asChild>
                <Link to="/yield-predictor">Try Yield Predictor</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">
              Comprehensive Agricultural Intelligence
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From yield predictions to market insights, AgroSight provides everything 
              you need for data-driven farming success.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="bg-gradient-card border-0 shadow-card hover:shadow-glow transition-all duration-300 animate-slide-up group">
                  <CardHeader>
                    <div className="bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="text-xl font-semibold group-hover:text-primary transition-colors">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
            Ready to Transform Your Farming?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Join thousands of farmers who are already using AgroSight to increase 
            productivity and profitability through smart agricultural decisions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="secondary" size="lg" className="text-lg px-8 py-3" asChild>
              <Link to="/auth">Get Started Now</Link>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-3 bg-white/10 border-white/20 text-primary-foreground hover:bg-white/20" asChild>
              <Link to="/market-forecast">View Demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
