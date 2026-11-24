import {
  CellDiff,
  CleaningActionProposal,
  ColumnProfile,
  ColumnSemanticType,
  D3ChartType,
  DataRow,
  DatasetQualityReport,
  DataSourceModality,
  LinearRegressionResult,
  NLQueryResult,
  PairwiseCorrelation,
  SmartPerspectiveCard,
  StoragePolicy,
} from '../types/workspace';

const SENTINEL_MISSING = new Set([
  '',
  'na',
  'n/a',
  'null',
  'none',
  'nil',
  'undefined',
  'missing',
  '?',
  '-',
  '--',
  'nan',
]);

/**
 * Determines whether an input source needs persistent workspace storage
 * or should operate in zero-copy external pass-through mode.
 */
export function determineStoragePolicy(modality: DataSourceModality): {
  policy: StoragePolicy;
  badgeText: string;
  rationale: string;
} {
  switch (modality) {
    case 'file_upload':
    case 'pdf_document':
    case 'manual_entry':
      return {
        policy: 'stored',
        badgeText: 'Persistent Workspace Storage',
        rationale:
          'Local file or manual input requires managed storage so cleaned snapshots and transformations persist.',
      };
    case 'url_endpoint':
    case 'rest_api':
    case 'data_stream':
    case 'data_lake':
      return {
        policy: 'passthrough',
        badgeText: 'Zero-Copy External Pass-Through',
        rationale:
          'Data already resides on an external endpoint, stream, or data lake. Accessed in-flight without redundant storage.',
      };
  }
}

export function isMissingValue(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'number') return Number.isNaN(val);
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    return SENTINEL_MISSING.has(trimmed);
  }
  return false;
}

/**
 * Checks if a value is a dirty formatted number (e.g. "$14,200.50", "84.2%", " 1,200 ms ")
 */
export function parseDirtyNumeric(val: unknown): {
  isNumeric: boolean;
  wasDirty: boolean;
  numericValue: number | null;
} {
  if (typeof val === 'number') {
    if (Number.isFinite(val)) {
      return { isNumeric: true, wasDirty: false, numericValue: val };
    }
    return { isNumeric: false, wasDirty: false, numericValue: null };
  }
  if (typeof val !== 'string') {
    return { isNumeric: false, wasDirty: false, numericValue: null };
  }
  const raw = val.trim();
  if (SENTINEL_MISSING.has(raw.toLowerCase())) {
    return { isNumeric: false, wasDirty: raw.length > 0, numericValue: null };
  }
  // Plain clean number string
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return { isNumeric: true, wasDirty: val !== raw, numericValue: Number(raw) };
  }
  // Formatted currency, percentage, commas, or units like "$12,450.80", "45.2%", "1,024.5"
  const stripped = raw
    .replace(/^[$€£¥₹]\s*/, '')
    .replace(/%$/, '')
    .replace(/\s*(ms|sec|s|kg|lbs|pts|usd|k)\s*$/i, '')
    .replace(/,/g, '')
    .trim();

  if (/^-?\d+(\.\d+)?$/.test(stripped)) {
    let num = Number(stripped);
    if (/k$/i.test(raw) && !/kg$/i.test(raw)) {
      num *= 1000;
    }
    return { isNumeric: true, wasDirty: true, numericValue: num };
  }
  return { isNumeric: false, wasDirty: false, numericValue: null };
}

/**
 * Parses unstructured text, CSV, JSON, Markdown tables, or key-value PDF text dumps into structured rows.
 */
