import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Keeps a preview failure (e.g. no WebGL) from blanking the whole app. */
export class PreviewErrorBoundary extends Component<{ children: ReactNode; resetKey?: unknown }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-2 p-4 text-center text-sm text-ink-300">
        <p>The preview couldn’t be shown.</p>
        <p className="text-xs text-ink-400">{this.state.error.message}</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="rounded border border-ink-700 px-2 py-1 text-xs hover:border-ink-500"
        >
          Try again
        </button>
      </div>
    );
  }
}
