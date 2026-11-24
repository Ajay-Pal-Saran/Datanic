import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  ColumnProfile,
  D3ChartType,
  DataRow,
  DrawingAnnotation,
  LinearRegressionResult,
  PairwiseCorrelation,
} from '../types/workspace';
import { parseDirtyNumeric } from '../utils/dataEngine';

interface D3InteractiveCanvasProps {
  chartType: D3ChartType;
  rows: DataRow[];
  columns: string[];
  profiles: ColumnProfile[];
  xColumn: string;
  yColumn: string;
  groupColumn: string;
  sizeColumn?: string;
  aggregation: 'mean' | 'sum' | 'median' | 'max' | 'count';
  showRegressionOverlay: boolean;
  showAnomalyCallouts: boolean;
  rollingWindow: number;
  regression: LinearRegressionResult;
  correlations: PairwiseCorrelation[];
  activeGroupFilter: string | null;
  onSelectGroupFilter: (group: string | null) => void;
  onSelectDataPoint: (row: DataRow | null) => void;
  // Drawing & Annotation props
  drawingMode: 'navigate' | 'freehand' | 'line' | 'rect' | 'callout';
  drawingColor: string;
  annotations: DrawingAnnotation[];
  onAddAnnotation: (ann: DrawingAnnotation) => void;
  theme?: 'dark' | 'light';
}

const PALETTE = [
  '#94A3B8', // Cool Slate Silver
  '#389890', // Muted Teal
  '#C98A4B', // Warm Sand
  '#C9525B', // Muted Rose
  '#71717A', // Graphite
  '#539C74', // Sage
  '#A89F91', // Warm Stone
];

