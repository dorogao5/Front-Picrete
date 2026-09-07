import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface InlineErrorProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}

export function InlineError({ title = "Не удалось загрузить данные", description, onRetry }: InlineErrorProps) {
  return (
    <Card className="border-destructive/30 p-6 text-center" role="alert">
      <AlertCircle className="mx-auto h-7 w-7 text-destructive" />
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4 gap-2" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Повторить
        </Button>
      )}
    </Card>
  );
}

