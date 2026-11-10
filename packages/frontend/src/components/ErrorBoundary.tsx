import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  // What failed, for the message shown to the user, e.g. "This demo".
  label: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches errors thrown while rendering its children (including a lazy()
// chunk that fails to load) and shows a fallback instead of letting React
// unmount the whole app (see D-026).
//
// This has to be a class: React has no hook equivalent for error boundaries.
//
// It does NOT catch errors in event handlers, async code (a rejected fetch,
// setTimeout), or in the boundary itself. Those still need their own
// try/catch, as Demo.tsx does for its API calls.
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  // Runs during rendering: switches this boundary to the fallback.
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  // Runs after the commit: the place for side effects such as logging. There
  // is no error-reporting service yet, so this is console only.
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error === null) return this.props.children;

    // The button reloads the page instead of resetting the boundary, on
    // purpose: React memoizes a rejected lazy() import, so re-rendering
    // after a failed chunk load (flaky network, or a deploy that replaced the
    // file) rethrows the same error forever. Only a reload recovers it. A
    // reload also fixes ordinary render errors, so one button covers both.
    //
    // The error message is for the console, not for users: React and library
    // messages are written for developers.
    return (
      <div className="error-boundary" role="alert">
        <p>{this.props.label} could not be shown.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}
