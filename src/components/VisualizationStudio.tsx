import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  Check,
  Compass,
  Download,
  Eraser,
  Highlighter,
  Layers,
  MousePointer,
  PenTool,
  Search,
  Sparkles,
  Square,
  TrendingUp,
  Undo2,
} from 'lucide-react';
import {
  ColumnProfile,
  D3ChartType,
  DataRow,
  DrawingAnnotation,
  LinearRegressionResult,
  NLQueryResult,
  PairwiseCorrelation,
  SmartPerspectiveCard,
  WorkspaceDataset,
} from '../types/workspace';
import {
  computeLinearRegression,
  discoverSmartPerspectives,
  executeLocalNLQuery,
  pickBestCohortColumn,
} from '../utils/dataEngine';
import { BentoOverview } from './BentoOverview';
import { D3InteractiveCanvas } from './D3InteractiveCanvas';

interface VisualizationStudioProps {
  dataset: WorkspaceDataset;
  profiles: ColumnProfile[];
  correlations: PairwiseCorrelation[];
  healthScore: number;
  initialSubTab?: 'visualize' | 'nl_query';
  theme: 'dark' | 'light';
  externalChartRequest?: {
    chartType: D3ChartType;
    xColumn?: string;
    yColumn?: string;
    groupColumn?: string;
    nonce: number;
  } | null;
  externalNlQueryRequest?: { query: string; nonce: number } | null;
  onPinView?: (view: {
    title: string;
    chartType: D3ChartType;
    xColumn: string;
    yColumn: string;
    groupColumn: string;
  }) => void;
}

const CHART_CATALOG: { id: D3ChartType; label: string; category: string }[] = [
  { id: 'parallel_coordinates', label: 'Parallel Coordinates', category: 'Multivariate' },
  { id: 'force_network', label: 'Force Network', category: 'Topology' },
  { id: 'scatter_regression', label: 'OLS Regression Scatter', category: 'Bivariate' },
  { id: 'sunburst_hierarchy', label: 'Sunburst Partition', category: 'Hierarchy' },
  { id: 'violin_distribution', label: 'Quantile & Density', category: 'Distribution' },
  { id: 'horizon_anomaly', label: 'Rolling Horizon & Z-Score', category: 'Sequential' },
  { id: 'grouped_bar', label: 'Cohort Comparison', category: 'Categorical' },
];

