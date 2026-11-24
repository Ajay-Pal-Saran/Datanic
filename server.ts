import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '25mb' }));

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Persistent server-side dataset store (only for datasets that require local storage: csv, excel, pdf, manual)
interface StoredDatasetRecord {
  id: string;
  name: string;
  sourceType: string;
  storageMode: 'stored' | 'passthrough';
  storedAt: string;
  rowCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
}

const storedDatasets = new Map<string, StoredDatasetRecord>();

app.get('/api/storage/datasets', (_req, res) => {
  const list = Array.from(storedDatasets.values()).map((d) => ({
    id: d.id,
    name: d.name,
    sourceType: d.sourceType,
    storageMode: d.storageMode,
    storedAt: d.storedAt,
    rowCount: d.rowCount,
    columns: d.columns,
  }));
  res.json({ datasets: list });
});

app.post('/api/storage/datasets', (req, res) => {
  const { id, name, sourceType, storageMode, columns, rows } = req.body;
  if (!id || !name || !Array.isArray(rows)) {
    res.status(400).json({ error: 'Invalid dataset payload' });
    return;
  }
  // Only store if storageMode is 'stored'
  if (storageMode === 'passthrough') {
    res.json({
      stored: false,
      message: 'Zero-copy pass-through active: data accessed via external URI/API without redundant server storage.',
    });
    return;
  }
  const record: StoredDatasetRecord = {
    id,
    name,
    sourceType: sourceType || 'file',
    storageMode: 'stored',
    storedAt: new Date().toISOString(),
    rowCount: rows.length,
    columns: Array.isArray(columns) ? columns : Object.keys(rows[0] || {}),
    rows: rows.slice(0, 5000),
  };
  storedDatasets.set(id, record);
  res.json({
    stored: true,
    dataset: {
      id: record.id,
      name: record.name,
      sourceType: record.sourceType,
      storageMode: record.storageMode,
      storedAt: record.storedAt,
      rowCount: record.rowCount,
      columns: record.columns,
    },
  });
});

app.delete('/api/storage/datasets/:id', (req, res) => {
  storedDatasets.delete(req.params.id);
  res.json({ deleted: true });
});

