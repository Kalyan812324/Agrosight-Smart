import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, PieChart, TrendingDown, IndianRupee, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const LoanCalculator = () => {
  const { toast } = useToast();
  const [loanData, setLoanData] = useState({
    amount: "",
    interestRate: "",
    tenure: "",
    loanType: ""
  });
  const [calculation, setCalculation] = useState(null);

  const loanTypes = [
    { name: "Crop Loan", rate: "7%" },
    { name: "Farm Equipment Loan", rate: "9.5%" },
    { name: "Land Purchase Loan", rate: "8.5%" },
    { name: "Irrigation Loan", rate: "8%" },
    { name: "Dairy Loan", rate: "7.5%" },
    { name: "Poultry Loan", rate: "8.5%" }
  ];

  const presetLoans = [
    { amount: 100000, rate: 7, tenure: 12, type: "Crop Loan" },
    { amount: 500000, rate: 9.5, tenure: 36, type: "Farm Equipment" },
    { amount: 1000000, rate: 8.5, tenure: 60, type: "Land Purchase" }
  ];

  const handleInputChange = (field, value) => {
    setLoanData(prev => ({ ...prev, [field]: value }));
  };

  const calculateEMI = () => {
    const { amount, interestRate, tenure } = loanData;
    
    if (!amount || !interestRate || !tenure) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const principal = parseFloat(amount);
    const monthlyRate = parseFloat(interestRate) / 100 / 12;
    const months = parseInt(tenure);

    // EMI calculation using the standard formula
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / 
                (Math.pow(1 + monthlyRate, months) - 1);
    
    const totalAmount = emi * months;
    const totalInterest = totalAmount - principal;
    
    // Simple interest calculation for comparison
    const simpleInterest = principal * (parseFloat(interestRate) / 100) * (months / 12);
    const simpleTotal = principal + simpleInterest;

    setCalculation({
      emi: Math.round(emi),
      totalAmount: Math.round(totalAmount),
      totalInterest: Math.round(totalInterest),
      principal: principal,
      simpleInterest: Math.round(simpleInterest),
      simpleTotal: Math.round(simpleTotal),
      savings: Math.round(simpleTotal - totalAmount), // Usually negative for compound
      monthlyBreakdown: generateMonthlyBreakdown(principal, monthlyRate, months, emi)
    });

    toast({
      title: "Calculation Complete",
      description: `EMI: ₹${Math.round(emi).toLocaleString()}/month`
    });
  };

  const generateMonthlyBreakdown = (principal, monthlyRate, months, emi) => {
    const breakdown = [];
    let remainingPrincipal = principal;

    for (let i = 1; i <= Math.min(months, 12); i++) { // Show first 12 months
      const interestPayment = remainingPrincipal * monthlyRate;
      const principalPayment = emi - interestPayment;
      remainingPrincipal -= principalPayment;

      breakdown.push({
        month: i,
        emi: Math.round(emi),
        principal: Math.round(principalPayment),
        interest: Math.round(interestPayment),
        balance: Math.round(remainingPrincipal)
      });
    }

    return breakdown;
  };

  const loadPresetLoan = (preset) => {
    setLoanData({
      amount: preset.amount.toString(),
      interestRate: preset.rate.toString(),
      tenure: preset.tenure.toString(),
      loanType: preset.type
    });
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-4">
            Smart Loan Calculator
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Calculate EMI, compare interest types, and plan your agricultural loans with detailed breakdowns.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-gradient-card border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calculator className="h-6 w-6 text-primary" />
                  <span>Loan Details</span>
                </CardTitle>
                <CardDescription>
                  Enter your loan requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loanType">Loan Type</Label>
                  <Select onValueChange={(value) => handleInputChange("loanType", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select loan type" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTypes.map(type => (
                        <SelectItem key={type.name} value={type.name}>
                          {type.name} ({type.rate})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Loan Amount (₹)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="e.g., 500000"
                    value={loanData.amount}
                    onChange={(e) => handleInputChange("amount", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interestRate">Interest Rate (% per annum)</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.1"
                    placeholder="e.g., 8.5"
                    value={loanData.interestRate}
                    onChange={(e) => handleInputChange("interestRate", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenure">Tenure (months)</Label>
                  <Input
                    id="tenure"
                    type="number"
                    placeholder="e.g., 36"
                    value={loanData.tenure}
                    onChange={(e) => handleInputChange("tenure", e.target.value)}
                  />
                </div>

                <Button variant="hero" className="w-full" onClick={calculateEMI}>
                  Calculate EMI
                </Button>
              </CardContent>
            </Card>

            {/* Preset Loans */}
            <Card className="bg-gradient-card border-0 shadow-card">
              <CardHeader>
                <CardTitle>Quick Presets</CardTitle>
                <CardDescription>Common agricultural loans</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {presetLoans.map((preset, index) => (
                  <Button 
                    key={index}
                    variant="outline" 
                    className="w-full justify-start text-left"
                    onClick={() => loadPresetLoan(preset)}
                  >
                    <div>
                      <p className="font-medium">{preset.type}</p>
                      <p className="text-sm text-muted-foreground">
                        ₹{preset.amount.toLocaleString()} • {preset.rate}% • {preset.tenure}m
                      </p>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* EMI Summary */}
            <Card className="bg-gradient-card border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <IndianRupee className="h-6 w-6 text-primary" />
                  <span>EMI Calculation</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!calculation ? (
                  <div className="text-center py-12">
                    <Calculator className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Enter loan details and click "Calculate EMI" to see results
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-primary/5 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Monthly EMI</p>
                      <p className="text-2xl font-bold text-primary">
                        ₹{calculation.emi.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="text-xl font-bold text-blue-600">
                        ₹{calculation.totalAmount.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Interest</p>
                      <p className="text-xl font-bold text-red-600">
                        ₹{calculation.totalInterest.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">Principal</p>
                      <p className="text-xl font-bold text-green-600">
                        ₹{calculation.principal.toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Interest Comparison */}
            {calculation && (
              <Card className="bg-gradient-card border-0 shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PieChart className="h-6 w-6 text-primary" />
                    <span>Interest Comparison</span>
                  </CardTitle>
                  <CardDescription>
                    Compound vs Simple Interest Analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-primary">Compound Interest (EMI)</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Principal:</span>
                          <span>₹{calculation.principal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Interest:</span>
                          <span>₹{calculation.totalInterest.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2">
                          <span>Total:</span>
                          <span>₹{calculation.totalAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-semibold text-blue-600">Simple Interest</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Principal:</span>
                          <span>₹{calculation.principal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Interest:</span>
                          <span>₹{calculation.simpleInterest.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2">
                          <span>Total:</span>
                          <span>₹{calculation.simpleTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Monthly Breakdown */}
            {calculation && (
              <Card className="bg-gradient-card border-0 shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-6 w-6 text-primary" />
                    <span>Monthly Breakdown (First 12 Months)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Month</th>
                          <th className="text-right p-2">EMI</th>
                          <th className="text-right p-2">Principal</th>
                          <th className="text-right p-2">Interest</th>
                          <th className="text-right p-2">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculation.monthlyBreakdown.map((month) => (
                          <tr key={month.month} className="border-b hover:bg-muted/50">
                            <td className="p-2">{month.month}</td>
                            <td className="text-right p-2">₹{month.emi.toLocaleString()}</td>
                            <td className="text-right p-2 text-green-600">₹{month.principal.toLocaleString()}</td>
                            <td className="text-right p-2 text-red-600">₹{month.interest.toLocaleString()}</td>
                            <td className="text-right p-2">₹{month.balance.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanCalculator;