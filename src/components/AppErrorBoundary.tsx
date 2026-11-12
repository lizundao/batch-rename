import { Component, type ErrorInfo, type ReactNode } from "react";
import { useI18n } from "../context/I18nContext";
import type { MessageKey } from "../i18n";

type TranslateFn = (key: MessageKey, ...args: (number | string)[]) => string;

interface InnerProps {
  children: ReactNode;
  tr: TranslateFn;
}

interface InnerState {
  error: Error | null;
}

class ErrorBoundaryInner extends Component<InnerProps, InnerState> {
  state: InnerState = { error: null };

  static getDerivedStateFromError(error: Error): InnerState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("界面渲染异常", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="app-error-boundary" role="alert">
        <h2>{this.props.tr("errorBoundaryTitle")}</h2>
        <p className="app-error-detail">{error.message}</p>
        <p>{this.props.tr("errorBoundaryHint")}</p>
        <button type="button" onClick={() => this.setState({ error: null })}>
          {this.props.tr("errorBoundaryRetry")}
        </button>
      </div>
    );
  }
}

/** 任何渲染异常都降级为可重试的提示页，而不是整窗白屏。 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { tr } = useI18n();
  return <ErrorBoundaryInner tr={tr}>{children}</ErrorBoundaryInner>;
}