export const VisualizationStudio: React.FC<VisualizationStudioProps> = ({
  dataset,
  profiles,
  correlations,
  healthScore,
  initialSubTab = 'visualize',
  theme,
  externalChartRequest,
  externalNlQueryRequest,
  onPinView,
}) => {
  const numCols = profiles.filter((p) => p.semanticType === 'numeric').map((p) => p.name);
  const defaultCohort = pickBestCohortColumn(profiles);

  const [vizStrategyMode, setVizStrategyMode] = useState<'smart_discovery' | 'custom_builder'>('smart_discovery');
  const [chartType, setChartType] = useState<D3ChartType>('parallel_coordinates');
  const [xColumn, setXColumn] = useState<string>(correlations[0]?.colA || numCols[0] || dataset.columns[0] || '');
  const [yColumn, setYColumn] = useState<string>(correlations[0]?.colB || numCols[1] || numCols[0] || dataset.columns[0] || '');
  const [groupColumn, setGroupColumn] = useState<string>(defaultCohort || dataset.columns[0] || '');
  const [sizeColumn, setSizeColumn] = useState<string>(numCols[2] || numCols[0] || '');
  const [aggregation, setAggregation] = useState<'mean' | 'sum' | 'median' | 'max' | 'count'>('mean');

  const [showRegressionOverlay, setShowRegressionOverlay] = useState(true);
  const [showAnomalyCallouts, setShowAnomalyCallouts] = useState(true);
  const [rollingWindow, setRollingWindow] = useState(4);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [inspectedRow, setInspectedRow] = useState<DataRow | null>(null);

  const [drawingMode, setDrawingMode] = useState<'navigate' | 'freehand' | 'line' | 'rect' | 'callout'>('navigate');
  const [drawingColor, setDrawingColor] = useState('#A1A1AA');
  const [annotations, setAnnotations] = useState<DrawingAnnotation[]>([]);

  const localPerspectives = discoverSmartPerspectives(dataset.name, profiles, correlations);
  const [aiPerspectives, setAiPerspectives] = useState<SmartPerspectiveCard[]>(localPerspectives);
  const [aiHeadlineInsight, setAiHeadlineInsight] = useState<string>(
    correlations[0]
      ? `Primary statistical coupling: ${correlations[0].colA} ↔ ${correlations[0].colB} (r = ${correlations[0].r}) across ${dataset.activeRows.length} records.`
      : `Synthesized ${localPerspectives.length} multivariate views across ${numCols.length} numeric dimensions.`
  );
  const [isSynthesizingAi, setIsSynthesizingAi] = useState(false);

  const [nlQueryInput, setNlQueryInput] = useState(
    initialSubTab === 'nl_query'
      ? `Show correlation and outliers between ${xColumn} and ${yColumn}`
      : ''
  );
  const [nlResult, setNlResult] = useState<NLQueryResult | null>(null);
  const [isQueryingNl, setIsQueryingNl] = useState(false);

  const [pinnedFeedback, setPinnedFeedback] = useState(false);

  // Sync external Command Palette or Saved View requests
  useEffect(() => {
    if (externalChartRequest) {
      setChartType(externalChartRequest.chartType);
      if (externalChartRequest.xColumn && dataset.columns.includes(externalChartRequest.xColumn)) {
        setXColumn(externalChartRequest.xColumn);
      }
      if (externalChartRequest.yColumn && dataset.columns.includes(externalChartRequest.yColumn)) {
        setYColumn(externalChartRequest.yColumn);
      }
      if (externalChartRequest.groupColumn && dataset.columns.includes(externalChartRequest.groupColumn)) {
        setGroupColumn(externalChartRequest.groupColumn);
      }
    }
  }, [externalChartRequest, dataset.columns]);

  useEffect(() => {
    if (externalNlQueryRequest?.query) {
      handleExecuteNLQuery(externalNlQueryRequest.query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalNlQueryRequest]);

  const activeRowsForViz = nlResult ? nlResult.filteredRows : dataset.activeRows;
  const regression: LinearRegressionResult = computeLinearRegression(
    activeRowsForViz,
    xColumn,
    yColumn,
    dataset.columns[0]
  );

  const handleApplyPerspective = (card: SmartPerspectiveCard) => {
    setChartType(card.recommendedChartType);
    if (dataset.columns.includes(card.xColumn)) setXColumn(card.xColumn);
    if (dataset.columns.includes(card.yColumn)) setYColumn(card.yColumn);
    if (dataset.columns.includes(card.groupColumn)) setGroupColumn(card.groupColumn);
    if (card.sizeColumn && dataset.columns.includes(card.sizeColumn)) setSizeColumn(card.sizeColumn);
  };

  const handleRunTier3SmartDiscovery = async () => {
    setIsSynthesizingAi(true);
    try {
      const res = await fetch('/api/ai/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName: dataset.name,
          columns: profiles.map((p) => ({ name: p.name, type: p.semanticType, mean: p.mean, median: p.median })),
          correlations: correlations.slice(0, 8),
          sampleRows: dataset.activeRows.slice(0, 10),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.headlineInsight) setAiHeadlineInsight(data.headlineInsight);
        if (Array.isArray(data.discoveredPatterns) && data.discoveredPatterns.length > 0) {
          const mapped: SmartPerspectiveCard[] = data.discoveredPatterns.map(
            (p: Record<string, string>, idx: number) => ({
              id: `ai-persp-${idx}`,
              title: p.title || `Multivariate Perspective #${idx + 1}`,
              explanation: p.explanation || '',
              statisticalEvidence: p.statisticalEvidence || '',
              recommendedChartType: (CHART_CATALOG.some((c) => c.id === p.recommendedChartType)
                ? p.recommendedChartType
                : 'parallel_coordinates') as D3ChartType,
              xColumn: dataset.columns.includes(p.xColumn) ? p.xColumn : xColumn,
              yColumn: dataset.columns.includes(p.yColumn) ? p.yColumn : yColumn,
              groupColumn: dataset.columns.includes(p.groupColumn) ? p.groupColumn : groupColumn,
              whyUnexpected: p.whyUnexpected || 'Surfaces latent multivariate topology.',
            })
          );
          setAiPerspectives(mapped);
          handleApplyPerspective(mapped[0]);
        }
      } else {
        setAiPerspectives(localPerspectives);
      }
    } catch {
      setAiPerspectives(localPerspectives);
    } finally {
      setIsSynthesizingAi(false);
    }
  };

  const handleExecuteNLQuery = async (overrideQuery?: string) => {
    const qText = (overrideQuery ?? nlQueryInput).trim();
    if (!qText) return;
    setNlQueryInput(qText);
    setIsQueryingNl(true);

    const localRes = executeLocalNLQuery(
      qText,
      dataset.name,
      dataset.columns,
      dataset.activeRows,
      profiles
    );

    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: qText,
          datasetName: dataset.name,
          columns: dataset.columns,
          statsSummary: profiles.map((p) => ({
            name: p.name,
            type: p.semanticType,
            mean: p.mean,
            median: p.median,
            min: p.min,
            max: p.max,
          })),
          sampleRows: dataset.activeRows.slice(0, 12),
        }),
      });
      if (res.ok) {
        const aiData = await res.json();
        const validChart = CHART_CATALOG.some((c) => c.id === aiData.suggestedChartType)
          ? (aiData.suggestedChartType as D3ChartType)
          : localRes.suggestedChartType;
        const nextX = dataset.columns.includes(aiData.xColumn) ? aiData.xColumn : localRes.xColumn;
        const nextY = dataset.columns.includes(aiData.yColumn) ? aiData.yColumn : localRes.yColumn;
        const nextG = dataset.columns.includes(aiData.groupColumn) ? aiData.groupColumn : localRes.groupColumn;

        setNlResult({
          ...localRes,
          directAnswer: aiData.directAnswer || localRes.directAnswer,
          patternFinding: aiData.patternFinding || localRes.patternFinding,
          suggestedChartType: validChart,
          xColumn: nextX,
          yColumn: nextY,
          groupColumn: nextG,
        });
        setChartType(validChart);
        setXColumn(nextX);
        setYColumn(nextY);
        setGroupColumn(nextG);
      } else {
        setNlResult(localRes);
        setChartType(localRes.suggestedChartType);
        setXColumn(localRes.xColumn);
        setYColumn(localRes.yColumn);
        setGroupColumn(localRes.groupColumn);
      }
    } catch {
      setNlResult(localRes);
      setChartType(localRes.suggestedChartType);
      setXColumn(localRes.xColumn);
      setYColumn(localRes.yColumn);
      setGroupColumn(localRes.groupColumn);
    } finally {
      setIsQueryingNl(false);
    }
  };

  const handleExportAnnotatedSvg = () => {
    const svgEl = document.querySelector('[data-testid="d3-visualization-svg"]');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${dataset.name.toLowerCase().replace(/\s+/g, '-')}-${chartType}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Compact Workspace Toolbar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold text-zinc-900 dark:text-[#F4F5F8] truncate">
            Visualization Studio
          </h1>
          <p className="text-[12px] text-zinc-500 dark:text-[#8A8F98] truncate">
            {aiHeadlineInsight}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Mode Segmented Toggle */}
          <div className="inline-flex items-center p-0.5 rounded-md border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/80 dark:bg-[#121317]">
            <button
              type="button"
              onClick={() => setVizStrategyMode('smart_discovery')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                vizStrategyMode === 'smart_discovery'
                  ? 'bg-white dark:bg-[#1E2028] text-zinc-900 dark:text-[#F4F5F8]'
                  : 'text-zinc-500 dark:text-[#8A8F98] hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>Smart AI</span>
            </button>
            <button
              type="button"
              onClick={() => setVizStrategyMode('custom_builder')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                vizStrategyMode === 'custom_builder'
                  ? 'bg-white dark:bg-[#1E2028] text-zinc-900 dark:text-[#F4F5F8]'
                  : 'text-zinc-500 dark:text-[#8A8F98] hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Custom D3</span>
            </button>
          </div>

          {onPinView && (
            <button
              type="button"
              onClick={() => {
                const label =
                  CHART_CATALOG.find((c) => c.id === chartType)?.label || chartType;
                onPinView({
                  title: `${label}: ${xColumn} × ${yColumn}`,
                  chartType,
                  xColumn,
                  yColumn,
                  groupColumn,
                });
                setPinnedFeedback(true);
                setTimeout(() => setPinnedFeedback(false), 1800);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 dark:text-[#D4D7E0] bg-white dark:bg-[#121317] border border-zinc-200 dark:border-white/[0.1] hover:border-zinc-300 dark:hover:border-white/[0.2] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {pinnedFeedback ? <Check className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
              <span>{pinnedFeedback ? 'Pinned' : 'Pin View'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={isSynthesizingAi}
            onClick={handleRunTier3SmartDiscovery}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-white dark:text-zinc-950 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white rounded-md disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>{isSynthesizingAi ? 'Synthesizing...' : 'Synthesize AI'}</span>
          </button>
        </div>
      </div>

      {/* Flat Hairline 4-Column Telemetry Strip */}
      <div className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0F1013] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-zinc-200 dark:divide-white/[0.08]">
        <div className="px-4 py-3 min-w-0">
          <div className="text-[11px] text-zinc-500 dark:text-[#6E7480] truncate">Observations</div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-lg font-semibold font-mono tabular-nums text-zinc-900 dark:text-[#F4F5F8]">
              {activeRowsForViz.length}
            </span>
            <span className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
              {dataset.columns.length} cols
            </span>
          </div>
        </div>

        <div className="px-4 py-3 min-w-0">
          <div className="text-[11px] text-zinc-500 dark:text-[#6E7480] truncate">Schema Health</div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-lg font-semibold font-mono tabular-nums text-zinc-900 dark:text-[#F4F5F8]">
              {healthScore}%
            </span>
            <span
              className={`text-[11px] font-medium whitespace-nowrap ${
                healthScore >= 90
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {dataset.isCleaned ? 'Cleaned' : 'Raw'}
            </span>
          </div>
        </div>

        <div className="px-4 py-3 min-w-0">
          <div className="text-[11px] text-zinc-500 dark:text-[#6E7480] truncate">Top Correlation</div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-lg font-semibold font-mono tabular-nums text-zinc-900 dark:text-[#F4F5F8]">
              {correlations[0] ? correlations[0].r : '—'}
            </span>
            <span className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480] truncate max-w-full">
              {correlations[0] ? `${correlations[0].colA} ↔ ${correlations[0].colB}` : 'N/A'}
            </span>
          </div>
        </div>

        <div className="px-4 py-3 min-w-0">
          <div className="text-[11px] text-zinc-500 dark:text-[#6E7480] truncate">OLS Fit &amp; Outliers</div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-lg font-semibold font-mono tabular-nums text-zinc-900 dark:text-[#F4F5F8]">
              R² {regression.rSquared}
            </span>
            <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 whitespace-nowrap">
              {regression.anomalies.length} outlier(s)
            </span>
          </div>
        </div>
      </div>

      {/* Synchronized Flat Hairline Bento Telemetry Strip */}
      <BentoOverview
        rows={activeRowsForViz}
        profiles={profiles}
        correlations={correlations}
        regression={regression}
        xColumn={xColumn}
        yColumn={yColumn}
        groupColumn={groupColumn}
        activeGroupFilter={activeGroupFilter}
        onSelectGroupFilter={setActiveGroupFilter}
        onSelectCorrelationPair={(colA, colB) => {
          setXColumn(colA);
          setYColumn(colB);
          setChartType('scatter_regression');
        }}
        onSelectChartType={setChartType}
      />

      {/* Inline Natural Language Query Bar */}
      <div className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0F1013] p-3 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-[#6E7480] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Natural language data query"
              value={nlQueryInput}
              onChange={(e) => setNlQueryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExecuteNLQuery();
              }}
              placeholder={`Ask a pattern question about "${dataset.name}" (e.g., "Find anomaly spikes in ${yColumn}")...`}
              className="w-full h-9 pl-9 pr-3 text-[12px] bg-zinc-50 dark:bg-[#141519] border border-zinc-200 dark:border-white/[0.08] rounded-md text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-[#6E7480] focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isQueryingNl}
              onClick={() => handleExecuteNLQuery()}
              className="h-9 px-3.5 text-[12px] font-medium text-white bg-zinc-900 dark:bg-[#1F2129] hover:bg-zinc-800 dark:hover:bg-[#2A2D38] border border-transparent dark:border-white/[0.08] rounded-md disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isQueryingNl ? 'Analyzing...' : 'Run Pattern Query'}
            </button>
            {nlResult && (
              <button
                type="button"
                onClick={() => setNlResult(null)}
                className="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                Reset ({nlResult.matchedRowCount})
              </button>
            )}
          </div>
        </div>

        {/* Unboxed Text Starter Links */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-[#6E7480]">
          <span>Try:</span>
          {[
            `Show correlation between ${xColumn} and ${yColumn}`,
            `Find extreme anomaly outliers in ${yColumn}`,
            `Compare distribution spread of ${yColumn} by ${groupColumn}`,
            `Synthesize multivariate parallel trajectory across all metrics`,
          ].map((sampleQ, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleExecuteNLQuery(sampleQ)}
              className="hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline transition-colors text-left cursor-pointer"
            >
              {sampleQ}
            </button>
          ))}
        </div>

        {nlResult && (
          <div className="pt-2 border-t border-zinc-200 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[12px]">
            <div className="space-y-0.5">
              <div className="font-medium text-zinc-900 dark:text-[#F4F5F8]">{nlResult.directAnswer}</div>
              <div className="text-[11px] text-zinc-500 dark:text-[#8A8F98]">{nlResult.patternFinding}</div>
            </div>
            <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-200 shrink-0">
              View: {nlResult.suggestedChartType}
            </span>
          </div>
        )}
      </div>

      {/* Slim Smart AI Perspective Selector Strip */}
      {vizStrategyMode === 'smart_discovery' && (
        <div className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0F1013] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 divide-x divide-zinc-200 dark:divide-white/[0.08] overflow-hidden">
          {aiPerspectives.map((card) => {
            const isActive = chartType === card.recommendedChartType;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleApplyPerspective(card)}
                className={`p-3 text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isActive
                    ? 'bg-zinc-100 dark:bg-white/[0.08]'
                    : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                }`}
              >
                <div className="space-y-1">
                  <div
                    className={`text-[10px] font-mono font-medium truncate ${
                      isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-[#6E7480]'
                    }`}
                  >
                    {card.recommendedChartType.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[12px] font-medium text-zinc-900 dark:text-[#F4F5F8] leading-snug line-clamp-2">
                    {card.title}
                  </div>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 dark:text-[#6E7480] truncate">
                  {card.xColumn} × {card.yColumn}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Flat Hairline Split-View: Left D3 Canvas & Analysis | Right Docked Inspector */}
      <div className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0F1013] grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-zinc-200 dark:divide-white/[0.08] overflow-hidden">
        {/* Main D3 Focus Canvas Column (9 cols) */}
        <div className="xl:col-span-9 flex flex-col min-w-0">
          {/* Compact Drawing & Annotation Toolbar */}
          <div className="px-3.5 py-2 border-b border-zinc-200 dark:border-white/[0.08] bg-zinc-50/70 dark:bg-[#121317] flex flex-wrap items-center justify-between gap-2">
            <div
              className="flex flex-wrap items-center gap-1"
              role="toolbar"
              aria-label="Canvas drawing and annotation tools"
            >
              {[
                { id: 'navigate', label: 'Inspect', icon: MousePointer },
                { id: 'freehand', label: 'Ink', icon: PenTool },
                { id: 'line', label: 'Vector', icon: TrendingUp },
                { id: 'rect', label: 'Box', icon: Square },
                { id: 'callout', label: 'Callout', icon: Highlighter },
              ].map((tool) => {
                const Icon = tool.icon;
                const active = drawingMode === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setDrawingMode(tool.id as typeof drawingMode)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950'
                        : 'text-zinc-600 dark:text-[#A0A6B2] hover:bg-zinc-200/60 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{tool.label}</span>
                  </button>
                );
              })}

              <div className="flex items-center gap-1 pl-2 ml-1 border-l border-zinc-200 dark:border-white/[0.08]">
                {['#A1A1AA', '#E5484D', '#389890', '#C98A4B', '#F4F5F8'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Select annotation color ${c}`}
                    onClick={() => setDrawingColor(c)}
                    className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                      drawingColor === c
                        ? 'border-zinc-900 dark:border-white scale-110'
                        : 'border-zinc-300 dark:border-white/20'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={annotations.length === 0}
                onClick={() => setAnnotations((prev) => prev.slice(0, -1))}
                aria-label="Undo last annotation"
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-[#A0A6B2] hover:bg-zinc-200/60 dark:hover:bg-white/[0.06] rounded disabled:opacity-35 cursor-pointer"
              >
                <Undo2 className="w-3 h-3" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                disabled={annotations.length === 0}
                onClick={() => setAnnotations([])}
                aria-label="Clear all annotations"
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-[#A0A6B2] hover:bg-zinc-200/60 dark:hover:bg-white/[0.06] rounded disabled:opacity-35 cursor-pointer"
              >
                <Eraser className="w-3 h-3" />
                <span>Clear ({annotations.length})</span>
              </button>
              <button
                type="button"
                onClick={handleExportAnnotatedSvg}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-zinc-900 dark:text-[#F4F5F8] border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#17181D] hover:bg-zinc-100 dark:hover:bg-[#1E2027] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Export SVG</span>
              </button>
            </div>
          </div>

          {/* Main D3 Interactive Surface */}
          <D3InteractiveCanvas
            chartType={chartType}
            rows={activeRowsForViz}
            columns={dataset.columns}
            profiles={profiles}
            xColumn={xColumn}
            yColumn={yColumn}
            groupColumn={groupColumn}
            sizeColumn={sizeColumn}
            aggregation={aggregation}
            showRegressionOverlay={showRegressionOverlay}
            showAnomalyCallouts={showAnomalyCallouts}
            rollingWindow={rollingWindow}
            regression={regression}
            correlations={correlations}
            activeGroupFilter={activeGroupFilter}
            onSelectGroupFilter={setActiveGroupFilter}
            onSelectDataPoint={setInspectedRow}
            drawingMode={drawingMode}
            drawingColor={drawingColor}
            annotations={annotations}
            onAddAnnotation={(ann) => setAnnotations((prev) => [...prev, ann])}
            theme={theme}
          />

          {/* Compact Hairline Regression & Correlation Footer Strip */}
          <div className="border-t border-zinc-200 dark:border-white/[0.08] grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-white/[0.08]">
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-zinc-900 dark:text-[#F4F5F8]">
                  OLS Regression &amp; Outliers
                </span>
                <span className="font-mono text-[11px] text-zinc-500 dark:text-[#8A8F98]">
                  r = {regression.r} · R² = {regression.rSquared}
                </span>
              </div>
              <div className="text-[11px] font-mono text-zinc-600 dark:text-[#A0A6B2] bg-zinc-50 dark:bg-[#141519] px-2.5 py-1.5 rounded border border-zinc-200/80 dark:border-white/[0.06]">
                {regression.equation}
              </div>
              {regression.anomalies.length > 0 ? (
                <div className="max-h-24 overflow-y-auto divide-y divide-zinc-100 dark:divide-white/[0.05] text-[11px] font-mono tabular-nums">
                  {regression.anomalies.map((a, i) => (
                    <div key={i} className="py-1 flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{a.label}</span>
                      <span className="text-rose-600 dark:text-rose-400">
                        {a.y} vs {a.predicted} (Z = {a.residualZ}σ)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 dark:text-[#6E7480]">
                  No residual outliers beyond ±1.65σ for {xColumn} × {yColumn}.
                </p>
              )}
            </div>

            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-zinc-900 dark:text-[#F4F5F8]">
                  Pairwise Correlation Ranking
                </span>
                <span className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
                  Top {Math.min(5, correlations.length)}
                </span>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-white/[0.05] text-[11px] font-mono tabular-nums">
                {correlations.slice(0, 5).map((c, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setXColumn(c.colA);
                      setYColumn(c.colB);
                      setChartType('scatter_regression');
                    }}
                    className="w-full py-1.5 px-1.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-white/[0.04] rounded transition-colors cursor-pointer"
                  >
                    <span className="font-sans text-zinc-700 dark:text-zinc-300 truncate">
                      {c.colA} ↔ {c.colB}
                    </span>
                    <span
                      className={`font-semibold shrink-0 ${
                        c.r >= 0.5
                          ? 'text-zinc-900 dark:text-zinc-100'
                          : c.r <= -0.5
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-zinc-500'
                      }`}
                    >
                      {c.r > 0 ? `+${c.r}` : c.r}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Docked Right Inspector Rail (3 cols) */}
        <div className="xl:col-span-3 p-4 space-y-4 bg-zinc-50/40 dark:bg-[#0C0D10]">
          <div className="pb-2 border-b border-zinc-200 dark:border-white/[0.08]">
            <h3 className="text-[12px] font-semibold text-zinc-900 dark:text-[#F4F5F8]">
              D3 Inspector
            </h3>
          </div>

          <div className="space-y-3 text-[12px]">
            <div>
              <label htmlFor="d3-chart-type-select" className="block text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98] mb-1">
                Topology
              </label>
              <select
                id="d3-chart-type-select"
                value={chartType}
                onChange={(e) => setChartType(e.target.value as D3ChartType)}
                className="w-full h-8 px-2.5 text-[12px] bg-white dark:bg-[#141519] border border-zinc-200 dark:border-white/[0.08] rounded-md text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
              >
                {CHART_CATALOG.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="d3-x-col-select" className="block text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98] mb-1">
                X Dimension
              </label>
              <select
                id="d3-x-col-select"
                value={xColumn}
                onChange={(e) => setXColumn(e.target.value)}
                className="w-full h-8 px-2.5 text-[12px] font-mono bg-white dark:bg-[#141519] border border-zinc-200 dark:border-white/[0.08] rounded-md text-zinc-900 dark:text-zinc-100"
              >
                {dataset.columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="d3-y-col-select" className="block text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98] mb-1">
                Y Measure
              </label>
              <select
                id="d3-y-col-select"
                value={yColumn}
                onChange={(e) => setYColumn(e.target.value)}
                className="w-full h-8 px-2.5 text-[12px] font-mono bg-white dark:bg-[#141519] border border-zinc-200 dark:border-white/[0.08] rounded-md text-zinc-900 dark:text-zinc-100"
              >
                {dataset.columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="d3-group-col-select" className="block text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98] mb-1">
                Cohort Grouping
              </label>
              <select
                id="d3-group-col-select"
                value={groupColumn}
                onChange={(e) => {
                  setGroupColumn(e.target.value);
                  setActiveGroupFilter(null);
                }}
                className="w-full h-8 px-2.5 text-[12px] font-mono bg-white dark:bg-[#141519] border border-zinc-200 dark:border-white/[0.08] rounded-md text-zinc-900 dark:text-zinc-100"
              >
                {dataset.columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            {chartType === 'scatter_regression' && (
              <div>
                <label htmlFor="d3-size-col-select" className="block text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98] mb-1">
                  Radius Measure
                </label>
                <select
                  id="d3-size-col-select"
                  value={sizeColumn}
                  onChange={(e) => setSizeColumn(e.target.value)}
                  className="w-full h-8 px-2.5 text-[12px] font-mono bg-white dark:bg-[#141519] border border-zinc-200 dark:border-white/[0.08] rounded-md text-zinc-900 dark:text-zinc-100"
                >
                  {numCols.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {chartType === 'grouped_bar' && (
              <div>
                <label htmlFor="d3-agg-select" className="block text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98] mb-1">
                  Aggregation
                </label>
                <select
                  id="d3-agg-select"
                  value={aggregation}
                  onChange={(e) =>
                    setAggregation(e.target.value as 'mean' | 'sum' | 'median' | 'max' | 'count')
                  }
                  className="w-full h-8 px-2.5 text-[12px] font-mono bg-white dark:bg-[#141519] border border-zinc-200 dark:border-white/[0.08] rounded-md text-zinc-900 dark:text-zinc-100"
                >
                  <option value="mean">Mean</option>
                  <option value="sum">Sum</option>
                  <option value="median">Median</option>
                  <option value="max">Max</option>
                  <option value="count">Count</option>
                </select>
              </div>
            )}

            {chartType === 'horizon_anomaly' && (
              <div>
                <label htmlFor="d3-rolling-slider" className="block text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98] mb-1">
                  Rolling Window ({rollingWindow} obs)
                </label>
                <input
                  id="d3-rolling-slider"
                  type="range"
                  min={2}
                  max={8}
                  value={rollingWindow}
                  onChange={(e) => setRollingWindow(Number(e.target.value))}
                  className="w-full accent-zinc-900 dark:accent-zinc-100"
                />
              </div>
            )}

            <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.08] space-y-2">
              <div className="text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98]">Overlays</div>
              <label className="flex items-center gap-2 text-[12px] text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRegressionOverlay}
                  onChange={(e) => setShowRegressionOverlay(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-white/20 accent-zinc-900 dark:accent-zinc-100"
                />
                <span>OLS Regression Band</span>
              </label>
              <label className="flex items-center gap-2 text-[12px] text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAnomalyCallouts}
                  onChange={(e) => setShowAnomalyCallouts(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-white/20 accent-zinc-900 dark:accent-zinc-100"
                />
                <span>Highlight &gt;1.65σ Outliers</span>
              </label>
            </div>
          </div>

          {inspectedRow && (
            <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-900 dark:text-[#F4F5F8]">
                  Selected Point
                </span>
                <button
                  type="button"
                  onClick={() => setInspectedRow(null)}
                  className="text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="p-2.5 bg-white dark:bg-[#141519] rounded border border-zinc-200 dark:border-white/[0.08] space-y-1 text-[11px] font-mono tabular-nums max-h-48 overflow-y-auto">
                {Object.entries(inspectedRow).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-zinc-500 dark:text-[#6E7480] truncate">{k}</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{String(v ?? 'null')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
