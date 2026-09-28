import { Component, type ReactNode } from "react";

// Catches a page that fails to load or render. The usual cause is a new
// deploy while the site is open: the old page's code files are gone, so
// opening a section for the first time fails until the page is reloaded.
export default class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const stale = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(this.state.error.message);
    return (
      <div className="rounded-lg border border-slate-300 bg-white px-5 py-8 text-center">
        <p className="text-sm font-semibold text-slate-900">
          {stale ? "The site was updated since you opened it." : "Something went wrong loading this page."}
        </p>
        <p className="mt-1 text-xs text-slate-500">Reload to get the latest version. Nothing you saved is lost.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Reload
        </button>
      </div>
    );
  }
}
