import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bookmark,
  Database,
  FolderKanban,
  Layers,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  ActivityEvent,
  D3ChartType,
  SavedVisualization,
  WorkspaceDataset,
  WorkspacePage,
  WorkspaceProject,
  WorkspaceSettings,
} from '../types/workspace';
import { profileDataset } from '../utils/dataEngine';
import { formatRelativeTime } from '../utils/workspaceDefaults';

interface HomeDashboardProps {
  workspaceSettings: WorkspaceSettings;
  projects: WorkspaceProject[];
  datasets: WorkspaceDataset[];
  activeDataset: WorkspaceDataset;
  savedViews: SavedVisualization[];
  activities: ActivityEvent[];
  assistantThreadCount: number;
  streamActive: boolean;
  onNavigate: (page: WorkspacePage) => void;
  onSelectDataset: (ds: WorkspaceDataset, targetPage?: WorkspacePage) => void;
  onCreateProject: (project: {
    name: string;
    description: string;
    datasetIds: string[];
    tags: string[];
  }) => void;
  onOpenSavedView: (view: SavedVisualization) => void;
  onAskAssistantWithDataset: (datasetId: string, starterPrompt?: string) => void;
}

const CHART_LABELS: Record<D3ChartType, string> = {
  parallel_coordinates: 'Parallel Coordinates',
  force_network: 'Force Network',
  scatter_regression: 'OLS Scatter',
  sunburst_hierarchy: 'Sunburst',
  violin_distribution: 'Violin & Box',
  horizon_anomaly: 'Horizon Envelope',
  grouped_bar: 'Cohort Bar',
};