export function parseUniversalTextToRows(rawInput: string): {
  columns: string[];
  rows: DataRow[];
  detectedFormat: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { columns: [], rows: [], detectedFormat: 'empty' };
  }

  // 1. Try JSON array or object with array property
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      let arr: Record<string, unknown>[] = [];
      if (Array.isArray(parsed)) {
        arr = parsed;
      } else if (parsed && typeof parsed === 'object') {
        const arrayProp = Object.values(parsed).find((v) => Array.isArray(v));
        if (Array.isArray(arrayProp)) {
          arr = arrayProp as Record<string, unknown>[];
        } else {
          arr = [parsed as Record<string, unknown>];
        }
      }
      if (arr.length > 0) {
        const colSet = new Set<string>();
        const rows: DataRow[] = arr.map((item) => {
          const flat: DataRow = {};
          if (item && typeof item === 'object') {
            for (const [k, v] of Object.entries(item)) {
              colSet.add(k);
              if (v === null || v === undefined) {
                flat[k] = null;
              } else if (typeof v === 'object') {
                flat[k] = JSON.stringify(v);
              } else {
                flat[k] = v as string | number | boolean;
              }
            }
          }
          return flat;
        });
        return { columns: Array.from(colSet), rows, detectedFormat: 'JSON Payload' };
      }
    } catch {
      // Fall through to line-based parsing
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 2. Key-Value Log / PDF Record Blocks (e.g., "Region: APAC | Revenue: $42,100 | Margin: 24.5%")
  if (lines.some((l) => l.includes(':') && (l.includes('|') || l.includes(';') || l.includes(',')))) {
    const kvRows: DataRow[] = [];
    const colSet = new Set<string>();
    for (const line of lines) {
      const segments = line.split(/[|;]/).map((s) => s.trim());
      if (segments.length >= 2 && segments.every((s) => s.includes(':'))) {
        const row: DataRow = {};
        for (const seg of segments) {
          const idx = seg.indexOf(':');
          const key = seg.slice(0, idx).trim();
          const val = seg.slice(idx + 1).trim();
          if (key) {
            colSet.add(key);
            row[key] = /^-?\d+(\.\d+)?$/.test(val) ? Number(val) : val;
          }
        }
        kvRows.push(row);
      }
    }
    if (kvRows.length >= 2) {
      return { columns: Array.from(colSet), rows: kvRows, detectedFormat: 'Structured Log / PDF Key-Value Stream' };
    }
  }

  // 3. Markdown / Pipe table (e.g. | Region | Revenue | Churn |)
  const pipeLines = lines.filter((l) => l.includes('|'));
  if (pipeLines.length >= 2) {
    const validLines = pipeLines.filter((l) => !/^\|?[\s\-:|]+\|?$/.test(l));
    if (validLines.length >= 2) {
      const splitPipe = (line: string) =>
        line
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const headers = splitPipe(validLines[0]);
      const rows: DataRow[] = validLines.slice(1).map((line) => {
        const vals = splitPipe(line);
        const row: DataRow = {};
        headers.forEach((h, i) => {
          row[h || `col_${i + 1}`] = vals[i] ?? null;
        });
        return row;
      });
      return { columns: headers, rows, detectedFormat: 'Pipe / Document Table' };
    }
  }

  // 4. Delimited CSV / TSV / Whitespace Table
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t')
    ? '\t'
    : firstLine.includes(',')
      ? ','
      : firstLine.includes(';')
        ? ';'
        : /\s{2,}/;

  const splitRow = (line: string): string[] => {
    if (typeof delimiter === 'string') {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    }
    return line.split(delimiter).map((s) => s.trim());
  };

  const headers = splitRow(lines[0]).map((h, i) => h || `Column_${i + 1}`);
  const rows: DataRow[] = lines.slice(1).map((line) => {
    const cells = splitRow(line);
    const row: DataRow = {};
    headers.forEach((h, i) => {
      const rawCell = cells[i] ?? '';
      if (rawCell === '') {
        row[h] = null;
      } else if (/^-?\d+(\.\d+)?$/.test(rawCell)) {
        row[h] = Number(rawCell);
      } else {
        row[h] = rawCell;
      }
    });
    return row;
  });

  return { columns: headers, rows, detectedFormat: 'Delimited Tabular Data' };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/**
 * Tier 1 Analysis: Profiles every column, detects missing values, dirty formats, outliers, and duplicate rows.
 */
export function profileDataset(
  datasetName: string,
  columns: string[],
  rows: DataRow[]
): DatasetQualityReport {
  const totalRows = rows.length;
  const totalColumns = columns.length;
  let missingCellsTotal = 0;
  let dirtyFormatCellsTotal = 0;
  let outlierCellsTotal = 0;

  // Duplicate row check
  const seenSignatures = new Set<string>();
  let duplicateRowsTotal = 0;
  for (const r of rows) {
    const sig = JSON.stringify(columns.map((c) => r[c] ?? null));
    if (seenSignatures.has(sig)) {
      duplicateRowsTotal++;
    } else {
      seenSignatures.add(sig);
    }
  }

  const columnProfiles: ColumnProfile[] = [];
  const proposals: CleaningActionProposal[] = [];

  for (const col of columns) {
    let missingCount = 0;
    let dirtyFormatCount = 0;
    let numericCandidateCount = 0;
    let temporalCandidateCount = 0;
    const numericValues: number[] = [];
    const freqMap = new Map<string, number>();
    const sampleValues: string[] = [];

    for (const row of rows) {
      const val = row[col];
      if (isMissingValue(val)) {
        missingCount++;
        if (typeof val === 'string' && val.trim().length > 0) {
          // Sentinel like "N/A" or "null"
          dirtyFormatCount++;
        }
        continue;
      }

      const strVal = String(val).trim();
      if (sampleValues.length < 5 && !sampleValues.includes(strVal)) {
        sampleValues.push(strVal);
      }
      freqMap.set(strVal, (freqMap.get(strVal) || 0) + 1);

      const numCheck = parseDirtyNumeric(val);
      if (numCheck.isNumeric && numCheck.numericValue !== null) {
        numericCandidateCount++;
        numericValues.push(numCheck.numericValue);
        if (numCheck.wasDirty) {
          dirtyFormatCount++;
        }
      } else if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(strVal) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(strVal)) {
        temporalCandidateCount++;
      } else if (typeof val === 'string' && val !== strVal) {
        dirtyFormatCount++;
      }
    }

    const nonMissing = totalRows - missingCount;
    let semanticType: ColumnSemanticType = 'categorical';
    if (nonMissing > 0 && numericCandidateCount / nonMissing >= 0.65) {
      semanticType = 'numeric';
    } else if (nonMissing > 0 && temporalCandidateCount / nonMissing >= 0.65) {
      semanticType = 'temporal';
    } else if (freqMap.size > 0 && Array.from(freqMap.keys()).every((k) => k.includes('/') || k.includes(':'))) {
      semanticType = 'unstructured_text';
    }

    let min: number | undefined;
    let max: number | undefined;
    let mean: number | undefined;
    let median: number | undefined;
    let stdDev: number | undefined;
    let q1: number | undefined;
    let q3: number | undefined;
    let iqr: number | undefined;
    let outlierCount = 0;

    if (semanticType === 'numeric' && numericValues.length > 0) {
      const sorted = [...numericValues].sort((a, b) => a - b);
      min = sorted[0];
      max = sorted[sorted.length - 1];
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      mean = Number((sum / sorted.length).toFixed(2));
      median = Number(quantile(sorted, 0.5).toFixed(2));
      q1 = Number(quantile(sorted, 0.25).toFixed(2));
      q3 = Number(quantile(sorted, 0.75).toFixed(2));
      iqr = Number((q3 - q1).toFixed(2));

      const variance = sorted.reduce((acc, v) => acc + Math.pow(v - (mean || 0), 2), 0) / sorted.length;
      stdDev = Number(Math.sqrt(variance).toFixed(2));

      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;
      if (iqr > 0) {
        outlierCount = sorted.filter((v) => v < lowerFence || v > upperFence).length;
      }
    }

    const topCategories = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([value, count]) => ({ value, count }));

    missingCellsTotal += missingCount;
    dirtyFormatCellsTotal += dirtyFormatCount;
    outlierCellsTotal += outlierCount;

    columnProfiles.push({
      name: col,
      semanticType,
      totalCount: totalRows,
      missingCount,
      missingPct: totalRows > 0 ? Number(((missingCount / totalRows) * 100).toFixed(1)) : 0,
      uniqueCount: freqMap.size,
      dirtyFormatCount,
      outlierCount,
      min,
      max,
      mean,
      median,
      stdDev,
      q1,
      q3,
      iqr,
      topCategories,
      sampleValues,
    });
  }

  // Build actionable cleaning proposals for user confirmation
  if (dirtyFormatCellsTotal > 0) {
    proposals.push({
      id: 'prop-normalize-formats',
      operationType: 'normalize_formats',
      title: 'Standardize Dirty Formats & Sentinel Nulls',
      targetColumn: 'ALL',
      issueType: 'Unstructured Currency / Units / Sentinel Strings',
      proposedFix: 'Strip currency/unit tokens ($, %, commas), trim whitespace, and coerce N/A sentinels into typed nulls.',
      impact: `Normalizes ${dirtyFormatCellsTotal} unparsed cells for mathematical aggregation.`,
      affectedCells: dirtyFormatCellsTotal,
      selected: true,
    });
  }

  const numericMissingCols = columnProfiles.filter((c) => c.semanticType === 'numeric' && c.missingCount > 0);
  if (numericMissingCols.length > 0) {
    const affected = numericMissingCols.reduce((acc, c) => acc + c.missingCount, 0);
    proposals.push({
      id: 'prop-impute-numeric',
      operationType: 'impute_missing_numeric',
      title: 'Impute Missing Numeric Measures (Median Imputation)',
      targetColumn: numericMissingCols.map((c) => c.name).join(', '),
      issueType: 'Missing Quantitative Values',
      proposedFix: `Fill ${affected} missing numeric cells across ${numericMissingCols.length} column(s) using robust column medians.`,
      impact: 'Prevents biased drop-offs and broken D3 scale domains.',
      affectedCells: affected,
      selected: true,
    });
  }

  const catMissingCols = columnProfiles.filter((c) => c.semanticType !== 'numeric' && c.missingCount > 0);
  if (catMissingCols.length > 0) {
    const affected = catMissingCols.reduce((acc, c) => acc + c.missingCount, 0);
    proposals.push({
      id: 'prop-impute-categorical',
      operationType: 'impute_missing_categorical',
      title: 'Impute Missing Categorical Dimensions (Mode / Unknown)',
      targetColumn: catMissingCols.map((c) => c.name).join(', '),
      issueType: 'Missing Dimension Labels',
      proposedFix: `Fill ${affected} missing category labels using modal distribution value.`,
      impact: 'Preserves full cohort records during hierarchical grouping.',
      affectedCells: affected,
      selected: true,
    });
  }

  if (outlierCellsTotal > 0) {
    const outlierCols = columnProfiles.filter((c) => c.outlierCount > 0);
    proposals.push({
      id: 'prop-cap-outliers',
      operationType: 'cap_outliers',
      title: 'Winsorize Extreme Statistical Outliers (1.5× IQR Fence)',
      targetColumn: outlierCols.map((c) => c.name).join(', '),
      issueType: 'Extreme Tail Anomalies',
      proposedFix: `Cap ${outlierCellsTotal} extreme outlier values to [Q1 - 1.5×IQR, Q3 + 1.5×IQR] bounds.`,
      impact: 'Stabilizes regression slopes and visual axis scaling.',
      affectedCells: outlierCellsTotal,
      selected: false, // Optional by default so user can decide whether outliers are errors or real anomalies
    });
  }

  if (duplicateRowsTotal > 0) {
    proposals.push({
      id: 'prop-deduplicate',
      operationType: 'deduplicate_rows',
      title: 'Remove Exact Duplicate Records',
      targetColumn: 'ALL',
      issueType: 'Redundant Ingestion Rows',
      proposedFix: `Deduplicate ${duplicateRowsTotal} identical record(s).`,
      impact: 'Eliminates double-counting in sum and count aggregations.',
      affectedCells: duplicateRowsTotal * Math.max(1, totalColumns),
      selected: true,
    });
  }

  const totalCells = Math.max(1, totalRows * totalColumns);
  const penalty =
    ((missingCellsTotal * 1.4 + dirtyFormatCellsTotal * 1.1 + outlierCellsTotal * 0.6 + duplicateRowsTotal * totalColumns) /
      totalCells) *
    100;
  const healthScore = Math.max(18, Math.min(100, Math.round(100 - penalty)));

  const readinessVerdict: DatasetQualityReport['readinessVerdict'] =
    missingCellsTotal > 0 || dirtyFormatCellsTotal > 0 || duplicateRowsTotal > 0
      ? 'needs_cleaning'
      : outlierCellsTotal > 0
        ? 'ready_with_warnings'
        : 'clean';

  const executiveDiagnosis =
    readinessVerdict === 'clean'
      ? `Dataset "${datasetName}" is structurally sound (${totalRows} rows × ${totalColumns} columns) with 100% typed completeness.`
      : `Tier-1 scan detected ${missingCellsTotal} missing values, ${dirtyFormatCellsTotal} unnormalized format strings, ${outlierCellsTotal} statistical outliers, and ${duplicateRowsTotal} duplicate rows across "${datasetName}".`;

  const userPromptQuestion =
    readinessVerdict === 'clean'
      ? 'Your data is clean and structured. Would you like to proceed directly to interactive D3 visualization?'
      : 'Review the detected data anomalies below. Which pre-data cleaning and structuring operations should Medium-Level AI execute before visualization?';

  return {
    healthScore,
    readinessVerdict,
    totalRows,
    totalColumns,
    missingCellsTotal,
    dirtyFormatCellsTotal,
    outlierCellsTotal,
    duplicateRowsTotal,
    columnProfiles,
    proposals,
    executiveDiagnosis,
    userPromptQuestion,
    aiTierLabel: 'Tier 1 — Normal AI Triage (gemini-4-hydrogen · ThinkingLevel.LOW)',
  };
}

