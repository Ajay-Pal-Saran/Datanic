import React from 'react';
import * as d3 from 'd3';
import {
  ColumnProfile,
  D3ChartType,
  DataRow,
  LinearRegressionResult,
  PairwiseCorrelation,
} from '../types/workspace';
import { parseDirtyNumeric } from '../utils/dataEngine';

interface BentoOverviewProps {
  rows: DataRow[];
  profiles: ColumnProfile[];
  correlations: PairwiseCorrelation[];
  regression: LinearRegressionResult;
  xColumn: string;
  yColumn: string;
  groupColumn: string;
  activeGroupFilter: string | null;
  onSelectGroupFilter: (grp: string | null) => void;
  onSelectCorrelationPair: (colA: string, colB: string) => void;
  onSelectChartType: (type: D3ChartType) => void;
}

const BENTO_COLORS = ['#71717A', '#A1A1AA', '#52525B', '#D4D4D8', '#3F3F46'];

export const BentoOverview: React.FC<BentoOverviewProps> = ({
  rows,
  profiles,
  correlations,
  regression,
  yColumn,
  groupColumn,
  activeGroupFilter,
  onSelectGroupFilter,
  onSelectCorrelationPair,
  onSelectChartType,
}) => {
  const grouped = d3.group(rows, (r) => String(r[groupColumn] ?? 'Default'));
  const cohortStats = Array.from(grouped.entries())
    .map(([key, items]) => {
      const nums = items
        .map((r) => parseDirtyNumeric(r[yColumn]).numericValue)
        .filter((v): v is number => v !== null);
      const meanVal = nums.length > 0 ? d3.mean(nums) ?? 0 : 0;
      return {
        key,
        count: items.length,
        meanVal: Number(meanVal.toFixed(1)),
        sharePct: rows.length > 0 ? Math.round((items.length / rows.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topNumCols = profiles
    .filter((p) => p.semanticType === 'numeric')
    .slice(0, 4)
    .map((p) => p.name);

  const getPairR = (a: string, b: string): number => {
    if (a === b) return 1;
    const match = correlations.find(
      (c) => (c.colA === a && c.colB === b) || (c.colA === b && c.colB === a)
    );
    return match ? match.r : 0;
  };

  const yProfile = profiles.find((p) => p.name === yColumn);
  const sparkVals = rows
    .slice(0, 24)
    .map((r) => parseDirtyNumeric(r[yColumn]).numericValue)
    .filter((v): v is number => v !== null);

  const sparkMin = d3.min(sparkVals) ?? 0;
  const sparkMax = d3.max(sparkVals) ?? 1;
  const sparkRange = sparkMax - sparkMin || 1;
  const sparkPoints = sparkVals
    .map((v, i) => {
      const x = sparkVals.length > 1 ? (i / (sparkVals.length - 1)) * 220 : 110;
      const y = 46 - ((v - sparkMin) / sparkRange) * 38;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0F1013] grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-white/[0.08] overflow-hidden">
      {/* Pane 1: Cohort Composition & Cross-Filter */}
      <div className="p-4 flex flex-col justify-between space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[12px] font-semibold text-zinc-900 dark:text-[#F4F5F8] truncate">
              Cohort Share ({groupColumn})
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-[#6E7480] truncate">
              Click segment to cross-filter canvas
            </p>
          </div>
          {activeGroupFilter && (
            <button
              type="button"
              onClick={() => onSelectGroupFilter(null)}
              className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        <div className="space-y-1">
          {cohortStats.map((item, idx) => {
            const isSel = activeGroupFilter === item.key;
            const color = BENTO_COLORS[idx % BENTO_COLORS.length];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectGroupFilter(isSel ? null : item.key)}
                className={`w-full text-left rounded px-2 py-1 transition-colors cursor-pointer ${
                  isSel
                    ? 'bg-zinc-200/80 dark:bg-white/[0.1] ring-1 ring-zinc-400 dark:ring-white/[0.24]'
                    : 'hover:bg-zinc-100/70 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1 gap-2">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {item.key}
                  </span>
                  <span className="font-mono tabular-nums text-zinc-500 dark:text-[#8A8F98] whitespace-nowrap shrink-0">
                    {item.count} ({item.sharePct}%) · avg {item.meanVal}
                  </span>
                </div>
                <div className="w-full h-1 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(6, item.sharePct)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pane 2: Restrained Pairwise Correlation Matrix */}
      <div className="p-4 flex flex-col justify-between space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[12px] font-semibold text-zinc-900 dark:text-[#F4F5F8] truncate">
              Correlation Matrix
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-[#6E7480] truncate">
              Click cell to plot OLS regression
            </p>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480] whitespace-nowrap shrink-0">
            Pearson r
          </span>
        </div>

        {topNumCols.length >= 2 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[10px] font-mono tabular-nums">
              <thead>
                <tr>
                  <th className="p-1 text-left text-zinc-400 dark:text-[#6E7480] font-normal">Dim</th>
                  {topNumCols.map((c) => (
                    <th
                      key={c}
                      className="p-1 text-center text-zinc-500 dark:text-[#8A8F98] font-medium truncate max-w-[54px]"
                      title={c}
                    >
                      {c.slice(0, 7)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topNumCols.map((rowCol) => (
                  <tr key={rowCol}>
                    <td
                      className="p-1 text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[64px]"
                      title={rowCol}
                    >
                      {rowCol.slice(0, 8)}
                    </td>
                    {topNumCols.map((colCol) => {
                      const r = getPairR(rowCol, colCol);
                      const absR = Math.abs(r);
                      const tone =
                        rowCol === colCol
                          ? 'bg-zinc-100 dark:bg-white/[0.03] text-zinc-400 dark:text-[#565B66]'
                          : r >= 0.5
                            ? 'bg-zinc-900/12 dark:bg-white/[0.16] text-zinc-950 dark:text-white border border-zinc-900/20 dark:border-white/[0.2]'
                            : r >= 0.2
                              ? 'bg-zinc-900/6 dark:bg-white/[0.08] text-zinc-800 dark:text-zinc-200'
                              : r <= -0.5
                                ? 'bg-rose-500/16 dark:bg-rose-500/18 text-rose-700 dark:text-rose-300 border border-rose-500/25'
                                : r <= -0.2
                                  ? 'bg-rose-500/8 dark:bg-rose-500/10 text-zinc-800 dark:text-zinc-300'
                                  : 'bg-zinc-50 dark:bg-white/[0.02] text-zinc-600 dark:text-[#8A8F98]';
                      return (
                        <td key={colCol} className="p-0.5">
                          <button
                            type="button"
                            disabled={rowCol === colCol}
                            onClick={() => onSelectCorrelationPair(rowCol, colCol)}
                            title={`${rowCol} vs ${colCol}: r = ${r}`}
                            className={`w-full py-1.5 rounded text-center font-medium transition-opacity ${tone} ${
                              rowCol !== colCol ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
                            }`}
                            style={absR > 0.8 && rowCol !== colCol ? { fontWeight: 700 } : undefined}
                          >
                            {r.toFixed(2)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 py-6 text-center">
            Requires at least 2 numeric dimensions.
          </div>
        )}
      </div>

      {/* Pane 3: Distribution Trace & Quantiles */}
      <div className="p-4 flex flex-col justify-between space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[12px] font-semibold text-zinc-900 dark:text-[#F4F5F8] truncate">
              Telemetry ({yColumn})
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-[#6E7480] truncate">
              Sequential trace, quartiles &amp; OLS fit
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectChartType('horizon_anomaly')}
            className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Horizon
          </button>
        </div>

        <div className="bg-zinc-50 dark:bg-[#141519] border border-zinc-200/80 dark:border-white/[0.06] rounded px-2.5 py-2">
          <svg
            viewBox="0 0 220 50"
            className="w-full h-11 overflow-visible text-zinc-800 dark:text-zinc-200"
            aria-label={`Sequential sparkline for ${yColumn}`}
          >
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={sparkPoints}
            />
          </svg>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-200 dark:border-white/[0.06] text-[11px] font-mono tabular-nums">
          <div>
            <div className="text-zinc-500 dark:text-[#6E7480] font-sans text-[10px]">Median</div>
            <div className="font-semibold text-zinc-900 dark:text-[#F4F5F8]">{yProfile?.median ?? '—'}</div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-[#6E7480] font-sans text-[10px]">IQR</div>
            <div className="font-semibold text-zinc-900 dark:text-[#F4F5F8]">{yProfile?.iqr ?? '—'}</div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-[#6E7480] font-sans text-[10px]">Fit R²</div>
            <div className="font-semibold text-zinc-900 dark:text-[#F4F5F8]">{regression.rSquared}</div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-[#6E7480] font-sans text-[10px]">Outliers</div>
            <div className="font-semibold text-rose-600 dark:text-rose-400">{regression.anomalies.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
