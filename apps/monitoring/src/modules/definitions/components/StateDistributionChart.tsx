import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps } from 'recharts';
import { cn } from '@monitoring/shared/lib/utils';

export interface StateData {
  stateKey: string;
  total: number;
  active: number;
  busy: number;
  faulted: number;
}

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function CustomTooltip(props: any) {
  const { active, payload, label } = props;
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="font-mono text-sm font-semibold text-foreground mb-2">{label}</p>
      <div className="flex flex-col gap-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground">{entry.name}:</span>
            <span className="text-xs font-mono font-medium text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type ChartType = 'bar' | 'pie';

export function StateDistributionChart({
  states,
  chartType = 'bar',
  onChartTypeChange,
}: {
  states: StateData[];
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
}) {
  if (!states.length) {
    return <div className="text-sm text-muted-foreground">No state data available</div>;
  }

  // Transform data for chart
  const chartData = states.map((s) => ({
    name: s.stateKey,
    active: s.active,
    busy: s.busy,
    faulted: s.faulted,
    total: s.total,
  }));

  return (
    <div className="flex flex-col gap-3">
      {/* Chart type toggle */}
      {onChartTypeChange && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Chart Type:</span>
          <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-0.5">
            {(['bar', 'pie'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onChartTypeChange(type)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  chartType === type
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {type === 'bar' ? 'Bar Chart' : 'Pie Chart'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bar Chart */}
      {chartType === 'bar' && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
            <Legend />
            <Bar dataKey="active" stackId="a" fill="#3b82f6" name="Active" />
            <Bar dataKey="busy" stackId="a" fill="#f59e0b" name="Busy" />
            <Bar dataKey="faulted" stackId="a" fill="#ef4444" name="Faulted" />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Pie Chart */}
      {chartType === 'pie' && (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="total"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(entry) => (entry.value > 0 ? `${entry.name}: ${entry.value}` : '')}
              labelLine={false}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
