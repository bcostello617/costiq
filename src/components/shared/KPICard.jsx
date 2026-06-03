import { cn } from '@/lib/utils';

export default function KPICard({ title, value, subtitle, icon: Icon, trend, trendLabel, className }) {
  const isPositive = trend > 0;
  const isNegative = trend < 0;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-lg",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className={cn(
            "text-xs font-semibold",
            isPositive && "text-green-600 dark:text-green-400",
            isNegative && "text-red-500",
            !isPositive && !isNegative && "text-muted-foreground"
          )}>
            {isPositive ? '↑' : isNegative ? '↓' : '→'} {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && <span className="text-xs text-muted-foreground">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}