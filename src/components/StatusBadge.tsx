import { Badge } from "@/components/ui/badge";
import { statusMeta, type StatusDomain } from "@/lib/statuses";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  domain: StatusDomain;
  value?: string | null;
  className?: string;
}

export const StatusBadge = ({ domain, value, className }: StatusBadgeProps) => {
  if (!value) return null;
  const meta = statusMeta(domain, value);
  return (
    <Badge variant={meta.tone} className={cn("whitespace-nowrap", className)}>
      {meta.label}
    </Badge>
  );
};
