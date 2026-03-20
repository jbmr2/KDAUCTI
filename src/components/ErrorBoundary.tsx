import React, { ErrorInfo, ReactNode } from 'react';
import { DatabaseErrorInfo } from '../types';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorInfo: DatabaseErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: any): State {
    try {
      const errorInfo = JSON.parse(error.message) as DatabaseErrorInfo;
      return { hasError: true, errorInfo };
    } catch {
      return { hasError: true, errorInfo: null };
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-4">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h2>
            <p className="text-zinc-400 mb-6">
              {this.state.errorInfo 
                ? `An error occurred during a ${this.state.errorInfo.operationType} operation on ${this.state.errorInfo.path}.`
                : "An unexpected error occurred. Please try refreshing the page."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