export const D3InteractiveCanvas: React.FC<D3InteractiveCanvasProps> = ({
  chartType,
  rows,
  profiles,
  xColumn,
  yColumn,
  groupColumn,
  sizeColumn,
  aggregation,
  showRegressionOverlay,
  showAnomalyCallouts,
  rollingWindow,
  regression,
  correlations,
  activeGroupFilter,
  onSelectGroupFilter,
  onSelectDataPoint,
  drawingMode,
  drawingColor,
  annotations,
  onAddAnnotation,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const t = {
    axisStroke: isDark ? 'rgba(255,255,255,0.16)' : '#D4D4D8',
    gridStroke: isDark ? 'rgba(255,255,255,0.06)' : '#E4E4E7',
    tickText: isDark ? '#8A8F98' : '#525866',
    labelText: isDark ? '#E4E6EC' : '#18181B',
    mutedText: isDark ? '#6E7480' : '#71717A',
    pointStroke: isDark ? '#0F1013' : '#FFFFFF',
    metricNodeFill: isDark ? '#1D1F27' : '#18181B',
    medianStroke: isDark ? '#F4F5F8' : '#0F172A',
    calloutBg: isDark ? '#14151A' : '#18181B',
    accent: isDark ? '#E4E6EC' : '#18181B',
    teal: '#389890',
    danger: '#E5484D',
  };
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    subtitle: string;
    metrics: { label: string; value: string }[];
  }>({
    visible: false,
    x: 0,
    y: 0,
    title: '',
    subtitle: '',
    metrics: [],
  });

  // Live drawing state
  const [draftPoints, setDraftPoints] = useState<{ x: number; y: number }[]>([]);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [calloutPromptPos, setCalloutPromptPos] = useState<{ x: number; y: number } | null>(null);
  const [calloutText, setCalloutText] = useState('');

  const filteredRows = activeGroupFilter
    ? rows.filter((r) => String(r[groupColumn] ?? '') === activeGroupFilter)
    : rows;

  const uniqueGroups = Array.from(
    new Set(rows.map((r) => String(r[groupColumn] ?? 'Default')))
  ).slice(0, 10);

  const colorScale = d3.scaleOrdinal<string, string>().domain(uniqueGroups).range(PALETTE);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const width = 880;
    const height = 470;
    const margin = { top: 36, right: 36, bottom: 56, left: 68 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('.d3-chart-root').remove();

    const g = svg
      .insert('g', '.d3-annotation-layer')
      .attr('class', 'd3-chart-root')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    if (filteredRows.length === 0) {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', t.mutedText)
        .attr('font-size', '12px')
        .text('No records match current filter.');
      return;
    }

    // 1. PARALLEL COORDINATES EXPLORER
    if (chartType === 'parallel_coordinates') {
      const numAxes = profiles
        .filter((p) => p.semanticType === 'numeric')
        .slice(0, 6)
        .map((p) => p.name);

      if (numAxes.length < 2) {
        g.append('text')
          .attr('x', innerW / 2)
          .attr('y', innerH / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#64748b')
          .text('At least 2 numeric columns required for Parallel Coordinates.');
        return;
      }

      const xScale = d3.scalePoint<string>().domain(numAxes).range([16, innerW - 16]);
      const yScales: Record<string, d3.ScaleLinear<number, number>> = {};

      for (const dim of numAxes) {
        const vals = filteredRows
          .map((r) => parseDirtyNumeric(r[dim]).numericValue)
          .filter((v): v is number => v !== null);
        const extent = d3.extent(vals) as [number, number];
        const min = extent[0] ?? 0;
        const max = extent[1] === min ? min + 1 : (extent[1] ?? 1);
        yScales[dim] = d3.scaleLinear().domain([min, max]).range([innerH, 10]).nice();
      }

      const lineGen = d3
        .line<[string, number]>()
        .x(([dim]) => xScale(dim) ?? 0)
        .y(([dim, val]) => yScales[dim](val));

      // Polylines
      g.selectAll('.pc-path')
        .data(filteredRows)
        .join('path')
        .attr('class', 'pc-path')
        .attr('d', (row) => {
          const pts: [string, number][] = numAxes.map((dim) => [
            dim,
            parseDirtyNumeric(row[dim]).numericValue ?? (yScales[dim].domain()[0] || 0),
          ]);
          return lineGen(pts);
        })
        .attr('fill', 'none')
        .attr('stroke', (row) => colorScale(String(row[groupColumn] ?? 'Default')))
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.55)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, row) {
          d3.select(this).attr('stroke-width', 4).attr('stroke-opacity', 1).raise();
          const [mx, my] = d3.pointer(event, svgEl);
          setTooltip({
            visible: true,
            x: mx,
            y: my,
            title: String(row[ profiles[0]?.name || groupColumn ] ?? 'Record'),
            subtitle: `${groupColumn}: ${String(row[groupColumn] ?? 'N/A')}`,
            metrics: numAxes.slice(0, 4).map((dim) => ({
              label: dim,
              value: String(row[dim] ?? 'null'),
            })),
          });
        })
        .on('mouseleave', function () {
          d3.select(this).attr('stroke-width', 2).attr('stroke-opacity', 0.55);
          setTooltip((t) => ({ ...t, visible: false }));
        })
        .on('click', (_e, row) => onSelectDataPoint(row));

      // Axes
      for (const dim of numAxes) {
        const axisG = g
          .append('g')
          .attr('transform', `translate(${xScale(dim) ?? 0},0)`)
          .call(d3.axisLeft(yScales[dim]).ticks(5));

        axisG
          .selectAll('text')
          .attr('font-family', 'JetBrains Mono, monospace')
          .attr('font-size', '10px')
          .attr('fill', t.tickText);
        axisG.selectAll('line, path').attr('stroke', t.axisStroke);

        axisG
          .append('text')
          .attr('y', -14)
          .attr('text-anchor', 'middle')
          .attr('fill', t.labelText)
          .attr('font-weight', '600')
          .attr('font-size', '11px')
          .text(dim.length > 16 ? `${dim.slice(0, 14)}…` : dim);
      }
    }

    // 2. FORCE-DIRECTED CORRELATION & ENTITY CLUSTER NETWORK
    else if (chartType === 'force_network') {
      interface GraphNode extends d3.SimulationNodeDatum {
        id: string;
        label: string;
        kind: 'metric' | 'cohort';
        group: string;
        radius: number;
        metricSummary: string;
      }
      interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
        weight: number;
        label: string;
        positive: boolean;
      }

      const numCols = profiles.filter((p) => p.semanticType === 'numeric').slice(0, 6);
      const nodes: GraphNode[] = numCols.map((p) => ({
        id: `col:${p.name}`,
        label: p.name,
        kind: 'metric',
        group: 'Metric Dimension',
        radius: 22,
        metricSummary: `Mean: ${p.mean ?? 0} · Median: ${p.median ?? 0}`,
      }));

      // Add cohort centroid nodes
      uniqueGroups.slice(0, 5).forEach((grp) => {
        const count = filteredRows.filter((r) => String(r[groupColumn] ?? '') === grp).length;
        nodes.push({
          id: `grp:${grp}`,
          label: grp,
          kind: 'cohort',
          group: grp,
          radius: Math.max(15, Math.min(26, 12 + count * 1.5)),
          metricSummary: `${count} records in cohort`,
        });
      });

      const nodeIds = new Set(nodes.map((n) => n.id));
      const links: GraphLink[] = [];

      for (const c of correlations.slice(0, 10)) {
        const s = `col:${c.colA}`;
        const t = `col:${c.colB}`;
        if (nodeIds.has(s) && nodeIds.has(t) && Math.abs(c.r) >= 0.15) {
          links.push({
            source: s,
            target: t,
            weight: Math.abs(c.r),
            label: `r = ${c.r}`,
            positive: c.r >= 0,
          });
        }
      }

      // Connect cohorts to top 2 metrics
      uniqueGroups.slice(0, 5).forEach((grp, idx) => {
        const targetMetric = numCols[idx % Math.max(1, numCols.length)];
        if (targetMetric) {
          links.push({
            source: `grp:${grp}`,
            target: `col:${targetMetric.name}`,
            weight: 0.5,
            label: 'Cohort Driver',
            positive: true,
          });
        }
      });

      // Run synchronous simulation ticks for instant deterministic layout
      const sim = d3
        .forceSimulation<GraphNode>(nodes)
        .force(
          'link',
          d3
            .forceLink<GraphNode, GraphLink>(links)
            .id((d) => d.id)
            .distance(115)
        )
        .force('charge', d3.forceManyBody().strength(-320))
        .force('center', d3.forceCenter(innerW / 2, innerH / 2))
        .force('collide', d3.forceCollide<GraphNode>((d) => d.radius + 14))
        .stop();

      for (let i = 0; i < 140; i++) sim.tick();

      // Links
      g.selectAll('.fn-link')
        .data(links)
        .join('line')
        .attr('class', 'fn-link')
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)
        .attr('stroke', (d) => (d.positive ? t.accent : t.danger))
        .attr('stroke-opacity', 0.45)
        .attr('stroke-width', (d) => Math.max(1.5, d.weight * 4.5));

      // Link correlation labels
      g.selectAll('.fn-link-label')
        .data(links.filter((l) => l.label.startsWith('r =')))
        .join('text')
        .attr('x', (d) => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
        .attr('y', (d) => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2 - 4)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('font-size', '10px')
        .attr('fill', t.tickText)
        .text((d) => d.label);

      // Nodes
      const nodeG = g
        .selectAll('.fn-node')
        .data(nodes)
        .join('g')
        .attr('class', 'fn-node')
        .attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          const [mx, my] = d3.pointer(event, svgEl);
          setTooltip({
            visible: true,
            x: mx,
            y: my,
            title: d.label,
            subtitle: d.kind === 'metric' ? 'Quantitative Measure Node' : `Cohort Cluster (${groupColumn})`,
            metrics: [{ label: 'Profile', value: d.metricSummary }],
          });
        })
        .on('mouseleave', () => setTooltip((t) => ({ ...t, visible: false })));

      nodeG
        .append('circle')
        .attr('r', (d) => d.radius)
        .attr('fill', (d) => (d.kind === 'metric' ? t.metricNodeFill : colorScale(d.group)))
        .attr('stroke', t.pointStroke)
        .attr('stroke-width', 2);

      nodeG
        .append('text')
        .attr('y', (d) => d.radius + 14)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', t.labelText)
        .text((d) => d.label);
    }

    // 3. OLS REGRESSION & RESIDUAL ANOMALY SCATTER
    else if (chartType === 'scatter_regression') {
      const pts = filteredRows
        .map((r, idx) => {
          const px = parseDirtyNumeric(r[xColumn]);
          const py = parseDirtyNumeric(r[yColumn]);
          const ps = sizeColumn ? parseDirtyNumeric(r[sizeColumn]) : { numericValue: 1 };
          if (!px.isNumeric || px.numericValue === null || !py.isNumeric || py.numericValue === null) {
            return null;
          }
          return {
            row: r,
            idx,
            x: px.numericValue,
            y: py.numericValue,
            sizeVal: ps.numericValue ?? 1,
            group: String(r[groupColumn] ?? 'Default'),
            label: String(r[profiles[0]?.name || groupColumn] ?? `Row #${idx + 1}`),
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (pts.length === 0) return;

      const xExt = d3.extent(pts, (d) => d.x) as [number, number];
      const yExt = d3.extent(pts, (d) => d.y) as [number, number];
      const sExt = d3.extent(pts, (d) => d.sizeVal) as [number, number];

      const xScale = d3
        .scaleLinear()
        .domain([xExt[0] * 0.92, xExt[1] * 1.05 || 1])
        .range([0, innerW])
        .nice();
      const yScale = d3
        .scaleLinear()
        .domain([Math.min(0, yExt[0] * 0.9), yExt[1] * 1.08 || 1])
        .range([innerH, 0])
        .nice();
      const rScale = d3
        .scaleSqrt()
        .domain([sExt[0] || 0, sExt[1] || 1])
        .range([5.5, 12]);

      // Gridlines
      g.append('g')
        .attr('stroke', t.gridStroke)
        .attr('stroke-dasharray', '3,3')
        .selectAll('line')
        .data(yScale.ticks(6))
        .join('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d));

      // Axes
      const xAxis = g
        .append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(7));
      xAxis.selectAll('text').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', '11px').attr('fill', t.tickText);
      xAxis.selectAll('line, path').attr('stroke', t.axisStroke);

      const yAxis = g.append('g').call(d3.axisLeft(yScale).ticks(6));
      yAxis.selectAll('text').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', '11px').attr('fill', t.tickText);
      yAxis.selectAll('line, path').attr('stroke', t.axisStroke);

      // Axis labels
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH + 42)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', t.labelText)
        .text(xColumn);

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', -48)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', t.labelText)
        .text(yColumn);

      // OLS Regression Line & Confidence Envelope
      if (showRegressionOverlay && pts.length >= 2) {
        const [xMin, xMax] = xScale.domain();
        const y1 = regression.slope * xMin + regression.intercept;
        const y2 = regression.slope * xMax + regression.intercept;

        const bandSpread = Math.abs(yExt[1] - yExt[0]) * 0.12;
        const bandArea = d3
          .area<{ x: number; y: number }>()
          .x((d) => xScale(d.x))
          .y0((d) => yScale(d.y - bandSpread))
          .y1((d) => yScale(d.y + bandSpread));

        g.append('path')
          .datum([
            { x: xMin, y: y1 },
            { x: xMax, y: y2 },
          ])
          .attr('fill', t.accent)
          .attr('fill-opacity', isDark ? 0.14 : 0.1)
          .attr('d', bandArea);

        g.append('line')
          .attr('x1', xScale(xMin))
          .attr('y1', yScale(y1))
          .attr('x2', xScale(xMax))
          .attr('y2', yScale(y2))
          .attr('stroke', t.accent)
          .attr('stroke-width', 1.75)
          .attr('stroke-dasharray', '6,4');
      }

      // Anomaly outer highlight rings
      const anomalySet = new Set(regression.anomalies.map((a) => a.rowIndex));
      if (showAnomalyCallouts) {
        g.selectAll('.anomaly-ring')
          .data(pts.filter((p) => anomalySet.has(p.idx)))
          .join('circle')
          .attr('class', 'anomaly-ring')
          .attr('cx', (d) => xScale(d.x))
          .attr('cy', (d) => yScale(d.y))
          .attr('r', (d) => rScale(d.sizeVal) + 5)
          .attr('fill', 'none')
          .attr('stroke', t.danger)
          .attr('stroke-width', 1.75)
          .attr('stroke-dasharray', '3,2');
      }

      // Points
      g.selectAll('.sc-dot')
        .data(pts)
        .join('circle')
        .attr('class', 'sc-dot')
        .attr('cx', (d) => xScale(d.x))
        .attr('cy', (d) => yScale(d.y))
        .attr('r', (d) => rScale(d.sizeVal))
        .attr('fill', (d) => colorScale(d.group))
        .attr('fill-opacity', 0.88)
        .attr('stroke', t.pointStroke)
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', function (event, d) {
          d3.select(this).attr('r', rScale(d.sizeVal) + 3).attr('fill-opacity', 1);
          const [mx, my] = d3.pointer(event, svgEl);
          setTooltip({
            visible: true,
            x: mx,
            y: my,
            title: d.label,
            subtitle: `${groupColumn}: ${d.group}`,
            metrics: [
              { label: xColumn, value: d.x.toLocaleString() },
              { label: yColumn, value: d.y.toLocaleString() },
              ...(anomalySet.has(d.idx) ? [{ label: 'Status', value: 'Residual Outlier (>1.65σ)' }] : []),
            ],
          });
        })
        .on('mouseleave', function (_e, d) {
          d3.select(this).attr('r', rScale(d.sizeVal)).attr('fill-opacity', 0.85);
          setTooltip((t) => ({ ...t, visible: false }));
        })
        .on('click', (_e, d) => onSelectDataPoint(d.row));
    }

    // 4. HIERARCHICAL SUNBURST PARTITION
    else if (chartType === 'sunburst_hierarchy') {
      const radius = Math.min(innerW, innerH) / 2 - 12;
      const centerG = g.append('g').attr('transform', `translate(${innerW / 2},${innerH / 2})`);

      interface TreeItem {
        name: string;
        value?: number;
        group?: string;
        row?: DataRow;
        children?: TreeItem[];
      }

      const grouped = d3.group(filteredRows, (r) => String(r[groupColumn] ?? 'Other'));
      const rootData: TreeItem = {
        name: 'Total',
        children: Array.from(grouped.entries()).map(([grp, items]) => ({
          name: grp,
          group: grp,
          children: items.slice(0, 12).map((r, i) => ({
            name: String(r[profiles[0]?.name || xColumn] ?? `${grp}-${i + 1}`),
            group: grp,
            value: Math.max(1, Math.abs(parseDirtyNumeric(r[yColumn]).numericValue ?? 10)),
            row: r,
          })),
        })),
      };

      const hierarchy = d3
        .hierarchy<TreeItem>(rootData)
        .sum((d) => d.value ?? 0)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

      const root = d3.partition<TreeItem>().size([2 * Math.PI, radius])(hierarchy);

      const arc = d3
        .arc<d3.HierarchyRectangularNode<TreeItem>>()
        .startAngle((d) => d.x0)
        .endAngle((d) => d.x1)
        .padAngle(0.01)
        .padRadius(radius / 2)
        .innerRadius((d) => d.y0)
        .outerRadius((d) => d.y1 - 2);

      centerG
        .selectAll('path')
        .data(root.descendants().filter((d) => d.depth > 0))
        .join('path')
        .attr('d', arc)
        .attr('fill', (d) => colorScale(d.data.group || d.data.name))
        .attr('fill-opacity', (d) => (d.depth === 1 ? 0.9 : 0.65))
        .attr('stroke', t.pointStroke)
        .attr('stroke-width', 1.2)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          const [mx, my] = d3.pointer(event, svgEl);
          const pct = root.value ? (((d.value ?? 0) / root.value) * 100).toFixed(1) : '0';
          setTooltip({
            visible: true,
            x: mx,
            y: my,
            title: d.data.name,
            subtitle: d.depth === 1 ? `Parent Cohort (${groupColumn})` : `Child Record · ${d.data.group}`,
            metrics: [
              { label: yColumn, value: (d.value ?? 0).toLocaleString() },
              { label: 'Share of Total', value: `${pct}%` },
            ],
          });
        })
        .on('mouseleave', () => setTooltip((t) => ({ ...t, visible: false })))
        .on('click', (_e, d) => {
          if (d.data.row) onSelectDataPoint(d.data.row);
        });

      centerG
        .selectAll('text')
        .data(root.descendants().filter((d) => d.depth === 1 && d.x1 - d.x0 > 0.22))
        .join('text')
        .attr('transform', (d) => {
          const angle = (((d.x0 + d.x1) / 2) * 180) / Math.PI - 90;
          const rMid = (d.y0 + d.y1) / 2;
          return `rotate(${angle}) translate(${rMid},0) rotate(${angle > 90 ? 180 : 0})`;
        })
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .attr('fill', '#ffffff')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .text((d) => d.data.name.slice(0, 12));
    }

    // 5. QUANTILE BOX & KERNEL DENSITY VIOLIN DISTRIBUTION
    else if (chartType === 'violin_distribution') {
      const grouped = d3.group(filteredRows, (r) => String(r[groupColumn] ?? 'Default'));
      const groups = Array.from(grouped.keys()).slice(0, 8);

      const allVals = filteredRows
        .map((r) => parseDirtyNumeric(r[yColumn]).numericValue)
        .filter((v): v is number => v !== null);
      const yExt = d3.extent(allVals) as [number, number];

      const xScale = d3.scaleBand<string>().domain(groups).range([0, innerW]).padding(0.28);
      const yScale = d3
        .scaleLinear()
        .domain([(yExt[0] ?? 0) * 0.9, (yExt[1] ?? 100) * 1.08])
        .range([innerH, 0])
        .nice();

      const bx = g
        .append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale));
      bx.selectAll('text').attr('font-size', '11px').attr('font-weight', '600').attr('fill', t.labelText);
      bx.selectAll('line, path').attr('stroke', t.axisStroke);

      const by = g.append('g').call(d3.axisLeft(yScale).ticks(6));
      by.selectAll('text').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', '11px').attr('fill', t.tickText);
      by.selectAll('line, path').attr('stroke', t.axisStroke);

      const boxW = xScale.bandwidth();

      for (const grp of groups) {
        const rowsInGrp = grouped.get(grp) || [];
        const vals = rowsInGrp
          .map((r) => parseDirtyNumeric(r[yColumn]).numericValue)
          .filter((v): v is number => v !== null)
          .sort((a, b) => a - b);

        if (vals.length === 0) continue;

        const q1 = d3.quantile(vals, 0.25) ?? vals[0];
        const median = d3.quantile(vals, 0.5) ?? vals[0];
        const q3 = d3.quantile(vals, 0.75) ?? vals[vals.length - 1];
        const min = vals[0];
        const max = vals[vals.length - 1];
        const xLeft = xScale(grp) ?? 0;
        const xMid = xLeft + boxW / 2;
        const col = colorScale(grp);

        // Whisker line
        g.append('line')
          .attr('x1', xMid)
          .attr('x2', xMid)
          .attr('y1', yScale(min))
          .attr('y2', yScale(max))
          .attr('stroke', col)
          .attr('stroke-width', 2);

        // IQR Box
        g.append('rect')
          .attr('x', xLeft)
          .attr('y', yScale(q3))
          .attr('width', boxW)
          .attr('height', Math.max(4, yScale(q1) - yScale(q3)))
          .attr('fill', col)
          .attr('fill-opacity', 0.22)
          .attr('stroke', col)
          .attr('stroke-width', 2)
          .attr('rx', 4)
          .style('cursor', 'pointer')
          .on('mouseenter', (event) => {
            const [mx, my] = d3.pointer(event, svgEl);
            setTooltip({
              visible: true,
              x: mx,
              y: my,
              title: `${grp} Distribution`,
              subtitle: `${vals.length} observations on ${yColumn}`,
              metrics: [
                { label: 'Median (Q2)', value: median.toFixed(2) },
                { label: 'IQR (Q1 – Q3)', value: `${q1.toFixed(1)} – ${q3.toFixed(1)}` },
                { label: 'Min / Max', value: `${min.toFixed(1)} / ${max.toFixed(1)}` },
              ],
            });
          })
          .on('mouseleave', () => setTooltip((t) => ({ ...t, visible: false })));

        // Median bar
        g.append('line')
          .attr('x1', xLeft)
          .attr('x2', xLeft + boxW)
          .attr('y1', yScale(median))
          .attr('y2', yScale(median))
          .attr('stroke', t.medianStroke)
          .attr('stroke-width', 2.5);

        // Individual jitter points
        rowsInGrp.forEach((r, i) => {
          const v = parseDirtyNumeric(r[yColumn]).numericValue;
          if (v === null) return;
          const jitter = ((i % 5) - 2) * (boxW * 0.1);
          g.append('circle')
            .attr('cx', xMid + jitter)
            .attr('cy', yScale(v))
            .attr('r', 4)
            .attr('fill', col)
            .attr('stroke', t.pointStroke)
            .attr('stroke-width', 1)
            .on('click', () => onSelectDataPoint(r));
        });
      }
    }

    // 6. ROLLING HORIZON & Z-SCORE ANOMALY ENVELOPE
    else if (chartType === 'horizon_anomaly') {
      const series = filteredRows
        .map((r, idx) => {
          const py = parseDirtyNumeric(r[yColumn]);
          if (!py.isNumeric || py.numericValue === null) return null;
          return {
            idx,
            row: r,
            label: String(r[profiles[0]?.name || xColumn] ?? `#${idx + 1}`),
            val: py.numericValue,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);

      if (series.length === 0) return;

      const mean = d3.mean(series, (d) => d.val) ?? 0;
      const std = d3.deviation(series, (d) => d.val) || 1;
      const w = Math.max(2, rollingWindow);

      const enriched = series.map((d, i) => {
        const slice = series.slice(Math.max(0, i - w + 1), i + 1);
        const rollMean = d3.mean(slice, (s) => s.val) ?? d.val;
        const z = (d.val - mean) / std;
        return { ...d, rollMean, z, isSpike: Math.abs(z) >= 1.5 };
      });

      const xScale = d3
        .scaleLinear()
        .domain([0, Math.max(1, enriched.length - 1)])
        .range([0, innerW]);
      const yExt = d3.extent(enriched, (d) => d.val) as [number, number];
      const yScale = d3
        .scaleLinear()
        .domain([Math.min(0, (yExt[0] ?? 0) * 0.9), (yExt[1] ?? 100) * 1.1])
        .range([innerH, 0])
        .nice();

      const hx = g
        .append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(
          d3
            .axisBottom(xScale)
            .ticks(Math.min(10, enriched.length))
            .tickFormat((d) => enriched[Number(d)]?.label.slice(0, 10) ?? String(d))
        );
      hx.selectAll('text').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', '10px').attr('fill', t.tickText);
      hx.selectAll('line, path').attr('stroke', t.axisStroke);

      const hy = g.append('g').call(d3.axisLeft(yScale).ticks(6));
      hy.selectAll('text').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', '11px').attr('fill', t.tickText);
      hy.selectAll('line, path').attr('stroke', t.axisStroke);

      const areaGen = d3
        .area<(typeof enriched)[0]>()
        .x((_, i) => xScale(i))
        .y0(innerH)
        .y1((d) => yScale(d.val))
        .curve(d3.curveMonotoneX);

      const lineGen = d3
        .line<(typeof enriched)[0]>()
        .x((_, i) => xScale(i))
        .y((d) => yScale(d.val))
        .curve(d3.curveMonotoneX);

      const rollGen = d3
        .line<(typeof enriched)[0]>()
        .x((_, i) => xScale(i))
        .y((d) => yScale(d.rollMean))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(enriched)
        .attr('fill', t.accent)
        .attr('fill-opacity', 0.14)
        .attr('d', areaGen);

      g.append('path')
        .datum(enriched)
        .attr('fill', 'none')
        .attr('stroke', t.accent)
        .attr('stroke-width', 2)
        .attr('d', lineGen);

      // Rolling average curve
      g.append('path')
        .datum(enriched)
        .attr('fill', 'none')
        .attr('stroke', t.teal)
        .attr('stroke-width', 1.75)
        .attr('stroke-dasharray', '5,3')
        .attr('d', rollGen);

      // Observation & Spike markers
      g.selectAll('.hz-dot')
        .data(enriched)
        .join('circle')
        .attr('cx', (_, i) => xScale(i))
        .attr('cy', (d) => yScale(d.val))
        .attr('r', (d) => (d.isSpike && showAnomalyCallouts ? 6.5 : 4))
        .attr('fill', (d) => (d.isSpike && showAnomalyCallouts ? t.danger : t.accent))
        .attr('stroke', t.pointStroke)
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          const [mx, my] = d3.pointer(event, svgEl);
          setTooltip({
            visible: true,
            x: mx,
            y: my,
            title: d.label,
            subtitle: d.isSpike ? `Anomaly Spike (Z = ${d.z.toFixed(2)}σ)` : 'Horizon Observation',
            metrics: [
              { label: yColumn, value: d.val.toLocaleString() },
              { label: `${w}-Period Rolling Avg`, value: d.rollMean.toFixed(2) },
            ],
          });
        })
        .on('mouseleave', () => setTooltip((t) => ({ ...t, visible: false })))
        .on('click', (_e, d) => onSelectDataPoint(d.row));
    }

    // 7. GROUPED / AGGREGATED COMPARATIVE BAR CHART
    else {
      const grouped = d3.group(filteredRows, (r) => String(r[xColumn] ?? 'Unspecified'));
      const aggregated = Array.from(grouped.entries())
        .map(([key, items]) => {
          const nums = items
            .map((r) => parseDirtyNumeric(r[yColumn]).numericValue)
            .filter((v): v is number => v !== null);
          let val = 0;
          if (aggregation === 'count') val = items.length;
          else if (nums.length === 0) val = 0;
          else if (aggregation === 'sum') val = d3.sum(nums);
          else if (aggregation === 'median') val = d3.median(nums) ?? 0;
          else if (aggregation === 'max') val = d3.max(nums) ?? 0;
          else val = d3.mean(nums) ?? 0;

          return {
            key,
            value: Number(val.toFixed(2)),
            count: items.length,
            sampleRow: items[0],
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 14);

      const xScale = d3
        .scaleBand<string>()
        .domain(aggregated.map((d) => d.key))
        .range([0, innerW])
        .padding(0.28);

      const maxVal = d3.max(aggregated, (d) => d.value) || 100;
      const yScale = d3
        .scaleLinear()
        .domain([0, maxVal * 1.12])
        .range([innerH, 0])
        .nice();

      const gx = g
        .append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale));
      gx.selectAll('text').attr('font-size', '11px').attr('font-weight', '600').attr('fill', t.labelText);
      gx.selectAll('line, path').attr('stroke', t.axisStroke);

      const gy = g.append('g').call(d3.axisLeft(yScale).ticks(6));
      gy.selectAll('text').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', '11px').attr('fill', t.tickText);
      gy.selectAll('line, path').attr('stroke', t.axisStroke);

      // Bars
      g.selectAll('.bar-rect')
        .data(aggregated)
        .join('rect')
        .attr('class', 'bar-rect')
        .attr('x', (d) => xScale(d.key) ?? 0)
        .attr('y', (d) => yScale(d.value))
        .attr('width', xScale.bandwidth())
        .attr('height', (d) => Math.max(2, innerH - yScale(d.value)))
        .attr('fill', (d) => colorScale(d.key))
        .attr('rx', 4)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          const [mx, my] = d3.pointer(event, svgEl);
          setTooltip({
            visible: true,
            x: mx,
            y: my,
            title: d.key,
            subtitle: `${d.count} record(s) in cohort`,
            metrics: [{ label: `${aggregation.toUpperCase()}(${yColumn})`, value: d.value.toLocaleString() }],
          });
        })
        .on('mouseleave', () => setTooltip((t) => ({ ...t, visible: false })))
        .on('click', (_e, d) => onSelectDataPoint(d.sampleRow));

      // Value labels above bars
      g.selectAll('.bar-label')
        .data(aggregated)
        .join('text')
        .attr('x', (d) => (xScale(d.key) ?? 0) + xScale.bandwidth() / 2)
        .attr('y', (d) => yScale(d.value) - 6)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('fill', t.labelText)
        .text((d) => d.value.toLocaleString());
    }
  }, [
    chartType,
    filteredRows,
    profiles,
    xColumn,
    yColumn,
    groupColumn,
    sizeColumn,
    aggregation,
    showRegressionOverlay,
    showAnomalyCallouts,
    rollingWindow,
    regression,
    correlations,
    colorScale,
    onSelectDataPoint,
    uniqueGroups,
    theme,
  ]);

  // Drawing pointer handlers
  const getSvgCoords = (e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } => {
    const svgEl = svgRef.current;
    if (!svgEl) return { x: 0, y: 0 };
    const rect = svgEl.getBoundingClientRect();
    const scaleX = 880 / rect.width;
    const scaleY = 470 / rect.height;
    return {
      x: Number(((e.clientX - rect.left) * scaleX).toFixed(1)),
      y: Number(((e.clientY - rect.top) * scaleY).toFixed(1)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drawingMode === 'navigate') return;
    const pt = getSvgCoords(e);
    if (drawingMode === 'callout') {
      setCalloutPromptPos(pt);
      setCalloutText('');
      return;
    }
    setIsPointerDown(true);
    setDraftPoints([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPointerDown || drawingMode === 'navigate' || drawingMode === 'callout') return;
    const pt = getSvgCoords(e);
    if (drawingMode === 'freehand') {
      setDraftPoints((prev) => [...prev, pt]);
    } else {
      setDraftPoints((prev) => [prev[0], pt]);
    }
  };

  const handlePointerUp = () => {
    if (!isPointerDown) return;
    setIsPointerDown(false);
    if (draftPoints.length >= 2) {
      onAddAnnotation({
        id: `ann-${Date.now()}`,
        tool: drawingMode as 'freehand' | 'line' | 'rect',
        color: drawingColor,
        strokeWidth: 2.5,
        points: draftPoints,
      });
    }
    setDraftPoints([]);
  };

  const handleConfirmCallout = () => {
    if (!calloutPromptPos || !calloutText.trim()) {
      setCalloutPromptPos(null);
      return;
    }
    onAddAnnotation({
      id: `ann-${Date.now()}`,
      tool: 'callout',
      color: drawingColor,
      strokeWidth: 2,
      points: [calloutPromptPos],
      text: calloutText.trim(),
    });
    setCalloutPromptPos(null);
    setCalloutText('');
  };

  const renderAnnotationShape = (ann: DrawingAnnotation) => {
    if (ann.tool === 'freehand' && ann.points.length >= 2) {
      const d = ann.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return (
        <path
          key={ann.id}
          d={d}
          fill="none"
          stroke={ann.color}
          strokeWidth={ann.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }
    if (ann.tool === 'line' && ann.points.length >= 2) {
      const [p1, p2] = ann.points;
      return (
        <line
          key={ann.id}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={ann.color}
          strokeWidth={ann.strokeWidth}
          strokeLinecap="round"
        />
      );
    }
    if (ann.tool === 'rect' && ann.points.length >= 2) {
      const [p1, p2] = ann.points;
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);
      return (
        <rect
          key={ann.id}
          x={x}
          y={y}
          width={w}
          height={h}
          fill={ann.color}
          fillOpacity={0.1}
          stroke={ann.color}
          strokeWidth={ann.strokeWidth}
          strokeDasharray="4,3"
          rx={4}
        />
      );
    }
    if (ann.tool === 'callout' && ann.points[0]) {
      const pt = ann.points[0];
      return (
        <g key={ann.id} transform={`translate(${pt.x},${pt.y})`}>
          <circle r={5} fill={ann.color} stroke="#ffffff" strokeWidth={1.5} />
          <rect
            x={8}
            y={-14}
            width={Math.max(70, (ann.text?.length || 6) * 6.8 + 16)}
            height={24}
            rx={4}
            fill="#0f172a"
            stroke={ann.color}
            strokeWidth={1.5}
          />
          <text x={15} y={2} fill="#ffffff" fontSize="11px" fontWeight="600">
            {ann.text}
          </text>
        </g>
      );
    }
    return null;
  };

  return (
    <div className="relative bg-white dark:bg-[#0F1013] overflow-hidden">
      {/* Hairline Cohort Filter Bar */}
      <div className="px-4 py-2.5 bg-zinc-50/70 dark:bg-[#121317] border-b border-zinc-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-[#8A8F98] mr-1">
            Filter ({groupColumn}):
          </span>
          <button
            type="button"
            onClick={() => onSelectGroupFilter(null)}
            className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeGroupFilter === null
                ? 'bg-zinc-900 dark:bg-white/[0.12] text-white'
                : 'text-zinc-600 dark:text-[#A0A6B2] border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
            }`}
          >
            All ({rows.length})
          </button>
          {uniqueGroups.map((grp) => {
            const isSel = activeGroupFilter === grp;
            return (
              <button
                key={grp}
                type="button"
                onClick={() => onSelectGroupFilter(isSel ? null : grp)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSel
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100'
                    : 'text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-xs shrink-0"
                  style={{ backgroundColor: colorScale(grp) }}
                />
                <span>{grp}</span>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] font-mono text-zinc-400 dark:text-[#6E7480]">
          {drawingMode === 'navigate'
            ? 'Inspect'
            : `Draw: ${drawingMode}`}
        </div>
      </div>

      {/* Main SVG Viewport */}
      <div className="relative w-full">
        <svg
          ref={svgRef}
          data-testid="d3-visualization-svg"
          viewBox="0 0 880 470"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`w-full h-auto block select-none ${
            drawingMode !== 'navigate' ? 'cursor-crosshair' : ''
          }`}
        >
          {/* User Drawing & Callout Annotation Layer */}
          <g className="d3-annotation-layer">
            {annotations.map((ann) => renderAnnotationShape(ann))}
            {draftPoints.length >= 2 &&
              renderAnnotationShape({
                id: 'draft',
                tool: drawingMode as 'freehand' | 'line' | 'rect',
                color: drawingColor,
                strokeWidth: 2.5,
                points: draftPoints,
              })}
          </g>
        </svg>

        {/* Callout Text Input Popover */}
        {calloutPromptPos && (
          <div
            className="absolute z-20 bg-slate-900 text-white p-3 rounded-lg shadow-lg border border-slate-700 flex items-center gap-2"
            style={{
              left: `${Math.min(70, (calloutPromptPos.x / 880) * 100)}%`,
              top: `${Math.min(75, (calloutPromptPos.y / 470) * 100)}%`,
            }}
          >
            <input
              type="text"
              value={calloutText}
              onChange={(e) => setCalloutText(e.target.value)}
              placeholder="Add annotation note..."
              aria-label="Annotation note text"
              className="px-2.5 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCallout();
              }}
            />
            <button
              type="button"
              onClick={handleConfirmCallout}
              className="px-2.5 py-1 text-xs font-semibold bg-zinc-100 text-zinc-950 rounded hover:bg-white cursor-pointer"
            >
              Pin
            </button>
            <button
              type="button"
              onClick={() => setCalloutPromptPos(null)}
              className="px-2 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Floating D3 Data Point Tooltip */}
        {tooltip.visible && drawingMode === 'navigate' && (
          <div
            className="pointer-events-none absolute z-10 bg-zinc-950/95 text-white px-3.5 py-2.5 rounded-lg shadow-md border border-white/[0.12] text-xs max-w-xs"
            style={{
              left: `${Math.min(72, (tooltip.x / 880) * 100 + 2)}%`,
              top: `${Math.max(4, (tooltip.y / 470) * 100 - 10)}%`,
            }}
          >
            <div className="font-bold text-white">{tooltip.title}</div>
            <div className="text-[11px] text-zinc-400 mb-1.5">{tooltip.subtitle}</div>
            <div className="space-y-0.5 font-mono tabular-nums text-[11px]">
              {tooltip.metrics.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">{m.label}:</span>
                  <span className="font-semibold text-white">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
