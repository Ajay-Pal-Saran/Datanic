import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Database,
  FolderKanban,
  Layers,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  D3ChartType,
  ProjectStatus,
  SavedVisualization,
  WorkspaceDataset,
  WorkspacePage,
  WorkspaceProject,
} from '../types/workspace';
import { formatRelativeTime } from '../utils/workspaceDefaults';

interface ProjectsPageProps {
  projects: WorkspaceProject[];
  datasets: WorkspaceDataset[];
  savedViews: SavedVisualization[];
  onCreateProject: (project: {
    name: string;
    description: string;
    datasetIds: string[];
    tags: string[];
  }) => void;
  onUpdateProjectStatus: (projectId: string, status: ProjectStatus) => void;
  onDeleteProject: (projectId: string) => void;
  onDeleteSavedView: (viewId: string) => void;
  onOpenSavedView: (view: SavedVisualization) => void;
  onSelectDataset: (ds: WorkspaceDataset, targetPage?: WorkspacePage) => void;
  onAskAssistantWithDataset: (datasetId: string, prompt: string) => void;
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

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  projects,
  datasets,
  savedViews,
  onCreateProject,
  onUpdateProjectStatus,
  onDeleteProject,
  onDeleteSavedView,
  onOpenSavedView,
  onSelectDataset,
  onAskAssistantWithDataset,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [datasetId, setDatasetId] = useState(datasets[0]?.id || '');
  const [tags, setTags] = useState('Analytics, D3');

  const filteredProjects = useMemo(
    () =>
      statusFilter === 'all'
        ? projects
        : projects.filter((p) => p.status === statusFilter),
    [projects, statusFilter]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateProject({
      name: name.trim(),
      description: description.trim() || 'Data analytics & visualization workspace project.',
      datasetIds: datasetId ? [datasetId] : [],
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 4),
    });
    setName('');
    setDescription('');
    setComposerOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-zinc-950 dark:text-[#F4F5F8]">
            Projects & Saved Views
          </h1>
          <p className="text-[12.5px] text-zinc-500 dark:text-[#8A8F98] mt-0.5">
            Organize analytical initiatives, linked datasets, and pinned D3 visualization snapshots.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setComposerOpen((o) => !o)}
          className="h-8 px-3.5 inline-flex items-center gap-1.5 text-[12px] font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          New Project
        </button>
      </div>

