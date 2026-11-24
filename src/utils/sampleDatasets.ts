import { WorkspaceDataset } from '../types/workspace';

const RAW_SAMPLE_DATASETS: WorkspaceDataset[] = [
  {
    id: 'ds-enterprise-saas',
    name: 'Global Enterprise SaaS Telemetry & Churn Cohort',
    description:
      'Contains intentional real-world data quality issues (unparsed currency strings, missing ARR/NPS cells, extreme latency outlier spikes, and a duplicate row) to demonstrate Tier-1 AI diagnosis, Tier-2 cleaning, and Tier-3 D3 discovery.',
    modality: 'file_upload',
    storagePolicy: 'stored',
    ingestedAt: '2026-11-21T03:00:00.000Z',
    isCleaned: false,
    cleaningHistory: [],
    lastDiffs: [],
    columns: [
      'Account_ID',
      'Region',
      'Tier',
      'ARR_USD',
      'API_Latency_ms',
      'Seat_Utilization_Pct',
      'Support_Tickets_Q3',
      'NPS_Score',
      'Churn_Risk_Score',
    ],
    rawRows: [
      { Account_ID: 'ACC-101', Region: 'North America', Tier: 'Enterprise', ARR_USD: '$148,500', API_Latency_ms: 42, Seat_Utilization_Pct: '91.4%', Support_Tickets_Q3: 3, NPS_Score: 74, Churn_Risk_Score: 14.2 },
      { Account_ID: 'ACC-102', Region: 'EMEA', Tier: 'Enterprise', ARR_USD: '$112,000', API_Latency_ms: 68, Seat_Utilization_Pct: '84.0%', Support_Tickets_Q3: 7, NPS_Score: 62, Churn_Risk_Score: 28.5 },
      { Account_ID: 'ACC-103', Region: 'APAC', Tier: 'Mid-Market', ARR_USD: '$54,200', API_Latency_ms: 115, Seat_Utilization_Pct: '63.5%', Support_Tickets_Q3: 14, NPS_Score: 'N/A', Churn_Risk_Score: 54.8 },
      { Account_ID: 'ACC-104', Region: 'North America', Tier: 'Enterprise', ARR_USD: 196000, API_Latency_ms: 38, Seat_Utilization_Pct: 95.2, Support_Tickets_Q3: 2, NPS_Score: 81, Churn_Risk_Score: 9.4 },
      { Account_ID: 'ACC-105', Region: 'LATAM', Tier: 'Growth', ARR_USD: '$29,800', API_Latency_ms: 185, Seat_Utilization_Pct: '48.0%', Support_Tickets_Q3: 19, NPS_Score: 31, Churn_Risk_Score: 76.1 },
      { Account_ID: 'ACC-106', Region: 'EMEA', Tier: 'Mid-Market', ARR_USD: 'N/A', API_Latency_ms: 74, Seat_Utilization_Pct: '77.8%', Support_Tickets_Q3: 6, NPS_Score: 58, Churn_Risk_Score: 33.0 },
      { Account_ID: 'ACC-107', Region: 'North America', Tier: 'Mid-Market', ARR_USD: '$68,400', API_Latency_ms: 52, Seat_Utilization_Pct: '81.2%', Support_Tickets_Q3: 5, NPS_Score: 67, Churn_Risk_Score: 21.7 },
      { Account_ID: 'ACC-108', Region: 'APAC', Tier: 'Enterprise', ARR_USD: '$164,000', API_Latency_ms: 890, Seat_Utilization_Pct: '52.1%', Support_Tickets_Q3: 28, NPS_Score: 24, Churn_Risk_Score: 84.5 },
      { Account_ID: 'ACC-109', Region: 'EMEA', Tier: 'Growth', ARR_USD: '$34,500', API_Latency_ms: 94, Seat_Utilization_Pct: null, Support_Tickets_Q3: 11, NPS_Score: 45, Churn_Risk_Score: 49.2 },
      { Account_ID: 'ACC-110', Region: 'North America', Tier: 'Enterprise', ARR_USD: '$215,000', API_Latency_ms: 35, Seat_Utilization_Pct: '96.8%', Support_Tickets_Q3: 1, NPS_Score: 86, Churn_Risk_Score: 6.8 },
      { Account_ID: 'ACC-111', Region: 'APAC', Tier: 'Growth', ARR_USD: '$24,900', API_Latency_ms: 142, Seat_Utilization_Pct: '59.4%', Support_Tickets_Q3: 15, NPS_Score: 39, Churn_Risk_Score: 63.4 },
      { Account_ID: 'ACC-112', Region: 'LATAM', Tier: 'Mid-Market', ARR_USD: '$49,000', API_Latency_ms: 128, Seat_Utilization_Pct: '68.9%', Support_Tickets_Q3: 12, NPS_Score: 'null', Churn_Risk_Score: 46.0 },
      { Account_ID: 'ACC-113', Region: 'EMEA', Tier: 'Enterprise', ARR_USD: '$138,700', API_Latency_ms: 61, Seat_Utilization_Pct: '88.3%', Support_Tickets_Q3: 4, NPS_Score: 71, Churn_Risk_Score: 18.9 },
      { Account_ID: 'ACC-114', Region: 'North America', Tier: 'Growth', ARR_USD: '$31,200', API_Latency_ms: 88, Seat_Utilization_Pct: '72.0%', Support_Tickets_Q3: 9, NPS_Score: 53, Churn_Risk_Score: 38.2 },
      { Account_ID: 'ACC-115', Region: 'APAC', Tier: 'Mid-Market', ARR_USD: '?', API_Latency_ms: 104, Seat_Utilization_Pct: '74.5%', Support_Tickets_Q3: 8, NPS_Score: 55, Churn_Risk_Score: 36.7 },
      { Account_ID: 'ACC-116', Region: 'North America', Tier: 'Enterprise', ARR_USD: '$179,300', API_Latency_ms: 44, Seat_Utilization_Pct: '92.7%', Support_Tickets_Q3: 3, NPS_Score: 78, Churn_Risk_Score: 12.1 },
      { Account_ID: 'ACC-117', Region: 'EMEA', Tier: 'Mid-Market', ARR_USD: '$76,800', API_Latency_ms: 79, Seat_Utilization_Pct: '79.5%', Support_Tickets_Q3: 6, NPS_Score: 61, Churn_Risk_Score: 27.4 },
      { Account_ID: 'ACC-118', Region: 'LATAM', Tier: 'Enterprise', ARR_USD: '$122,400', API_Latency_ms: 98, Seat_Utilization_Pct: '83.1%', Support_Tickets_Q3: 7, NPS_Score: 64, Churn_Risk_Score: 25.8 },
      // Intentional exact duplicate of ACC-101 to demonstrate duplicate detection
      { Account_ID: 'ACC-101', Region: 'North America', Tier: 'Enterprise', ARR_USD: '$148,500', API_Latency_ms: 42, Seat_Utilization_Pct: '91.4%', Support_Tickets_Q3: 3, NPS_Score: 74, Churn_Risk_Score: 14.2 },
    ],
    activeRows: [],
  },
  {
    id: 'ds-semiconductor-fab',
    name: '3nm Semiconductor Lithography Yield & Chamber Stream',
    description:
      'High-dimensional wafer chamber telemetry streamed from cleanroom sensors via zero-copy data lake pass-through.',
    modality: 'data_lake',
    storagePolicy: 'passthrough',
    sourceUri: 's3://datanic-foundry-lake/fab-04/euv-lithography-telemetry.parquet',
    ingestedAt: '2026-11-21T03:10:00.000Z',
    isCleaned: false,
    cleaningHistory: [],
    lastDiffs: [],
    columns: [
      'Wafer_Lot',
      'Chamber_Line',
      'Recipe_Mode',
      'EUV_Dose_mJ',
      'Vacuum_Pressure_mTorr',
      'Stage_Temp_C',
      'Overlay_Error_nm',
      'Defect_Density_cm2',
      'Die_Yield_Pct',
    ],
    rawRows: [
      { Wafer_Lot: 'LOT-901', Chamber_Line: 'EUV-Alpha', Recipe_Mode: 'High-NA', EUV_Dose_mJ: 34.2, Vacuum_Pressure_mTorr: 1.18, Stage_Temp_C: 22.1, Overlay_Error_nm: 1.4, Defect_Density_cm2: 0.042, Die_Yield_Pct: 94.8 },
      { Wafer_Lot: 'LOT-902', Chamber_Line: 'EUV-Alpha', Recipe_Mode: 'High-NA', EUV_Dose_mJ: 34.5, Vacuum_Pressure_mTorr: 1.21, Stage_Temp_C: 22.3, Overlay_Error_nm: 1.5, Defect_Density_cm2: 0.045, Die_Yield_Pct: 94.1 },
      { Wafer_Lot: 'LOT-903', Chamber_Line: 'EUV-Beta', Recipe_Mode: 'Standard', EUV_Dose_mJ: 31.8, Vacuum_Pressure_mTorr: 1.42, Stage_Temp_C: 23.4, Overlay_Error_nm: 2.3, Defect_Density_cm2: 0.089, Die_Yield_Pct: 86.4 },
      { Wafer_Lot: 'LOT-904', Chamber_Line: 'EUV-Gamma', Recipe_Mode: 'Ultrafine', EUV_Dose_mJ: 36.1, Vacuum_Pressure_mTorr: 1.09, Stage_Temp_C: 21.8, Overlay_Error_nm: 1.1, Defect_Density_cm2: 0.031, Die_Yield_Pct: 96.7 },
      { Wafer_Lot: 'LOT-905', Chamber_Line: 'EUV-Beta', Recipe_Mode: 'Standard', EUV_Dose_mJ: 'N/A', Vacuum_Pressure_mTorr: 1.85, Stage_Temp_C: 25.9, Overlay_Error_nm: 4.8, Defect_Density_cm2: 0.215, Die_Yield_Pct: 68.2 },
      { Wafer_Lot: 'LOT-906', Chamber_Line: 'EUV-Alpha', Recipe_Mode: 'Ultrafine', EUV_Dose_mJ: 35.8, Vacuum_Pressure_mTorr: 1.12, Stage_Temp_C: 21.9, Overlay_Error_nm: 1.2, Defect_Density_cm2: 0.035, Die_Yield_Pct: 96.1 },
      { Wafer_Lot: 'LOT-907', Chamber_Line: 'EUV-Gamma', Recipe_Mode: 'High-NA', EUV_Dose_mJ: 34.0, Vacuum_Pressure_mTorr: 1.24, Stage_Temp_C: 22.4, Overlay_Error_nm: 1.6, Defect_Density_cm2: 0.051, Die_Yield_Pct: 92.9 },
      { Wafer_Lot: 'LOT-908', Chamber_Line: 'EUV-Delta', Recipe_Mode: 'Standard', EUV_Dose_mJ: 30.9, Vacuum_Pressure_mTorr: 1.56, Stage_Temp_C: 24.1, Overlay_Error_nm: 2.9, Defect_Density_cm2: 0.118, Die_Yield_Pct: 81.5 },
      { Wafer_Lot: 'LOT-909', Chamber_Line: 'EUV-Delta', Recipe_Mode: 'High-NA', EUV_Dose_mJ: 33.7, Vacuum_Pressure_mTorr: 'null', Stage_Temp_C: 22.7, Overlay_Error_nm: 1.8, Defect_Density_cm2: 0.062, Die_Yield_Pct: 90.4 },
      { Wafer_Lot: 'LOT-910', Chamber_Line: 'EUV-Gamma', Recipe_Mode: 'Ultrafine', EUV_Dose_mJ: 36.4, Vacuum_Pressure_mTorr: 1.07, Stage_Temp_C: 21.7, Overlay_Error_nm: 1.0, Defect_Density_cm2: 0.028, Die_Yield_Pct: 97.3 },
      { Wafer_Lot: 'LOT-911', Chamber_Line: 'EUV-Beta', Recipe_Mode: 'High-NA', EUV_Dose_mJ: 33.4, Vacuum_Pressure_mTorr: 1.33, Stage_Temp_C: 23.0, Overlay_Error_nm: 2.0, Defect_Density_cm2: 0.074, Die_Yield_Pct: 88.7 },
      { Wafer_Lot: 'LOT-912', Chamber_Line: 'EUV-Alpha', Recipe_Mode: 'Standard', EUV_Dose_mJ: 32.1, Vacuum_Pressure_mTorr: 1.38, Stage_Temp_C: 23.2, Overlay_Error_nm: 2.1, Defect_Density_cm2: 0.081, Die_Yield_Pct: 87.6 },
    ],
    activeRows: [],
  },
  {
    id: 'ds-supply-chain',
    name: 'Global Maritime & Air Freight Corridor Logistics API',
    description:
      'Live REST API feed of multi-modal shipping corridors, customs dwell hours, fuel surcharges, and carbon intensity.',
    modality: 'rest_api',
    storagePolicy: 'passthrough',
    sourceUri: 'https://api.logistics-telemetry.internal/v2/corridors/live',
    ingestedAt: '2026-11-21T03:15:00.000Z',
    isCleaned: false,
    cleaningHistory: [],
    lastDiffs: [],
    columns: [
      'Corridor_Code',
      'Transport_Mode',
      'Origin_Hub',
      'Transit_Hours',
      'Customs_Dwell_Hrs',
      'Freight_Cost_USD',
      'CO2_kg_per_TEU',
      'On_Time_Reliability_Pct',
    ],
    rawRows: [
      { Corridor_Code: 'SHG-LAX-01', Transport_Mode: 'Maritime Express', Origin_Hub: 'Shanghai', Transit_Hours: 312, Customs_Dwell_Hrs: 18.4, Freight_Cost_USD: '$3,450', CO2_kg_per_TEU: 410, On_Time_Reliability_Pct: '92.4%' },
      { Corridor_Code: 'SIN-RTM-02', Transport_Mode: 'Maritime Standard', Origin_Hub: 'Singapore', Transit_Hours: 480, Customs_Dwell_Hrs: 26.0, Freight_Cost_USD: '$2,890', CO2_kg_per_TEU: 385, On_Time_Reliability_Pct: '84.1%' },
      { Corridor_Code: 'FRA-JFK-03', Transport_Mode: 'Air Cargo Priority', Origin_Hub: 'Frankfurt', Transit_Hours: 14, Customs_Dwell_Hrs: 4.2, Freight_Cost_USD: '$11,200', CO2_kg_per_TEU: 1840, On_Time_Reliability_Pct: '98.2%' },
      { Corridor_Code: 'ICN-SEA-04', Transport_Mode: 'Maritime Express', Origin_Hub: 'Incheon', Transit_Hours: 264, Customs_Dwell_Hrs: 14.8, Freight_Cost_USD: '$3,720', CO2_kg_per_TEU: 395, On_Time_Reliability_Pct: '94.0%' },
      { Corridor_Code: 'SZZX-ORD-05', Transport_Mode: 'Air Cargo Standard', Origin_Hub: 'Shenzhen', Transit_Hours: 22, Customs_Dwell_Hrs: 7.5, Freight_Cost_USD: '$9,400', CO2_kg_per_TEU: 1690, On_Time_Reliability_Pct: '95.6%' },
      { Corridor_Code: 'RTM-NYC-06', Transport_Mode: 'Maritime Standard', Origin_Hub: 'Rotterdam', Transit_Hours: 240, Customs_Dwell_Hrs: 'N/A', Freight_Cost_USD: '$2,610', CO2_kg_per_TEU: 340, On_Time_Reliability_Pct: '88.5%' },
      { Corridor_Code: 'TYO-SFO-07', Transport_Mode: 'Air Cargo Priority', Origin_Hub: 'Tokyo', Transit_Hours: 12, Customs_Dwell_Hrs: 3.8, Freight_Cost_USD: '$12,100', CO2_kg_per_TEU: 1920, On_Time_Reliability_Pct: '98.9%' },
      { Corridor_Code: 'BUS-LGB-08', Transport_Mode: 'Maritime Express', Origin_Hub: 'Busan', Transit_Hours: 278, Customs_Dwell_Hrs: 16.2, Freight_Cost_USD: '$3,580', CO2_kg_per_TEU: 402, On_Time_Reliability_Pct: '91.8%' },
      { Corridor_Code: 'HAM-SAV-09', Transport_Mode: 'Maritime Standard', Origin_Hub: 'Hamburg', Transit_Hours: 295, Customs_Dwell_Hrs: 31.5, Freight_Cost_USD: '$2,740', CO2_kg_per_TEU: 360, On_Time_Reliability_Pct: '79.3%' },
      { Corridor_Code: 'HKG-MEM-10', Transport_Mode: 'Air Cargo Standard', Origin_Hub: 'Hong Kong', Transit_Hours: 19, Customs_Dwell_Hrs: 6.1, Freight_Cost_USD: '$9,850', CO2_kg_per_TEU: 1750, On_Time_Reliability_Pct: '96.4%' },
    ],
    activeRows: [],
  },
];

