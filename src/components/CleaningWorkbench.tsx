import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  RotateCcw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  CleaningActionProposal,
  DatasetQualityReport,
  WorkspaceDataset,
} from '../types/workspace';

interface CleaningWorkbenchProps {
  dataset: WorkspaceDataset;
  qualityReport: DatasetQualityReport;
  onExecuteCleaning: (selectedOpTypes: string[], customInstruction: string, aiSummary?: string) => void;
  onResetToRaw: () => void;
  onProceedToViz: () => void;
}

export const CleaningWorkbench: React.FC<CleaningWorkbenchProps> = ({
  dataset,
  qualityReport,
  onExecuteCleaning,
  onResetToRaw,
  onProceedToViz,
}) => {
  const [selectedOps, setSelectedOps] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const p of qualityReport.proposals) {
      map[p.operationType] = p.selected;
    }
    return map;
  });

  const [customInstruction, setCustomInstruction] = useState('');
  const [aiDiagnosisNote, setAiDiagnosisNote] = useState<string | null>(null);
  const [aiQuestionNote, setAiQuestionNote] = useState<string | null>(null);
  const [aiCleanAuditNotes, setAiCleanAuditNotes] = useState<string[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const toggleProposal = (p: CleaningActionProposal) => {
    setSelectedOps((prev) => ({
      ...prev,
      [p.operationType]: !prev[p.operationType],
    }));
  };

  const handleRunTier1GeminiScan = async () => {
    setIsDiagnosing(true);
    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName: dataset.name,
          columnProfiles: qualityReport.columnProfiles,
          sampleRows: dataset.activeRows.slice(0, 10),
          statisticalIssues: {
            missingCellsTotal: qualityReport.missingCellsTotal,
            dirtyFormatCellsTotal: qualityReport.dirtyFormatCellsTotal,
            outlierCellsTotal: qualityReport.outlierCellsTotal,
            duplicateRowsTotal: qualityReport.duplicateRowsTotal,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiDiagnosisNote(data.executiveDiagnosis);
        setAiQuestionNote(data.userPromptQuestion);
      } else {
        setAiDiagnosisNote(qualityReport.executiveDiagnosis);
      }
    } catch {
      setAiDiagnosisNote(qualityReport.executiveDiagnosis);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleRunTier2Cleaning = async () => {
    const activeOpTypes = Object.entries(selectedOps)
      .filter(([, checked]) => checked)
      .map(([op]) => op);

    const finalOps =
      activeOpTypes.length > 0
        ? activeOpTypes
        : qualityReport.proposals.map((p) => p.operationType);

    onExecuteCleaning(finalOps, customInstruction);

    setIsCleaning(true);
    try {
      const res = await fetch('/api/ai/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName: dataset.name,
          selectedOperations: finalOps,
          customInstruction,
          summaryBefore: {
            rows: qualityReport.totalRows,
            missing: qualityReport.missingCellsTotal,
            dirty: qualityReport.dirtyFormatCellsTotal,
            outliers: qualityReport.outlierCellsTotal,
          },
          sampleDirtyRows: dataset.activeRows.slice(0, 8),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.technicalAuditNotes)) {
          setAiCleanAuditNotes(data.technicalAuditNotes);
        }
      }
    } catch {
      // Deterministic cleaning already applied
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold text-zinc-900 dark:text-[#F4F5F8]">
            Quality Audit &amp; Tier-2 Cleaning
          </h1>
          <p className="text-[12px] text-zinc-500 dark:text-[#8A8F98] truncate">
            {qualityReport.aiTierLabel} · Review flagged anomalies before applying mutations
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {dataset.isCleaned && (
            <button
              type="button"
              onClick={onResetToRaw}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-[#141519] border border-zinc-200 dark:border-white/[0.08] rounded-md hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rollback Raw</span>
            </button>
          )}
          <button
            type="button"
            onClick={onProceedToViz}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-white dark:text-zinc-950 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Open Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4-Column Flat Hairline Telemetry Strip */}
      <div className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0F1013] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-zinc-200 dark:divide-white/[0.08]">
        <div className="px-4 py-3">
          <div className="text-[11px] text-zinc-500 dark:text-[#6E7480]">Structural Health</div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-lg font-semibold font-mono tabular-nums text-zinc-900 dark:text-[#F4F5F8]">
              {qualityReport.healthScore}%
            </span>
            <span
              className={`text-[11px] font-medium ${
                qualityReport.healthScore >= 95
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : qualityReport.healthScore >= 75
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {qualityReport.readinessVerdict === 'clean'
                ? 'Ready'
                : qualityReport.readinessVerdict === 'ready_with_warnings'
                  ? 'Minor Warnings'
                  : 'Needs Cleaning'}
            </span>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-[11px] text-zinc-500 dark:text-[#6E7480]">Missing Cells</div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-lg font-semibold font-mono tabular-nums text-zinc-900 dark:text-[#F4F5F8]">
              {qualityReport.missingCellsTotal}
            </span>
            <span className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
              {qualityReport.totalRows} rows
            </span>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-[11px] text-zinc-500 dark:text-[#6E7480]">Dirty Formats</div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-lg font-semibold font-mono tabular-nums text-zinc-900 dark:text-[#F4F5F8]">
              {qualityReport.dirtyFormatCellsTotal}
            </span>
            <span className="text-[11px] text-zinc-400 dark:text-[#6E7480]">Currency / Units</span>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="text-[11px] text-zinc-500 dark:text-[#6E7480]">Outliers &amp; Dupes</div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-lg font-semibold font-mono tabular-nums text-zinc-900 dark:text-[#F4F5F8]">
              {qualityReport.outlierCellsTotal + qualityReport.duplicateRowsTotal}
            </span>
            <span className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
              {qualityReport.outlierCellsTotal} IQR · {qualityReport.duplicateRowsTotal} dup
            </span>
          </div>
        </div>
      </div>

      {/* Unified Split Container: Tier-1 Audit & Approval | Tier-2 Diff Inspector */}
      <div className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0F1013] grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-white/[0.08] overflow-hidden">
        <div className="lg:col-span-7 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-200 dark:border-white/[0.06]">
              <div className="flex items-center gap-2 text-[12px] font-medium text-zinc-800 dark:text-zinc-200">
                <Cpu className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                <span>Tier-1 Diagnostic Audit</span>
              </div>
              <button
                type="button"
                disabled={isDiagnosing}
                onClick={handleRunTier1GeminiScan}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] rounded transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isDiagnosing ? 'Auditing...' : 'Refresh AI Audit'}</span>
              </button>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-[#141519] border border-zinc-200 dark:border-white/[0.06] rounded-md space-y-1.5 text-[12px]">
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {aiDiagnosisNote || qualityReport.executiveDiagnosis}
              </p>
              <div className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
                &ldquo;{aiQuestionNote || qualityReport.userPromptQuestion}&rdquo;
              </div>
            </div>

            {qualityReport.proposals.length > 0 ? (
              <div className="divide-y divide-zinc-200 dark:divide-white/[0.06] border border-zinc-200 dark:border-white/[0.08] rounded-md overflow-hidden">
                {qualityReport.proposals.map((prop) => {
                  const checked = Boolean(selectedOps[prop.operationType] ?? prop.selected);
                  return (
                    <label
                      key={prop.id}
                      className={`flex items-start gap-3 p-3 transition-colors cursor-pointer ${
                        checked
                          ? 'bg-zinc-100/80 dark:bg-white/[0.06]'
                          : 'hover:bg-zinc-50 dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProposal(prop)}
                        className="mt-0.5 rounded border-zinc-300 dark:border-white/20 accent-zinc-900 dark:accent-zinc-100"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[12px] font-medium text-zinc-900 dark:text-[#F4F5F8]">
                            {prop.title}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
                            {prop.affectedCells} cells · {prop.targetColumn}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-[#8A8F98] mt-0.5">
                          {prop.proposedFix}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-emerald-500/8 border border-emerald-500/25 rounded-md flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="text-[12px]">
                  <div className="font-medium text-zinc-900 dark:text-[#F4F5F8]">
                    Dataset Clean &amp; Structurally Validated
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-[#8A8F98]">
                    Zero missing values, dirty strings, or duplicates remain.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="custom-clean-rule" className="block text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98] mb-1">
                Custom Cleaning Rule (Optional)
              </label>
              <input
                id="custom-clean-rule"
                type="text"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="e.g., Standardize labels or drop rows missing primary keys..."
                className="w-full h-8 px-2.5 text-[12px] bg-zinc-50 dark:bg-[#141519] border border-zinc-200 dark:border-white/[0.08] rounded-md text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-[#6E7480] focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
              gemini-4-hydrogen · MEDIUM
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onProceedToViz}
                className="h-8 px-3 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.08] rounded-md hover:bg-zinc-50 dark:hover:bg-white/[0.04] cursor-pointer"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={isCleaning}
                onClick={handleRunTier2Cleaning}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[12px] font-medium text-white dark:text-zinc-950 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white rounded-md disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{isCleaning ? 'Cleaning...' : 'Execute Tier-2 Cleaning'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Diff Inspector */}
        <div className="lg:col-span-5 p-5 bg-zinc-50/40 dark:bg-[#0C0D10] space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-white/[0.06]">
            <h3 className="text-[12px] font-semibold text-zinc-900 dark:text-[#F4F5F8]">
              Transformation Diffs
            </h3>
            <span className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
              {dataset.lastDiffs.length} cell(s)
            </span>
          </div>

          {dataset.cleaningHistory.length > 0 ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/8 border border-emerald-500/25 rounded-md text-[11px] text-zinc-800 dark:text-zinc-200">
                {dataset.cleaningHistory[dataset.cleaningHistory.length - 1].summary}
              </div>

              {aiCleanAuditNotes.length > 0 && (
                <ul className="space-y-1 text-[11px] text-zinc-500 dark:text-[#8A8F98] list-disc pl-4">
                  {aiCleanAuditNotes.map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              )}

              <div className="overflow-y-auto max-h-72 border border-zinc-200 dark:border-white/[0.08] rounded-md bg-white dark:bg-[#0F1013]">
                <table className="w-full text-left border-collapse text-[11px] font-mono tabular-nums">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-[#141519] border-b border-zinc-200 dark:border-white/[0.08] h-8">
                      <th className="px-2.5 text-zinc-500 dark:text-[#6E7480]">Row</th>
                      <th className="px-2.5 text-zinc-500 dark:text-[#6E7480]">Column</th>
                      <th className="px-2.5 text-rose-600 dark:text-rose-400">Before</th>
                      <th className="px-2.5 text-emerald-600 dark:text-emerald-400">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.05]">
                    {dataset.lastDiffs.slice(0, 35).map((diff, idx) => (
                      <tr key={idx} className="h-8">
                        <td className="px-2.5 text-zinc-400 dark:text-[#6E7480]">#{diff.rowIndex + 1}</td>
                        <td className="px-2.5 font-sans font-medium text-zinc-800 dark:text-zinc-200">
                          {diff.column}
                        </td>
                        <td className="px-2.5 text-rose-600 dark:text-rose-400 line-through">
                          {diff.before === null ? 'null' : String(diff.before)}
                        </td>
                        <td className="px-2.5 text-emerald-600 dark:text-emerald-400 font-medium">
                          {diff.after === null ? 'null' : String(diff.after)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-1.5">
              <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
              <div className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200">
                No Cleaning Executed Yet
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-[#6E7480] max-w-xs mx-auto">
                Approve proposals on the left and run Tier-2 Cleaning to inspect cell-by-cell diffs.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Column Schema Audit Table */}
      <div className="border border-zinc-200 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#0F1013] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between">
          <span className="text-[12px] font-semibold text-zinc-900 dark:text-[#F4F5F8]">
            Column Schema &amp; Distribution Audit
          </span>
          <span className="text-[11px] font-mono text-zinc-500 dark:text-[#6E7480]">
            {qualityReport.totalRows} rows
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-[#121317] border-b border-zinc-200 dark:border-white/[0.08] h-9 text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98]">
                <th className="px-4">Column</th>
                <th className="px-4">Type</th>
                <th className="px-4 text-right">Missing</th>
                <th className="px-4 text-right">Dirty</th>
                <th className="px-4 text-right">Unique</th>
                <th className="px-4 text-right">Mean</th>
                <th className="px-4 text-right">Median</th>
                <th className="px-4 text-right">IQR</th>
                <th className="px-4 text-right">Outliers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.05] text-[12px] tabular-nums">
              {qualityReport.columnProfiles.map((col) => (
                <tr key={col.name} className="h-9 hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 font-medium text-zinc-900 dark:text-zinc-100">{col.name}</td>
                  <td className="px-4 font-mono text-zinc-500 dark:text-[#8A8F98]">{col.semanticType}</td>
                  <td
                    className={`px-4 text-right font-mono ${
                      col.missingCount > 0 ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-zinc-400 dark:text-[#6E7480]'
                    }`}
                  >
                    {col.missingCount} ({col.missingPct}%)
                  </td>
                  <td
                    className={`px-4 text-right font-mono ${
                      col.dirtyFormatCount > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-zinc-400 dark:text-[#6E7480]'
                    }`}
                  >
                    {col.dirtyFormatCount}
                  </td>
                  <td className="px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">{col.uniqueCount}</td>
                  <td className="px-4 text-right font-mono text-zinc-800 dark:text-zinc-200">
                    {col.mean !== undefined ? col.mean.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 text-right font-mono text-zinc-800 dark:text-zinc-200">
                    {col.median !== undefined ? col.median.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 text-right font-mono text-zinc-600 dark:text-zinc-400">
                    {col.iqr !== undefined ? col.iqr.toLocaleString() : '—'}
                  </td>
                  <td
                    className={`px-4 text-right font-mono ${
                      col.outlierCount > 0 ? 'text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-400 dark:text-[#6E7480]'
                    }`}
                  >
                    {col.outlierCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