const MODALITY_LABELS: Record<string, string> = {
  file_upload: 'File Upload',
  pdf_document: 'PDF / Text',
  url_endpoint: 'URL Feed',
  rest_api: 'REST API',
  data_stream: 'Live Stream',
  data_lake: 'Data Lake',
  manual_entry: 'Manual Grid',
};

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  workspaceSettings,
  projects,
  datasets,
  activeDataset,
  savedViews,
  activities,
  assistantThreadCount,
  streamActive,
  onNavigate,
  onSelectDataset,
  onCreateProject,
  onOpenSavedView,
  onAskAssistantWithDataset,
}) => {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projDatasetId, setProjDatasetId] = useState(activeDataset.id);
  const [projTags, setProjTags] = useState('Analytics, Telemetry');

  const datasetProfiles = useMemo(() => {
    const map = new Map<string, { healthScore: number; missingCells: number; outliers: number }>();
    datasets.forEach((ds) => {
      const report = profileDataset(ds.name, ds.columns, ds.activeRows);
      map.set(ds.id, {
        healthScore: report.healthScore,
        missingCells: report.missingCellsTotal,
        outliers: report.outlierCellsTotal,
      });
    });
    return map;
  }, [datasets]);

  const metrics = useMemo(() => {
    const totalRows = datasets.reduce((acc, ds) => acc + ds.activeRows.length, 0);
    const totalColumns = datasets.reduce((acc, ds) => acc + ds.columns.length, 0);
    const storedCount = datasets.filter((d) => d.storagePolicy === 'stored').length;
    const passthroughCount = datasets.length - storedCount;
    const cleanedCount = datasets.filter((d) => d.isCleaned).length;
    const avgHealth =
      datasets.length > 0
        ? Math.round(
            datasets.reduce((acc, ds) => acc + (datasetProfiles.get(ds.id)?.healthScore ?? 100), 0) /
              datasets.length
          )
        : 100;
    const activeProjects = projects.filter((p) => p.status === 'active').length;

    return {
      totalRows,
      totalColumns,
      storedCount,
      passthroughCount,
      cleanedCount,
      avgHealth,
      activeProjects,
    };
  }, [datasets, datasetProfiles, projects]);

  const handleSubmitProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;
    onCreateProject({
      name: projName.trim(),
      description: projDesc.trim() || 'Analytical project in Datanic workspace.',
      datasetIds: projDatasetId ? [projDatasetId] : [],
      tags: projTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 4),
    });
    setProjName('');
    setProjDesc('');
    setNewProjectOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Workspace Hero Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 dark:text-[#6E7480]">
            <span>{workspaceSettings.workspaceName}</span>
            <span>·</span>
            <span>{workspaceSettings.analystName}</span>
            {streamActive && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Radio className="w-3 h-3" />
                  Stream Live
                </span>
              </>
            )}
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-zinc-950 dark:text-[#F4F5F8]">
            Workspace Overview
          </h1>
          <p className="text-[12.5px] text-zinc-500 dark:text-[#8A8F98]">
            Track active analytical projects, connected datasets, schema health, pinned D3 views, and AI sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="h-8 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium rounded-md border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#121317] text-zinc-800 dark:text-[#E4E6EC] hover:bg-zinc-50 dark:hover:bg-[#191B22] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ingest')}
            className="h-8 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium rounded-md border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#121317] text-zinc-800 dark:text-[#E4E6EC] hover:bg-zinc-50 dark:hover:bg-[#191B22] transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Connect Data
          </button>

          <button
            type="button"
            onClick={() => onNavigate('assistant')}
            className="h-8 px-3.5 inline-flex items-center gap-1.5 text-[12px] font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ask Datanic AI
          </button>
        </div>
      </div>

      {/* Hairline 6-Metric KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0E0F12] divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-zinc-200 dark:divide-white/[0.08] overflow-hidden">
        <button
          type="button"
          onClick={() => onNavigate('projects')}
          className="p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
        >
          <div className="text-[11px] text-zinc-500 dark:text-[#7E8591]">Projects</div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[20px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-[#F4F5F8]">
              {projects.length}
            </span>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-[#6E7480]">
              {metrics.activeProjects} active
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('ingest')}
          className="p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
        >
          <div className="text-[11px] text-zinc-500 dark:text-[#7E8591]">Datasets</div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[20px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-[#F4F5F8]">
              {datasets.length}
            </span>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-[#6E7480]">
              {metrics.storedCount}s · {metrics.passthroughCount}pt
            </span>
          </div>
        </button>

        <div className="p-3.5 text-left">
          <div className="text-[11px] text-zinc-500 dark:text-[#7E8591]">Indexed Records</div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[20px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-[#F4F5F8]">
              {metrics.totalRows.toLocaleString()}
            </span>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-[#6E7480]">
              {metrics.totalColumns} cols
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('clean')}
          className="p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
        >
          <div className="text-[11px] text-zinc-500 dark:text-[#7E8591]">Avg Data Health</div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[20px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-[#F4F5F8]">
              {metrics.avgHealth}%
            </span>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-[#6E7480]">
              {metrics.cleanedCount}/{datasets.length} clean
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('projects')}
          className="p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
        >
          <div className="text-[11px] text-zinc-500 dark:text-[#7E8591]">Saved Views</div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[20px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-[#F4F5F8]">
              {savedViews.length}
            </span>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-[#6E7480]">D3 pins</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('assistant')}
          className="p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
        >
          <div className="text-[11px] text-zinc-500 dark:text-[#7E8591]">AI Threads</div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[20px] font-semibold font-mono tabular-nums text-zinc-950 dark:text-[#F4F5F8]">
              {assistantThreadCount}
            </span>
            <span className="text-[11px] font-mono text-zinc-500 dark:text-[#6E7480]">Ready</span>
          </div>
        </button>
      </div>

      {/* Main Two-Column Hairline Split: Left (Projects + Datasets) | Right (Saved Views + Activity) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-6">
          {/* Active Projects */}
          <section className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0E0F12] overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-3.5 h-3.5 text-zinc-500 dark:text-[#8A8F98]" />
                <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-[#F4F5F8]">
                  Active Projects
                </h2>
                <span className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
                  {projects.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('projects')}
                className="text-[11.5px] font-medium text-zinc-600 dark:text-[#A0A6B2] hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                Manage all
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-zinc-200/80 dark:divide-white/[0.06]">
              {projects.slice(0, 4).map((project) => {
                const linkedDs = datasets.find((d) => project.datasetIds.includes(d.id)) || activeDataset;
                const dsHealth = datasetProfiles.get(linkedDs.id)?.healthScore ?? 100;
                const viewCount = savedViews.filter((v) => v.projectId === project.id).length;

                return (
                  <div
                    key={project.id}
                    className="px-4 py-3.5 hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-zinc-950 dark:text-[#F4F5F8] truncate">
                          {project.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                            project.status === 'active'
                              ? 'border-zinc-300 dark:border-white/[0.14] text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-white/[0.06]'
                              : project.status === 'in_review'
                                ? 'border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10'
                                : 'border-zinc-200 dark:border-white/[0.08] text-zinc-500'
                          }`}
                        >
                          {project.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[12px] text-zinc-500 dark:text-[#8A8F98] line-clamp-1">
                        {project.description}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
                        <span>{project.owner}</span>
                        <span>·</span>
                        <span>{project.datasetIds.length} dataset</span>
                        <span>·</span>
                        <span>{viewCount} views</span>
                        <span>·</span>
                        <span>Health {dsHealth}%</span>
                        <span>·</span>
                        <span>{formatRelativeTime(project.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSelectDataset(linkedDs, 'visualize')}
                        className="h-7 px-2.5 text-[11px] font-medium rounded border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#121317] text-zinc-700 dark:text-[#D4D7E0] hover:text-zinc-950 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/[0.2] transition-colors cursor-pointer"
                      >
                        Open Studio
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onAskAssistantWithDataset(
                            linkedDs.id,
                            `Summarize the key anomalies, strongest correlations, and recommended next analyses for ${linkedDs.name}.`
                          )
                        }
                        className="h-7 px-2.5 text-[11px] font-medium rounded border border-zinc-200 dark:border-white/[0.1] text-zinc-600 dark:text-[#9DA3AF] hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        Ask AI
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Workspace Datasets Directory */}
          <section className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0E0F12] overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-zinc-500 dark:text-[#8A8F98]" />
                <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-[#F4F5F8]">
                  Connected Datasets
                </h2>
                <span className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
                  {datasets.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('ingest')}
                className="text-[11.5px] font-medium text-zinc-600 dark:text-[#A0A6B2] hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                Add source
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-white/[0.08] text-[10.5px] font-mono uppercase tracking-wider text-zinc-400 dark:text-[#6E7480]">
                    <th className="py-2.5 pl-4 pr-2 font-medium">Dataset</th>
                    <th className="py-2.5 px-2 font-medium">Source</th>
                    <th className="py-2.5 px-2 font-medium">Storage</th>
                    <th className="py-2.5 px-2 font-medium text-right">Shape</th>
                    <th className="py-2.5 px-2 font-medium text-right">Health</th>
                    <th className="py-2.5 pl-2 pr-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/70 dark:divide-white/[0.06] text-[12px]">
                  {datasets.map((ds) => {
                    const stats = datasetProfiles.get(ds.id) || {
                      healthScore: 100,
                      missingCells: 0,
                      outliers: 0,
                    };
                    const isActive = ds.id === activeDataset.id;
                    return (
                      <tr
                        key={ds.id}
                        className={`hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors ${
                          isActive ? 'bg-zinc-50/70 dark:bg-white/[0.025]' : ''
                        }`}
                      >
                        <td className="py-2.5 pl-4 pr-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isActive
                                  ? 'bg-zinc-900 dark:bg-zinc-100'
                                  : 'bg-zinc-300 dark:bg-zinc-700'
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-zinc-900 dark:text-[#F4F5F8] truncate max-w-[195px]">
                                {ds.name}
                              </div>
                              <div className="text-[10.5px] font-mono text-zinc-400 dark:text-[#6E7480]">
                                {ds.isCleaned
                                  ? 'Cleaned snapshot'
                                  : `${stats.missingCells} nulls · ${stats.outliers} outliers`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-zinc-600 dark:text-[#9DA3AF] whitespace-nowrap">
                          {MODALITY_LABELS[ds.modality] || ds.modality}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] whitespace-nowrap">
                          <span
                            className={
                              ds.storagePolicy === 'stored'
                                ? 'text-zinc-800 dark:text-zinc-200'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {ds.storagePolicy === 'stored' ? 'Stored' : 'Pass-Through'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-right tabular-nums text-zinc-600 dark:text-[#9DA3AF] whitespace-nowrap">
                          {ds.activeRows.length}×{ds.columns.length}
                        </td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                          <span className="font-mono text-[11px] tabular-nums text-zinc-800 dark:text-zinc-200">
                            {stats.healthScore}%
                          </span>
                        </td>
                        <td className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onSelectDataset(ds, 'clean')}
                              className="px-2 py-1 text-[11px] rounded text-zinc-600 dark:text-[#9DA3AF] hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] cursor-pointer"
                            >
                              Clean
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectDataset(ds, 'visualize')}
                              className="px-2 py-1 text-[11px] rounded text-zinc-900 dark:text-zinc-100 font-medium hover:bg-zinc-100 dark:hover:bg-white/[0.08] cursor-pointer"
                            >
                              Studio
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Rail: Saved D3 Views + Quick Pipeline + Activity */}
        <div className="xl:col-span-4 space-y-6">
          {/* Pinned Visualizations */}
          <section className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0E0F12] overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="w-3.5 h-3.5 text-zinc-500 dark:text-[#8A8F98]" />
                <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-[#F4F5F8]">
                  Pinned Views
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('visualize')}
                className="text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98] hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                Studio →
              </button>
            </div>

            <div className="divide-y divide-zinc-200/70 dark:divide-white/[0.06]">
              {savedViews.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-zinc-500">
                  No pinned charts yet. Save any topology from Visualization Studio.
                </div>
              ) : (
                savedViews.slice(0, 4).map((view) => {
                  const ds = datasets.find((d) => d.id === view.datasetId);
                  return (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => onOpenSavedView(view)}
                      className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-medium text-zinc-900 dark:text-[#F4F5F8] truncate">
                          {view.title}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 dark:text-[#7E8591] shrink-0">
                          {CHART_LABELS[view.chartType]}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
                        <span className="truncate">
                          {ds ? ds.name : view.datasetId}
                        </span>
                        <span className="shrink-0">
                          {view.xColumn} × {view.yColumn}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Pipeline Quick Launch */}
          <section className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0E0F12] overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/[0.08]">
              <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-[#F4F5F8]">
                Quick Workflows
              </h2>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200/80 dark:divide-white/[0.06]">
              <button
                type="button"
                onClick={() => onNavigate('assistant')}
                className="p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 mb-2" />
                <div className="text-[12px] font-medium text-zinc-900 dark:text-[#F4F5F8]">
                  AI Analyst Chat
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-[#7E8591] mt-0.5">
                  Conversational discovery
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('ingest')}
                className="p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 mb-2" />
                <div className="text-[12px] font-medium text-zinc-900 dark:text-[#F4F5F8]">
                  Ingest Source
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-[#7E8591] mt-0.5">
                  CSV, PDF, API, Lake
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('clean')}
                className="p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 mb-2" />
                <div className="text-[12px] font-medium text-zinc-900 dark:text-[#F4F5F8]">
                  Audit & Clean
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-[#7E8591] mt-0.5">
                  Tier 1–2 remediation
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('visualize')}
                className="p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 mb-2" />
                <div className="text-[12px] font-medium text-zinc-900 dark:text-[#F4F5F8]">
                  D3 Studio
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-[#7E8591] mt-0.5">
                  7 interactive charts
                </div>
              </button>
            </div>
          </section>

          {/* Recent Workspace Activity */}
          <section className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0E0F12] overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/[0.08] flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-zinc-500 dark:text-[#8A8F98]" />
              <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-[#F4F5F8]">
                Recent Activity
              </h2>
            </div>
            <div className="divide-y divide-zinc-200/70 dark:divide-white/[0.06]">
              {activities.slice(0, 5).map((ev) => (
                <div key={ev.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-zinc-900 dark:text-[#E4E6EC] truncate">
                      {ev.title}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-[#7E8591] line-clamp-1">
                      {ev.detail}
                    </div>
                  </div>
                  <span className="text-[10.5px] font-mono text-zinc-400 dark:text-[#6E7480] shrink-0">
                    {formatRelativeTime(ev.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Inline Create Project Modal */}
      {newProjectOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create New Project"
        >
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={() => setNewProjectOpen(false)}
          />
          <form
            onSubmit={handleSubmitProject}
            className="relative w-full max-w-md rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#111216] shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-zinc-950 dark:text-[#F4F5F8]">
                Create Workspace Project
              </h3>
              <button
                type="button"
                onClick={() => setNewProjectOpen(false)}
                className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-600 dark:text-[#9DA3AF] mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="e.g. Q4 Enterprise Retention Forecast"
                  className="w-full h-9 px-3 text-[12.5px] rounded-md border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#0B0C0E] text-zinc-900 dark:text-[#F4F5F8] focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-600 dark:text-[#9DA3AF] mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="Analytical objective, target KPIs, and modeling scope..."
                  className="w-full p-2.5 text-[12.5px] rounded-md border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#0B0C0E] text-zinc-900 dark:text-[#F4F5F8] focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-600 dark:text-[#9DA3AF] mb-1">
                  Primary Linked Dataset
                </label>
                <select
                  value={projDatasetId}
                  onChange={(e) => setProjDatasetId(e.target.value)}
                  className="w-full h-9 px-2.5 text-[12px] rounded-md border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#0B0C0E] text-zinc-900 dark:text-[#F4F5F8] focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                >
                  {datasets.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.activeRows.length} rows)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-600 dark:text-[#9DA3AF] mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={projTags}
                  onChange={(e) => setProjTags(e.target.value)}
                  className="w-full h-9 px-3 text-[12px] rounded-md border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#0B0C0E] text-zinc-900 dark:text-[#F4F5F8] focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-zinc-200 dark:border-white/[0.08] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewProjectOpen(false)}
                className="h-8 px-3 text-[12px] rounded-md text-zinc-600 dark:text-[#9DA3AF] hover:bg-zinc-100 dark:hover:bg-white/[0.06] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-3.5 text-[12px] font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white cursor-pointer"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