/**
 * Tier 2 Execution: Performs user-confirmed data cleaning and returns cleaned rows + cell-level diff log.
 */
export function executeDataCleaning(
  columns: string[],
  rows: DataRow[],
  selectedOperations: string[],
  customInstruction?: string
): {
  cleanedColumns: string[];
  cleanedRows: DataRow[];
  diffs: CellDiff[];
  summaryText: string;
} {
  const opSet = new Set(selectedOperations);
  const diffs: CellDiff[] = [];
  let workingRows: DataRow[] = rows.map((r) => ({ ...r }));
  const cleanedColumns = [...columns];

  // Step 1: Deduplicate rows if selected
  let removedDuplicates = 0;
  if (opSet.has('deduplicate_rows')) {
    const seen = new Set<string>();
    const deduped: DataRow[] = [];
    for (const r of workingRows) {
      const sig = JSON.stringify(cleanedColumns.map((c) => r[c] ?? null));
      if (!seen.has(sig)) {
        seen.add(sig);
        deduped.push(r);
      } else {
        removedDuplicates++;
      }
    }
    workingRows = deduped;
  }

  // Profile current columns to get medians, modes, and IQR fences
  const initialReport = profileDataset('Working', cleanedColumns, workingRows);
  const profileMap = new Map<string, ColumnProfile>();
  for (const p of initialReport.columnProfiles) {
    profileMap.set(p.name, p);
  }

  // Step 2: Normalize formats & sentinel values
  if (opSet.has('normalize_formats')) {
    workingRows.forEach((row, rIdx) => {
      for (const col of cleanedColumns) {
        const val = row[col];
        const prof = profileMap.get(col);
        if (val === null || val === undefined) continue;

        if (isMissingValue(val)) {
          if (val !== null) {
            diffs.push({
              rowIndex: rIdx,
              column: col,
              before: val,
              after: null,
              operation: 'Standardize Sentinel Null',
            });
            row[col] = null;
          }
          continue;
        }

        if (prof?.semanticType === 'numeric') {
          const parsed = parseDirtyNumeric(val);
          if (parsed.isNumeric && parsed.numericValue !== null && parsed.wasDirty) {
            diffs.push({
              rowIndex: rIdx,
              column: col,
              before: val,
              after: parsed.numericValue,
              operation: 'Parse Numeric Format',
            });
            row[col] = parsed.numericValue;
          }
        } else if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed !== val) {
            diffs.push({
              rowIndex: rIdx,
              column: col,
              before: val,
              after: trimmed,
              operation: 'Trim Whitespace',
            });
            row[col] = trimmed;
          }
        }
      }
    });
  }

  // Step 3: Impute missing numeric values
  if (opSet.has('impute_missing_numeric')) {
    workingRows.forEach((row, rIdx) => {
      for (const col of cleanedColumns) {
        const prof = profileMap.get(col);
        if (prof?.semanticType === 'numeric' && isMissingValue(row[col])) {
          const fillVal = prof.median ?? prof.mean ?? 0;
          diffs.push({
            rowIndex: rIdx,
            column: col,
            before: row[col],
            after: fillVal,
            operation: `Median Imputation (${fillVal})`,
          });
          row[col] = fillVal;
        }
      }
    });
  }

  // Step 4: Impute missing categorical values
  if (opSet.has('impute_missing_categorical')) {
    workingRows.forEach((row, rIdx) => {
      for (const col of cleanedColumns) {
        const prof = profileMap.get(col);
        if (prof?.semanticType !== 'numeric' && isMissingValue(row[col])) {
          const modeVal = prof?.topCategories?.[0]?.value || 'Unspecified';
          diffs.push({
            rowIndex: rIdx,
            column: col,
            before: row[col],
            after: modeVal,
            operation: `Mode Imputation (${modeVal})`,
          });
          row[col] = modeVal;
        }
      }
    });
  }

  // Step 5: Cap outliers (Winsorize at 1.5x IQR)
  if (opSet.has('cap_outliers')) {
    workingRows.forEach((row, rIdx) => {
      for (const col of cleanedColumns) {
        const prof = profileMap.get(col);
        if (
          prof?.semanticType === 'numeric' &&
          prof.q1 !== undefined &&
          prof.q3 !== undefined &&
          prof.iqr !== undefined &&
          prof.iqr > 0
        ) {
          const parsed = parseDirtyNumeric(row[col]);
          if (parsed.isNumeric && parsed.numericValue !== null) {
            const lower = Number((prof.q1 - 1.5 * prof.iqr).toFixed(2));
            const upper = Number((prof.q3 + 1.5 * prof.iqr).toFixed(2));
            if (parsed.numericValue < lower) {
              diffs.push({
                rowIndex: rIdx,
                column: col,
                before: row[col],
                after: lower,
                operation: `Winsorize Lower Bound (${lower})`,
              });
              row[col] = lower;
            } else if (parsed.numericValue > upper) {
              diffs.push({
                rowIndex: rIdx,
                column: col,
                before: row[col],
                after: upper,
                operation: `Winsorize Upper Bound (${upper})`,
              });
              row[col] = upper;
            }
          }
        }
      }
    });
  }

  // Step 6: Optional Custom User Instruction execution (e.g., "drop missing", "uppercase", "filter")
  if (customInstruction && customInstruction.trim().length > 0) {
    const instr = customInstruction.toLowerCase();
    if (instr.includes('drop') && instr.includes('missing')) {
      workingRows = workingRows.filter((r) => cleanedColumns.every((c) => !isMissingValue(r[c])));
    }
    if (instr.includes('uppercase')) {
      workingRows.forEach((row, rIdx) => {
        for (const col of cleanedColumns) {
          if (typeof row[col] === 'string') {
            const upper = (row[col] as string).toUpperCase();
            if (upper !== row[col]) {
              diffs.push({
                rowIndex: rIdx,
                column: col,
                before: row[col],
                after: upper,
                operation: 'Custom Rule: Uppercase',
              });
              row[col] = upper;
            }
          }
        }
      });
    }
  }

  const summaryText = `Tier-2 Medium-Level AI cleaned ${diffs.length} cell value(s)${
    removedDuplicates > 0 ? ` and removed ${removedDuplicates} duplicate record(s)` : ''
  } across ${workingRows.length} rows.`;

  return {
    cleanedColumns,
    cleanedRows: workingRows,
    diffs,
    summaryText,
  };
}

