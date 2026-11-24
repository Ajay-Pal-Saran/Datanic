import React from 'react';
import {
  Database,
  FolderKanban,
  Home,
  Layers,
  MessageSquare,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { WorkspaceDataset, WorkspacePage } from '../types/workspace';

export type WorkspaceStage = WorkspacePage;

interface EnterpriseSidebarProps {
  stage: WorkspacePage;
  onChangeStage: (stage: WorkspacePage) => void;
  datasets: WorkspaceDataset[];
  activeDataset: WorkspaceDataset;
  onSelectDataset: (ds: WorkspaceDataset) => void;
  projectCount: number;
  healthScore: number;
  streamActive: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenCommandPalette: () => void;
}

const WORKSPACE_ITEMS: {
  id: WorkspacePage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: 'projects';
}[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
  { id: 'projects', label: 'Projects', icon: FolderKanban, badgeKey: 'projects' },
];

const PIPELINE_ITEMS: {
  id: WorkspacePage;
  index: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'ingest', index: '01', label: 'Data Ingestion', icon: Upload },
  { id: 'clean', index: '02', label: 'Quality & Clean', icon: ShieldCheck },
  { id: 'visualize', index: '03', label: 'Visualization Studio', icon: Layers },
  { id: 'nl_query', index: '04', label: 'Pattern Query', icon: MessageSquare },
];

