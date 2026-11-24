import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  Check,
  Copy,
  Database,
  Layers,
  MessageSquare,
  PanelLeft,
  Paperclip,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  AssistantMessage,
  AssistantThread,
  ReasoningDepth,
  WorkspaceDataset,
  WorkspacePage,
  WorkspaceSettings,
} from '../types/workspace';
import {
  computeCorrelationMatrix,
  pickBestCohortColumn,
  profileDataset,
} from '../utils/dataEngine';
import { formatRelativeTime } from '../utils/workspaceDefaults';

interface AIAssistantPageProps {
  datasets: WorkspaceDataset[];
  activeDataset: WorkspaceDataset;
  threads: AssistantThread[];
  activeThreadId: string | null;
  settings: WorkspaceSettings;
  pendingPrompt?: { datasetId?: string; prompt: string; nonce: number } | null;
  onUpdateThreads: React.Dispatch<React.SetStateAction<AssistantThread[]>>;
  onSelectThread: (id: string | null) => void;
  onSelectDataset: (ds: WorkspaceDataset, targetPage?: WorkspacePage) => void;
  onNavigate: (page: WorkspacePage) => void;
  onLogActivity: (title: string, detail: string) => void;
}

const REASONING_LABELS: Record<ReasoningDepth, string> = {
  low: 'Fast',
  medium: 'Balanced',
  high: 'Deep',
};

// Safe lightweight Markdown renderer (no dangerouslySetInnerHTML)
const MarkdownMessage: React.FC<{ content: string }> = ({ content }) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const renderInline = (text: string, keyPrefix: string) => {
    const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return tokens.map((tok, i) => {
      if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
        return (
          <code
            key={`${keyPrefix}-c-${i}`}
            className="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-white/[0.08] font-mono text-[11.5px] text-zinc-900 dark:text-zinc-100"
          >
            {tok.slice(1, -1)}
          </code>
        );
      }
      if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
        return (
          <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-zinc-950 dark:text-white">
            {tok.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={`${keyPrefix}-t-${i}`}>{tok}</React.Fragment>;
    });
  };

  const blocks = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed text-zinc-800 dark:text-[#D9DCE4]">
      {blocks.map((block, bIdx) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          const inner = block.slice(3, -3);
          const firstNl = inner.indexOf('\n');
          const lang = firstNl > -1 ? inner.slice(0, firstNl).trim() : 'code';
          const code = firstNl > -1 ? inner.slice(firstNl + 1) : inner;

          return (
            <div
              key={`code-${bIdx}`}
              className="rounded-md border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-[#090A0D] overflow-hidden"
            >
              <div className="px-3 py-1.5 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between text-[10.5px] font-mono text-zinc-500 dark:text-[#7E8591]">
                <span>{lang || 'snippet'}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(code);
                    setCopiedIdx(bIdx);
                    setTimeout(() => setCopiedIdx(null), 1500);
                  }}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  {copiedIdx === bIdx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedIdx === bIdx ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto text-[11.5px] font-mono text-zinc-800 dark:text-zinc-200">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        const lines = block.split('\n');
        const elements: React.ReactNode[] = [];
        let listItems: string[] = [];

        const flushList = (key: string) => {
          if (listItems.length > 0) {
            elements.push(
              <ul key={key} className="list-disc pl-5 space-y-1">
                {listItems.map((item, idx) => (
                  <li key={`${key}-${idx}`}>{renderInline(item, `${key}-${idx}`)}</li>
                ))}
              </ul>
            );
            listItems = [];
          }
        };

        lines.forEach((rawLine, lIdx) => {
          const line = rawLine.trim();
          if (!line) {
            flushList(`l-${bIdx}-${lIdx}`);
            return;
          }
          if (line.startsWith('### ')) {
            flushList(`l-${bIdx}-${lIdx}`);
            elements.push(
              <h4
                key={`h3-${bIdx}-${lIdx}`}
                className="text-[13.5px] font-semibold text-zinc-950 dark:text-[#F4F5F8] pt-1"
              >
                {renderInline(line.slice(4), `h3-${bIdx}-${lIdx}`)}
              </h4>
            );
          } else if (line.startsWith('## ')) {
            flushList(`l-${bIdx}-${lIdx}`);
            elements.push(
              <h3
                key={`h2-${bIdx}-${lIdx}`}
                className="text-[14.5px] font-semibold text-zinc-950 dark:text-[#F4F5F8] pt-1.5"
              >
                {renderInline(line.slice(3), `h2-${bIdx}-${lIdx}`)}
              </h3>
            );
          } else if (line.startsWith('- ') || line.startsWith('* ')) {
            listItems.push(line.slice(2));
          } else if (/^\d+\.\s+/.test(line)) {
            listItems.push(line.replace(/^\d+\.\s+/, ''));
          } else {
            flushList(`l-${bIdx}-${lIdx}`);
            elements.push(
              <p key={`p-${bIdx}-${lIdx}`}>{renderInline(line, `p-${bIdx}-${lIdx}`)}</p>
            );
          }
        });
        flushList(`l-${bIdx}-end`);

        return <React.Fragment key={`blk-${bIdx}`}>{elements}</React.Fragment>;
      })}
    </div>
  );
};

