'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback UI. Receives the error and a reset callback. */
  fallback?: (error: Error | null, reset: () => void) => React.ReactNode;
}

/**
 * React class-based Error Boundary.
 * Catches unhandled render errors in child components and shows a fallback UI
 * instead of crashing the entire page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to the browser console for debugging. Replace with a
    // production error-reporting service (e.g. Sentry) as needed.
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback(error, this.handleReset);
      }

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              Something went wrong
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error?.message ?? 'An unexpected error occurred.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
          >
            Try again
          </Button>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
