import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Menu, Moon, Search, Sun } from 'lucide-react';
import { AIAssistantPage } from './components/AIAssistantPage';
import { CleaningWorkbench } from './components/CleaningWorkbench';
import { CommandPalette } from './components/CommandPalette';
import { EnterpriseSidebar } from './components/EnterpriseSidebar';
import { HomeDashboard } from './components/HomeDashboard';
import { IngestionHub } from './components/IngestionHub';
import { ProjectsPage } from './components/ProjectsPage';
import { SettingsPage } from './components/SettingsPage';
import { VisualizationStudio } from './components/VisualizationStudio';
import {
  ActivityEvent,
  AssistantThread,
  D3ChartType,
  DataRow,
  ProjectStatus,
  SavedVisualization,
  WorkspaceDataset,
  WorkspacePage,
  WorkspaceProject,
  WorkspaceSettings,
} from './types/workspace';
import {
  computeCorrelationMatrix,
  executeDataCleaning,
  profileDataset,
} from './utils/dataEngine';
import { SAMPLE_DATASETS } from './utils/sampleDatasets';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  createInitialActivity,
  createInitialProjects,
  createInitialSavedViews,
} from './utils/workspaceDefaults';

const PAGE_TITLES: Record<WorkspacePage, string> = {
  home: 'Home',
  assistant: 'AI Assistant',
  projects: 'Projects & Views',
  ingest: 'Data Ingestion',
  clean: 'Quality & Cleaning',
  visualize: 'Visualization Studio',
  nl_query: 'Pattern Query',
  settings: 'Settings',
};

function loadJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved =
        localStorage.getItem('datanic-theme') || localStorage.getItem('prismata-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  const [settings, setSettings] = useState<WorkspaceSettings>(() => ({
    ...DEFAULT_WORKSPACE_SETTINGS,
    ...loadJsonStorage<Partial<WorkspaceSettings>>('datanic-settings', {}),
  }));

  // Default to Home page (or user's saved default startup page, defaulting to 'home')
  const [page, setPage] = useState<WorkspacePage>(() => settings.defaultPage || 'home');
  const [datasets, setDatasets] = useState<WorkspaceDataset[]>(SAMPLE_DATASETS);
  const [activeDatasetId, setActiveDatasetId] = useState<string>(SAMPLE_DATASETS[0].id);

  const [projects, setProjects] = useState<WorkspaceProject[]>(() =>
    loadJsonStorage<WorkspaceProject[]>(
      'datanic-projects',
      createInitialProjects(SAMPLE_DATASETS)
    )
  );
  const [savedViews, setSavedViews] = useState<SavedVisualization[]>(() =>
    loadJsonStorage<SavedVisualization[]>(
      'datanic-saved-views',
      createInitialSavedViews(SAMPLE_DATASETS)
    )
  );
  const [activities, setActivities] = useState<ActivityEvent[]>(() =>
    loadJsonStorage<ActivityEvent[]>('datanic-activity', createInitialActivity())
  );
  const [assistantThreads, setAssistantThreads] = useState<AssistantThread[]>(() =>
    loadJsonStorage<AssistantThread[]>('datanic-ai-threads', [])
  );
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [commandOpen, setCommandOpen] = useState<boolean>(false);

  const [externalChartRequest, setExternalChartRequest] = useState<{
    chartType: D3ChartType;
    xColumn?: string;
    yColumn?: string;
    groupColumn?: string;
    nonce: number;
  } | null>(null);
  const [externalNlQueryRequest, setExternalNlQueryRequest] = useState<{
    query: string;
    nonce: number;
  } | null>(null);
  const [pendingAssistantPrompt, setPendingAssistantPrompt] = useState<{
    datasetId?: string;
    prompt: string;
    nonce: number;
  } | null>(null);

  // Persist workspace state to localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('datanic-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('datanic-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('datanic-projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('datanic-saved-views', JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    localStorage.setItem('datanic-activity', JSON.stringify(activities.slice(0, 30)));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem('datanic-ai-threads', JSON.stringify(assistantThreads.slice(0, 25)));
  }, [assistantThreads]);

  // Global Cmd+K / Ctrl+K shortcut for Command Palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const logActivity = (type: ActivityEvent['type'], title: string, detail: string) => {
    setActivities((prev) => [
      {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        title,
        detail,
        timestamp: new Date().toISOString(),
      },
      ...prev.slice(0, 29),
    ]);
  };

  const activeDataset = useMemo(
    () => datasets.find((d) => d.id === activeDatasetId) || datasets[0],
    [datasets, activeDatasetId]
  );

  const qualityReport = useMemo(
    () => profileDataset(activeDataset.name, activeDataset.columns, activeDataset.activeRows),
    [activeDataset]
  );

  const correlations = useMemo(
    () =>
      computeCorrelationMatrix(
        activeDataset.columns,
        activeDataset.activeRows,
        qualityReport.columnProfiles
      ),
    [activeDataset, qualityReport]
  );

  const syncStorageWithServer = async (ds: WorkspaceDataset) => {
    try {
      await fetch('/api/storage/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ds.id,
          name: ds.name,
          sourceType: ds.modality,
          storageMode: ds.storagePolicy,
          columns: ds.columns,
          rows: ds.activeRows,
        }),
      });
    } catch {
      // Non-blocking storage sync
    }
  };

  useEffect(() => {
    syncStorageWithServer(activeDataset);
  }, [activeDataset.id, activeDataset.isCleaned]);

  useEffect(() => {
    if (!streamActive) return;
    const timer = setInterval(() => {
      setDatasets((prev) =>
        prev.map((ds) => {
          if (ds.id !== activeDatasetId) return ds;
          const template = ds.activeRows[ds.activeRows.length - 1] || ds.rawRows[0] || {};
          const nextRow: DataRow = { ...template };
          ds.columns.forEach((col, i) => {
            const val = template[col];
            if (i === 0 && typeof val === 'string') {
              nextRow[col] = `${val.split('-')[0]}-${ds.activeRows.length + 101}`;
            } else if (typeof val === 'number') {
              const jitter = 1 + (Math.random() - 0.48) * 0.14;
              nextRow[col] = Number((val * jitter).toFixed(2));
            }
          });
          return {
            ...ds,
            activeRows: [...ds.activeRows.slice(-60), nextRow],
          };
        })
      );
    }, 1500);
    return () => clearInterval(timer);
  }, [streamActive, activeDatasetId]);

  const handleInjectStreamAnomaly = () => {
    setDatasets((prev) =>
      prev.map((ds) => {
        if (ds.id !== activeDatasetId) return ds;
        const template = ds.activeRows[0] || {};
        const spikeRow: DataRow = { ...template };
        ds.columns.forEach((col, i) => {
          const val = template[col];
          if (i === 0) {
            spikeRow[col] = `SPIKE-${ds.activeRows.length + 1}`;
          } else if (typeof val === 'number') {
            spikeRow[col] = Number((val * 2.85).toFixed(2));
          }
        });
        return {
          ...ds,
          activeRows: [...ds.activeRows, spikeRow],
        };
      })
    );
  };

  const handleIngestNewDataset = (newDs: WorkspaceDataset, autoAdvanceToClean = false) => {
    setDatasets((prev) => [newDs, ...prev.filter((d) => d.id !== newDs.id)]);
    setActiveDatasetId(newDs.id);
    syncStorageWithServer(newDs);
    logActivity(
      'ingest',
      `Connected "${newDs.name}"`,
      `${newDs.activeRows.length} rows · ${newDs.storagePolicy === 'stored' ? 'Workspace Stored' : 'Zero-Copy Pass-Through'}`
    );
    if (autoAdvanceToClean) {
      setPage('clean');
    }
  };

  const handleExecuteCleaning = (
    selectedOpTypes: string[],
    customInstruction: string,
    remoteSummary?: string
  ) => {
    const result = executeDataCleaning(
      activeDataset.columns,
      activeDataset.activeRows,
      selectedOpTypes,
      customInstruction
    );

    const updated: WorkspaceDataset = {
      ...activeDataset,
      columns: result.cleanedColumns,
      activeRows: result.cleanedRows,
      isCleaned: true,
      lastDiffs: result.diffs,
      cleaningHistory: [
        ...activeDataset.cleaningHistory,
        {
          timestamp: new Date().toISOString(),
          operationsApplied: selectedOpTypes,
          cellsModified: result.diffs.length,
          rowsBefore: activeDataset.activeRows.length,
          rowsAfter: result.cleanedRows.length,
          summary: remoteSummary || result.summaryText,
          aiTier: 'Tier 2 — Medium-Level AI Cleaner (gemini-4-hydrogen · ThinkingLevel.MEDIUM)',
        },
      ],
    };

    setDatasets((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    syncStorageWithServer(updated);
    logActivity(
      'clean',
      `Cleaned "${activeDataset.name}"`,
      `${result.diffs.length} cells remediated across ${selectedOpTypes.length} rules`
    );
  };

  const handleResetToRaw = () => {
    setDatasets((prev) =>
      prev.map((d) =>
        d.id === activeDataset.id
          ? {
              ...d,
              activeRows: d.rawRows.map((r) => ({ ...r })),
              isCleaned: false,
              lastDiffs: [],
              cleaningHistory: [],
            }
          : d
      )
    );
  };

  const handleCreateProject = (payload: {
    name: string;
    description: string;
    datasetIds: string[];
    tags: string[];
  }) => {
    const now = new Date().toISOString();
    const created: WorkspaceProject = {
      id: `proj-${Date.now()}`,
      name: payload.name,
      description: payload.description,
      status: 'active',
      owner: settings.analystName,
      datasetIds: payload.datasetIds,
      tags: payload.tags,
      createdAt: now,
      updatedAt: now,
    };
    setProjects((prev) => [created, ...prev]);
    logActivity('project', `Created Project "${created.name}"`, created.description);
  };

  const handleUpdateProjectStatus = (projectId: string, status: ProjectStatus) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, status, updatedAt: new Date().toISOString() } : p
      )
    );
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  const handlePinView = (view: {
    title: string;
    chartType: D3ChartType;
    xColumn: string;
    yColumn: string;
    groupColumn: string;
  }) => {
    const matchingProject =
      projects.find((p) => p.datasetIds.includes(activeDataset.id)) || projects[0];
    const saved: SavedVisualization = {
      id: `view-${Date.now()}`,
      projectId: matchingProject?.id || 'unassigned',
      datasetId: activeDataset.id,
      title: view.title,
      chartType: view.chartType,
      xColumn: view.xColumn,
      yColumn: view.yColumn,
      groupColumn: view.groupColumn,
      createdAt: new Date().toISOString(),
    };
    setSavedViews((prev) => [saved, ...prev]);
    logActivity('visualize', `Pinned "${view.title}"`, `Saved to ${matchingProject?.name || 'Workspace'}`);
  };

  const handleOpenSavedView = (view: SavedVisualization) => {
    const ds = datasets.find((d) => d.id === view.datasetId);
    if (ds) setActiveDatasetId(ds.id);
    setPage('visualize');
    setExternalChartRequest({
      chartType: view.chartType,
      xColumn: view.xColumn,
      yColumn: view.yColumn,
      groupColumn: view.groupColumn,
      nonce: Date.now(),
    });
  };

  const handleAskAssistantWithDataset = (datasetId: string, prompt?: string) => {
    setPage('assistant');
    if (prompt) {
      setPendingAssistantPrompt({ datasetId, prompt, nonce: Date.now() });
    }
  };

  const handleExportCleanCsv = () => {
    const cols = activeDataset.columns;
    const headerLine = cols.join(',');
    const bodyLines = activeDataset.activeRows.map((row) =>
      cols
        .map((c) => {
          const val = row[c];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(',')
    );
    const csvContent = [headerLine, ...bodyLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDataset.name.toLowerCase().replace(/\s+/g, '-')}-cleaned.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logActivity('export', `Exported CSV`, activeDataset.name);
  };

  const handleExportWorkspaceBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      workspaceName: settings.workspaceName,
      settings,
      projects,
      savedViews,
      datasetSummaries: datasets.map((d) => ({
        id: d.id,
        name: d.name,
        modality: d.modality,
        storagePolicy: d.storagePolicy,
        rows: d.activeRows.length,
        columns: d.columns,
      })),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `datanic-workspace-backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResetWorkspace = () => {
    localStorage.removeItem('datanic-settings');
    localStorage.removeItem('datanic-projects');
    localStorage.removeItem('datanic-saved-views');
    localStorage.removeItem('datanic-activity');
    localStorage.removeItem('datanic-ai-threads');
    setSettings(DEFAULT_WORKSPACE_SETTINGS);
    setDatasets(SAMPLE_DATASETS);
    setActiveDatasetId(SAMPLE_DATASETS[0].id);
    setProjects(createInitialProjects(SAMPLE_DATASETS));
    setSavedViews(createInitialSavedViews(SAMPLE_DATASETS));
    setActivities(createInitialActivity());
    setAssistantThreads([]);
    setActiveThreadId(null);
    setPage('home');
  };

  return (
    <div className="min-h-screen flex bg-[#FAFAFA] dark:bg-[#08090A] text-zinc-900 dark:text-[#F4F5F8]">
      {/* Compact 220px Linear Rail */}
      <EnterpriseSidebar
        stage={page}
        onChangeStage={setPage}
        datasets={datasets}
        activeDataset={activeDataset}
        onSelectDataset={(ds) => setActiveDatasetId(ds.id)}
        projectCount={projects.length}
        healthScore={qualityReport.healthScore}
        streamActive={streamActive}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onOpenCommandPalette={() => setCommandOpen(true)}
      />

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Compact 44px Linear Top Header */}
        <header className="sticky top-0 z-30 h-11 px-4 lg:px-6 bg-[#FAFAFA]/90 dark:bg-[#08090A]/90 backdrop-blur border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open workspace navigation"
              className="lg:hidden p-1 -ml-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] min-w-0">
              <span className="hidden md:inline text-zinc-500 dark:text-[#8A8F98] truncate max-w-[220px]">
                {page === 'home' || page === 'projects' || page === 'settings'
                  ? settings.workspaceName
                  : activeDataset.name}
              </span>
              <ChevronRight className="hidden md:block w-3 h-3 text-zinc-400 dark:text-[#6E7480] shrink-0" />
              <span className="text-zinc-900 dark:text-[#F4F5F8] font-medium truncate">
                {PAGE_TITLES[page]}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden lg:inline text-[11px] font-mono text-zinc-400 dark:text-[#6E7480] tabular-nums mr-1">
              {activeDataset.activeRows.length} rows · {activeDataset.columns.length} cols ·{' '}
              {qualityReport.healthScore}%
            </span>

            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Open command palette"
              className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2 text-[11px] text-zinc-500 dark:text-[#8A8F98] bg-white dark:bg-[#121317] border border-zinc-200 dark:border-white/[0.08] rounded hover:border-zinc-300 dark:hover:border-white/[0.15] transition-colors cursor-pointer"
            >
              <Search className="w-3 h-3" />
              <kbd className="font-mono text-[10px]">⌘K</kbd>
            </button>

            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex items-center justify-center w-7 h-7 rounded border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#121317] text-zinc-600 dark:text-[#A0A6B2] hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCleanCsv}
              className="h-7 px-2.5 text-[11px] font-medium text-white bg-zinc-900 dark:bg-[#1C1E26] border border-transparent dark:border-white/[0.1] hover:bg-zinc-800 dark:hover:bg-[#252833] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Export CSV
            </button>
          </div>
        </header>

        {/* Main Workspace Viewport */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {page === 'home' && (
            <HomeDashboard
              workspaceSettings={settings}
              projects={projects}
              datasets={datasets}
              activeDataset={activeDataset}
              savedViews={savedViews}
              activities={activities}
              assistantThreadCount={assistantThreads.length}
              streamActive={streamActive}
              onNavigate={setPage}
              onSelectDataset={(ds, target) => {
                setActiveDatasetId(ds.id);
                if (target) setPage(target);
              }}
              onCreateProject={handleCreateProject}
              onOpenSavedView={handleOpenSavedView}
              onAskAssistantWithDataset={handleAskAssistantWithDataset}
            />
          )}

          {page === 'assistant' && (
            <AIAssistantPage
              datasets={datasets}
              activeDataset={activeDataset}
              threads={assistantThreads}
              activeThreadId={activeThreadId}
              settings={settings}
              pendingPrompt={pendingAssistantPrompt}
              onUpdateThreads={setAssistantThreads}
              onSelectThread={setActiveThreadId}
              onSelectDataset={(ds, target) => {
                setActiveDatasetId(ds.id);
                if (target) setPage(target);
              }}
              onNavigate={setPage}
              onLogActivity={(title, detail) => logActivity('assistant', title, detail)}
            />
          )}

          {page === 'projects' && (
            <ProjectsPage
              projects={projects}
              datasets={datasets}
              savedViews={savedViews}
              onCreateProject={handleCreateProject}
              onUpdateProjectStatus={handleUpdateProjectStatus}
              onDeleteProject={handleDeleteProject}
              onDeleteSavedView={(id) =>
                setSavedViews((prev) => prev.filter((v) => v.id !== id))
              }
              onOpenSavedView={handleOpenSavedView}
              onSelectDataset={(ds, target) => {
                setActiveDatasetId(ds.id);
                if (target) setPage(target);
              }}
              onAskAssistantWithDataset={(dsId, prompt) =>
                handleAskAssistantWithDataset(dsId, prompt)
              }
            />
          )}

          {page === 'ingest' && (
            <IngestionHub
              activeDataset={activeDataset}
              savedDatasets={datasets}
              onSelectDataset={(ds) => setActiveDatasetId(ds.id)}
              onIngestNewDataset={handleIngestNewDataset}
              onProceedToCleaning={() => setPage('clean')}
              streamActive={streamActive}
              onToggleStream={() => setStreamActive((s) => !s)}
              onInjectStreamAnomaly={handleInjectStreamAnomaly}
            />
          )}

          {page === 'clean' && (
            <CleaningWorkbench
              dataset={activeDataset}
              qualityReport={qualityReport}
              onExecuteCleaning={handleExecuteCleaning}
              onResetToRaw={handleResetToRaw}
              onProceedToViz={() => setPage('visualize')}
            />
          )}

          {(page === 'visualize' || page === 'nl_query') && (
            <VisualizationStudio
              dataset={activeDataset}
              profiles={qualityReport.columnProfiles}
              correlations={correlations}
              healthScore={qualityReport.healthScore}
              initialSubTab={page === 'nl_query' ? 'nl_query' : 'visualize'}
              theme={theme}
              externalChartRequest={externalChartRequest}
              externalNlQueryRequest={externalNlQueryRequest}
              onPinView={handlePinView}
            />
          )}

          {page === 'settings' && (
            <SettingsPage
              theme={theme}
              onSetTheme={setTheme}
              settings={settings}
              onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
              onExportWorkspaceBackup={handleExportWorkspaceBackup}
              onResetWorkspace={handleResetWorkspace}
            />
          )}
        </main>
      </div>

      {/* Global Cmd+K Command Palette */}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        datasets={datasets}
        activeDatasetId={activeDataset.id}
        onSelectDataset={(ds) => setActiveDatasetId(ds.id)}
        onChangeStage={setPage}
        onSelectChartTopology={(chartType) => {
          setPage('visualize');
          setExternalChartRequest({ chartType, nonce: Date.now() });
        }}
        onRunNlQuery={(query) => {
          setPage('visualize');
          setExternalNlQueryRequest({ query, nonce: Date.now() });
        }}
        onAskAssistant={(prompt) => {
          setPage('assistant');
          setPendingAssistantPrompt({
            datasetId: activeDataset.id,
            prompt,
            nonce: Date.now(),
          });
        }}
        onExportCsv={handleExportCleanCsv}
      />
    </div>
  );
}
