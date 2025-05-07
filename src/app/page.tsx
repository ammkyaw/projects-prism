'use client';

import { useState, useEffect } from 'react'; // Import useState, useEffect
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button'; // Import ShadCN Button
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, BarChart, LayoutDashboard } from 'lucide-react';
import LoginModal from '@/components/login-modal'; // Import the LoginModal component
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 md:p-8">

        {/* Hero Section */}
        <section className="text-center w-full max-w-4xl mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-blue-500 to-accent text-transparent bg-clip-text">
            Project Prism
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Streamline your Agile reporting. Gain insights into sprint velocity, burndown progress, and developer statistics with intuitive visualizations.
          </p>
          <Button size="lg" onClick={handlePrismButtonClick} className="shadow-lg">
            Go to Prism Dashboard
            <LayoutDashboard className="ml-2 h-5 w-5" />
          </Button>
        </section>

        {/* Features Section (Optional) */}
        <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="mt-4">Velocity Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Monitor team velocity across sprints to understand capacity and predictability.</CardDescription>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
                <BarChart className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="mt-4">Burndown Charts</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Visualize sprint progress with clear burndown charts for points and tasks.</CardDescription>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit">
                <LayoutDashboard className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="mt-4">Comprehensive Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Get a complete overview of your projects, sprints, and backlog in one place.</CardDescription>
            </CardContent>
          </Card>
        </section>

        {/* Footer can be part of the layout if needed */}
        <footer className="mt-16 text-center text-sm text-muted-foreground">
          © {clientTime ? new Date().getFullYear() : 'Loading year...'} Project Prism. All rights reserved.
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
