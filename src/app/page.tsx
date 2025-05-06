
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button'; // Import ShadCN Button
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, BarChart, LayoutDashboard } from 'lucide-react';

const LandingPage = () => {
  const router = useRouter();

  const handlePrismButtonClick = () => {
    router.push('/prism'); // Navigate to the main app page
  };

  return (
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
         {/* Image Removed */}
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
          © {new Date().getFullYear()} Project Prism. All rights reserved.
        </footer>
    </div>
  );
};

export default LandingPage;
