import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Changing this key resets any caught error state (e.g. switching tabs or trips). */
  resetKey?: string | number | null;
  /** "app" renders a full-viewport Liquid Glass screen; "tab" renders an in-tab card. */
  scope?: "app" | "tab";
  title?: string;
  description?: string;
  retryLabel?: string;
  detailsLabel?: string;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Caught rendering error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const {
      scope = "tab",
      title,
      description,
      retryLabel,
      detailsLabel,
    } = this.props;

    const resolvedTitle =
      title ||
      (scope === "app"
        ? "應用程式發生預期外的錯誤 / Something went wrong"
        : "此區塊暫時無法顯示 / This section hit a snag");
    const resolvedDesc =
      description ||
      "別擔心，您的旅程資料仍安全儲存在雲端。請點擊下方按鈕重試。";
    const resolvedRetry = retryLabel || "重試 / Try Again";
    const resolvedDetails = detailsLabel || "錯誤詳情";

    const containerClass =
      scope === "app"
        ? "min-h-screen flex items-center justify-center p-6 bg-[#FBFBFD] dark:bg-[#060709] text-slate-900 dark:text-slate-100"
        : "py-12 sm:py-16 px-4 flex items-center justify-center";

    return (
      <div
        role="alert"
        data-testid="error-boundary-fallback"
        data-error-scope={scope}
        className={containerClass}
      >
        <div className="w-full max-w-md ios27-card rounded-[28px] p-6 sm:p-8 text-center border border-black/[0.06] dark:border-white/[0.12] bg-white/85 dark:bg-[#14161D]/85 backdrop-blur-2xl shadow-xl space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <AlertTriangle size={26} />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {resolvedTitle}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              {resolvedDesc}
            </p>
          </div>

          {this.state.error?.message && (
            <div className="rounded-2xl px-3.5 py-2.5 bg-slate-100/80 dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                {resolvedDetails}
              </div>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 break-words line-clamp-3">
                {this.state.error.message}
              </p>
            </div>
          )}

          <div className="pt-1 flex justify-center">
            <button
              type="button"
              data-testid="error-boundary-retry-btn"
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-sm whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw size={15} className="shrink-0" />
              <span>{resolvedRetry}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
