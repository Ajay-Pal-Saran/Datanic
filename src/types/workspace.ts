export type DataSourceModality =
  | 'file_upload'
  | 'pdf_document'
  | 'url_endpoint'
  | 'rest_api'
  | 'data_stream'
  | 'data_lake'
  | 'manual_entry';

export type StoragePolicy = 'stored' | 'passthrough';

export type ColumnSemanticType = 'numeric' | 'categorical' | 'temporal' | 'boolean' | 'unstructured_text';

export type DataRow = Record<string, string | number | boolean | null>;

export interface ColumnProfile {
  name: string;
  semanticType: ColumnSemanticType;
  totalCount: number;
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
  dirtyFormatCount: number;
  outlierCount: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  q1?: number;
  q3?: number;
  iqr?: number;
  topCategories?: { value: string; count: number }[];
  sampleValues: string[];
}

export type CleaningOperationType =
  | 'normalize_formats'
  | 'impute_missing_numeric'
  | 'impute_missing_categorical'
  | 'cap_outliers'
  | 'deduplicate_rows'
  | 'extract_composite_fields';

export interface CleaningActionProposal {
  id: string;
  operationType: CleaningOperationType;
  title: string;
  targetColumn: string; // 'ALL' or specific column name
  issueType: string;
  proposedFix: string;
  impact: string;
  affectedCells: number;
  selected: boolean;
}

export interface CellDiff {
  rowIndex: number;
  column: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
  operation: string;
}

export interface DatasetQualityReport {
  healthScore: number;
  readinessVerdict: 'needs_cleaning' | 'ready_with_warnings' | 'clean';
  totalRows: number;
  totalColumns: number;
  missingCellsTotal: number;
  dirtyFormatCellsTotal: number;
  outlierCellsTotal: number;
  duplicateRowsTotal: number;
  columnProfiles: ColumnProfile[];
  proposals: CleaningActionProposal[];
  executiveDiagnosis: string;
  userPromptQuestion: string;
  aiTierLabel: string;
}

export type D3ChartType =
  | 'parallel_coordinates'
  | 'force_network'
  | 'scatter_regression'
  | 'sunburst_hierarchy'
  | 'violin_distribution'
  | 'horizon_anomaly'
  | 'grouped_bar';

export interface SmartPerspectiveCard {
  id: string;
  title: string;
  explanation: string;
  statisticalEvidence: string;
  recommendedChartType: D3ChartType;
  xColumn: string;
  yColumn: string;
  groupColumn: string;
  sizeColumn?: string;
  whyUnexpected: string;
}

export interface PairwiseCorrelation {
  colA: string;
  colB: string;
  r: number;
  strength: 'strong_positive' | 'moderate_positive' | 'weak' | 'moderate_negative' | 'strong_negative';
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  r: number;
  equation: string;
  anomalies: { rowIndex: number; x: number; y: number; predicted: number; residualZ: number; label: string }[];
}

export interface DrawingAnnotation {
  id: string;
  tool: 'freehand' | 'line' | 'rect' | 'callout';
  color: string;
  strokeWidth: number;
  points: { x: number; y: number }[];
  text?: string;
}

export interface NLQueryResult {
  query: string;
  directAnswer: string;
  patternFinding: string;
  suggestedChartType: D3ChartType;
  xColumn: string;
  yColumn: string;
  groupColumn: string;
  filteredRows: DataRow[];
  matchedRowCount: number;
  aiTierLabel: string;
}

export interface WorkspaceDataset {
  id: string;
  name: string;
  description: string;
  modality: DataSourceModality;
  storagePolicy: StoragePolicy;
  sourceUri?: string;
  ingestedAt: string;
  columns: string[];
  rawRows: DataRow[];
  activeRows: DataRow[];
  isCleaned: boolean;
  cleaningHistory: {
    timestamp: string;
    operationsApplied: string[];
    cellsModified: number;
    rowsBefore: number;
    rowsAfter: number;
    summary: string;
    aiTier: string;
  }[];
  lastDiffs: CellDiff[];
}

export type WorkspacePage =
  | 'home'
  | 'assistant'
  | 'projects'
  | 'ingest'
  | 'clean'
  | 'visualize'
  | 'nl_query'
  | 'settings';

export type ProjectStatus = 'active' | 'in_review' | 'archived';

export interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  owner: string;
  datasetIds: string[];
  tags: string[];
  updatedAt: string;
  createdAt: string;
}

export interface SavedVisualization {
  id: string;
  projectId: string;
  datasetId: string;
  title: string;
  chartType: D3ChartType;
  xColumn: string;
  yColumn: string;
  groupColumn: string;
  note?: string;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  type: 'ingest' | 'clean' | 'visualize' | 'assistant' | 'project' | 'export';
  title: string;
  detail: string;
  timestamp: string;
}

export type ReasoningDepth = 'low' | 'medium' | 'high';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  datasetId?: string;
  datasetName?: string;
  reasoningDepth?: ReasoningDepth;
  suggestedAction?: {
    label: string;
    targetPage: WorkspacePage;
    chartType?: D3ChartType;
  };
  error?: string;
}

export interface AssistantThread {
  id: string;
  title: string;
  datasetId: string | 'all';
  updatedAt: string;
  messages: AssistantMessage[];
}

export interface WorkspaceSettings {
  workspaceName: string;
  analystName: string;
  analystRole: string;
  defaultPage: 'home' | 'assistant' | 'visualize' | 'ingest';
  tableDensity: 'compact' | 'comfortable';
  defaultStorageMode: 'auto' | 'stored' | 'passthrough';
  outlierZThreshold: number;
  missingValueStrategy: 'median_mode' | 'drop_rows' | 'flag_only';
  defaultReasoningDepth: ReasoningDepth;
  assistantTone: 'concise' | 'technical' | 'step_by_step';
  autoAttachContext: boolean;
}

