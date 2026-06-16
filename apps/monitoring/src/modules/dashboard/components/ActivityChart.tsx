import { Button } from '@vnext-forge-studio/designer-ui/ui';
import type { StatsTimePoint } from '@monitoring/shared/types';
import type { StatsTimeRange } from '@monitoring/modules/dashboard/api/dashboard-queries';

interface ActivityChartProps {
  data: StatsTimePoint[] | undefined;
  isLoading: boolean;
  range: StatsTimeRange;
  onRangeChange: (r: StatsTimeRange) => void;
}

const CHART_H = 120;
const CHART_W = 600;
const PAD = { top: 10, right: 10, bottom: 24, left: 32 };

function toSvgPoints(values: number[], max: number, width: number, height: number): string {
  if (!values.length) return '';
  const step = width / (values.length - 1 || 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - (max > 0 ? (v / max) * height : 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function toAreaPath(values: number[], max: number, width: number, height: number): string {
  if (!values.length) return '';
  const step = width / (values.length - 1 || 1);
  const pts = values
    .map((v, i) => {
      const x = i * step;
      const y = height - (max > 0 ? (v / max) * height : 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' L ');
  return `M 0,${height} L ${pts} L ${width},${height} Z`;
}

export function ActivityChart({ data, isLoading, range, onRangeChange }: ActivityChartProps) {
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const activeVals = data?.map((p) => p.active) ?? [];
  const completedVals = data?.map((p) => p.completed) ?? [];
  const faultedVals = data?.map((p) => p.faulted) ?? [];
  const labels = data?.map((p) => p.label) ?? [];

  const maxVal = Math.max(...activeVals, ...completedVals, ...faultedVals, 1);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Instance Activity
        </h2>
        <div className="flex gap-1">
          {(['24h', '7d'] as const).map((r) => (
            <Button
              key={r}
              variant={range === r ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onRangeChange(r)}
              className="h-7 px-2.5 text-xs"
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        {/* Legend */}
        <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 opacity-70" /> Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Faulted
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
            Loading chart data…
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="w-full"
            style={{ height: CHART_H }}
          >
            <defs>
              <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <g transform={`translate(${PAD.left},${PAD.top})`}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <line
                  key={f}
                  x1="0"
                  y1={(innerH * (1 - f)).toFixed(1)}
                  x2={innerW}
                  y2={(innerH * (1 - f)).toFixed(1)}
                  stroke="currentColor"
                  strokeOpacity="0.08"
                  strokeWidth="1"
                />
              ))}

              {/* Active area */}
              {activeVals.length > 1 && (
                <path
                  d={toAreaPath(activeVals, maxVal, innerW, innerH)}
                  fill="url(#activeGrad)"
                />
              )}

              {/* Active line */}
              {activeVals.length > 1 && (
                <polyline
                  points={toSvgPoints(activeVals, maxVal, innerW, innerH)}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeOpacity="0.8"
                />
              )}

              {/* Completed dashed */}
              {completedVals.length > 1 && (
                <polyline
                  points={toSvgPoints(completedVals, maxVal, innerW, innerH)}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              )}

              {/* Faulted dots */}
              {faultedVals.map((v, i) => {
                const step = innerW / (faultedVals.length - 1 || 1);
                const cx = i * step;
                const cy = innerH - (maxVal > 0 ? (v / maxVal) * innerH : 0);
                return (
                  <circle
                    key={i}
                    cx={cx.toFixed(1)}
                    cy={cy.toFixed(1)}
                    r="3"
                    fill="#ef4444"
                    fillOpacity="0.8"
                  />
                );
              })}

              {/* X axis labels */}
              {labels.map((label, i) => {
                const step = innerW / (labels.length - 1 || 1);
                const showEvery = Math.ceil(labels.length / 8);
                if (i % showEvery !== 0 && i !== labels.length - 1) return null;
                return (
                  <text
                    key={i}
                    x={(i * step).toFixed(1)}
                    y={innerH + 16}
                    textAnchor="middle"
                    fontSize="10"
                    fill="currentColor"
                    fillOpacity="0.4"
                  >
                    {label}
                  </text>
                );
              })}
            </g>
          </svg>
        )}
      </div>
    </section>
  );
}