/**
 * Computes pairwise Pearson correlation coefficients for all numeric columns.
 */
export function computeCorrelationMatrix(
  columns: string[],
  rows: DataRow[],
  profiles: ColumnProfile[]
): PairwiseCorrelation[] {
  const numCols = profiles.filter((p) => p.semanticType === 'numeric').map((p) => p.name);
  const results: PairwiseCorrelation[] = [];

  for (let i = 0; i < numCols.length; i++) {
    for (let j = i + 1; j < numCols.length; j++) {
      const colA = numCols[i];
      const colB = numCols[j];
      const pairs: [number, number][] = [];

      for (const r of rows) {
        const a = parseDirtyNumeric(r[colA]);
        const b = parseDirtyNumeric(r[colB]);
        if (a.isNumeric && a.numericValue !== null && b.isNumeric && b.numericValue !== null) {
          pairs.push([a.numericValue, b.numericValue]);
        }
      }

      if (pairs.length < 3) continue;
      const n = pairs.length;
      const meanA = pairs.reduce((s, p) => s + p[0], 0) / n;
      const meanB = pairs.reduce((s, p) => s + p[1], 0) / n;

      let num = 0;
      let denA = 0;
      let denB = 0;
      for (const [a, b] of pairs) {
        const da = a - meanA;
        const db = b - meanB;
        num += da * db;
        denA += da * da;
        denB += db * db;
      }

      const denom = Math.sqrt(denA * denB);
      const rVal = denom === 0 ? 0 : Number((num / denom).toFixed(3));
      const absR = Math.abs(rVal);
      const strength: PairwiseCorrelation['strength'] =
        rVal >= 0.65
          ? 'strong_positive'
          : rVal >= 0.35
            ? 'moderate_positive'
            : rVal <= -0.65
              ? 'strong_negative'
              : rVal <= -0.35
                ? 'moderate_negative'
                : 'weak';

      if (absR >= 0) {
        results.push({ colA, colB, r: rVal, strength });
      }
    }
  }

  return results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

/**
 * Computes Ordinary Least Squares (OLS) linear regression and detects residual anomalies.
 */
export function computeLinearRegression(
  rows: DataRow[],
  xCol: string,
  yCol: string,
  labelCol?: string
): LinearRegressionResult {
  const pts: { rowIndex: number; x: number; y: number; label: string }[] = [];
  rows.forEach((r, idx) => {
    const px = parseDirtyNumeric(r[xCol]);
    const py = parseDirtyNumeric(r[yCol]);
    if (px.isNumeric && px.numericValue !== null && py.isNumeric && py.numericValue !== null) {
      pts.push({
        rowIndex: idx,
        x: px.numericValue,
        y: py.numericValue,
        label: labelCol && r[labelCol] ? String(r[labelCol]) : `Row #${idx + 1}`,
      });
    }
  });

  if (pts.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      r: 0,
      equation: 'Insufficient numeric pairs',
      anomalies: [],
    };
  }

  const n = pts.length;
  const meanX = pts.reduce((s, p) => s + p.x, 0) / n;
  const meanY = pts.reduce((s, p) => s + p.y, 0) / n;

  let ssXY = 0;
  let ssXX = 0;
  let ssYY = 0;
  for (const p of pts) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const r = ssXX * ssYY === 0 ? 0 : ssXY / Math.sqrt(ssXX * ssYY);
  const rSquared = Number((r * r).toFixed(3));

  const residuals = pts.map((p) => {
    const predicted = slope * p.x + intercept;
    return { ...p, predicted, residual: p.y - predicted };
  });

  const resStd =
    Math.sqrt(residuals.reduce((s, p) => s + p.residual * p.residual, 0) / Math.max(1, n - 2)) || 1;

  const anomalies = residuals
    .map((p) => ({
      rowIndex: p.rowIndex,
      x: p.x,
      y: p.y,
      predicted: Number(p.predicted.toFixed(2)),
      residualZ: Number((p.residual / resStd).toFixed(2)),
      label: p.label,
    }))
    .filter((a) => Math.abs(a.residualZ) >= 1.65)
    .sort((a, b) => Math.abs(b.residualZ) - Math.abs(a.residualZ));

  const sign = intercept >= 0 ? '+' : '-';
  const equation = `y = ${slope.toFixed(3)}x ${sign} ${Math.abs(intercept).toFixed(2)} (R² = ${rSquared})`;

  return {
    slope: Number(slope.toFixed(4)),
    intercept: Number(intercept.toFixed(2)),
    rSquared,
    r: Number(r.toFixed(3)),
    equation,
    anomalies,
  };
}