export const SAMPLE_DATASETS: WorkspaceDataset[] = RAW_SAMPLE_DATASETS.map((ds) => ({
  ...ds,
  activeRows: ds.rawRows.map((r) => ({ ...r })),
}));

export const SAMPLE_UNSTRUCTURED_PDF_TEXT = `QUARTERLY CLINICAL & BIOTECH LAB EXTRACTION REPORT (PDF PAGE 4)
Patient_Cohort: Oncology-Phase2A | Compound: PRX-409 | Dosage_mg: 120 | Biomarker_Reduction_Pct: 68.4% | Half_Life_Hrs: 14.2 | Adverse_Events_Count: 1 | Efficacy_Index: 89.2
Patient_Cohort: Oncology-Phase2A | Compound: PRX-409 | Dosage_mg: 80 | Biomarker_Reduction_Pct: 51.0% | Half_Life_Hrs: 11.8 | Adverse_Events_Count: 0 | Efficacy_Index: 77.5
Patient_Cohort: Immunology-ArmB | Compound: KYN-210 | Dosage_mg: 200 | Biomarker_Reduction_Pct: 74.1% | Half_Life_Hrs: 18.6 | Adverse_Events_Count: 3 | Efficacy_Index: 92.8
Patient_Cohort: Immunology-ArmB | Compound: KYN-210 | Dosage_mg: 150 | Biomarker_Reduction_Pct: N/A | Half_Life_Hrs: 16.0 | Adverse_Events_Count: 2 | Efficacy_Index: 84.1
Patient_Cohort: Neurology-Pilot | Compound: NVR-88 | Dosage_mg: 60 | Biomarker_Reduction_Pct: 38.9% | Half_Life_Hrs: 9.4 | Adverse_Events_Count: 4 | Efficacy_Index: 61.3
Patient_Cohort: Neurology-Pilot | Compound: NVR-88 | Dosage_mg: 90 | Biomarker_Reduction_Pct: 44.2% | Half_Life_Hrs: 10.5 | Adverse_Events_Count: 5 | Efficacy_Index: 66.8
Patient_Cohort: Oncology-Phase2B | Compound: PRX-409 | Dosage_mg: 160 | Biomarker_Reduction_Pct: 79.5% | Half_Life_Hrs: 15.9 | Adverse_Events_Count: 2 | Efficacy_Index: 94.6
Patient_Cohort: Immunology-ArmA | Compound: KYN-210 | Dosage_mg: 100 | Biomarker_Reduction_Pct: 59.8% | Half_Life_Hrs: 13.4 | Adverse_Events_Count: 1 | Efficacy_Index: 81.0`;
