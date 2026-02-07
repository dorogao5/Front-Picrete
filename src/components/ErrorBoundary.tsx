import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Errors are captured by getDerivedStateFromError
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-6">
          <Card className="w-full max-w-lg p-8 text-center shadow-elegant">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">!</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Произошла ошибка</h1>
            <p className="text-muted-foreground mb-6">
              Что-то пошло не так. Нажмите «Перезагрузить» — страница обновится без кэша. Если ошибка повторится, нажмите Ctrl+Shift+R (или Cmd+Shift+R на Mac).
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("_", String(Date.now()));
                  window.location.replace(url.toString());
                }}
              >
                Перезагрузить
              </Button>
              <Button variant="outline" onClick={this.handleReset}>
                Попробовать снова
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
