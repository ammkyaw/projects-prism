
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Using Inter for a clean, modern font
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster
import { ThemeProvider } from "@/components/theme-provider"; // Import ThemeProvider

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Project Prism',
  description: 'Agile sprint reports including velocity, burndown, and developer stats.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning> {/* suppressHydrationWarning for next-themes */}
      <body className={`${inter.className} antialiased flex flex-col min-h-screen`}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
          {/* Header can be part of the page or a shared component */}
          <main className="flex-1"> {/* Wrap main content */}
            {children}
          </main>
          {/* Footer can be part of the page or a shared component */}
          <Toaster /> {/* Add Toaster component */}
        </ThemeProvider>
      </body>
    </html>
  );
}