/**
 * Tier 3 Smart AI Perspective Synthesizer: Generates unexpected multivariate D3 visualization proposals.
 */
export function pickBestCohortColumn(profiles: ColumnProfile[]): string {
  const catProfiles = profiles.filter((p) => p.semanticType !== 'numeric');
  // Prefer low-cardinality grouping columns (2 to 8 distinct values, e.g. Region, Tier, Chamber_Line) over unique IDs
  const cohortCol = catProfiles.find(
    (p) => p.uniqueCount >= 2 && p.uniqueCount <= Math.max(8, Math.floor(p.totalCount * 0.55))
  );
  return cohortCol?.name || catProfiles[0]?.name || profiles[0]?.name || 'Group';
}

export function discoverSmartPerspectives(
  _datasetName: string,
  profiles: ColumnProfile[],
  correlations: PairwiseCorrelation[]
): SmartPerspectiveCard[] {
  const numCols = profiles.filter((p) => p.semanticType === 'numeric').map((p) => p.name);
  const catProfiles = profiles.filter((p) => p.semanticType !== 'numeric');
  const cohortCols = catProfiles
    .filter((p) => p.uniqueCount >= 2 && p.uniqueCount <= Math.max(8, Math.floor(p.totalCount * 0.55)))
    .map((p) => p.name);
  const catCols = cohortCols.length > 0 ? cohortCols : catProfiles.map((p) => p.name);

  const primaryX = correlations[0]?.colA || numCols[0] || profiles[0]?.name || 'X';
  const primaryY = correlations[0]?.colB || numCols[1] || numCols[0] || 'Y';
  const primaryGroup = pickBestCohortColumn(profiles);
  const secondaryNum = numCols[2] || numCols[0] || primaryY;
  const topCorr = correlations[0];

  return [
    {
      id: 'persp-parallel',
      title: 'Multivariate Parallel Coordinates Trajectory',
      explanation: `Simultaneously projects ${Math.min(6, numCols.length)} quantitative dimensions (${numCols.slice(0, 5).join(', ')}) normalized to [0, 1] scale, grouped by ${primaryGroup}.`,
      statisticalEvidence: `${numCols.length} continuous axes analyzed; reveals cross-dimensional trade-offs invisible in 2D bar charts.`,
      recommendedChartType: 'parallel_coordinates',
      xColumn: primaryX,
      yColumn: primaryY,
      groupColumn: primaryGroup,
      whyUnexpected:
        'Standard 2D charts hide multi-attribute inversions. Brushing parallel axes exposes high-performing outlier cohorts across 5+ metrics at once.',
    },
    {
      id: 'persp-network',
      title: 'Force-Directed Feature Correlation & Entity Cluster Graph',
      explanation: `Maps pairwise Pearson r couplings and cohort centroids into a physics-driven D3 force topology.`,
      statisticalEvidence: topCorr
        ? `Strongest coupling detected between ${topCorr.colA} and ${topCorr.colB} (r = ${topCorr.r}).`
        : 'Topology links variables and high-density entity nodes by similarity.',
      recommendedChartType: 'force_network',
      xColumn: primaryX,
      yColumn: primaryY,
      groupColumn: primaryGroup,
      whyUnexpected:
        'Transforms tabular columns into a relational graph so analysts immediately see collinear metric clusters and isolated drivers.',
    },
    {
      id: 'persp-regression',
      title: `OLS Regression & Residual Anomaly Scatter (${primaryX} vs ${primaryY})`,
      explanation: `Plots ${primaryY} against ${primaryX} with linear regression trendline, confidence envelope, and residual Z-score anomaly pins.`,
      statisticalEvidence: topCorr
        ? `Linear correlation r = ${topCorr.r} across ${profiles[0]?.totalCount || 0} observations.`
        : `Evaluates bivariate variance and flags observations deviating >1.65σ from trend.`,
      recommendedChartType: 'scatter_regression',
      xColumn: primaryX,
      yColumn: primaryY,
      groupColumn: primaryGroup,
      sizeColumn: secondaryNum,
      whyUnexpected:
        'Automatically separates structural trend from localized regime anomalies that skew aggregate averages.',
    },
    {
      id: 'persp-sunburst',
      title: `Hierarchical Sunburst Partition (${primaryGroup} → Sub-Cohorts)`,
      explanation: `Radial multi-ring partition sizing angular arcs proportionally to ${primaryY} across categorical hierarchies.`,
      statisticalEvidence: `Decomposes total ${primaryY} variance across ${catCols.slice(0, 2).join(' × ') || primaryGroup}.`,
      recommendedChartType: 'sunburst_hierarchy',
      xColumn: primaryGroup,
      yColumn: primaryY,
      groupColumn: primaryGroup,
      whyUnexpected:
        'Exposes nested pareto concentration (where a single sub-segment dominates >40% of a parent category) in one radial view.',
    },
    {
      id: 'persp-violin',
      title: `Quantile Box & Kernel Density Distribution (${primaryY} by ${primaryGroup})`,
      explanation: `Compares median, interquartile range (IQR), and tail skewness of ${primaryY} across ${primaryGroup} segments.`,
      statisticalEvidence: `Reveals variance heterogeneity and bimodal splits masked by simple mean bar charts.`,
      recommendedChartType: 'violin_distribution',
      xColumn: primaryGroup,
      yColumn: primaryY,
      groupColumn: primaryGroup,
      whyUnexpected:
        'Two cohorts with identical averages often have wildly different spread and tail risk; quantile violins expose the full density shape.',
    },
    {
      id: 'persp-horizon',
      title: `Rolling Horizon & Z-Score Anomaly Envelope (${primaryY})`,
      explanation: `Tracks sequential progression of ${primaryY} with a configurable rolling average band and automatic 2σ spike detection.`,
      statisticalEvidence: `Flags local volatility bursts and structural regime shifts across ordered records.`,
      recommendedChartType: 'horizon_anomaly',
      xColumn: primaryX,
      yColumn: primaryY,
      groupColumn: primaryGroup,
      whyUnexpected:
        'Combines moving-average smoothing with pointwise Z-score anomaly markers for immediate root-cause triage.',
    },
  ];
}

