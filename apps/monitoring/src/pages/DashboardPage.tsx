import { useState } from 'react';

import {
  useComponentCounts,
  useInstanceStats,
  useRecentFaults,
  useStatsTimeSeries,
  type StatsTimeRange,
} from '@monitoring/modules/dashboard/api/dashboard-queries';
import { ActivityChart } from '@monitoring/modules/dashboard/components/ActivityChart';
import { ComponentCountsSection } from '@monitoring/modules/dashboard/components/ComponentCountsSection';
import { InstanceDistSection } from '@monitoring/modules/dashboard/components/InstanceDistSection';
import { RecentFaultsSection } from '@monitoring/modules/dashboard/components/RecentFaultsSection';
import { config } from '@monitoring/shared/config/config';
import { useGlobalTimeRange, buildTimeRangeFilter } from '@monitoring/shared/time-range';

export function DashboardPage() {
  const [timeRange, setTimeRange] = useState<StatsTimeRange>('24h');
  const { resolved } = useGlobalTimeRange();

  const filter = buildTimeRangeFilter(resolved);
  const statsQuery = useInstanceStats(filter);
  const timeSeriesQuery = useStatsTimeSeries(timeRange);
  const faultsQuery = useRecentFaults();
  const countsQuery = useComponentCounts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {config.domain} · real-time instance overview
        </p>
      </div>

      <ComponentCountsSection
        data={countsQuery.data}
        isLoading={countsQuery.isLoading}
      />

      <InstanceDistSection
        data={statsQuery.data}
        isLoading={statsQuery.isLoading}
        rangeLabel={resolved.label}
      />

      <ActivityChart
        data={timeSeriesQuery.data}
        isLoading={timeSeriesQuery.isLoading}
        range={timeRange}
        onRangeChange={setTimeRange}
      />

      <RecentFaultsSection
        data={faultsQuery.data}
        isLoading={faultsQuery.isLoading}
      />
    </div>
  );
}