export const AIAssistantPage: React.FC<AIAssistantPageProps> = ({
  datasets,
  activeDataset,
  threads,
  activeThreadId,
  settings,
  pendingPrompt,
  onUpdateThreads,
  onSelectThread,
  onSelectDataset,
  onNavigate,
  onLogActivity,
}) => {
  const [historyOpen, setHistoryOpen] = useState(true);
  const [input, setInput] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | 'all'>(
    settings.autoAttachContext ? activeDataset.id : 'all'
  );
  const [reasoningDepth, setReasoningDepth] = useState<ReasoningDepth>(settings.defaultReasoningDepth);
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [attachedSnippet, setAttachedSnippet] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastHandledNonceRef = useRef<number>(0);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const contextDataset = useMemo(
    () =>
      selectedDatasetId === 'all'
        ? null
        : datasets.find((d) => d.id === selectedDatasetId) || activeDataset,
    [selectedDatasetId, datasets, activeDataset]
  );

  // Sync context selector when switching threads
  useEffect(() => {
    if (activeThread) {
      setSelectedDatasetId(activeThread.datasetId);
    }
  }, [activeThread?.id]);

  // Auto-scroll when messages stream
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages.length, streaming]);

  // Auto-resize composer textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  // Build grounded statistical payload for server-side Gemini context
  const buildDatasetContextPayload = (dsId: string | 'all') => {
    const summarizeDs = (ds: WorkspaceDataset) => {
      const report = profileDataset(ds.name, ds.columns, ds.activeRows);
      const corrs = computeCorrelationMatrix(ds.columns, ds.activeRows, report.columnProfiles);
      return {
        id: ds.id,
        name: ds.name,
        modality: ds.modality,
        storagePolicy: ds.storagePolicy,
        isCleaned: ds.isCleaned,
        rowCount: ds.activeRows.length,
        columnCount: ds.columns.length,
        healthScore: report.healthScore,
        missingCellsTotal: report.missingCellsTotal,
        outlierCellsTotal: report.outlierCellsTotal,
        columns: report.columnProfiles.map((p) => ({
          name: p.name,
          type: p.semanticType,
          missing: p.missingCount,
          outliers: p.outlierCount,
          mean: p.mean,
          median: p.median,
          min: p.min,
          max: p.max,
          topCategories: p.topCategories?.slice(0, 4),
        })),
        topCorrelations: corrs.slice(0, 8),
        sampleRows: ds.activeRows.slice(0, 12),
      };
    };

    if (dsId === 'all') {
      return {
        scope: 'all_workspace_datasets',
        datasetCount: datasets.length,
        datasets: datasets.map((d) => summarizeDs(d)),
      };
    }
    const target = datasets.find((d) => d.id === dsId) || activeDataset;
    return {
      scope: 'single_dataset',
      dataset: summarizeDs(target),
    };
  };

  const starterPrompts = useMemo(() => {
    const ds = contextDataset || activeDataset;
    const report = profileDataset(ds.name, ds.columns, ds.activeRows);
    const numCols = report.columnProfiles
      .filter((p) => p.semanticType === 'numeric')
      .map((p) => p.name);
    const colA = numCols[0] || ds.columns[0];
    const colB = numCols[numCols.length - 1] || ds.columns[1] || ds.columns[0];
    const groupCol = pickBestCohortColumn(report.columnProfiles) || ds.columns[1] || ds.columns[0];

    return [
      {
        title: 'Diagnose outliers & root causes',
        prompt: `Identify every statistical outlier and missing-value risk in ${ds.name}, and explain which records drive variance in ${colB}.`,
      },
      {
        title: 'Uncover hidden correlations',
        prompt: `Analyze the strongest positive and negative correlations across ${ds.name}, especially between ${colA} and ${colB}, and suggest the best D3 chart to expose them.`,
      },
      {
        title: 'Cohort segmentation summary',
        prompt: `Compare performance segments across ${groupCol} in ${ds.name} and write a concise executive brief with concrete numbers.`,
      },
      {
        title: 'Generate SQL & Python pipeline',
        prompt: `Write a clean SQL aggregation query and a Python pandas snippet to clean ${ds.name} and compute Z-score anomaly flags for ${colB}.`,
      },
    ];
  }, [contextDataset, activeDataset]);

  const sendMessage = async (overrideText?: string, overrideDsId?: string | 'all') => {
    const rawPrompt = (overrideText ?? input).trim();
    if (!rawPrompt || streaming) return;

    const fullUserContent = attachedSnippet.trim()
      ? `${rawPrompt}\n\n\`\`\`\n${attachedSnippet.trim()}\n\`\`\``
      : rawPrompt;

    const targetDsId = overrideDsId ?? selectedDatasetId;
    const targetDs = targetDsId === 'all' ? null : datasets.find((d) => d.id === targetDsId) || activeDataset;

    const nowIso = new Date().toISOString();
    const userMsg: AssistantMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: fullUserContent,
      timestamp: nowIso,
      datasetId: targetDs?.id,
      datasetName: targetDs ? targetDs.name : 'All Workspace Datasets',
      reasoningDepth,
    };

    const assistantMsgId = `msg-a-${Date.now() + 1}`;
    const placeholderAssistantMsg: AssistantMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: nowIso,
      datasetId: targetDs?.id,
      datasetName: targetDs ? targetDs.name : 'All Workspace Datasets',
      reasoningDepth,
    };

    let threadId = activeThreadId;
    let historyForApi: { role: string; content: string }[] = [];

    if (!threadId || !threads.some((t) => t.id === threadId)) {
      threadId = `thread-${Date.now()}`;
      const newThread: AssistantThread = {
        id: threadId,
        title: rawPrompt.length > 48 ? `${rawPrompt.slice(0, 48)}…` : rawPrompt,
        datasetId: targetDsId,
        updatedAt: nowIso,
        messages: [userMsg, placeholderAssistantMsg],
      };
      onUpdateThreads((prev) => [newThread, ...prev]);
      onSelectThread(threadId);
      historyForApi = [{ role: 'user', content: fullUserContent }];
    } else {
      const existing = threads.find((t) => t.id === threadId)!;
      historyForApi = [
        ...existing.messages
          .filter((m) => !m.error && m.content.trim().length > 0)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: fullUserContent },
      ];
      onUpdateThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                datasetId: targetDsId,
                updatedAt: nowIso,
                messages: [...t.messages, userMsg, placeholderAssistantMsg],
              }
            : t
        )
      );
    }

    if (!overrideText) {
      setInput('');
      setAttachedSnippet('');
      setSnippetOpen(false);
    }

    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const currentThreadId = threadId;

    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyForApi,
          datasetContext: buildDatasetContextPayload(targetDsId),
          reasoningDepth,
          assistantTone: settings.assistantTone,
        }),
      });

      if (!response.ok) {
        let errorMsg = `Assistant request failed (HTTP ${response.status})`;
        try {
          const errJson = await response.json();
          if (errJson?.error) errorMsg = errJson.error;
        } catch {
          // ignore parse error
        }
        onUpdateThreads((prev) =>
          prev.map((t) =>
            t.id === currentThreadId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, error: errorMsg } : m
                  ),
                }
              : t
          )
        );
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming response body unavailable.');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const payloadStr = line.slice(5).trim();
          if (!payloadStr) continue;
          try {
            const payload = JSON.parse(payloadStr);
            if (payload.error) {
              onUpdateThreads((prev) =>
                prev.map((t) =>
                  t.id === currentThreadId
                    ? {
                        ...t,
                        messages: t.messages.map((m) =>
                          m.id === assistantMsgId ? { ...m, error: payload.error } : m
                        ),
                      }
                    : t
                )
              );
              return;
            }
            if (payload.delta) {
              accumulated += payload.delta;
              const snapshot = accumulated;
              onUpdateThreads((prev) =>
                prev.map((t) =>
                  t.id === currentThreadId
                    ? {
                        ...t,
                        updatedAt: new Date().toISOString(),
                        messages: t.messages.map((m) =>
                          m.id === assistantMsgId ? { ...m, content: snapshot } : m
                        ),
                      }
                    : t
                )
              );
            }
          } catch {
            // Skip malformed SSE frame
          }
        }
      }

      onLogActivity(
        'AI Assistant Analysis',
        `${rawPrompt.slice(0, 64)}${rawPrompt.length > 64 ? '…' : ''}`
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unable to reach AI Assistant endpoint.';
      onUpdateThreads((prev) =>
        prev.map((t) =>
          t.id === currentThreadId
            ? {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === assistantMsgId ? { ...m, error: msg } : m
                ),
              }
            : t
        )
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  // Support external launch with pre-populated prompt (e.g. from Home "Ask AI" or Command Palette)
  useEffect(() => {
    if (pendingPrompt && pendingPrompt.nonce !== lastHandledNonceRef.current) {
      lastHandledNonceRef.current = pendingPrompt.nonce;
      const targetDs = pendingPrompt.datasetId || activeDataset.id;
      setSelectedDatasetId(targetDs);
      onSelectThread(null);
      sendMessage(pendingPrompt.prompt, targetDs);
    }
  }, [pendingPrompt]);

  const handleStopStream = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handleNewThread = () => {
    if (streaming) handleStopStream();
    onSelectThread(null);
    setInput('');
    textareaRef.current?.focus();
  };

  const handleDeleteThread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeThreadId === id) {
      onSelectThread(null);
    }
  };

  return (
    <div className="h-[calc(100vh-5.75rem)] min-h-[580px] flex border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0B0C0E] overflow-hidden">
      {/* Left Thread History Rail */}
      {historyOpen && (
        <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-zinc-200 dark:border-white/[0.08] bg-[#FAFAFA] dark:bg-[#090A0C]">
          <div className="p-2.5 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleNewThread}
              className="flex-1 h-8 px-2.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-[12px] font-medium inline-flex items-center justify-center gap-1.5 hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="px-2 py-1 text-[10.5px] font-mono uppercase tracking-wider text-zinc-400 dark:text-[#6E7480]">
              Threads ({threads.length})
            </div>
            {threads.length === 0 ? (
              <div className="px-2 py-6 text-center text-[11.5px] text-zinc-400 dark:text-[#6E7480]">
                Start a conversation to save thread history here.
              </div>
            ) : (
              threads.map((thread) => {
                const isSelected = thread.id === activeThreadId;
                return (
                  <div
                    key={thread.id}
                    onClick={() => onSelectThread(thread.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSelectThread(thread.id);
                    }}
                    className={`group px-2.5 py-2 rounded-md flex items-start justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-200/80 dark:bg-white/[0.08] text-zinc-950 dark:text-white'
                        : 'text-zinc-600 dark:text-[#9DA3AF] hover:bg-zinc-200/40 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium truncate">{thread.title}</div>
                      <div className="text-[10px] font-mono text-zinc-400 dark:text-[#6E7480] mt-0.5">
                        {thread.messages.filter((m) => m.role === 'user').length} turns ·{' '}
                        {formatRelativeTime(thread.updatedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteThread(thread.id, e)}
                      aria-label="Delete thread"
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* Main Conversational Surface */}
      <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-[#0D0E12]">
        {/* Top Assistant Bar */}
        <div className="h-11 px-4 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setHistoryOpen((o) => !o)}
              aria-label="Toggle thread history"
              className="hidden md:inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-semibold text-zinc-950 dark:text-[#F4F5F8] truncate">
              {activeThread ? activeThread.title : 'Datanic AI Assistant'}
            </span>
            <span className="hidden sm:inline text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
              · {contextDataset ? contextDataset.name : 'All Datasets'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleNewThread}
              className="md:hidden h-7 px-2.5 text-[11px] font-medium rounded border border-zinc-200 dark:border-white/[0.1] text-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              New
            </button>
            {contextDataset && (
              <button
                type="button"
                onClick={() => onSelectDataset(contextDataset, 'visualize')}
                className="h-7 px-2.5 text-[11px] font-medium rounded border border-zinc-200 dark:border-white/[0.1] text-zinc-600 dark:text-[#A0A6B2] hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-white/[0.04] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3 h-3" />
                Open Studio
              </button>
            )}
          </div>
        </div>

        {/* Messages Area OR Claude/ChatGPT-style Centered Empty State */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          {!activeThread || activeThread.messages.length === 0 ? (
            <div className="max-w-2xl mx-auto pt-8 sm:pt-14 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-[#08090A] flex items-center justify-center mb-4 shadow-sm">
                <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
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
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight text-zinc-950 dark:text-[#F4F5F8]">
                What would you like to discover?
              </h1>
              <p className="mt-1.5 text-[13px] text-zinc-500 dark:text-[#8A8F98] max-w-lg">
                Ask questions in natural language grounded in your workspace schemas, correlations,
                and outlier telemetry—or generate SQL, Python, and D3 visualization plans.
              </p>

              {/* Dynamic Dataset Starter Prompt Grid */}
              <div className="mt-8 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {starterPrompts.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => sendMessage(item.prompt)}
                    className="p-3.5 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-[#FAFAFA] dark:bg-[#121318] hover:border-zinc-300 dark:hover:border-white/[0.18] hover:bg-zinc-100/70 dark:hover:bg-[#171920] transition-colors cursor-pointer"
                  >
                    <div className="text-[12.5px] font-medium text-zinc-900 dark:text-[#F4F5F8]">
                      {item.title}
                    </div>
                    <div className="mt-1 text-[11.5px] text-zinc-500 dark:text-[#8A8F98] line-clamp-2">
                      {item.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6 pb-4">
              {activeThread.messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-[#08090A] flex items-center justify-center shrink-0 mt-0.5">
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
                      </div>
                    )}

                    <div
                      className={`min-w-0 ${
                        isUser
                          ? 'max-w-[82%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-zinc-900 dark:bg-[#1D1F27] text-white dark:text-[#F4F5F8] border border-transparent dark:border-white/[0.08]'
                          : 'flex-1'
                      }`}
                    >
                      {isUser ? (
                        <div className="space-y-1.5">
                          <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content}
                          </div>
                          {msg.datasetName && (
                            <div className="text-[10px] font-mono text-zinc-400 dark:text-[#7E8591]">
                              Context: {msg.datasetName}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              Datanic AI
                            </span>
                            {msg.reasoningDepth && (
                              <span>· {REASONING_LABELS[msg.reasoningDepth]} reasoning</span>
                            )}
                            {msg.datasetName && <span>· {msg.datasetName}</span>}
                          </div>

                          {msg.error ? (
                            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400 text-[12px] flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <div>
                                <div className="font-medium">AI Assistant Request Error</div>
                                <div className="mt-0.5 opacity-90">{msg.error}</div>
                              </div>
                            </div>
                          ) : msg.content ? (
                            <MarkdownMessage content={msg.content} />
                          ) : (
                            <div className="flex items-center gap-2 text-[12px] text-zinc-500 dark:text-[#8A8F98] py-1">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
                              <span>Analyzing workspace context…</span>
                            </div>
                          )}

                          {/* Action Bar below finished Assistant reply */}
                          {!msg.error && msg.content && !streaming && (
                            <div className="pt-1 flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(msg.content);
                                  setCopiedMsgId(msg.id);
                                  setTimeout(() => setCopiedMsgId(null), 1500);
                                }}
                                className="h-6 px-2 text-[11px] rounded border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-[#8A8F98] hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                              >
                                {copiedMsgId === msg.id ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                {copiedMsgId === msg.id ? 'Copied' : 'Copy'}
                              </button>

                              <button
                                type="button"
                                onClick={() => onNavigate('visualize')}
                                className="h-6 px-2 text-[11px] rounded border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-[#8A8F98] hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Layers className="w-3 h-3" />
                                Visualize in D3
                              </button>

                              <button
                                type="button"
                                onClick={() => onNavigate('clean')}
                                className="h-6 px-2 text-[11px] rounded border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-[#8A8F98] hover:text-zinc-950 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                Run Cleaner
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ChatGPT / Claude-Style Floating Composer Box */}
        <div className="px-4 sm:px-6 pb-4 pt-2 border-t border-zinc-200/70 dark:border-white/[0.06] bg-white dark:bg-[#0D0E12]">
          <div className="max-w-3xl mx-auto">
            {snippetOpen && (
              <div className="mb-2 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#121318] p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono text-zinc-500 dark:text-[#8A8F98]">
                    Attach CSV, JSON, SQL, or log snippet
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSnippetOpen(false);
                      setAttachedSnippet('');
                    }}
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={attachedSnippet}
                  onChange={(e) => setAttachedSnippet(e.target.value)}
                  placeholder="Paste raw rows, JSON payload, or query snippet..."
                  className="w-full bg-transparent text-[11.5px] font-mono text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none resize-none"
                />
              </div>
            )}

            <div className="rounded-xl border border-zinc-300 dark:border-white/[0.12] bg-[#FAFAFA] dark:bg-[#13141A] focus-within:border-zinc-500 dark:focus-within:border-white/[0.28] transition-colors shadow-sm">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`Ask Datanic AI about ${contextDataset ? contextDataset.name : 'your workspace datasets'}...`}
                className="w-full px-4 pt-3.5 pb-2 bg-transparent text-[13.5px] text-zinc-950 dark:text-[#F4F5F8] placeholder:text-zinc-400 dark:placeholder:text-[#6E7480] focus:outline-none resize-none leading-relaxed"
              />

              {/* Composer Bottom Controls */}
              <div className="px-3 pb-2.5 pt-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Dataset Context Selector */}
                  <label className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#1A1C23] text-[11px] text-zinc-700 dark:text-[#C8CCD6]">
                    <Database className="w-3 h-3 text-zinc-400 shrink-0" />
                    <select
                      aria-label="Dataset context"
                      value={selectedDatasetId}
                      onChange={(e) => setSelectedDatasetId(e.target.value)}
                      className="bg-transparent focus:outline-none max-w-[175px] truncate cursor-pointer text-[11px]"
                    >
                      <option value="all">All Workspace Datasets ({datasets.length})</option>
                      {datasets.map((ds) => (
                        <option key={ds.id} value={ds.id}>
                          {ds.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Reasoning Depth Selector */}
                  <div className="inline-flex items-center rounded-md border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#1A1C23] p-0.5">
                    {(['low', 'medium', 'high'] as ReasoningDepth[]).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setReasoningDepth(lvl)}
                        className={`h-6 px-2 rounded text-[10.5px] font-medium transition-colors cursor-pointer ${
                          reasoningDepth === lvl
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950'
                            : 'text-zinc-500 dark:text-[#8A8F98] hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        {REASONING_LABELS[lvl]}
                      </button>
                    ))}
                  </div>

                  {/* Attach Snippet Toggle */}
                  <button
                    type="button"
                    onClick={() => setSnippetOpen((s) => !s)}
                    title="Attach data snippet"
                    className={`h-7 px-2 rounded-md border text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer ${
                      snippetOpen || attachedSnippet
                        ? 'border-zinc-900 dark:border-zinc-200 text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-white/[0.08]'
                        : 'border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#1A1C23] text-zinc-500 dark:text-[#8A8F98] hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Paperclip className="w-3 h-3" />
                    <span className="hidden sm:inline">Snippet</span>
                  </button>
                </div>

                {/* Send / Stop CTA */}
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-[10.5px] font-mono text-zinc-400 dark:text-[#6E7480]">
                    ⏎ Send
                  </span>
                  {streaming ? (
                    <button
                      type="button"
                      onClick={handleStopStream}
                      aria-label="Stop response"
                      className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-white transition-colors cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendMessage()}
                      disabled={!input.trim()}
                      aria-label="Send message"
                      className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-zinc-400 dark:text-[#6E7480] px-1">
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Grounded in live workspace schema & statistics
              </span>
              <span className="inline-flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" />
                Tone: {settings.assistantTone.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