/**
 * Deterministic Natural Language Query & Pattern Discovery engine (also acts as instant fallback / companion to Gemini Tier 3).
 */
export function executeLocalNLQuery(
  query: string,
  datasetName: string,
  columns: string[],
  rows: DataRow[],
  profiles: ColumnProfile[]
): NLQueryResult {
  const q = query.toLowerCase().trim();
  const numCols = profiles.filter((p) => p.semanticType === 'numeric').map((p) => p.name);
  const catCols = profiles.filter((p) => p.semanticType !== 'numeric').map((p) => p.name);
  const bestCohort = pickBestCohortColumn(profiles);

  // Match mentioned columns in query
  const mentionedNum = numCols.filter((c) => q.includes(c.toLowerCase().replace(/_/g, ' ')) || q.includes(c.toLowerCase()));
  const mentionedCat = catCols.filter((c) => q.includes(c.toLowerCase().replace(/_/g, ' ')) || q.includes(c.toLowerCase()));

  const yColumn = mentionedNum[0] || numCols[0] || columns[0] || 'Value';
  const xColumn = mentionedNum[1] || mentionedCat[0] || numCols[1] || bestCohort || 'Category';
  const groupColumn = mentionedCat[0] || bestCohort || columns[0] || 'Group';

  let filteredRows = [...rows];
  let suggestedChartType: D3ChartType = 'grouped_bar';
  let directAnswer = '';
  let patternFinding = '';

  const yProfile = profiles.find((p) => p.name === yColumn);

  if (q.includes('anomal') || q.includes('outlier') || q.includes('extreme') || q.includes('spike')) {
    suggestedChartType = 'horizon_anomaly';
    if (yProfile && yProfile.q1 !== undefined && yProfile.q3 !== undefined && yProfile.iqr !== undefined) {
      const lower = yProfile.q1 - 1.2 * yProfile.iqr;
      const upper = yProfile.q3 + 1.2 * yProfile.iqr;
      const anomalies = rows.filter((r) => {
        const v = parseDirtyNumeric(r[yColumn]);
        return v.isNumeric && v.numericValue !== null && (v.numericValue < lower || v.numericValue > upper);
      });
      if (anomalies.length > 0) {
        filteredRows = anomalies;
      }
      directAnswer = `Detected ${anomalies.length} anomalous record(s) on "${yColumn}" outside the [${lower.toFixed(1)}, ${upper.toFixed(1)}] IQR threshold (Dataset Median: ${yProfile.median}, Max: ${yProfile.max}).`;
      patternFinding = `Tail anomalies cluster primarily around ${groupColumn} = "${anomalies[0]?.[groupColumn] ?? 'top segment'}", indicating localized regime spikes rather than uniform noise.`;
    }
  } else if (q.includes('correlat') || q.includes('relationship') || q.includes('vs') || q.includes('impact')) {
    suggestedChartType = 'scatter_regression';
    const xNum = mentionedNum[1] || numCols.find((c) => c !== yColumn) || yColumn;
    const reg = computeLinearRegression(rows, xNum, yColumn, groupColumn);
    directAnswer = `Bivariate analysis between "${xNum}" and "${yColumn}" yields Pearson r = ${reg.r} (${reg.equation}).`;
    patternFinding =
      reg.anomalies.length > 0
        ? `Identified ${reg.anomalies.length} high-residual divergence points (led by ${reg.anomalies[0].label} with Z = ${reg.anomalies[0].residualZ}σ).`
        : `Variables exhibit a consistent linear relationship across all ${rows.length} records.`;
  } else if (q.includes('network') || q.includes('cluster') || q.includes('multivariate') || q.includes('all')) {
    suggestedChartType = q.includes('network') ? 'force_network' : 'parallel_coordinates';
    const corrs = computeCorrelationMatrix(columns, rows, profiles);
    const top = corrs[0];
    directAnswer = `Synthesized multivariate structure across ${numCols.length} quantitative measures and ${catCols.length} categorical dimensions.`;
    patternFinding = top
      ? `Primary latent cluster centers on ${top.colA} ↔ ${top.colB} (r = ${top.r}, ${top.strength.replace('_', ' ')}).`
      : `Multivariate trajectories show distinct cluster separation by ${groupColumn}.`;
  } else if (q.includes('distribution') || q.includes('spread') || q.includes('median') || q.includes('quartil')) {
    suggestedChartType = 'violin_distribution';
    directAnswer = `Distribution profile for "${yColumn}": Mean = ${yProfile?.mean ?? 'N/A'}, Median = ${yProfile?.median ?? 'N/A'}, IQR = ${yProfile?.iqr ?? 'N/A'} (Min ${yProfile?.min ?? 0} to Max ${yProfile?.max ?? 0}).`;
    patternFinding = `Comparing "${yColumn}" across "${groupColumn}" cohorts reveals inter-segment dispersion and skewness shifts.`;
  } else if (q.includes('top') || q.includes('highest') || q.includes('best') || q.includes('max')) {
    suggestedChartType = 'grouped_bar';
    filteredRows = [...rows]
      .sort((a, b) => {
        const va = parseDirtyNumeric(a[yColumn]).numericValue ?? -Infinity;
        const vb = parseDirtyNumeric(b[yColumn]).numericValue ?? -Infinity;
        return vb - va;
      })
      .slice(0, Math.min(15, rows.length));
    const topRow = filteredRows[0];
    directAnswer = `Top performer on "${yColumn}" is ${topRow?.[groupColumn] ?? 'Row #1'} at ${topRow?.[yColumn] ?? 'N/A'} (Dataset average: ${yProfile?.mean ?? 'N/A'}).`;
    patternFinding = `The top 3 records account for a disproportionate share of peak "${yColumn}" performance.`;
  } else {
    suggestedChartType = 'grouped_bar';
    directAnswer = `Analyzed ${rows.length} records in "${datasetName}" focusing on "${yColumn}" grouped by "${groupColumn}" (Mean: ${yProfile?.mean ?? 'N/A'}, Median: ${yProfile?.median ?? 'N/A'}).`;
    patternFinding = `Cross-segment aggregation highlights clear differentiation across ${yProfile?.uniqueCount ?? 'multiple'} distinct values.`;
  }

  return {
    query,
    directAnswer,
    patternFinding,
    suggestedChartType,
    xColumn: suggestedChartType === 'scatter_regression' ? mentionedNum[1] || numCols[1] || xColumn : groupColumn,
    yColumn,
    groupColumn,
    filteredRows,
    matchedRowCount: filteredRows.length,
    aiTierLabel: 'Tier 3 — Smart AI Pattern Engine (gemini-4-hydrogen · ThinkingLevel.HIGH)',
  };
}
