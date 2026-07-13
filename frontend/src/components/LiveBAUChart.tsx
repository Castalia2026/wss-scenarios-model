import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, Line, Label, ReferenceLine, LabelList,
} from 'recharts';
import { toPng } from 'html-to-image';

/**
 * BAU vs Target chart driven by the LIVE calculation engine (validated cell-by-cell against the
 * reference Excel). Re-computes whenever the shared inputs change (debounced).
 *
 * Accepts EITHER a single `inputs` (one area) or an `inputsList` of several area datasets that are
 * summed element-wise (Urban + Rural = National) — households, safely-managed BAU/target counts and
 * the financing gap are all additive across areas. So the National panel is a genuine sum of the two
 * per-area engine runs, not a synthetic scaling.
 */
export default function LiveBAUChart({ inputs, inputsList, sector, scopeLabel }:
  { inputs?: any; inputsList?: any[]; sector: 'water' | 'sanitation'; scopeLabel?: string }) {
  const datasets = ((inputsList && inputsList.length) ? inputsList : (inputs ? [inputs] : [])).filter(Boolean);
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Set when the BAU is budget-constrained (frozen): the capex budget is below the replacement need in
  // every forecast year, so no new safely-managed connections are built and unit cost has no effect.
  const [constrained, setConstrained] = useState<{ avail: number; repl: number; cur: string } | null>(null);
  // Reference lines carry BOTH the absolute (count) and share value so they track the Y-axis unit toggle.
  const [targetLines, setTargetLines] = useState<{ y: number; yShare: number; label: string }[]>([]);
  // On-chart annotation anchors: one per target year — the target point (chat-box callout) and the
  // gap-line point (financing-gap flag). These REPLACE the old four KPI cards.
  const [targetPoints, setTargetPoints] = useState<any[]>([]);
  // Which flags the user has closed (✕). Keys: `t-<year>` (target callout), `f-<year>` (finance flag).
  // A closed flag leaves a small marker at its anchor that reopens it on click.
  const [closedFlags, setClosedFlags] = useState<Set<string>>(new Set());
  const toggleFlag = (key: string, open: boolean) => setClosedFlags(prev => {
    const n = new Set(prev); if (open) n.delete(key); else n.add(key); return n;
  });
  // Multi-select of target YEARS whose call-out + finance flag are drawn at all (the 🎯 Targets
  // dropdown). null = all targets visible (so newly-added targets show automatically).
  const [visibleTargets, setVisibleTargets] = useState<Set<number> | null>(null);
  const [tgtDropOpen, setTgtDropOpen] = useState(false);
  const isTargetVisible = (yr: number) => !visibleTargets || visibleTargets.has(yr);
  const toggleTargetVisible = (yr: number, allYears: number[]) => setVisibleTargets(prev => {
    const n = new Set(prev ?? allYears);          // null (all) -> materialize the full set first
    if (n.has(yr)) n.delete(yr); else n.add(yr);
    return n;
  });
  // Y-axis unit: absolute household counts (millions) or share of total households (%).
  const [unitMode, setUnitMode] = useState<'count' | 'share'>('count');
  // Show/hide the per-year data-point dots on the chart.
  const [showDots, setShowDots] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);
  // ── Flag overlay geometry ──────────────────────────────────────────────────────────────────
  // The call-outs/flags are rendered in a SEPARATE svg stacked ABOVE the whole chart (not inside
  // recharts), so nothing — series lines, data-point dots, even the hover cursor/active dots that
  // recharts paints in its top layer — can ever draw across them. Pixel positions are derived from
  // the rendered axis ticks: both axes are linear in (year, value), so two ticks fix each mapping.
  const [overlay, setOverlay] = useState<{ left: number; top: number; width: number; height: number;
    xm: number; xb: number; ym: number; yb: number } | null>(null);
  const [winTick, setWinTick] = useState(0);          // bump on window resize to re-measure
  useEffect(() => {
    const onResize = () => setWinTick(t => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isShareNow = unitMode === 'share';
  useLayoutEffect(() => {
    // ResponsiveContainer sizes itself asynchronously (ResizeObserver), so the surface/ticks may not
    // exist yet on the first pass after data arrives — retry shortly until they do.
    const retry = () => { const h = setTimeout(() => setWinTick(t => t + 1), 120); return () => clearTimeout(h); };
    const wrap = chartRef.current;
    // Several .recharts-surface svgs exist (each legend icon is one) — take the LARGEST (the plot).
    const surface = wrap ? ([...wrap.querySelectorAll('svg.recharts-surface')] as SVGSVGElement[])
      .sort((a, b) => b.clientWidth - a.clientWidth)[0] : null;
    if (!wrap || !surface || surface.clientWidth < 100) { setOverlay(null); return data.length ? retry() : undefined; }
    const sR = surface.getBoundingClientRect();
    const wR = wrap.getBoundingClientRect();
    // recharts 3 renders tick labels as text.recharts-cartesian-axis-tick-value in separate z-index
    // layers (not nested under the axis groups), so classify by CONTENT: 4-digit years = x-axis;
    // any other number = y-axis (which only ever shows small counts or percentages here).
    const xt: { yr: number; x: number }[] = [];
    const yt: { v: number; y: number }[] = [];
    let sawPct = false;
    surface.querySelectorAll('text.recharts-cartesian-axis-tick-value').forEach((t) => {
      const raw = (t.textContent || '').trim();
      const x = parseFloat(t.getAttribute('x') || '');
      const y = parseFloat(t.getAttribute('y') || '');
      if (/^(19|20)\d{2}$/.test(raw)) {
        if (!isNaN(x)) xt.push({ yr: parseInt(raw, 10), x });
      } else {
        if (/%$/.test(raw)) sawPct = true;
        const v = parseFloat(raw.replace(/[%,\s]/g, ''));
        if (!isNaN(v) && !isNaN(y)) yt.push({ v: isShareNow ? v / 100 : v, y });
      }
    });
    // Stale-DOM guard: right after the unit toggle, recharts may not have repainted the axis yet —
    // in share mode ticks end with '%', in count mode they don't. Mismatch => measure again shortly.
    if (xt.length < 2 || yt.length < 2 || sawPct !== isShareNow) { setOverlay(null); return data.length ? retry() : undefined; }
    const xa = xt[0], xz = xt[xt.length - 1];
    const ya = yt[0], yz = yt[yt.length - 1];
    if (xz.yr === xa.yr || yz.v === ya.v) { setOverlay(null); return; }
    const xm = (xz.x - xa.x) / (xz.yr - xa.yr), xb = xa.x - xm * xa.yr;
    const ym = (yz.y - ya.y) / (yz.v - ya.v), yb = ya.y - ym * ya.v;
    setOverlay({ left: sR.left - wR.left, top: sR.top - wR.top, width: sR.width, height: sR.height, xm, xb, ym, yb });
  }, [data, unitMode, winTick]);

  const depKey = JSON.stringify(datasets) + '|' + sector;
  useEffect(() => {
    if (!datasets.length) return;
    const h = setTimeout(() => {
      Promise.all(datasets.map(inp =>
        fetch('/api/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inp) })
          .then(r => { if (!r.ok) throw new Error('calc failed (' + r.status + ')'); return r.json(); })
      )).then(resList => {
        const base = resList[0];
        const years: number[] = base.years;
        const secOf = (res: any) => sector === 'water' ? res.water_supply : res.sanitation;
        // Element-wise sum across areas (Urban + Rural = National). All three series are additive.
        const sum = (pick: (res: any, i: number) => number) =>
          years.map((_: number, i: number) => resList.reduce((a, res) => a + (pick(res, i) || 0), 0));
        const total = sum((res, i) => res.total_hh[i]);
        const bau = sum((res, i) => secOf(res).bau_hh[0][i]);
        const tgt = sum((res, i) => secOf(res).target_hh[0][i]);

        // Performance-improvement start year: the target only diverges from BAU from here on. Before it,
        // the target line is dotted (those years are not in the performance-improvement window yet).
        const per = datasets[0]?.period || {};
        const perfStart = (per.as_is_forecast_start ?? ((per.baseline_year ?? 2025) + 1)) + (per.as_is_forecast_length ?? 2);
        const rows = years.map((y: number, i: number) => {
          const tot = +total[i].toFixed(4);
          // Safely-managed can never exceed total households — clamp both BAU and target for display.
          const bauC = +Math.min(total[i], bau[i]).toFixed(4);
          const tgtC = +Math.min(total[i], tgt[i]).toFixed(4);
          const gap = +Math.max(0, tgtC - bauC).toFixed(4);   // HH gap = target − BAU (safely managed)
          return {
            year: y,
            'Total households': tot,
            'Households with safely managed (BAU)': bauC,
            // Split so the pre-performance-start portion draws dotted and the rest solid (two <Line>s below).
            'Target (before performance start)': y <= perfStart ? tgtC : null,
            'Target (safely managed)': y >= perfStart ? tgtC : null,
            // Gap only exists once the target diverges from BAU — start the line at the performance-start year.
            'HH gap (target − BAU)': y >= perfStart ? gap : null,
          };
        });
        setData(rows);

        // test2: target years come from the service table — any forecast column whose 5 rung shares
        // sum to ~100% is a target. Union across areas; fall back to the legacy fixed Target 1/2
        // years for old payloads that define none in the table.
        const svcSection = sector === 'water' ? 'water_service' : 'sanitation_service';
        const svcPrefix = sector === 'water' ? 'serv' : 'sserv';
        const tgtYearSet = new Set<number>();
        datasets.forEach((inp: any) => {
          const svc = inp?.[svcSection] || {};
          const arrs = [1, 2, 3, 4, 5].map(k => svc[`${svcPrefix}${k}_ts`] || []);
          const msy = inp?.period?.model_start_year ?? years[0];
          const by = inp?.period?.baseline_year ?? msy;
          const end = inp?.period?.forecast_end_year ?? years[years.length - 1];
          const maxLen = Math.max(0, ...arrs.map((a: any[]) => a.length));
          for (let idx = 0; idx < maxLen; idx++) {
            const yr = msy + idx;
            if (yr <= by || yr > end) continue;
            let s = 0, any = false;
            arrs.forEach((a: any[]) => { const v = a[idx]; if (v != null && v > 0) { s += v; any = true; } });
            if (any && Math.abs(s - 1) < 0.02) tgtYearSet.add(yr);
          }
        });
        const t1y = per.target1_year || 2030, t2y = per.target2_year || 2040;
        const tgtYears = tgtYearSet.size ? [...tgtYearSet].sort((a, b) => a - b)
          : [t1y, t2y].filter((y, i, arr) => years.includes(y) && arr.indexOf(y) === i);
        // Per-target anchor + KPI payload for the on-chart flags (all additive across areas).
        const gapMoneyAt = (yr: number) => { const ix = years.indexOf(yr); return ix >= 0 ? resList.reduce((a, res) => a + (secOf(res).financing_gap[ix] || 0), 0) : null; };
        const cur0 = datasets[0]?.country_config?.currency || 'LCU';
        const points = tgtYears.map((yr: number) => {
          const ix = years.indexOf(yr);
          if (ix < 0) return null;
          const tot = total[ix] || 0;
          const t = Math.min(tot, tgt[ix]), b = Math.min(tot, bau[ix]);
          const gapHH = Math.max(0, t - b);
          return {
            year: yr, cur: cur0,
            y: +t.toFixed(4), yShare: tot > 0 ? t / tot : 0,                    // target point (callout anchor)
            gapY: +gapHH.toFixed(4), gapYShare: tot > 0 ? gapHH / tot : 0,      // gap-line point (flag anchor)
            bauCov: tot > 0 ? b / tot : 0, tgtCov: tot > 0 ? t / tot : 0,
            svcGap: gapHH, finGap: gapMoneyAt(yr),
          };
        }).filter(Boolean) as any[];
        setTargetPoints(points);
        setTargetLines(points.map(p => ({ y: p.y, yShare: p.yShare, label: `Target (${p.year})` })));

        // Budget-constrained (frozen) detection: if for EVERY forecast year the BAU capex budget is at
        // or below the replacement/depreciation need, new safely-managed connections = max(0, budget −
        // replacement) ÷ cost = 0, so the BAU curve is flat and UNIT COST HAS NO EFFECT. Flag it.
        const availS = sum((res, i) => (secOf(res).bau_available || [])[i] || 0);
        const replS = sum((res, i) => (secOf(res).bau_replacement_capex || [])[i] || 0);
        const baseYr = per.baseline_year ?? years[0];
        const fcast = years.map((y: number, i: number) => (y > baseYr ? i : -1)).filter((i: number) => i >= 0);
        const frozen = fcast.length > 0 && fcast.every((i: number) => availS[i] <= replS[i] + 1e-9);
        const avgOf = (arr: number[]) => fcast.reduce((a: number, i: number) => a + (arr[i] || 0), 0) / fcast.length;
        setConstrained(frozen ? { avail: avgOf(availS), repl: avgOf(replS), cur: datasets[0]?.country_config?.currency || 'LCU' } : null);

        // ── Headline summary (the per-target KPIs now live in the on-chart flags) ──
        const endIdx = years.length - 1;                       // last year = forecast end
        const totEnd = total[endIdx] || 0;
        const cov = (arr: number[]) => totEnd > 0 ? Math.min(totEnd, arr[endIdx]) / totEnd : 0;
        const tin = sum((res, i) => (secOf(res).total_investment_need || [])[i] || 0);
        const baseline = per.baseline_year ?? years[0];
        let cumNeed = 0; years.forEach((y: number, i: number) => { if (y > baseline) cumNeed += tin[i] || 0; });
        setSummary({
          costSM: datasets.length === 1 ? secOf(base).cost_per_hh : null,
          currency: cur0,
          endline: years[endIdx], baseline, firstForecast: baseline + 1,
          bauCov: cov(bau), tgtCov: cov(tgt),
          gapEnd: Math.max(0, Math.min(totEnd, tgt[endIdx]) - Math.min(totEnd, bau[endIdx])),
          firstTgt: points.length ? { year: points[0].year, finGap: points[0].finGap } : null,
          cumNeed,
        });
        setError(null);
      }).catch(e => setError(String(e)));
    }, 350);
    return () => clearTimeout(h);
  }, [depKey]);

  const sectorLabel = sector === 'water' ? 'Water Supply' : 'Sanitation';
  const isShare = unitMode === 'share';

  // Endpoint value labels: annotate the baseline year and the final forecast year only.
  const per0 = datasets[0]?.period || {};
  const endpointYears = useMemo(() => {
    const s = new Set<number>();
    if (per0.baseline_year != null) s.add(per0.baseline_year);
    if (per0.forecast_end_year != null) s.add(per0.forecast_end_year);
    return s;
  }, [per0.baseline_year, per0.forecast_end_year]);

  // In share mode, divide every series by that row's Total households (preserving nulls for the split
  // target lines so their dotted/solid break still renders). Total households becomes the 100% ceiling.
  const displayData = useMemo(() => {
    if (!isShare) return data;
    return data.map(row => {
      const tot = row['Total households'] || 0;
      const div = (v: number | null) => v == null ? null : (tot > 0 ? v / tot : 0);
      return {
        year: row.year,
        'Total households': tot > 0 ? 1 : 0,
        'Households with safely managed (BAU)': div(row['Households with safely managed (BAU)']),
        'Target (before performance start)': div(row['Target (before performance start)']),
        'Target (safely managed)': div(row['Target (safely managed)']),
        'HH gap (target − BAU)': div(row['HH gap (target − BAU)']),
      };
    });
  }, [data, isShare]);

  const fmtVal = (v: any) => isShare ? ((+(v ?? 0)) * 100).toFixed(1) + '%' : (+(v ?? 0)).toFixed(3) + 'M';
  const fmtLabel = (v: any) => isShare ? ((+(v ?? 0)) * 100).toFixed(0) + '%' : (+(v ?? 0)).toFixed(2) + 'M';

  // Render a value label only at the baseline / endline year points (used by <LabelList> on key series).
  const endpointLabel = (props: any) => {
    const { x, y, index, value } = props;
    const row = displayData[index];
    if (!row || value == null || !endpointYears.has(row.year)) return null;
    return <text x={x} y={y - 7} textAnchor="middle" fontSize={9} fontWeight={700} fill="#0c4a6e">{fmtLabel(value)}</text>;
  };

  const fileBase = `${(scopeLabel ? scopeLabel + '_' : '')}${sector}_bau`;

  // CSV of exactly the series the chart shows (target columns merged), honoring the current unit toggle.
  const exportCsv = () => {
    if (!displayData.length) return;
    const unit = isShare ? ' (share)' : ' (millions)';
    const header = ['Year', 'Total households' + unit, 'Safely managed BAU' + unit, 'Target safely managed' + unit, 'HH gap (target - BAU)' + unit];
    const lines = [header.join(',')];
    displayData.forEach((r: any) => {
      const tgt = r['Target (safely managed)'] ?? r['Target (before performance start)'];
      const cell = (v: any) => v == null ? '' : (typeof v === 'number' ? v : String(v));
      lines.push([r.year, cell(r['Total households']), cell(r['Households with safely managed (BAU)']), cell(tgt), cell(r['HH gap (target − BAU)'])].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileBase + '.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // PNG export via html-to-image: rasterizes the actual chart node (SVG + the HTML legend recharts
  // renders alongside it), so the image matches what's on screen. Captures at 2× on a white bg.
  const exportPng = async () => {
    const node = chartRef.current;
    if (!node) return;
    try {
      const dataUrl = await toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true });
      const a = document.createElement('a');
      a.href = dataUrl; a.download = fileBase + '.png'; a.click();
    } catch (e) {
      setError('PNG export failed: ' + String(e));
    }
  };

  const toolBtn: React.CSSProperties = {
    padding: '4px 10px', fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 6,
    background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 500,
  };

  // ── On-chart annotations (replace the four KPI cards) ─────────────────────────────────────────
  // TargetBubble: a chat-box callout with a tail pointing at the target point, closable via ✕.
  // FinanceFlag: a flag on a pole anchored to the gap line, showing the financing gap for that year.
  // Both leave a small clickable marker when closed so they can be reopened.
  const pct1 = (f: number) => (f * 100).toFixed(1) + '%';

  const TargetBubble = (props: any) => {
    const { cx, cy, point } = props;
    if (cx == null || cy == null) return null;
    const key = `t-${point.year}`;
    if (closedFlags.has(key)) {
      return (
        <g onClick={() => toggleFlag(key, true)} style={{ cursor: 'pointer' }}>
          <title>{`Reopen the Target ${point.year} call-out`}</title>
          <circle cx={cx} cy={cy} r={8} fill="#fff" stroke="#16a34a" strokeWidth={1.5} />
          <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={9}>🎯</text>
        </g>
      );
    }
    const lines = [
      `Target coverage: ${pct1(point.tgtCov)}`,
      `BAU coverage: ${pct1(point.bauCov)}`,
      `Service gap: ${point.svcGap.toFixed(2)} M HH`,
    ];
    const w = 142, lineH = 12, h = 22 + lines.length * lineH + 5;
    const chartW = chartRef.current?.clientWidth || 640;
    const bx = Math.max(4, Math.min(cx - w / 2, chartW - w - 8));    // clamp inside the chart
    const above = cy > h + 26;                                       // flip below if too close to the top
    const by = above ? cy - h - 12 : cy + 12;
    const tx = Math.max(bx + 12, Math.min(cx, bx + w - 12));         // tail base, kept on the bubble edge
    const tail = above
      ? `M ${tx - 6} ${by + h} L ${tx + 6} ${by + h} L ${cx} ${cy - 3} Z`
      : `M ${tx - 6} ${by} L ${tx + 6} ${by} L ${cx} ${cy + 3} Z`;
    return (
      <g>
        <circle cx={cx} cy={cy} r={3.5} fill="#16a34a" stroke="#fff" strokeWidth={1} />
        {/* Solid white box + shadow so the chart lines can never show through or clash with the text */}
        <rect x={bx + 2} y={by + 2.5} width={w} height={h} rx={7} fill="#0f172a" opacity={0.16} />
        <path d={tail} fill="#ffffff" stroke="#16a34a" strokeWidth={1} />
        <rect x={bx} y={by} width={w} height={h} rx={7} fill="#ffffff" stroke="#16a34a" strokeWidth={1.4} />
        <text x={bx + 9} y={by + 15} fontSize={10} fontWeight={700} fill="#15803d">🎯 Target {point.year}</text>
        {lines.map((t, i) => (
          <text key={i} x={bx + 9} y={by + 29 + i * lineH} fontSize={9} fill="#334155">{t}</text>
        ))}
        <g onClick={() => toggleFlag(key, false)} style={{ cursor: 'pointer' }}>
          <title>Close</title>
          <circle cx={bx + w - 11} cy={by + 11} r={7} fill="#fff" stroke="#cbd5e1" />
          <text x={bx + w - 11} y={by + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#64748b">✕</text>
        </g>
      </g>
    );
  };

  const FinanceFlag = (props: any) => {
    const { cx, cy, point } = props;
    if (cx == null || cy == null) return null;
    const key = `f-${point.year}`;
    if (closedFlags.has(key)) {
      return (
        <g onClick={() => toggleFlag(key, true)} style={{ cursor: 'pointer' }}>
          <title>{`Reopen the ${point.year} financing-gap flag`}</title>
          <circle cx={cx} cy={cy} r={8} fill="#fff" stroke="#b91c1c" strokeWidth={1.5} />
          <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={9}>🚩</text>
        </g>
      );
    }
    const valTxt = point.finGap == null ? '—' : Math.round(point.finGap).toLocaleString() + ' M ' + point.cur + '/yr';
    const w = 148, h = 34, poleH = 42;
    const chartW = chartRef.current?.clientWidth || 640;
    const rightSide = cx + w + 10 < chartW;                          // banner right of the pole if it fits
    const bx = rightSide ? cx + 2 : cx - w - 2;
    const bannerTop = cy - poleH;
    return (
      <g>
        <line x1={cx} y1={cy} x2={cx} y2={bannerTop} stroke="#b91c1c" strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={3} fill="#b91c1c" stroke="#fff" strokeWidth={1} />
        {/* Solid white banner + shadow so chart lines never show through */}
        <rect x={bx + 2} y={bannerTop + 2.5} width={w} height={h} rx={5} fill="#0f172a" opacity={0.16} />
        <rect x={bx} y={bannerTop} width={w} height={h} rx={5} fill="#ffffff" stroke="#b91c1c" strokeWidth={1.4} />
        <text x={bx + 8} y={bannerTop + 14} fontSize={9.5} fontWeight={700} fill="#b91c1c">🚩 Financing gap · {point.year}</text>
        <text x={bx + 8} y={bannerTop + 27} fontSize={10} fontWeight={700} fill="#7f1d1d">{valTxt}</text>
        <g onClick={() => toggleFlag(key, false)} style={{ cursor: 'pointer' }}>
          <title>Close</title>
          <circle cx={bx + w - 10} cy={bannerTop + 11} r={7} fill="#fff" stroke="#fca5a5" />
          <text x={bx + w - 10} y={bannerTop + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill="#b91c1c">✕</text>
        </g>
      </g>
    );
  };

  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>
        {scopeLabel ? scopeLabel + ' ' : ''}{sectorLabel} - BAU vs Target (live calculation engine)
      </h3>
      <div style={{ fontSize: 10, color: '#065f46', background: '#d1fae5', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Live engine output, validated against the reference Excel workbook.{datasets.length > 1 ? ' National = Urban + Rural (summed).' : ' Edits on the Data Inputs / Test Harness tabs recompute this chart.'}
      </div>
      {constrained && (
        <div style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 4, padding: '6px 10px', marginBottom: 8, lineHeight: 1.5 }}>
          ⚠ <b>Budget-constrained BAU.</b> The BAU capex budget (~{Math.round(constrained.avail).toLocaleString()} M {constrained.cur}/yr) is below the replacement need (~{Math.round(constrained.repl).toLocaleString()} M {constrained.cur}/yr), so no new safely-managed connections are built and <b>unit cost has no effect</b> on this curve. Raise the {sectorLabel.toLowerCase()} budget above the replacement need to move it.
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: '#b91c1c', marginBottom: 8 }}>{error}</div>}
      {summary && (() => {
        const cur = summary.currency;
        const pct = (f: number) => (f * 100).toFixed(1) + '%';
        const money = (v: number | null) => v == null ? '—' : Math.round(v).toLocaleString() + ' M ' + cur;
        return (
          <div style={{ marginBottom: 12 }}>
            {/* The per-target KPIs (coverage / service gap / financing gap) are now drawn ON the chart:
                a 🎯 chat-box callout at each target point and a 🚩 financing-gap flag on the gap line. */}
            <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 6 }}>
              🎯 Target call-outs and 🚩 financing-gap flags are drawn on the chart — click a flag's ✕ to close it, or click its marker to reopen.
            </div>
            <div style={{ fontSize: 11.5, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '3px solid #2563eb', borderRadius: 6, padding: '8px 12px', lineHeight: 1.55 }}>
              <b>Summary.</b> Under business-as-usual, safely-managed {sectorLabel.toLowerCase()} coverage reaches <b>{pct(summary.bauCov)}</b> by {summary.endline}, against a target of <b>{pct(summary.tgtCov)}</b> — a shortfall of <b>{summary.gapEnd.toFixed(2)} M households</b>. Meeting the target needs <b>{Math.round(summary.cumNeed).toLocaleString()} M {cur}</b> cumulatively ({summary.firstForecast}–{summary.endline}){summary.firstTgt ? <>; the annual financing gap at {summary.firstTgt.year} is <b>{money(summary.firstTgt.finGap)}</b></> : null}.
              {summary.costSM != null && <> Weighted safely-managed cost per household: <b>{Math.round(summary.costSM).toLocaleString()} {cur}</b>.</>}
            </div>
          </div>
        );
      })()}
      {/* Toolbar: Y-axis unit toggle + per-chart exports */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
          {([['count', '# Households'], ['share', 'Share %']] as const).map(([m, l]) => (
            <button key={m} onClick={() => setUnitMode(m)} style={{
              padding: '4px 10px', fontSize: 11, border: 'none', cursor: 'pointer',
              background: unitMode === m ? '#2563eb' : '#fff', color: unitMode === m ? '#fff' : '#475569',
              fontWeight: unitMode === m ? 700 : 500,
            }}>{l}</button>
          ))}
        </div>
        <button onClick={() => setShowDots(d => !d)} style={{ ...toolBtn, fontWeight: 600, background: showDots ? '#eff6ff' : '#fff', color: showDots ? '#2563eb' : '#475569', borderColor: showDots ? '#93c5fd' : '#cbd5e1' }} title="Show or hide the per-year data-point dots">● Data points: {showDots ? 'on' : 'off'}</button>
        {/* Multi-select dropdown: which target years' call-outs + finance flags are drawn (declutters
            the chart when there are many targets). null selection = all visible. */}
        {targetPoints.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setTgtDropOpen(o => !o)} title="Choose which targets' call-outs and financing-gap flags are shown on the chart"
              style={{ ...toolBtn, fontWeight: 600, background: tgtDropOpen ? '#f0fdf4' : '#fff', borderColor: '#86efac', color: '#15803d' }}>
              🎯 Targets shown: {visibleTargets ? visibleTargets.size : targetPoints.length}/{targetPoints.length} ▾
            </button>
            {tgtDropOpen && (<>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setTgtDropOpen(false)} />
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: '8px 10px', minWidth: 180 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Show call-out &amp; 🚩 flag for:</div>
                {targetPoints.map((p) => (
                  <label key={p.year} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '3px 2px', cursor: 'pointer', color: '#334155' }}>
                    <input type="checkbox" checked={isTargetVisible(p.year)}
                      onChange={() => toggleTargetVisible(p.year, targetPoints.map((q: any) => q.year))}
                      style={{ accentColor: '#16a34a' }} />
                    🎯 Target {p.year}
                  </label>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                  <button onClick={() => setVisibleTargets(null)} style={{ ...toolBtn, padding: '2px 10px', fontSize: 10 }}>All</button>
                  <button onClick={() => setVisibleTargets(new Set())} style={{ ...toolBtn, padding: '2px 10px', fontSize: 10 }}>None</button>
                </div>
              </div>
            </>)}
          </div>
        )}
        <button onClick={exportPng} style={toolBtn} title="Download this graph as a PNG image">⤓ PNG</button>
        <button onClick={exportCsv} style={toolBtn} title="Download the graph's values as CSV">⤓ CSV</button>
      </div>
      <div ref={chartRef} style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={displayData} margin={{ top: 14, right: 70, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={isShare ? [0, 1] : undefined}
              tickFormatter={isShare ? (v: number) => Math.round(v * 100) + '%' : undefined}>
              <Label value={isShare ? '% of households' : '# households (millions)'} angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#64748b' }} />
            </YAxis>
            <Tooltip formatter={(value: any) => fmtVal(value)}
              labelFormatter={(label: any) => (per0.baseline_year != null && label === per0.baseline_year) ? `${label} — baseline year` : String(label)}
              contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="Households with safely managed (BAU)" fill="#7dd3fc" stroke="#0ea5e9" fillOpacity={0.55} dot={showDots ? { r: 1.8 } : false} legendType="rect">
              <LabelList content={endpointLabel} />
            </Area>
            <Line type="monotone" dataKey="Total households" stroke="#6b7280" strokeWidth={2.5} dot={showDots ? { r: 1.8 } : false} legendType="plainline" strokeDasharray="8 4" />
            {/* Target trajectory: dotted before the performance-improvement start year, solid from it on */}
            <Line type="monotone" dataKey="Target (before performance start)" stroke="#16a34a" strokeWidth={2} dot={false} legendType="plainline" strokeDasharray="2 3" connectNulls={false} />
            <Line type="monotone" dataKey="Target (safely managed)" stroke="#16a34a" strokeWidth={3} dot={showDots ? { r: 1.8 } : false} legendType="plainline" connectNulls={false}>
              <LabelList content={endpointLabel} />
            </Line>
            {/* HH gap — orange line (target − BAU, safely managed) */}
            <Line type="monotone" dataKey="HH gap (target − BAU)" stroke="#f97316" strokeWidth={2} dot={showDots ? { r: 1.8 } : false} legendType="plainline" strokeDasharray="5 3" connectNulls={false} />
            {/* Horizontal reference line at each target's safely-managed level */}
            {targetLines.map((t, i) => (
              <ReferenceLine key={i} y={isShare ? t.yShare : t.y} stroke="#16a34a" strokeDasharray="2 4" ifOverflow="extendDomain"
                label={{ value: t.label, position: 'right', fontSize: 9, fill: '#15803d' }} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        {/* Flag overlay: a separate svg stacked ABOVE the entire chart (and above recharts' hover
            cursor/tooltip layer), so lines and data points can never cross the call-outs. The svg
            itself ignores pointer events; only the flag groups are clickable, so chart hover/tooltip
            still works everywhere else. */}
        {overlay && (
          <svg width={overlay.width} height={overlay.height}
            style={{ position: 'absolute', left: overlay.left, top: overlay.top, overflow: 'visible', pointerEvents: 'none', zIndex: 20 }}>
            {targetPoints.filter((p) => isTargetVisible(p.year)).map((p) => (
              <g key={`ff-${p.year}`} style={{ pointerEvents: 'auto' }}>
                <FinanceFlag cx={overlay.xm * p.year + overlay.xb} cy={overlay.ym * (isShare ? p.gapYShare : p.gapY) + overlay.yb} point={p} />
              </g>
            ))}
            {targetPoints.filter((p) => isTargetVisible(p.year)).map((p) => (
              <g key={`tb-${p.year}`} style={{ pointerEvents: 'auto' }}>
                <TargetBubble cx={overlay.xm * p.year + overlay.xb} cy={overlay.ym * (isShare ? p.yShare : p.y) + overlay.yb} point={p} />
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
