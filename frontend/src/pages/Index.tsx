import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Users, Calendar, BarChart3 } from 'lucide-react';
import { COMPANY_NAME, APP_NAME, ROUTES } from '@/utils/constants';

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: "Employee Management",
      description: "Comprehensive employee records and information management",
      href: ROUTES.EMPLOYEES
    },
    {
      icon: Calendar,
      title: "Duty Scheduling",
      description: "Advanced duty chart management and scheduling system",
      href: ROUTES.DUTY_CHART
    },
    {
      icon: BarChart3,
      title: "Reports & Analytics",
      description: "Detailed insights and performance analytics",
      href: ROUTES.REPORTS
    }
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-12">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xl">
            NT
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold text-primary">{COMPANY_NAME}</h1>
            <p className="text-muted-foreground">{APP_NAME}</p>
          </div>
        </div>
        <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Streamline Your Workforce Management
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Efficiently manage duty assignments, employee schedules, and organizational workflows with our comprehensive management system.
        </p>
        <div className="flex gap-4 justify-center pt-6">
          <Button 
            size="lg" 
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="gap-2"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => navigate(ROUTES.DUTY_CHART)}
          >
            View Duty Chart
          </Button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {features.map((feature) => {
          const IconComponent = feature.icon;
          return (
            <Card 
              key={feature.title} 
              className="hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => navigate(feature.href)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
                <CardDescription className="pt-2">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between group-hover:bg-primary/5">
                  Learn More
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">127</div>
            <p className="text-sm text-muted-foreground">Total Employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-success">96%</div>
            <p className="text-sm text-muted-foreground">Coverage Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-accent">24</div>
            <p className="text-sm text-muted-foreground">Active Shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-warning">8</div>
            <p className="text-sm text-muted-foreground">Pending Requests</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
