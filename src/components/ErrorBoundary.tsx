import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface State {
  err: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error) {
    console.error("UI error:", err);
  }

  reset = () => this.setState({ err: null });

  render() {
    if (this.state.err) {
      return (
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <div className="glass rounded-2xl p-8 space-y-4">
            <h2 className="text-xl font-bold">Something broke</h2>
            <p className="text-sm text-base-content/70 font-mono break-words">
              {this.state.err.message}
            </p>
            <button className="btn btn-primary btn-sm gap-2" onClick={this.reset}>
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
