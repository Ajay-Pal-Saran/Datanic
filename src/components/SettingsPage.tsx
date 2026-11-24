import React, { useState } from 'react';
import {
  Check,
  Database,
  Download,
  Keyboard,
  Moon,
  Palette,
  RotateCcw,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import { ReasoningDepth, WorkspaceSettings } from '../types/workspace';

interface SettingsPageProps {
  theme: 'dark' | 'light';
  onSetTheme: (theme: 'dark' | 'light') => void;
  settings: WorkspaceSettings;
  onUpdateSettings: (patch: Partial<WorkspaceSettings>) => void;
  onExportWorkspaceBackup: () => void;
  onResetWorkspace: () => void;
}

type SettingsSection = 'general' | 'appearance' | 'data' | 'ai' | 'shortcuts';

const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'data', label: 'Data & Storage', icon: Database },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'shortcuts', label: 'Shortcuts & Data', icon: Keyboard },
];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  onSetTheme,
  settings,
  onUpdateSettings,
  onExportWorkspaceBackup,
  onResetWorkspace,
}) => {
  const [section, setSection] = useState<SettingsSection>('general');
  const [savedToast, setSavedToast] = useState(false);

  const patchWithToast = (patch: Partial<WorkspaceSettings>) => {
    onUpdateSettings(patch);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1600);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-zinc-950 dark:text-[#F4F5F8]">
            Workspace Settings
          </h1>
          <p className="text-[12.5px] text-zinc-500 dark:text-[#8A8F98] mt-0.5">
            Configure Datanic workspace defaults, visual theme, storage routing policies, and AI reasoning preferences.
          </p>
        </div>
        {savedToast && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#14161D] text-[11.5px] font-mono text-zinc-700 dark:text-zinc-200">
            <Check className="w-3.5 h-3.5" />
            Preferences saved
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Settings Nav */}
        <nav className="lg:col-span-3 border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0E0F12] p-1.5 space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={`w-full h-8 px-2.5 rounded-md flex items-center gap-2 text-[12px] text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-950 dark:text-white font-medium'
                    : 'text-zinc-600 dark:text-[#9DA3AF] hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Settings Content */}
        <div className="lg:col-span-9 border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0E0F12] divide-y divide-zinc-200 dark:divide-white/[0.06]">
          {section === 'general' && (
            <>
              <div className="p-5 space-y-4">
                <div>
                  <h2 className="text-[14px] font-semibold text-zinc-950 dark:text-[#F4F5F8]">
                    Workspace Identity
                  </h2>
                  <p className="text-[12px] text-zinc-500 dark:text-[#8A8F98]">
                    Displayed in workspace overview headers and exported snapshot metadata.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-[#9DA3AF] mb-1">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      value={settings.workspaceName}
                      onChange={(e) => patchWithToast({ workspaceName: e.target.value })}
                      className="w-full h-9 px-3 text-[12.5px] rounded-md border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#090A0D] text-zinc-900 dark:text-[#F4F5F8] focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-[#9DA3AF] mb-1">
                      Analyst Display Name
                    </label>
                    <input
                      type="text"
                      value={settings.analystName}
                      onChange={(e) => patchWithToast({ analystName: e.target.value })}
                      className="w-full h-9 px-3 text-[12.5px] rounded-md border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#090A0D] text-zinc-900 dark:text-[#F4F5F8] focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-[#9DA3AF] mb-1">
                      Team / Role
                    </label>
                    <input
                      type="text"
                      value={settings.analystRole}
                      onChange={(e) => patchWithToast({ analystRole: e.target.value })}
                      className="w-full h-9 px-3 text-[12.5px] rounded-md border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#090A0D] text-zinc-900 dark:text-[#F4F5F8] focus:outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-zinc-950 dark:text-[#F4F5F8]">
                    Default Startup Page
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-[#8A8F98]">
                    Choose which page opens automatically when launching Datanic.
                  </div>
                </div>
                <select
                  value={settings.defaultPage}
                  onChange={(e) =>
                    patchWithToast({
                      defaultPage: e.target.value as WorkspaceSettings['defaultPage'],
                    })
                  }
                  className="h-9 px-3 text-[12px] rounded-md border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#090A0D] text-zinc-900 dark:text-[#F4F5F8] cursor-pointer focus:outline-none"
                >
                  <option value="home">Home (Workspace Overview)</option>
                  <option value="assistant">AI Assistant</option>
                  <option value="visualize">Visualization Studio</option>
                  <option value="ingest">Data Ingestion</option>
                </select>
              </div>
            </>
          )}

          {section === 'appearance' && (
            <>
              <div className="p-5 space-y-4">
                <div>
                  <h2 className="text-[14px] font-semibold text-zinc-950 dark:text-[#F4F5F8]">
                    Interface Theme
                  </h2>
                  <p className="text-[12px] text-zinc-500 dark:text-[#8A8F98]">
                    Switch between obsidian dark and crisp porcelain light surfaces.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onSetTheme('dark')}
                    className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                      theme === 'dark'
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100/70 dark:bg-white/[0.06]'
                        : 'border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.16]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-950 dark:text-white">
                        <Moon className="w-3.5 h-3.5" />
                        Obsidian Dark
                      </span>
                      {theme === 'dark' && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />}
                    </div>
                    <div className="h-12 rounded border border-white/10 bg-[#08090A] p-2 flex items-center gap-2">
                      <div className="w-6 h-full rounded bg-[#14161D]" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2 w-2/3 rounded bg-zinc-200/80" />
                        <div className="h-1.5 w-1/2 rounded bg-zinc-700" />
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSetTheme('light')}
                    className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100/70 dark:bg-white/[0.06]'
                        : 'border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.16]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-950 dark:text-white">
                        <Sun className="w-3.5 h-3.5" />
                        Porcelain Light
                      </span>
                      {theme === 'light' && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />}
                    </div>
                    <div className="h-12 rounded border border-zinc-200 bg-[#FAFAFA] p-2 flex items-center gap-2">
                      <div className="w-6 h-full rounded bg-zinc-200/80" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2 w-2/3 rounded bg-zinc-900" />
                        <div className="h-1.5 w-1/2 rounded bg-zinc-400" />
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-zinc-950 dark:text-[#F4F5F8]">
                    Data Grid Density
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-[#8A8F98]">
                    Adjust row padding across ingestion previews and schema tables.
                  </div>
                </div>
                <div className="inline-flex rounded-md border border-zinc-200 dark:border-white/[0.1] p-0.5 bg-zinc-50 dark:bg-[#090A0D]">
                  {(['compact', 'comfortable'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => patchWithToast({ tableDensity: d })}
                      className={`px-3 py-1 text-[11.5px] rounded capitalize cursor-pointer ${
                        settings.tableDensity === d
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-medium'
                          : 'text-zinc-500 dark:text-[#8A8F98]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {section === 'data' && (
            <>
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-zinc-950 dark:text-[#F4F5F8]">
                    Storage Routing Policy
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-[#8A8F98]">
                    Smart Auto-Route stores local CSV/Excel/PDF files and streams URLs, APIs, and data lakes zero-copy.
                  </div>
                </div>
                <select
                  value={settings.defaultStorageMode}
                  onChange={(e) =>
                    patchWithToast({
                      defaultStorageMode: e.target.value as WorkspaceSettings['defaultStorageMode'],
                    })
                  }
                  className="h-9 px-3 text-[12px] rounded-md border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#090A0D] text-zinc-900 dark:text-[#F4F5F8] cursor-pointer focus:outline-none"
                >
                  <option value="auto">Smart Auto-Route (Recommended)</option>
                  <option value="stored">Always Store in Workspace</option>
                  <option value="passthrough">Prefer Zero-Copy Pass-Through</option>
                </select>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[13px] font-medium text-zinc-950 dark:text-[#F4F5F8]">
                    Outlier Z-Score Sensitivity
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-[#8A8F98]">
                    Standard deviation threshold used to flag extreme anomalies during Tier-1 audits.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1.5"
                    max="3.5"
                    step="0.1"
                    value={settings.outlierZThreshold}
                    onChange={(e) =>
                      patchWithToast({ outlierZThreshold: Number(e.target.value) })
                    }
                    className="w-32 accent-zinc-900 dark:accent-zinc-100 cursor-pointer"
                  />
                  <span className="font-mono text-[12px] w-10 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                    {settings.outlierZThreshold.toFixed(1)}σ
                  </span>
                </div>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-zinc-950 dark:text-[#F4F5F8]">
                    Default Missing-Value Strategy
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-[#8A8F98]">
                    Pre-selected remediation rule for Tier-2 cleaning proposals.
                  </div>
                </div>
                <select
                  value={settings.missingValueStrategy}
                  onChange={(e) =>
                    patchWithToast({
                      missingValueStrategy: e.target.value as WorkspaceSettings['missingValueStrategy'],
                    })
                  }
                  className="h-9 px-3 text-[12px] rounded-md border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#090A0D] text-zinc-900 dark:text-[#F4F5F8] cursor-pointer focus:outline-none"
                >
                  <option value="median_mode">Impute Median / Mode</option>
                  <option value="drop_rows">Exclude Incomplete Rows</option>
                  <option value="flag_only">Flag Only (Preserve Nulls)</option>
                </select>
              </div>
            </>
          )}

          {section === 'ai' && (
            <>
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-zinc-950 dark:text-[#F4F5F8]">
                    Default AI Reasoning Depth
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-[#8A8F98]">
                    Controls default thinking depth in the Datanic AI Assistant composer.
                  </div>
                </div>
                <div className="inline-flex rounded-md border border-zinc-200 dark:border-white/[0.1] p-0.5 bg-zinc-50 dark:bg-[#090A0D]">
                  {(['low', 'medium', 'high'] as ReasoningDepth[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => patchWithToast({ defaultReasoningDepth: lvl })}
                      className={`px-3 py-1 text-[11.5px] rounded cursor-pointer ${
                        settings.defaultReasoningDepth === lvl
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-medium'
                          : 'text-zinc-500 dark:text-[#8A8F98]'
                      }`}
                    >
                      {lvl === 'low' ? 'Fast' : lvl === 'medium' ? 'Balanced' : 'Deep'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-zinc-950 dark:text-[#F4F5F8]">
                    Assistant Response Tone
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-[#8A8F98]">
                    Tailor how Datanic AI frames statistical explanations and code output.
                  </div>
                </div>
                <select
                  value={settings.assistantTone}
                  onChange={(e) =>
                    patchWithToast({
                      assistantTone: e.target.value as WorkspaceSettings['assistantTone'],
                    })
                  }
                  className="h-9 px-3 text-[12px] rounded-md border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#090A0D] text-zinc-900 dark:text-[#F4F5F8] cursor-pointer focus:outline-none"
                >
                  <option value="technical">Technical Data Scientist</option>
                  <option value="concise">Executive Concise</option>
                  <option value="step_by_step">Step-by-Step Walkthrough</option>
                </select>
              </div>

              <div className="p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[13px] font-medium text-zinc-950 dark:text-[#F4F5F8]">
                    Auto-Attach Active Dataset Context
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-[#8A8F98]">
                    Automatically ground new AI Assistant threads with the currently active dataset schema and correlations.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoAttachContext}
                  onChange={(e) => patchWithToast({ autoAttachContext: e.target.checked })}
                  className="w-4 h-4 accent-zinc-900 dark:accent-zinc-100 cursor-pointer"
                />
              </div>
            </>
          )}

          {section === 'shortcuts' && (
            <>
              <div className="p-5 space-y-3">
                <h2 className="text-[14px] font-semibold text-zinc-950 dark:text-[#F4F5F8]">
                  Keyboard Shortcuts
                </h2>
                <div className="divide-y divide-zinc-200/70 dark:divide-white/[0.06] text-[12px]">
                  {[
                    ['Open Command Palette', '⌘ K / Ctrl K'],
                    ['Send AI Assistant Prompt', 'Enter'],
                    ['New Line in AI Composer', 'Shift + Enter'],
                    ['Close Command Palette / Modal', 'Esc'],
                  ].map(([label, keys]) => (
                    <div key={label} className="py-2.5 flex items-center justify-between">
                      <span className="text-zinc-600 dark:text-[#9DA3AF]">{label}</span>
                      <kbd className="px-2 py-0.5 text-[11px] font-mono rounded border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#14161D] text-zinc-800 dark:text-zinc-200">
                        {keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-zinc-950 dark:text-[#F4F5F8]">
                    Workspace Backup & Reset
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-[#8A8F98]">
                    Export projects, saved views, and preferences as JSON or restore initial demo datasets.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onExportWorkspaceBackup}
                    className="h-8 px-3 text-[12px] font-medium rounded-md border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#14161D] text-zinc-800 dark:text-zinc-100 inline-flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-[#1C1F29] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={onResetWorkspace}
                    className="h-8 px-3 text-[12px] font-medium rounded-md border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Workspace
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
