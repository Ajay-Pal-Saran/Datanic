import {
  ActivityEvent,
  SavedVisualization,
  WorkspaceDataset,
  WorkspaceProject,
  WorkspaceSettings,
} from '../types/workspace';

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  workspaceName: 'Datanic Workspace',
  analystName: 'Lead Data Scientist',
  analystRole: 'Analytics & Telemetry Engineering',
  defaultPage: 'home',
  tableDensity: 'compact',
  defaultStorageMode: 'auto',
  outlierZThreshold: 2.5,
  missingValueStrategy: 'median_mode',
  defaultReasoningDepth: 'medium',
  assistantTone: 'technical',
  autoAttachContext: true,
};

export function createInitialProjects(datasets: WorkspaceDataset[]): WorkspaceProject[] {
  const ds0 = datasets[0]?.id;
  const ds1 = datasets[1]?.id;
  const ds2 = datasets[2]?.id;
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

  return [
    {
      id: 'proj-saas-churn',
      name: 'Enterprise SaaS Churn & Latency Diagnostics',
      description:
        'Multivariate retention audit linking API latency tail spikes, seat utilization, and NPS degradation across global enterprise tiers.',
      status: 'active',
      owner: 'Revenue Analytics',
      datasetIds: ds0 ? [ds0] : [],
      tags: ['SaaS', 'Churn', 'OLS'],
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(2),
    },
    {
      id: 'proj-fab-yield',
      name: '3nm Lithography Chamber Yield Surveillance',
      description:
        'Real-time pass-through telemetry monitoring EUV wafer yield excursions against chamber pressure and thermal drift.',
      status: 'active',
      owner: 'Fab Process Ops',
      datasetIds: ds1 ? [ds1] : [],
      tags: ['Semiconductor', 'Stream', 'Anomaly'],
      createdAt: hoursAgo(120),
      updatedAt: hoursAgo(6),
    },
    {
      id: 'proj-freight-corridors',
      name: 'Global Freight Corridor Delay Optimization',
      description:
        'Cross-corridor transit time variance and customs dwell-time benchmark across maritime and air cargo lanes.',
      status: 'in_review',
      owner: 'Supply Chain Science',
      datasetIds: ds2 ? [ds2] : [],
      tags: ['Logistics', 'API', 'Cohort'],
      createdAt: hoursAgo(210),
      updatedAt: hoursAgo(18),
    },
  ];
}

export function createInitialSavedViews(datasets: WorkspaceDataset[]): SavedVisualization[] {
  const ds0 = datasets[0];
  const ds1 = datasets[1];
  const ds2 = datasets[2];
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

  const views: SavedVisualization[] = [];
  if (ds0) {
    views.push({
      id: 'view-churn-ols',
      projectId: 'proj-saas-churn',
      datasetId: ds0.id,
      title: 'NPS vs. Churn Risk OLS Residual Map',
      chartType: 'scatter_regression',
      xColumn: 'NPS_Score',
      yColumn: 'Churn_Risk_Score',
      groupColumn: 'Region',
      note: 'Highlights APAC Enterprise outlier ACC-108 with 890ms API latency.',
      createdAt: hoursAgo(3),
    });
    views.push({
      id: 'view-saas-parallel',
      projectId: 'proj-saas-churn',
      datasetId: ds0.id,
      title: 'Multi-Metric Enterprise Trajectory',
      chartType: 'parallel_coordinates',
      xColumn: 'ARR_USD',
      yColumn: 'Churn_Risk_Score',
      groupColumn: 'Tier',
      note: 'Cross-axis comparison of ARR, utilization, support tickets, and churn.',
      createdAt: hoursAgo(5),
    });
  }
  if (ds1) {
    views.push({
      id: 'view-fab-horizon',
      projectId: 'proj-fab-yield',
      datasetId: ds1.id,
      title: 'Chamber Yield Z-Score Horizon Envelope',
      chartType: 'horizon_anomaly',
      xColumn: ds1.columns[2] || ds1.columns[0],
      yColumn: ds1.columns[3] || ds1.columns[1],
      groupColumn: ds1.columns[1] || ds1.columns[0],
      note: 'Sequential drift detection for wafer batch yield deviations.',
      createdAt: hoursAgo(9),
    });
  }
  if (ds2) {
    views.push({
      id: 'view-freight-cohort',
      projectId: 'proj-freight-corridors',
      datasetId: ds2.id,
      title: 'Corridor Delay Distribution by Mode',
      chartType: 'violin_distribution',
      xColumn: ds2.columns[2] || ds2.columns[0],
      yColumn: ds2.columns[3] || ds2.columns[1],
      groupColumn: ds2.columns[1] || ds2.columns[0],
      note: 'Compares quantile spread across maritime vs air corridors.',
      createdAt: hoursAgo(20),
    });
  }
  return views;
}

export function createInitialActivity(): ActivityEvent[] {
  const now = new Date();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000).toISOString();
  return [
    {
      id: 'act-1',
      type: 'visualize',
      title: 'Pinned OLS Regression Snapshot',
      detail: 'NPS_Score × Churn_Risk_Score saved to Enterprise SaaS Churn Diagnostics',
      timestamp: minsAgo(24),
    },
    {
      id: 'act-2',
      type: 'ingest',
      title: 'Connected Zero-Copy Data Lake Stream',
      detail: '3nm Semiconductor Lithography Yield mounted via pass-through URI',
      timestamp: minsAgo(95),
    },
    {
      id: 'act-3',
      type: 'project',
      title: 'Updated Project Review Status',
      detail: 'Global Freight Corridor Delay Optimization moved to In Review',
      timestamp: minsAgo(240),
    },
  ];
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