      {/* Inline New Project Composer */}
      {composerOpen && (
        <form
          onSubmit={handleSubmit}
          className="p-4 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#0E0F12] grid grid-cols-1 md:grid-cols-12 gap-3"
        >
          <div className="md:col-span-4">
            <label className="block text-[11px] text-zinc-500 dark:text-[#8A8F98] mb-1">
              Project Title
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. APAC Latency Cohort Investigation"
              className="w-full h-8 px-2.5 text-[12px] rounded border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#090A0D] text-zinc-900 dark:text-[#F4F5F8] focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-[11px] text-zinc-500 dark:text-[#8A8F98] mb-1">
              Primary Dataset
            </label>
            <select
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              className="w-full h-8 px-2.5 text-[12px] rounded border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#090A0D] text-zinc-900 dark:text-[#F4F5F8] focus:outline-none"
            >
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="block text-[11px] text-zinc-500 dark:text-[#8A8F98] mb-1">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full h-8 px-2.5 text-[12px] rounded border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#090A0D] text-zinc-900 dark:text-[#F4F5F8] focus:outline-none"
            />
          </div>
          <div className="md:col-span-9">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short scope or hypothesis description..."
              className="w-full h-8 px-2.5 text-[12px] rounded border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#090A0D] text-zinc-900 dark:text-[#F4F5F8] focus:outline-none"
            />
          </div>
          <div className="md:col-span-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="h-8 px-3 text-[12px] rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 px-3 text-[12px] font-medium rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-white/[0.08]">
        {(['all', 'active', 'in_review', 'archived'] as const).map((status) => {
          const count =
            status === 'all'
              ? projects.length
              : projects.filter((p) => p.status === status).length;
          const active = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 text-[12px] font-medium border-b-2 transition-colors cursor-pointer ${
                active
                  ? 'border-zinc-900 dark:border-zinc-100 text-zinc-950 dark:text-white'
                  : 'border-transparent text-zinc-500 dark:text-[#8A8F98] hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {status === 'all'
                ? 'All'
                : status === 'in_review'
                  ? 'In Review'
                  : status.charAt(0).toUpperCase() + status.slice(1)}{' '}
              <span className="font-mono text-[11px] opacity-65 ml-1">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Projects List */}
      <div className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0E0F12] divide-y divide-zinc-200 dark:divide-white/[0.06]">
        {filteredProjects.length === 0 ? (
          <div className="p-8 text-center text-[12.5px] text-zinc-500">
            No projects in this status view.
          </div>
        ) : (
          filteredProjects.map((project) => {
            const linkedDatasets = datasets.filter((d) => project.datasetIds.includes(d.id));
            const primaryDs = linkedDatasets[0] || datasets[0];
            const projectViews = savedViews.filter((v) => v.projectId === project.id);

            return (
              <div key={project.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <FolderKanban className="w-4 h-4 text-zinc-400 shrink-0" />
                    <h2 className="text-[14px] font-semibold text-zinc-950 dark:text-[#F4F5F8]">
                      {project.name}
                    </h2>
                    <select
                      aria-label={`Status for ${project.name}`}
                      value={project.status}
                      onChange={(e) =>
                        onUpdateProjectStatus(project.id, e.target.value as ProjectStatus)
                      }
                      className="h-6 px-2 text-[10.5px] font-mono uppercase rounded border border-zinc-200 dark:border-white/[0.12] bg-zinc-50 dark:bg-[#14161D] text-zinc-700 dark:text-zinc-200 cursor-pointer focus:outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="in_review">In Review</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  <p className="text-[12.5px] text-zinc-500 dark:text-[#8A8F98]">
                    {project.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
                    <span className="inline-flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      {linkedDatasets.map((d) => d.name).join(', ') || 'Unassigned'}
                    </span>
                    <span>·</span>
                    <span>{projectViews.length} pinned views</span>
                    <span>·</span>
                    <span>Updated {formatRelativeTime(project.updatedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {primaryDs && (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelectDataset(primaryDs, 'visualize')}
                        className="h-7 px-2.5 text-[11.5px] font-medium rounded border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#14161D] text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-[#1D202A] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Layers className="w-3 h-3" />
                        Studio
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onAskAssistantWithDataset(
                            primaryDs.id,
                            `Analyze project "${project.name}" using dataset ${primaryDs.name} and propose top statistical insights.`
                          )
                        }
                        className="h-7 px-2.5 text-[11.5px] font-medium rounded border border-zinc-200 dark:border-white/[0.1] text-zinc-600 dark:text-[#A0A6B2] hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        Ask AI
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteProject(project.id)}
                    aria-label={`Delete ${project.name}`}
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-zinc-200 dark:border-white/[0.08] text-zinc-400 hover:text-red-500 hover:border-red-500/30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Saved Visualizations Library */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-zinc-500" />
            <h2 className="text-[14px] font-semibold text-zinc-950 dark:text-[#F4F5F8]">
              Pinned D3 Views Library ({savedViews.length})
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {savedViews.map((view) => {
            const ds = datasets.find((d) => d.id === view.datasetId);
            const proj = projects.find((p) => p.id === view.projectId);
            return (
              <div
                key={view.id}
                className="p-4 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#0E0F12] flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-500 dark:text-[#7E8591]">
                      {CHART_LABELS[view.chartType]}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteSavedView(view.id)}
                      aria-label="Remove pinned view"
                      className="text-zinc-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[13px] font-semibold text-zinc-950 dark:text-[#F4F5F8]">
                    {view.title}
                  </div>
                  {view.note && (
                    <p className="text-[11.5px] text-zinc-500 dark:text-[#8A8F98] line-clamp-2">
                      {view.note}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-200/70 dark:border-white/[0.06] flex items-center justify-between gap-2">
                  <div className="text-[10.5px] font-mono text-zinc-400 dark:text-[#6E7480] truncate">
                    {proj?.name || ds?.name || 'Workspace'}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenSavedView(view)}
                    className="text-[11.5px] font-medium text-zinc-900 dark:text-zinc-100 hover:underline shrink-0 cursor-pointer"
                  >
                    Open →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
