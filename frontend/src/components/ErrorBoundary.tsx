import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  onBack?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Card className="m-4 border-destructive/40 bg-destructive/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive text-lg">
              <AlertCircle className="h-5 w-5" />
              {this.props.fallbackTitle || "An unexpected error occurred"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground/80 font-medium">
              {this.state.error?.message || "Something went wrong while rendering this section."}
            </p>
            {this.state.error?.stack && (
              <pre className="p-3 bg-muted/80 rounded text-xs font-mono overflow-auto max-h-40 text-destructive/90 border">
                {this.state.error.stack}
              </pre>
            )}
            <div className="flex items-center gap-2 pt-2">
              {this.props.onBack && (
                <Button variant="default" size="sm" onClick={this.props.onBack}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Go Back
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={this.reset}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

