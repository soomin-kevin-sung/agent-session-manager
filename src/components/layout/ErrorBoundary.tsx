import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React render error", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="dark flex h-screen min-h-[800px] w-screen min-w-[1280px] items-center justify-center bg-zinc-950 text-zinc-100">
          <div className="max-w-md rounded-md border border-red-900/60 bg-zinc-900 p-5 shadow-xl">
            <h1 className="text-base font-semibold text-red-300">
              App failed to render
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {this.state.error.message || "Check the developer console for details."}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
