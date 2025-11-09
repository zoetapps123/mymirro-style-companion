import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: any;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Log error details so we can see them in the console tool
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught an error:", { error, errorInfo });
    
    // Log to backend for customer visibility
    this.logErrorToBackend(error, errorInfo);
  }

  private async logErrorToBackend(error: any, errorInfo: any) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      );
      
      await supabase.functions.invoke('log-error', {
        body: {
          error_type: 'unhandled_error',
          error_message: error?.message || String(error),
          error_stack: error?.stack,
          context: {
            component_stack: errorInfo?.componentStack,
            user_agent: navigator.userAgent,
            viewport: { width: window.innerWidth, height: window.innerHeight },
          },
          url: window.location.href,
          session_id: sessionStorage.getItem('session_id') || undefined,
        },
      });
    } catch (logError) {
      // Silent fail - don't block error UI
      console.error('Failed to log error to backend:', logError);
    }
  }

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || String(this.state.error);
      const stack = this.state.error?.stack;
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-xl w-full text-center space-y-4">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The app hit an unexpected error. Please try reloading. If this persists, details are below for debugging.
            </p>
            {message && (
              <div className="text-left bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg p-3 overflow-auto max-h-60">
                <p className="text-sm font-medium">{message}</p>
                {stack && (
                  <pre className="mt-2 text-xs opacity-80 whitespace-pre-wrap">{stack}</pre>
                )}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-xl px-4 h-10 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow focus:outline-none"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}

export default ErrorBoundary;
