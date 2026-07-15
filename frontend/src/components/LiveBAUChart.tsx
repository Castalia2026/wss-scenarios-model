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
 * the financing gap are all additive across areas.
 *
 * test2 chart: unit toggle is "# households" vs "% of population"; the financing gap is shown as the
 * VERTICAL Target−BAU difference at the final forecast year (not a floating box); per-year numbers
 * live in the data table below the chart. Animations snap (no tween).
 */

// Round to 3 significant figures. toPrecision avoids the float artefacts that dividing by a tiny
// power of ten produced (e.g. 117 / 1e-5 = 11699999.999999998).
function round3(v: number): number {
  if (!isFinite(v) || v === 0) return 0;
  return Number(v.toPrecision(3));
}
// Format with thousands separators, at most 2 decimals (no scientific notation).
function sig3(v: number): string {
  return round3(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
// Money in the engine is carried in MILLIONS; display large money in BILLIONS (÷1000) to 3 sig figs,
// so a financing gap like 254,000 M reads "254 B" instead of a six-digit number.
function sigB(vMillions: number): string {
  return sig3(vMillions / 1000);
}

export default function LiveBAUChart({ inputs, inputsList, sector, scopeLabel }:
  { inputs?: any; inputsList?: any[]; sector: 'water' | 'sanitation'; scopeLabel?: string }) {
  const datasets = ((inputsList && inputsList.length) ? inputsList : (inputs ? [inputs] : [])).filter(Boolean);
  const [data, setData] = useState<any[]>([]);
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [endAnno, setEndAnno] = useState<{ year: number; bau: number; tgt: number; bauShare: number; tgtShare: number; gapHH: number; finGap: number | null; cur: string } | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Set when the BAU is budget-constrained (frozen): the capex budget is below the replacement need in
  // every forecast year, so no new safely-managed connections are built and unit cost has no effect.
  const [constrained, setConstrained] = useState<{ avail: number; repl: number; cur: string } | null>(null);
  // Reference lines carry BOTH the absolute (count) and share value so they track the Y-axis unit toggle.
  const [targetLines, setTargetLines] = useState<{ y: number; yShare: number; label: string }[]>([]);
  // Y-axis unit: absolute household counts (millions) or share of total POPULATION (%).
  const [unitMode, setUnitMode] = useState<'count' | 'share'>('count');
  // Show/hide the per-year data-point dots on the chart.
  const [showDots, setShowDots] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);
  // ── Overlay geometry: the final-year vertical-gap annotation is drawn in a SEPARATE svg stacked
  // ABOVE the chart, so nothing recharts paints can cross it. Pixel positions are derived from the
  // rendered axis ticks: both axes are linear in (year, value), so two ticks fix each mapping.
  const [overlay, setOverlay] = useState<{ left: number; top: number; width: number; height: number;
    xm: number; xb: number; ym: number; yb: number } | null>(null);
  const [winTick, setWinTick] = useState(0);          // bump to re-measure the overlay geometry
  const [wrapW, setWrapW] = useState(0);              // measured chart width — drives the chart explicitly
  // recharts' ResponsiveContainer does not reliably re-fit when the side Guide panel opens/closes
  // (it changes the chart's width with no window 'resize'), leaving the chart and its financing-gap
  // overlay pinned to a stale width. We instead measure the wrapper ourselves and size the chart
  // explicitly, re-measuring on every width change via a ResizeObserver. useLayoutEffect measures
  // before paint so there is no zero-width first frame.
  useLayoutEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const bump = () => setWinTick(t => t + 1);
    const measure = () => {
      if (chartRef.current) setWrapW(chartRef.current.clientWidth);
      bump();
      // recharts repositions its axis ticks a render cycle or two AFTER the width prop changes, so an
      // immediate read can pick up stale tick coordinates — which leaves the financing-gap overlay
      // mapped to the old scale (its bracket lands off the resized plot). Re-measure a couple of times
      // as recharts settles so the overlay maps years to the FINAL tick positions.
      timers.forEach(clearTimeout); timers.length = 0;
      timers.push(setTimeout(bump, 60), setTimeout(bump, 260));
    };
    measure();
    window.addEventListener('resize', measure);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && chartRef.current) {
      ro = new ResizeObserver(() => measure());
      ro.observe(chartRef.current);
    }
    return () => { timers.forEach(clearTimeout); window.removeEventListener('resize', measure); if (ro) ro.disconnect(); };
  }, []);
  const isShareNow = unitMode === 'share';
  useLayoutEffect(() => {
    const retry = () => { const h = setTimeout(() => setWinTick(t => t + 1), 120); return () => clearTimeout(h); };
    const wrap = chartRef.current;
    const surface = wrap ? ([...wrap.querySelectorAll('svg.recharts-surface')] as SVGSVGElement[])
      .sort((a, b) => b.clientWidth - a.clientWidth)[0] : null;
    if (!wrap || !surface || surface.clientWidth < 100) { setOverlay(null); return data.length ? retry() : undefined; }
    const sR = surface.getBoundingClientRect();
    const wR = wrap.getBoundingClientRect();
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
        // Element-wise sum across areas (Urban + Rural = National). All series are additive.
        const sum = (pick: (res: any, i: number) => number) =>
          years.map((_: number, i: number) => resList.reduce((a, res) => a + (pick(res, i) || 0), 0));
        const total = sum((res, i) => res.total_hh[i]);
        const pop = sum((res, i) => res.population[i]);
        const bau = sum((res, i) => secOf(res).bau_hh[0][i]);
        const tgt = sum((res, i) => secOf(res).target_hh[0][i]);
        const finGapSeries = sum((res, i) => (secOf(res).financing_gap || [])[i] || 0);

        const per = datasets[0]?.period || {};
        const baseYr = per.baseline_year ?? years[0];
        const rows = years.map((y: number, i: number) => {
          const tot = +total[i].toFixed(4);
          // Safely-managed can never exceed total households — clamp both BAU and target for display.
          const bauC = +Math.min(total[i], bau[i]).toFixed(4);
          const tgtC = +Math.min(total[i], tgt[i]).toFixed(4);
          return {
            year: y,
            'Total households': tot,
            'Households with safely managed (BAU)': bauC,
            'Target (safely managed)': tgtC,
          };
        });
        setData(rows);

        const cur0 = datasets[0]?.country_config?.currency || 'LCU';

        // Per-year data table (forecast years only): total HH, safely-managed BAU, target, HH gap, financing gap.
        const tblRows = years.map((y: number, i: number) => {
          if (y <= baseYr) return null;
          const tot = total[i] || 0;
          const b = Math.min(tot, bau[i]);
          const t = Math.min(tot, tgt[i]);
          const gapHH = Math.max(0, t - b);
          return { year: y, total: tot, bau: b, tgt: t, gapHH, finGap: finGapSeries[i] ?? null };
        }).filter(Boolean) as any[];
        setTableRows(tblRows);

        // Final-year vertical-gap annotation: the Target−BAU difference (households) and the annual
        // financing gap (money) at the LAST forecast year.
        const endIdx = years.length - 1;
        const totEnd = total[endIdx] || 0;
        const popEnd = pop[endIdx] || 0;
        const bauEnd = Math.min(totEnd, bau[endIdx]);
        const tgtEnd = Math.min(totEnd, tgt[endIdx]);
        setEndAnno({
          year: years[endIdx],
          bau: +bauEnd.toFixed(4), tgt: +tgtEnd.toFixed(4),
          bauShare: totEnd > 0 ? bauEnd / totEnd : 0, tgtShare: totEnd > 0 ? tgtEnd / totEnd : 0,
          gapHH: Math.max(0, tgtEnd - bauEnd), finGap: finGapSeries[endIdx] ?? null, cur: cur0,
        });

        // test2: target years come from the service table — any forecast column whose 5 rung shares
        // sum to ~100% is a target. Union across areas. Draw a horizontal reference line at each level.
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
        const tgtYears = [...tgtYearSet].sort((a, b) => a - b);
        setTargetLines(tgtYears.map((yr: number) => {
          const ix = years.indexOf(yr);
          const tot = ix >= 0 ? (total[ix] || 0) : 0;
          const t = ix >= 0 ? Math.min(tot, tgt[ix]) : 0;
          return { y: +t.toFixed(4), yShare: tot > 0 ? t / tot : 0, label: `Target (${yr})` };
        }));

        // Budget-constrained (frozen) detection.
        const availS = sum((res, i) => (secOf(res).bau_available || [])[i] || 0);
        const replS = sum((res, i) => (secOf(res).bau_replacement_capex || [])[i] || 0);
        const fcast = years.map((y: number, i: number) => (y > baseYr ? i : -1)).filter((i: number) => i >= 0);
        const frozen = fcast.length > 0 && fcast.every((i: number) => availS[i] <= replS[i] + 1e-9);
        const avgOf = (arr: number[]) => fcast.reduce((a: number, i: number) => a + (arr[i] || 0), 0) / fcast.length;
        setConstrained(frozen ? { avail: avgOf(availS), repl: avgOf(replS), cur: cur0 } : null);

        // ── Headline summary ──
        const cov = (arr: number[]) => totEnd > 0 ? Math.min(totEnd, arr[endIdx]) / totEnd : 0;
        const covPop = (arr: number[]) => popEnd > 0 ? Math.min(totEnd, arr[endIdx]) / totEnd : 0;   // ≈ share of population
        const tin = sum((res, i) => (secOf(res).total_investment_need || [])[i] || 0);
        let cumNeed = 0; years.forEach((y: number, i: number) => { if (y > baseYr) cumNeed += tin[i] || 0; });
        setSummary({
          costSM: datasets.length === 1 ? secOf(base).cost_per_hh : null,
          currency: cur0,
          endline: years[endIdx], baseline: baseYr, firstForecast: baseYr + 1,
          bauCov: cov(bau), tgtCov: cov(tgt), bauPop: covPop(bau), tgtPop: covPop(tgt),
          gapEnd: Math.max(0, tgtEnd - bauEnd), finGapEnd: finGapSeries[endIdx] ?? null,
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

  // In share mode, divide every series by that row's Total households (= share of population, since
  // the model uses one household size). Total households becomes the 100% ceiling.
  const displayData = useMemo(() => {
    if (!isShare) return data;
    return data.map(row => {
      const tot = row['Total households'] || 0;
      const div = (v: number | null) => v == null ? null : (tot > 0 ? v / tot : 0);
      return {
        year: row.year,
        'Total households': tot > 0 ? 1 : 0,
        'Households with safely managed (BAU)': div(row['Households with safely managed (BAU)']),
        'Target (safely managed)': div(row['Target (safely managed)']),
      };
    });
  }, [data, isShare]);

  const fmtVal = (v: any) => isShare ? ((+(v ?? 0)) * 100).toFixed(1) + '%' : sig3(+(v ?? 0)) + 'M';
  const fmtLabel = (v: any) => isShare ? ((+(v ?? 0)) * 100).toFixed(0) + '%' : sig3(+(v ?? 0)) + 'M';

  // Render a value label only at the baseline / endline year points (used by <LabelList> on key series).
  const endpointLabel = (props: any) => {
    const { x, y, index, value } = props;
    const row = displayData[index];
    if (!row || value == null || !endpointYears.has(row.year)) return null;
    return <text x={x} y={y - 7} textAnchor="middle" fontSize={9} fontWeight={700} fill="#0c4a6e">{fmtLabel(value)}</text>;
  };

  const fileBase = `${(scopeLabel ? scopeLabel + '_' : '')}${sector}_bau`;

  // CSV of the data table (forecast years).
  const exportCsv = () => {
    if (!tableRows.length) return;
    const header = ['Year', 'Total households (M)', 'Safely managed BAU (M)', 'Target safely managed (M)', 'Households in gap (M)', 'Financing gap (B ' + (endAnno?.cur || 'LCU') + '/yr)'];
    const lines = [header.join(',')];
    tableRows.forEach((r: any) => {
      lines.push([r.year, round3(r.total), round3(r.bau), round3(r.tgt), round3(r.gapHH), r.finGap == null ? '' : round3(r.finGap / 1000)].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileBase + '.csv'; a.click();
    URL.revokeObjectURL(url);
  };

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

  // ── Final-year financing-gap annotation ──────────────────────────────────────────────────────
  // A vertical bracket at the last forecast year spanning BAU→Target, labelled with the money gap.
  const GapAnnotation = () => {
    if (!overlay || !endAnno) return null;
    const bauV = isShare ? endAnno.bauShare : endAnno.bau;
    const tgtV = isShare ? endAnno.tgtShare : endAnno.tgt;
    const x = overlay.xm * endAnno.year + overlay.xb;
    const yBau = overlay.ym * bauV + overlay.yb;
    const yTgt = overlay.ym * tgtV + overlay.yb;
    if (!isFinite(x) || !isFinite(yBau) || !isFinite(yTgt)) return null;
    const yTop = Math.min(yBau, yTgt), yBot = Math.max(yBau, yTgt);
    // Draw the bracket just to the LEFT of the final-year gridline so it doesn't fall off the plot.
    const bx = Math.min(x, overlay.width - 8);
    const tick = 6;
    const midY = (yTop + yBot) / 2;
    const money = endAnno.finGap == null ? null : `${sigB(endAnno.finGap)} B ${endAnno.cur}/yr`;
    const gapHHtxt = `${sig3(endAnno.gapHH)} M HH`;
    // Label box to the left of the bracket.
    const boxW = 132, boxH = money ? 44 : 30;
    const boxX = Math.max(4, bx - boxW - 10);
    const boxY = Math.max(2, Math.min(midY - boxH / 2, overlay.height - boxH - 2));
    return (
      <g>
        {/* endpoints on the two lines */}
        <circle cx={x} cy={yBau} r={3} fill="#0ea5e9" stroke="#fff" strokeWidth={1} />
        <circle cx={x} cy={yTgt} r={3} fill="#16a34a" stroke="#fff" strokeWidth={1} />
        {/* vertical double-arrow bracket */}
        <line x1={bx} y1={yTop} x2={bx} y2={yBot} stroke="#b91c1c" strokeWidth={2} />
        <line x1={bx - tick} y1={yTop} x2={bx + tick} y2={yTop} stroke="#b91c1c" strokeWidth={2} />
        <line x1={bx - tick} y1={yBot} x2={bx + tick} y2={yBot} stroke="#b91c1c" strokeWidth={2} />
        <path d={`M ${bx} ${yTop} l -4 6 l 8 0 z`} fill="#b91c1c" />
        <path d={`M ${bx} ${yBot} l -4 -6 l 8 0 z`} fill="#b91c1c" />
        {/* leader from bracket to label box */}
        <line x1={boxX + boxW} y1={midY} x2={bx} y2={midY} stroke="#b91c1c" strokeWidth={1} strokeDasharray="2 2" />
        {/* label box */}
        <rect x={boxX + 2} y={boxY + 2.5} width={boxW} height={boxH} rx={5} fill="#0f172a" opacity={0.16} />
        <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={5} fill="#fff" stroke="#b91c1c" strokeWidth={1.4} />
        <text x={boxX + 8} y={boxY + 14} fontSize={9.5} fontWeight={700} fill="#b91c1c">Financing gap · {endAnno.year}</text>
        {money
          ? <><text x={boxX + 8} y={boxY + 27} fontSize={10} fontWeight={700} fill="#7f1d1d">{money}</text>
              <text x={boxX + 8} y={boxY + 39} fontSize={9} fill="#334155">{gapHHtxt} shortfall</text></>
          : <text x={boxX + 8} y={boxY + 25} fontSize={10} fontWeight={700} fill="#7f1d1d">{gapHHtxt} shortfall</text>}
      </g>
    );
  };

  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 6, fontWeight: 600, color: '#1e3a5f' }}>
        {scopeLabel ? scopeLabel + ' ' : ''}{sectorLabel} - BAU vs Target (live calculation engine)
      </h3>
      <div style={{ fontSize: 10, color: '#065f46', background: '#d1fae5', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
        Live engine output.{datasets.length > 1 ? ' National = Urban + Rural (summed).' : ' Edits on the Data Inputs tab recompute this chart.'}
      </div>
      {constrained && (
        <div style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 4, padding: '6px 10px', marginBottom: 8, lineHeight: 1.5 }}>
          ⚠ <b>Budget-constrained BAU.</b> The BAU capex budget (~{sigB(constrained.avail)} B {constrained.cur}/yr) is below the replacement need (~{sigB(constrained.repl)} B {constrained.cur}/yr), so no new safely-managed connections are built and <b>unit cost has no effect</b> on this curve. Raise the {sectorLabel.toLowerCase()} budget above the replacement need to move it.
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: '#b91c1c', marginBottom: 8 }}>{error}</div>}
      {summary && (() => {
        const cur = summary.currency;
        const pct = (f: number) => (f * 100).toFixed(1) + '%';
        const money = (v: number | null) => v == null ? '—' : sigB(v) + ' B ' + cur;
        return (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '3px solid #2563eb', borderRadius: 6, padding: '8px 12px', lineHeight: 1.55 }}>
              <b>Summary.</b> Under business-as-usual, safely-managed {sectorLabel.toLowerCase()} reaches <b>{pct(summary.bauPop)}</b> of the population by {summary.endline}, against a target of <b>{pct(summary.tgtPop)}</b> — a shortfall of <b>{sig3(summary.gapEnd)} M households</b>. The annual financing gap at {summary.endline} is <b>{money(summary.finGapEnd)}/yr</b>; meeting the target needs <b>{sigB(summary.cumNeed)} B {cur}</b> cumulatively ({summary.firstForecast}–{summary.endline}).
              {summary.costSM != null && <> Weighted safely-managed cost per household: <b>{sig3(summary.costSM)} {cur}</b>.</>}
            </div>
          </div>
        );
      })()}
      {/* Toolbar: Y-axis unit toggle + per-chart exports */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
          {([['count', '# Households'], ['share', '% of population']] as const).map(([m, l]) => (
            <button key={m} onClick={() => setUnitMode(m)} style={{
              padding: '4px 10px', fontSize: 11, border: 'none', cursor: 'pointer',
              background: unitMode === m ? '#2563eb' : '#fff', color: unitMode === m ? '#fff' : '#475569',
              fontWeight: unitMode === m ? 700 : 500,
            }}>{l}</button>
          ))}
        </div>
        <button onClick={() => setShowDots(d => !d)} style={{ ...toolBtn, fontWeight: 600, background: showDots ? '#eff6ff' : '#fff', color: showDots ? '#2563eb' : '#475569', borderColor: showDots ? '#93c5fd' : '#cbd5e1' }} title="Show or hide the per-year data-point dots">● Data points: {showDots ? 'on' : 'off'}</button>
        <button onClick={exportPng} style={toolBtn} title="Download this graph as a PNG image">⤓ PNG</button>
        <button onClick={exportCsv} style={toolBtn} title="Download the data table as CSV">⤓ CSV</button>
      </div>
      <div ref={chartRef} style={{ position: 'relative' }}>
        <ComposedChart width={Math.max(1, wrapW)} height={380} data={displayData} margin={{ top: 14, right: 70, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={isShare ? [0, 1] : undefined}
              tickFormatter={isShare ? (v: number) => Math.round(v * 100) + '%' : (v: number) => sig3(v)}>
              <Label value={isShare ? '% of population' : '# households (millions)'} angle={-90} position="insideLeft" style={{ fontSize: 10, fill: '#64748b' }} />
            </YAxis>
            <Tooltip formatter={(value: any) => fmtVal(value)}
              labelFormatter={(label: any) => (per0.baseline_year != null && label === per0.baseline_year) ? `${label} — last historical year` : String(label)}
              contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="Households with safely managed (BAU)" fill="#7dd3fc" stroke="#0ea5e9" fillOpacity={0.55} dot={showDots ? { r: 1.8 } : false} legendType="rect" isAnimationActive={false}>
              <LabelList content={endpointLabel} />
            </Area>
            <Line type="monotone" dataKey="Total households" stroke="#6b7280" strokeWidth={2.5} dot={showDots ? { r: 1.8 } : false} legendType="plainline" strokeDasharray="8 4" isAnimationActive={false} />
            {/* Target trajectory: one solid line across all years */}
            <Line type="monotone" dataKey="Target (safely managed)" stroke="#16a34a" strokeWidth={3} dot={showDots ? { r: 1.8 } : false} legendType="plainline" connectNulls={false} isAnimationActive={false}>
              <LabelList content={endpointLabel} />
            </Line>
            {/* Horizontal reference line at each target's safely-managed level */}
            {targetLines.map((t, i) => (
              <ReferenceLine key={i} y={isShare ? t.yShare : t.y} stroke="#16a34a" strokeDasharray="2 4" ifOverflow="extendDomain"
                label={{ value: t.label, position: 'right', fontSize: 9, fill: '#15803d' }} />
            ))}
          </ComposedChart>
        {/* Final-year financing-gap annotation, drawn above the chart. */}
        {overlay && endAnno && (
          <svg width={overlay.width} height={overlay.height}
            style={{ position: 'absolute', left: overlay.left, top: overlay.top, overflow: 'visible', pointerEvents: 'none', zIndex: 20 }}>
            <GapAnnotation />
          </svg>
        )}
      </div>

      {/* ── Per-year data table (forecast years) ─────────────────────────────────────────────── */}
      {tableRows.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>Forecast data (per year)</div>
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, width: '100%' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', color: '#334155' }}>
                  {['Year', 'Total households (M)', 'Safely managed — BAU (M)', 'Target (M)', 'Households in gap (M)', `Financing gap (B ${endAnno?.cur || 'LCU'}/yr)`].map((h, i) => (
                    <th key={i} style={{ padding: '5px 10px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700, whiteSpace: 'nowrap', position: i === 0 ? 'sticky' : undefined, left: i === 0 ? 0 : undefined, background: '#f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r: any, ri: number) => (
                  <tr key={r.year} style={{ background: ri % 2 ? '#fafbfc' : '#fff' }}>
                    <td style={{ padding: '4px 10px', fontWeight: 600, color: '#1e3a5f', position: 'sticky', left: 0, background: ri % 2 ? '#fafbfc' : '#fff' }}>{r.year}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right' }}>{sig3(r.total)}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', color: '#0369a1' }}>{sig3(r.bau)}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', color: '#15803d' }}>{sig3(r.tgt)}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', color: '#b45309', fontWeight: 600 }}>{sig3(r.gapHH)}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', color: '#b91c1c' }}>{r.finGap == null ? '—' : sigB(r.finGap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
