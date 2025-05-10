'use client';

import { useState, useEffect } from 'react'; // Import useState, useEffect
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button'; // Import ShadCN Button
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { TrendingUp, BarChart, LayoutDashboard } from 'lucide-react';
import LoginModal from '@/components/login/login-modal'; // Import the LoginModal component
import { useToast } from '@/hooks/use-toast'; // Import useToast for other potential uses

const LandingPage = () => {
  const router = useRouter();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false); // State for modal visibility
  const { toast } = useToast(); // Initialize toast if needed elsewhere
  const [clientTime, setClientTime] = useState<string | null>(null); // State for client-side time

  useEffect(() => {
    // Get client-side time on mount to avoid hydration issues if displaying current year
    setClientTime(new Date().toLocaleTimeString());
  }, []);

  const handlePrismButtonClick = () => {
    // Instead of navigating directly, open the login modal
    setIsLoginModalOpen(true);
  };

  // Function to handle successful login (passed to the modal)
  const handleSuccessfulLogin = () => {
    setIsLoginModalOpen(false); // Close the modal first
    // The LoginModal will handle showing "Logging in..."
    // The dashboard page will handle showing "Loading project data..."
    // and "Login Successful" upon successful data fetch.
    router.push('/prism'); // Navigate to the main app page after successful login
  };

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground md:p-8">
        {/* Hero Section */}
        <section className="mb-16 w-full max-w-4xl text-center">
          <h1 className="mb-4 bg-gradient-to-r from-primary via-blue-500 to-accent bg-clip-text text-4xl font-bold text-transparent md:text-6xl">
            Projects Prism
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Streamline your Agile reporting. Gain insights into sprint velocity,
            burndown progress, and developer statistics with intuitive
            visualizations.
          </p>
          <Button
            size="lg"
            onClick={handlePrismButtonClick}
            className="shadow-lg"
          >
            Go to Prism Dashboard
            <LayoutDashboard className="ml-2 h-5 w-5" />
          </Button>
        </section>

        {/* Features Section (Optional) */}
        <section className="grid w-full max-w-5xl grid-cols-1 gap-8 text-center md:grid-cols-3">
          <Card className="transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="mx-auto w-fit rounded-full bg-primary/10 p-3">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="mt-4">Velocity Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Monitor team velocity across sprints to understand capacity and
                predictability.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="mx-auto w-fit rounded-full bg-primary/10 p-3">
                <BarChart className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="mt-4">Burndown Charts</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Visualize sprint progress with clear burndown charts for points
                and tasks.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="mx-auto w-fit rounded-full bg-primary/10 p-3">
                <LayoutDashboard className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="mt-4">Comprehensive Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Get a complete overview of your projects, sprints, and backlog
                in one place.
              </CardDescription>
            </CardContent>
          </Card>
        </section>

        {/* Footer can be part of the layout if needed */}
        <footer className="mt-16 text-center text-sm text-muted-foreground">
          © {clientTime ? new Date().getFullYear() : 'Loading year...'} Project
          Prism. All rights reserved.
        </footer>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onOpenChange={setIsLoginModalOpen}
        onLoginSuccess={handleSuccessfulLogin}
      />
    </>
  );
};

export default LandingPage;
