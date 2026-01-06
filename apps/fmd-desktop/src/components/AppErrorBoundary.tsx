import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

const isDev = import.meta.env.DEV;

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App crashed during render", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    const { error, errorInfo } = this.state;
    if (!error) {
      return this.props.children;
    }

    const stack =
      (error && error.stack ? error.stack : "") ||
      (errorInfo?.componentStack ? errorInfo.componentStack : "");

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
          background: "#F7F5F2",
          color: "#1B1B1B",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        <div style={{ maxWidth: 760, width: "100%" }}>
          <h1 style={{ marginBottom: 12, fontSize: 20 }}>
            App failed to render
          </h1>
          <p style={{ marginBottom: 16 }}>
            An unexpected error occurred during startup. Check the console for
            details.
          </p>
          <div
            style={{
              padding: "12px 16px",
              border: "1px solid #E0DCD4",
              borderRadius: 8,
              background: "#FFFFFF",
              wordBreak: "break-word",
              marginBottom: isDev && stack ? 16 : 0,
            }}
          >
            {error.message || String(error)}
          </div>
          {isDev && stack ? (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "#111827",
                color: "#F9FAFB",
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {stack.trim()}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}
