import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RuntimeLineChartData } from './runtimeMonitorTypes';
import { useI18n } from '@/i18n';
import { formatRuntimeOutputType } from './runtimeOutputLabels';

type RuntimeStatsChartsProps = {
  eventChart: RuntimeLineChartData;
  outputChart: RuntimeLineChartData;
};

type TooltipPayloadItem = {
  color?: string;
  dataKey: string;
  value: number;
  payload?: Record<string, string | number>;
};

const COLORS = ['#2563eb', '#0f766e', '#7c3aed', '#ea580c', '#0891b2', '#dc2626'];

export function RuntimeStatsCharts({ eventChart, outputChart }: RuntimeStatsChartsProps) {
  const t = useI18n();

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <RuntimeLineChartCard
        title={t('monitor.charts.eventTitle')}
        description={t('monitor.charts.eventDescription')}
        data={eventChart}
      />
      <RuntimeLineChartCard
        title={t('monitor.charts.outputTitle')}
        description={t('monitor.charts.outputDescription')}
        data={outputChart}
        formatSeriesLabel={(key) => formatRuntimeOutputType(key, t)}
      />
    </div>
  );
}

function RuntimeLineChartCard({
  title,
  description,
  data,
  formatSeriesLabel
}: {
  title: string;
  description: string;
  data: RuntimeLineChartData;
  formatSeriesLabel?: (key: string) => string;
}) {
  const t = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.rows.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            {t('monitor.charts.empty')}
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip content={<RuntimeTooltip formatSeriesLabel={formatSeriesLabel} />} />
                {data.seriesKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={formatSeriesLabel?.(key) ?? key}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RuntimeTooltip({
  active,
  payload,
  label,
  formatSeriesLabel
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  formatSeriesLabel?: (key: string) => string;
}) {
  const t = useI18n();

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow">
      <p className="mb-2 font-medium">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => {
          const row = item.payload ?? {};
          const key = item.dataKey;
          const label = formatSeriesLabel?.(key) ?? key;
          return (
            <div key={key} className="grid gap-0.5">
              <span style={{ color: item.color }}>
                {label}: {item.value}
              </span>
              <span className="text-muted-foreground">
                {t('monitor.charts.successFailure', {
                  success: row[`${key}__success`] ?? 0,
                  failure: row[`${key}__failure`] ?? 0
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
