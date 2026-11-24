import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCorrelationMatrix,
  computeLinearRegression,
  determineStoragePolicy,
  executeDataCleaning,
  executeLocalNLQuery,
  parseDirtyNumeric,
  parseUniversalTextToRows,
  profileDataset,
} from './dataEngine';
import { SAMPLE_DATASETS, SAMPLE_UNSTRUCTURED_PDF_TEXT } from './sampleDatasets';

test('determineStoragePolicy distinguishes persistent storage vs zero-copy pass-through', () => {
  assert.equal(determineStoragePolicy('file_upload').policy, 'stored');
  assert.equal(determineStoragePolicy('pdf_document').policy, 'stored');
  assert.equal(determineStoragePolicy('manual_entry').policy, 'stored');
  assert.equal(determineStoragePolicy('url_endpoint').policy, 'passthrough');
  assert.equal(determineStoragePolicy('rest_api').policy, 'passthrough');
  assert.equal(determineStoragePolicy('data_stream').policy, 'passthrough');
  assert.equal(determineStoragePolicy('data_lake').policy, 'passthrough');
});

test('parseDirtyNumeric parses formatted currencies, percentages, and sentinels', () => {
  const c1 = parseDirtyNumeric('$148,500');
  assert.equal(c1.isNumeric, true);
  assert.equal(c1.wasDirty, true);
  assert.equal(c1.numericValue, 148500);

  const c2 = parseDirtyNumeric('91.4%');
  assert.equal(c2.isNumeric, true);
  assert.equal(c2.wasDirty, true);
  assert.equal(c2.numericValue, 91.4);

  const c3 = parseDirtyNumeric('N/A');
  assert.equal(c3.isNumeric, false);
  assert.equal(c3.numericValue, null);
});

test('parseUniversalTextToRows extracts structured rows from PDF key-value text and CSV', () => {
  const pdfParsed = parseUniversalTextToRows(SAMPLE_UNSTRUCTURED_PDF_TEXT);
  assert.ok(pdfParsed.columns.includes('Patient_Cohort'));
  assert.ok(pdfParsed.columns.includes('Efficacy_Index'));
  assert.equal(pdfParsed.rows.length, 8);

  const csvParsed = parseUniversalTextToRows('City,Temp,Status\nTokyo,24.5,Active\nBerlin,18.2,Active');
  assert.deepEqual(csvParsed.columns, ['City', 'Temp', 'Status']);
  assert.equal(csvParsed.rows.length, 2);
  assert.equal(csvParsed.rows[0].Temp, 24.5);
});

test('Tier 1 profileDataset and Tier 2 executeDataCleaning resolve missing, dirty, and duplicate cells', () => {
  const saas = SAMPLE_DATASETS[0];
  const reportBefore = profileDataset(saas.name, saas.columns, saas.rawRows);

  assert.equal(reportBefore.readinessVerdict, 'needs_cleaning');
  assert.ok(reportBefore.missingCellsTotal >= 4);
  assert.ok(reportBefore.dirtyFormatCellsTotal >= 15);
  assert.equal(reportBefore.duplicateRowsTotal, 1);

  const cleaned = executeDataCleaning(saas.columns, saas.rawRows, [
    'deduplicate_rows',
    'normalize_formats',
    'impute_missing_numeric',
    'impute_missing_categorical',
    'cap_outliers',
  ]);

  assert.equal(cleaned.cleanedRows.length, saas.rawRows.length - 1);
  assert.ok(cleaned.diffs.length > 10);

  const reportAfter = profileDataset(saas.name, cleaned.cleanedColumns, cleaned.cleanedRows);
  assert.equal(reportAfter.missingCellsTotal, 0);
  assert.equal(reportAfter.dirtyFormatCellsTotal, 0);
  assert.equal(reportAfter.duplicateRowsTotal, 0);
  assert.ok(reportAfter.healthScore > reportBefore.healthScore);
});

test('Tier 3 correlation, regression, and NL query engine compute valid statistical insights', () => {
  const saas = SAMPLE_DATASETS[0];
  const cleaned = executeDataCleaning(saas.columns, saas.rawRows, [
    'deduplicate_rows',
    'normalize_formats',
    'impute_missing_numeric',
  ]);
  const report = profileDataset(saas.name, cleaned.cleanedColumns, cleaned.cleanedRows);
  const corrs = computeCorrelationMatrix(cleaned.cleanedColumns, cleaned.cleanedRows, report.columnProfiles);

  assert.ok(corrs.length > 0);
  assert.ok(Math.abs(corrs[0].r) <= 1);

  const reg = computeLinearRegression(cleaned.cleanedRows, 'Seat_Utilization_Pct', 'Churn_Risk_Score', 'Account_ID');
  assert.ok(reg.rSquared > 0.5);
  assert.ok(reg.slope < 0);

  const nlResult = executeLocalNLQuery(
    'Show correlation between Seat_Utilization_Pct and Churn_Risk_Score',
    saas.name,
    cleaned.cleanedColumns,
    cleaned.cleanedRows,
    report.columnProfiles
  );
  assert.equal(nlResult.suggestedChartType, 'scatter_regression');
  assert.ok(nlResult.directAnswer.includes('Pearson r'));
});
