import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageShellProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backLabel?: string;
  onBack?: () => void;
  width?: "default" | "wide" | "narrow";
  children: ReactNode;
}

const widthClass = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-[1600px]",
};

export const PageShell = ({
  title,
  subtitle,
  actions,
  backLabel,
  onBack,
  width = "default",
  children,
}: PageShellProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-notebook">
      <Navbar />
      <main className={cn("container mx-auto px-4 pb-16 pt-24 sm:px-6", widthClass[width])}>
        {(title || actions || backLabel) && (
          <header className="mb-8">
            {backLabel && (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 mb-2 text-muted-foreground hover:text-foreground"
                onClick={onBack ?? (() => navigate(-1))}
              >
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Button>
            )}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {title && (
                  <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
                )}
                {subtitle && <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>}
              </div>
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
          </header>
        )}
        {children}
      </main>
    </div>
  );
};

export const PageLoader = ({ label = "Загрузка..." }: { label?: string }) => (
  <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin" />
    <span className="text-sm">{label}</span>
  </div>
);
