export type RuntimeChartRow = {
  bucketStart: string;
  label: string;
  [key: string]: string | number;
};

export type RuntimeLineChartData = {
  rows: RuntimeChartRow[];
  seriesKeys: string[];
};

export type RuntimeChartsData = {
  eventChart: RuntimeLineChartData;
  outputChart: RuntimeLineChartData;
};