// Zero-copy external URL / REST API fetch proxy (so CORS never blocks external JSON/CSV endpoints)
app.post('/api/proxy/fetch', async (req, res) => {
  try {
    const { url, headers } = req.body;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'A valid URL is required' });
      return;
    }
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      res.status(400).json({ error: 'Only HTTP/HTTPS URLs are supported' });
      return;
    }
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json, text/csv, text/plain, */*',
        ...(typeof headers === 'object' && headers !== null ? headers : {}),
      },
    });
    if (!response.ok) {
      res.status(response.status).json({
        error: `Remote endpoint returned HTTP ${response.status}: ${response.statusText}`,
      });
      return;
    }
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    res.json({
      contentType,
      rawText,
      fetchedAt: new Date().toISOString(),
      storagePolicy: 'passthrough',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch external URL';
    res.status(500).json({ error: msg });
  }
});

// Tier 1 (Normal AI - ThinkingLevel.LOW): Parse unstructured text / PDF report snippets into structured tabular rows
app.post('/api/ai/parse-unstructured', async (req, res) => {
  const { rawText, documentHint } = req.body;
  if (!rawText || typeof rawText !== 'string') {
    res.status(400).json({ error: 'rawText is required' });
    return;
  }

  const ai = getGenAIClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server.',
      fallbackAvailable: true,
    });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Extract structured tabular records from the following unstructured document or PDF text (${documentHint || 'general report'}).\n\nRAW DOCUMENT:\n${rawText.slice(0, 12000)}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are a precision data extraction engine. Convert unstructured text, PDF tables, invoices, or logs into a uniform JSON array of flat objects with consistent keys and clean numeric/string/date values. Return JSON with "datasetName", "summary", and "rows" (as JSON stringified array of objects).',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            datasetName: { type: Type.STRING },
            summary: { type: Type.STRING },
            rowsJson: {
              type: Type.STRING,
              description: 'A valid JSON array of flat record objects extracted from the text.',
            },
          },
          required: ['datasetName', 'summary', 'rowsJson'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const rows = JSON.parse(parsed.rowsJson || '[]');
    res.json({
      tier: 'Tier 1 — Normal AI (gemini-4-hydrogen · ThinkingLevel.LOW)',
      datasetName: parsed.datasetName || 'Extracted Document Table',
      summary: parsed.summary || 'Structured records extracted from unstructured text.',
      rows: Array.isArray(rows) ? rows : [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI extraction failed';
    res.status(500).json({ error: msg, fallbackAvailable: true });
  }
});

// Tier 1 (Normal AI - ThinkingLevel.LOW): Diagnose schema, missingness, anomalies, and propose cleaning plan to user
app.post('/api/ai/diagnose', async (req, res) => {
  const { datasetName, columnProfiles, sampleRows, statisticalIssues } = req.body;
  const ai = getGenAIClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured.',
      fallbackAvailable: true,
    });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Analyze this dataset ("${datasetName}") and determine whether it needs structuring, data cleaning, missing value imputation, or outlier treatment before visualization.\n\nColumn Profiles:\n${JSON.stringify(columnProfiles, null, 2)}\n\nDetected Statistical Issues:\n${JSON.stringify(statisticalIssues, null, 2)}\n\nSample Rows (first 12):\n${JSON.stringify((sampleRows || []).slice(0, 12), null, 2)}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are a Tier-1 Data Quality Triage AI. Diagnose structural, missing-value, formatting, and outlier issues in the user dataset. Formulate a direct question to the user explaining what needs cleaning and list concrete recommended pre-cleaning operations.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            readinessVerdict: {
              type: Type.STRING,
              description: 'needs_cleaning | ready_with_warnings | clean',
            },
            executiveDiagnosis: {
              type: Type.STRING,
              description: 'Concise 2-3 sentence diagnosis of data quality and structural health.',
            },
            userPromptQuestion: {
              type: Type.STRING,
              description: 'Direct question asking the user to confirm specific cleaning steps before visualization.',
            },
            recommendedActions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  targetColumn: { type: Type.STRING },
                  issueType: { type: Type.STRING },
                  proposedFix: { type: Type.STRING },
                  impact: { type: Type.STRING },
                },
                required: ['id', 'title', 'targetColumn', 'issueType', 'proposedFix', 'impact'],
              },
            },
          },
          required: ['readinessVerdict', 'executiveDiagnosis', 'userPromptQuestion', 'recommendedActions'],
        },
      },
    });

    const result = JSON.parse((response.text ?? '{}').trim());
    res.json({
      tier: 'Tier 1 — Normal AI Triage (gemini-4-hydrogen · ThinkingLevel.LOW)',
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Tier 1 AI diagnosis failed';
    res.status(500).json({ error: msg, fallbackAvailable: true });
  }
});

// Tier 2 (Medium-Level AI - ThinkingLevel.MEDIUM): Perform semantic data cleaning & custom user transformation instructions
app.post('/api/ai/clean', async (req, res) => {
  const { datasetName, selectedOperations, customInstruction, summaryBefore, sampleDirtyRows } = req.body;
  const ai = getGenAIClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured.',
      fallbackAvailable: true,
    });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Dataset: "${datasetName}"\nUser-Approved Cleaning Operations: ${JSON.stringify(selectedOperations)}\nUser Custom Cleaning Instruction: "${customInstruction || 'None'}"\nSummary Before Cleaning: ${JSON.stringify(summaryBefore)}\nSample Dirty Rows: ${JSON.stringify((sampleDirtyRows || []).slice(0, 10))}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        systemInstruction:
          'You are a Tier-2 Medium-Level Data Engineering AI. Summarize the exact mathematical and semantic transformations applied during pre-data cleaning, explain how missing values and anomalies were resolved, and provide optional derived column rules or value mappings.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cleaningSummary: { type: Type.STRING },
            technicalAuditNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            postCleanQuestion: {
              type: Type.STRING,
              description: 'Question asking the user whether they want to configure custom charts or let Smart AI discover unexpected multivariate visualizations.',
            },
          },
          required: ['cleaningSummary', 'technicalAuditNotes', 'postCleanQuestion'],
        },
      },
    });

    const result = JSON.parse((response.text ?? '{}').trim());
    res.json({
      tier: 'Tier 2 — Medium-Level AI Cleaner (gemini-4-hydrogen · ThinkingLevel.MEDIUM)',
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Tier 2 AI cleaning failed';
    res.status(500).json({ error: msg, fallbackAvailable: true });
  }
});

// Tier 3 (Smart AI - ThinkingLevel.HIGH): Discover non-obvious perspectives, hidden correlations & recommend D3 visualizations
app.post('/api/ai/discover', async (req, res) => {
  const { datasetName, columns, correlations, sampleRows } = req.body;
  const ai = getGenAIClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured.',
      fallbackAvailable: true,
    });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Perform deep multivariate pattern discovery on dataset "${datasetName}".\nColumns & Types:\n${JSON.stringify(columns, null, 2)}\nTop Pairwise Correlations:\n${JSON.stringify(correlations, null, 2)}\nSample Rows:\n${JSON.stringify((sampleRows || []).slice(0, 10), null, 2)}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        systemInstruction:
          'You are a Tier-3 Principal Data Scientist AI. Uncover non-obvious patterns, latent clusters, and multivariate relationships in the dataset. Recommend advanced D3.js visualizations (chosen from: "parallel_coordinates", "force_network", "scatter_regression", "sunburst_hierarchy", "violin_distribution", "horizon_anomaly", "grouped_bar") that give the analyst a fresh perspective they would not have thought to build manually.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headlineInsight: { type: Type.STRING },
            discoveredPatterns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  statisticalEvidence: { type: Type.STRING },
                  recommendedChartType: { type: Type.STRING },
                  xColumn: { type: Type.STRING },
                  yColumn: { type: Type.STRING },
                  groupColumn: { type: Type.STRING },
                  whyUnexpected: { type: Type.STRING },
                },
                required: [
                  'title',
                  'explanation',
                  'statisticalEvidence',
                  'recommendedChartType',
                  'xColumn',
                  'yColumn',
                  'groupColumn',
                  'whyUnexpected',
                ],
              },
            },
          },
          required: ['headlineInsight', 'discoveredPatterns'],
        },
      },
    });

    const result = JSON.parse((response.text ?? '{}').trim());
    res.json({
      tier: 'Tier 3 — Smart AI Pattern Synthesis (gemini-4-hydrogen · ThinkingLevel.HIGH)',
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Tier 3 discovery failed';
    res.status(500).json({ error: msg, fallbackAvailable: true });
  }
});

// Tier 3 (Smart AI - ThinkingLevel.HIGH): Natural Language Query & Pattern Finder
app.post('/api/ai/query', async (req, res) => {
  const { query, datasetName, columns, statsSummary, sampleRows } = req.body;
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Query is required' });
    return;
  }

  const ai = getGenAIClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured.',
      fallbackAvailable: true,
    });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `User Natural Language Query: "${query}"\nDataset: "${datasetName}"\nAvailable Columns: ${JSON.stringify(columns)}\nStatistical Summary: ${JSON.stringify(statsSummary)}\nSample Data: ${JSON.stringify((sampleRows || []).slice(0, 15))}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        systemInstruction:
          'You are a Natural Language Data Query & Pattern Engine. Answer the user query using the provided schema and statistics, specify structured filter or sort rules using exact column names, and recommend the best D3 chart configuration ("scatter_regression", "grouped_bar", "parallel_coordinates", "force_network", "sunburst_hierarchy", "violin_distribution", "horizon_anomaly") to visualize the answer.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            directAnswer: { type: Type.STRING },
            patternFinding: { type: Type.STRING },
            suggestedChartType: { type: Type.STRING },
            xColumn: { type: Type.STRING },
            yColumn: { type: Type.STRING },
            groupColumn: { type: Type.STRING },
            filterColumn: { type: Type.STRING },
            filterOperator: {
              type: Type.STRING,
              description: 'none | gt | lt | eq | contains | top_n | outliers_only',
            },
            filterValue: { type: Type.STRING },
          },
          required: [
            'directAnswer',
            'patternFinding',
            'suggestedChartType',
            'xColumn',
            'yColumn',
            'groupColumn',
            'filterColumn',
            'filterOperator',
            'filterValue',
          ],
        },
      },
    });

    const result = JSON.parse((response.text ?? '{}').trim());
    res.json({
      tier: 'Tier 3 — Smart AI NL Query Engine (gemini-4-hydrogen · ThinkingLevel.HIGH)',
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'NL query failed';
    res.status(500).json({ error: msg, fallbackAvailable: true });
  }
});

// Conversational AI Data Assistant (Streaming SSE via gemini-4-hydrogen)
app.post('/api/ai/assistant', async (req, res) => {
  const { messages, datasetContext, reasoningDepth, assistantTone } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Messages array is required.' });
    return;
  }

  const ai = getGenAIClient();
  if (!ai) {
    res.status(503).json({
      error:
        'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets to enable live AI Assistant conversations.',
    });
    return;
  }

  const thinkingLevel =
    reasoningDepth === 'low'
      ? ThinkingLevel.LOW
      : reasoningDepth === 'medium'
        ? ThinkingLevel.MEDIUM
        : ThinkingLevel.HIGH;

  const toneInstruction =
    assistantTone === 'concise'
      ? 'Keep answers executive, sharp, and concise with bulleted numerical takeaways.'
      : assistantTone === 'step_by_step'
        ? 'Explain your analytical reasoning step by step, showing formulas, checks, and actionable next steps.'
        : 'Respond as a principal data scientist and analytics engineer: precise, quantitative, referencing exact column names, correlations, outliers, and D3 visualization topologies when useful.';

  const contextBlock = datasetContext
    ? `\n\nACTIVE WORKSPACE DATA CONTEXT:\n${JSON.stringify(datasetContext, null, 2).slice(0, 18000)}`
    : '\n\nNo specific dataset attached; answer general data science, SQL, Python, statistics, and Datanic workspace questions.';

  const systemInstruction = `You are Datanic AI, an enterprise data science and visualization assistant embedded in the Datanic Analytics Workspace.
${toneInstruction}
When referencing data, cite exact column names, statistics, correlations, anomalies, and row counts from the provided workspace context. Never invent numbers that are not supported by the context. Use clean Markdown (headings, bullet points, bold metrics, tables, or fenced code blocks for SQL/Python/D3 snippets).${contextBlock}`;

  // Convert conversation history into multi-turn contents
  const formattedContents = messages.slice(-14).map((m: { role: string; content: string }) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '') }],
  }));

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-4-hydrogen',
      contents: formattedContents,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel },
      },
    });

    for await (const chunk of stream) {
      const delta = chunk.text ?? '';
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI Assistant stream failed.';
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Datanic Workspace Server running on http://localhost:${PORT}`);
  });
}

startServer();
