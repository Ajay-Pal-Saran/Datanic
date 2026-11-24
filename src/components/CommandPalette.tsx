import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Database,
  Download,
  FolderKanban,
  Home,
  Layers,
  MessageSquare,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import { D3ChartType, WorkspaceDataset, WorkspacePage } from '../types/workspace';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  datasets: WorkspaceDataset[];
  activeDatasetId: string;
  onSelectDataset: (ds: WorkspaceDataset) => void;
  onChangeStage: (stage: WorkspacePage) => void;
  onSelectChartTopology: (chart: D3ChartType) => void;
  onRunNlQuery: (query: string) => void;
  onAskAssistant: (prompt: string) => void;
  onExportCsv: () => void;
}

interface CommandItem {
  id: string;
  group: 'Navigation' | 'Datasets' | 'D3 Topologies' | 'Workspace';
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

const CHART_COMMANDS: { id: D3ChartType; label: string; hint: string }[] = [
  { id: 'parallel_coordinates', label: 'Parallel Coordinates Trajectory', hint: 'Multivariate' },
  { id: 'force_network', label: 'Force Correlation Network', hint: 'Topology' },
  { id: 'scatter_regression', label: 'OLS Regression & Anomaly Scatter', hint: 'Bivariate' },
  { id: 'sunburst_hierarchy', label: 'Hierarchical Sunburst Partition', hint: 'Hierarchy' },
  { id: 'violin_distribution', label: 'Quantile Box & Violin Distribution', hint: 'Spread' },
  { id: 'horizon_anomaly', label: 'Rolling Horizon & Z-Score Envelope', hint: 'Sequential' },
  { id: 'grouped_bar', label: 'Aggregated Cohort Comparison', hint: 'Categorical' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  theme,
  onToggleTheme,
  datasets,
  activeDatasetId,
  onSelectDataset,
  onChangeStage,
  onSelectChartTopology,
  onRunNlQuery,
  onAskAssistant,
  onExportCsv,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      {
        id: 'nav-home',
        group: 'Navigation',
        label: 'Go to Home — Workspace Overview',
        hint: 'Home',
        icon: Home,
        run: () => onChangeStage('home'),
      },
      {
        id: 'nav-assistant',
        group: 'Navigation',
        label: 'Open Datanic AI Assistant Chat',
        hint: 'AI Chat',
        icon: Sparkles,
        run: () => onChangeStage('assistant'),
      },
      {
        id: 'nav-projects',
        group: 'Navigation',
        label: 'Go to Projects & Saved Views',
        hint: 'Projects',
        icon: FolderKanban,
        run: () => onChangeStage('projects'),
      },
      {
        id: 'nav-ingest',
        group: 'Navigation',
        label: 'Go to 01. Data Ingestion & Connectors',
        hint: 'Stage 1',
        icon: Upload,
        run: () => onChangeStage('ingest'),
      },
      {
        id: 'nav-clean',
        group: 'Navigation',
        label: 'Go to 02. Quality Audit & Tier-2 Cleaning',
        hint: 'Stage 2',
        icon: ShieldCheck,
        run: () => onChangeStage('clean'),
      },
      {
        id: 'nav-viz',
        group: 'Navigation',
        label: 'Go to 03. Visualization Studio',
        hint: 'Stage 3',
        icon: Layers,
        run: () => onChangeStage('visualize'),
      },
      {
        id: 'nav-nl',
        group: 'Navigation',
        label: 'Go to 04. Natural Language Pattern Query',
        hint: 'Stage 4',
        icon: MessageSquare,
        run: () => onChangeStage('nl_query'),
      },
      {
        id: 'nav-settings',
        group: 'Navigation',
        label: 'Open Workspace Settings',
        hint: 'Settings',
        icon: Settings,
        run: () => onChangeStage('settings'),
      },
      ...datasets.map((ds) => ({
        id: `ds-${ds.id}`,
        group: 'Datasets' as const,
        label: ds.name,
        hint: ds.id === activeDatasetId ? 'Active' : `${ds.activeRows.length} rows`,
        icon: Database,
        run: () => onSelectDataset(ds),
      })),
      ...CHART_COMMANDS.map((c) => ({
        id: `chart-${c.id}`,
        group: 'D3 Topologies' as const,
        label: c.label,
        hint: c.hint,
        icon: Layers,
        run: () => onSelectChartTopology(c.id),
      })),
      {
        id: 'act-theme',
        group: 'Workspace',
        label: theme === 'dark' ? 'Switch to Porcelain Light mode' : 'Switch to Obsidian Dark mode',
        hint: 'Theme',
        icon: theme === 'dark' ? Sun : Moon,
        run: onToggleTheme,
      },
      {
        id: 'act-export',
        group: 'Workspace',
        label: 'Export active dataset as Clean CSV',
        hint: 'Download',
        icon: Download,
        run: onExportCsv,
      },
    ];

    const q = query.trim().toLowerCase();
    const filtered = q
      ? base.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.group.toLowerCase().includes(q) ||
            (item.hint || '').toLowerCase().includes(q)
        )
      : base;

    if (q.length >= 3) {
      filtered.push({
        id: 'ai-chat-ask',
        group: 'Workspace',
        label: `Ask Datanic AI Assistant: "${query.trim()}"`,
        hint: 'AI Chat',
        icon: Sparkles,
        run: () => onAskAssistant(query.trim()),
      });
      filtered.push({
        id: 'nl-ask',
        group: 'Workspace',
        label: `Run D3 Pattern Query: "${query.trim()}"`,
        hint: 'NL Query',
        icon: MessageSquare,
        run: () => onRunNlQuery(query.trim()),
      });
    }

    return filtered;
  }, [
    query,
    datasets,
    activeDatasetId,
    theme,
    onChangeStage,
    onSelectDataset,
    onSelectChartTopology,
    onToggleTheme,
    onExportCsv,
    onRunNlQuery,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      items[activeIndex].run();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Workspace Command Palette"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#111216] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-3.5 h-11 border-b border-zinc-200 dark:border-white/[0.08]">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to stage, dataset, D3 topology, theme, or ask a pattern query..."
            className="w-full bg-transparent text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.1] rounded">
            Esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1.5 divide-y divide-zinc-100 dark:divide-white/[0.04]">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-zinc-500">
              No matching commands.
            </div>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              const active = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    item.run();
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-left text-[12px] transition-colors cursor-pointer ${
                    active
                      ? 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-950 dark:text-white'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        active
                          ? 'text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    />
                    <span className="truncate font-medium">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.hint && (
                      <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                        {item.hint}
                      </span>
                    )}
                    {active && <ArrowRight className="w-3 h-3 text-zinc-700 dark:text-zinc-200" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