export const EnterpriseSidebar: React.FC<EnterpriseSidebarProps> = ({
  stage,
  onChangeStage,
  datasets,
  activeDataset,
  onSelectDataset,
  projectCount,
  healthScore,
  streamActive,
  mobileOpen,
  onCloseMobile,
  onOpenCommandPalette,
}) => {
  const sidebarBody = (
    <div className="flex flex-col h-full bg-[#F6F6F8] dark:bg-[#0B0C0E] text-zinc-600 dark:text-[#A0A6B2] select-none">
      {/* Compact Brand Header (44px) */}
      <div className="h-11 px-3.5 flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.08] shrink-0">
        <button
          type="button"
          onClick={() => {
            onChangeStage('home');
            onCloseMobile();
          }}
          className="flex items-center gap-2 text-left cursor-pointer"
        >
          <span
            aria-hidden="true"
            className="w-6 h-6 rounded-[6px] bg-zinc-900 dark:bg-zinc-100 text-white dark:text-[#08090A] flex items-center justify-center shrink-0"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
              <path
                d="M4 3.5H9.25C13.15 3.5 16 6.25 16 10C16 13.75 13.15 16.5 9.25 16.5H4V3.5Z"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinejoin="round"
              />
              <path
                d="M7.5 7.25H10.1C11.55 7.25 12.6 8.38 12.6 10C12.6 11.62 11.55 12.75 10.1 12.75H7.5V7.25Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="text-[13.5px] font-semibold tracking-tight text-zinc-900 dark:text-[#F4F5F8] font-display whitespace-nowrap">
            Datanic
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation sidebar"
          className="lg:hidden p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Command Trigger */}
      <div className="px-2.5 pt-2.5">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full h-7 px-2.5 flex items-center justify-between rounded-md border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#121317] text-[12px] text-zinc-500 dark:text-[#7E8591] hover:border-zinc-300 dark:hover:border-white/[0.15] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Search className="w-3 h-3 shrink-0" />
            <span>Command...</span>
          </span>
          <kbd className="text-[10px] font-mono text-zinc-400 dark:text-[#6E7480]">⌘K</kbd>
        </button>
      </div>

      {/* Primary Workspace Navigation, Pipeline & Datasets */}
      <div className="px-2.5 py-3.5 space-y-5 flex-1 overflow-y-auto">
        {/* Workspace Section */}
        <div>
          <div className="px-2 mb-1 text-[11px] font-medium text-zinc-400 dark:text-[#6E7480]">
            Workspace
          </div>
          <nav aria-label="Workspace pages" className="space-y-0.5">
            {WORKSPACE_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = stage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChangeStage(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full h-8 flex items-center justify-between gap-2 px-2 rounded-md text-left text-[12px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-zinc-200/75 dark:bg-white/[0.08] text-zinc-950 dark:text-[#F4F5F8] font-medium'
                      : 'text-zinc-600 dark:text-[#A0A6B2] hover:bg-zinc-200/40 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-[#F4F5F8]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive
                          ? 'text-zinc-900 dark:text-[#F4F5F8]'
                          : 'text-zinc-400 dark:text-[#6E7480]'
                      }`}
                    />
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  </span>
                  {item.badgeKey === 'projects' && (
                    <span className="text-[10px] font-mono tabular-nums text-zinc-400 dark:text-[#6E7480]">
                      {projectCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Data Pipeline Section */}
        <div>
          <div className="px-2 mb-1 text-[11px] font-medium text-zinc-400 dark:text-[#6E7480]">
            Pipeline
          </div>
          <nav aria-label="Primary workspace stages" className="space-y-0.5">
            {PIPELINE_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = stage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChangeStage(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full h-8 flex items-center gap-2 px-2 rounded-md text-left text-[12px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-zinc-200/75 dark:bg-white/[0.08] text-zinc-950 dark:text-[#F4F5F8] font-medium'
                      : 'text-zinc-600 dark:text-[#A0A6B2] hover:bg-zinc-200/40 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-[#F4F5F8]'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive
                        ? 'text-zinc-900 dark:text-[#F4F5F8]'
                        : 'text-zinc-400 dark:text-[#6E7480]'
                    }`}
                  />
                  <span className="truncate whitespace-nowrap">
                    {item.index}. {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Workspace Datasets */}
        <div>
          <div className="px-2 mb-1 flex items-center justify-between text-[11px] font-medium text-zinc-400 dark:text-[#6E7480]">
            <span>Datasets</span>
            <span className="font-mono tabular-nums">{datasets.length}</span>
          </div>
          <div className="space-y-0.5">
            {datasets.map((ds) => {
              const isSelected = ds.id === activeDataset.id;
              return (
                <button
                  key={ds.id}
                  type="button"
                  onClick={() => {
                    onSelectDataset(ds);
                    onCloseMobile();
                  }}
                  className={`w-full h-8 flex items-center justify-between gap-2 px-2 rounded-md text-left text-[12px] transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-200/80 dark:bg-white/[0.09] text-zinc-950 dark:text-[#F4F5F8] font-medium'
                      : 'text-zinc-600 dark:text-[#A0A6B2] hover:bg-zinc-200/40 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-[#F4F5F8]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Database
                      className={`w-3 h-3 shrink-0 ${
                        isSelected
                          ? 'text-zinc-900 dark:text-[#F4F5F8]'
                          : 'text-zinc-400 dark:text-[#6E7480]'
                      }`}
                    />
                    <span className="truncate">{ds.name}</span>
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-zinc-400 dark:text-[#6E7480] shrink-0">
                    {ds.activeRows.length}r
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Settings Link + Bottom Hairline Telemetry */}
      <div className="border-t border-zinc-200 dark:border-white/[0.08]">
        <div className="px-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              onChangeStage('settings');
              onCloseMobile();
            }}
            className={`w-full h-8 flex items-center gap-2 px-2 rounded-md text-left text-[12px] transition-colors cursor-pointer ${
              stage === 'settings'
                ? 'bg-zinc-200/75 dark:bg-white/[0.08] text-zinc-950 dark:text-[#F4F5F8] font-medium'
                : 'text-zinc-600 dark:text-[#A0A6B2] hover:bg-zinc-200/40 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-[#F4F5F8]'
            }`}
          >
            <Settings
              className={`w-3.5 h-3.5 shrink-0 ${
                stage === 'settings'
                  ? 'text-zinc-900 dark:text-[#F4F5F8]'
                  : 'text-zinc-400 dark:text-[#6E7480]'
              }`}
            />
            <span>Settings</span>
          </button>
        </div>

        <div className="px-3.5 py-2.5 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 dark:text-[#6E7480]">Storage</span>
            <span
              className={`font-mono font-medium ${
                activeDataset.storagePolicy === 'stored'
                  ? 'text-zinc-900 dark:text-zinc-200'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {activeDataset.storagePolicy === 'stored' ? 'Stored' : 'Pass-Through'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-zinc-500 dark:text-[#6E7480]">Health</span>
            <span className="font-mono font-semibold text-zinc-900 dark:text-[#F4F5F8] tabular-nums">
              {healthScore}%
            </span>
          </div>

          {streamActive && (
            <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-white/[0.06] text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3" />
                <span>Stream</span>
              </span>
              <span className="font-mono">Live</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[220px] shrink-0 border-r border-zinc-200 dark:border-white/[0.08] bg-[#F6F6F8] dark:bg-[#0B0C0E]">
        <div className="sticky top-0 h-screen">{sidebarBody}</div>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[82vw] h-full z-10 border-r border-zinc-200 dark:border-white/[0.08]">
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
};
