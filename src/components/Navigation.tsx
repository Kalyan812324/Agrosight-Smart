import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Sprout, BarChart3, Calculator, TrendingUp, Cloud, Wallet, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated, signOut, loading } = useAuth();
  
  const navItems = [
    { href: "/", label: "Home", icon: Sprout, protected: false },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3, protected: true },
    { href: "/weather", label: "Weather", icon: Cloud, protected: true },
    { href: "/yield-predictor", label: "Yield Predictor", icon: TrendingUp, protected: true },
    { href: "/market-forecast", label: "Market", icon: BarChart3, protected: true },
    { href: "/loan-calculator", label: "Loans", icon: Calculator, protected: true },
    { href: "/expense-analyzer", label: "Profit Analyzer", icon: Wallet, protected: true },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign out',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Signed Out',
        description: 'You have been signed out successfully'
      });
      navigate('/');
    }
    setIsOpen(false);
  };

  // Filter nav items based on auth status
  const visibleItems = navItems.filter(item => !item.protected || isAuthenticated);

  return (
    <nav className="bg-card/95 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="bg-gradient-primary p-2 rounded-lg group-hover:shadow-glow transition-shadow">
              <Sprout className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary">AgroSight</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Auth Button */}
            {!loading && (
              isAuthenticated ? (
                <div className="flex items-center space-x-2 ml-4">
                  <span className="text-sm text-muted-foreground hidden lg:inline">
                    <User className="h-4 w-4 inline mr-1" />
                    {user?.email?.split('@')[0]}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    className="flex items-center space-x-1"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </Button>
                </div>
              ) : (
                <Link to="/auth">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex items-center space-x-1 ml-4"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Sign In</span>
                  </Button>
                </Link>
              )
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden bg-card border-t border-border">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Mobile Auth */}
            {!loading && (
              isAuthenticated ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-destructive hover:bg-destructive/10 w-full"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sign Out ({user?.email?.split('@')[0]})</span>
                </button>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-primary hover:bg-primary/10"
                >
                  <LogIn className="h-5 w-5" />
                  <span>Sign In</span>
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
