import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  // Y-axis unit: absolute household counts (millions) or share of total households (%).
  const [unitMode, setUnitMode] = useState<'count' | 'share'>('count');
  // Show/hide the per-year data-point dots on the chart.
  const [showDots, setShowDots] = useState(true);
  // Which target the gap KPI cards report (Target 1 vs Target 2).
  const [gapTarget, setGapTarget] = useState<'t1' | 't2'>('t1');
  const chartRef = useRef<HTMLDivElement>(null);

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

        // Horizontal reference line at each target's safely-managed level (Target 1 & Target 2 years)
        const t1y = per.target1_year || 2030, t2y = per.target2_year || 2040;
        const refs: { y: number; yShare: number; label: string }[] = [];
        ([[t1y, 'Target 1'], [t2y, 'Target 2']] as [number, string][]).forEach(([yr, lbl]) => {
          const ix = years.indexOf(yr);
          if (ix >= 0) {
            const yv = +Math.min(total[ix], tgt[ix]).toFixed(4);
            refs.push({ y: yv, yShare: total[ix] > 0 ? yv / total[ix] : 0, label: `${lbl} (${yr})` });
          }
        });
        setTargetLines(refs);

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

        // ── Headline KPIs (all additive across areas; same clamping as the chart) ──
        const endIdx = years.length - 1;                       // last year = forecast end
        const totEnd = total[endIdx] || 0;
        const cov = (arr: number[]) => totEnd > 0 ? Math.min(totEnd, arr[endIdx]) / totEnd : 0;
        const gapAt = (yr: number) => { const ix = years.indexOf(yr); return ix >= 0 ? resList.reduce((a, res) => a + (secOf(res).financing_gap[ix] || 0), 0) : null; };
        // Per-target coverage / service-gap (used by the Target 1 / Target 2 KPI tabs).
        const covAt = (arr: number[], yr: number) => { const ix = years.indexOf(yr); return ix >= 0 && total[ix] > 0 ? Math.min(total[ix], arr[ix]) / total[ix] : 0; };
        const svcGapAt = (yr: number) => { const ix = years.indexOf(yr); return ix >= 0 ? Math.max(0, Math.min(total[ix], tgt[ix]) - Math.min(total[ix], bau[ix])) : 0; };
        const perTarget = (yr: number) => ({ year: yr, bauCov: covAt(bau, yr), tgtCov: covAt(tgt, yr), svcGap: svcGapAt(yr), finGap: gapAt(yr) });
        const tin = sum((res, i) => (secOf(res).total_investment_need || [])[i] || 0);
        const baseline = per.baseline_year ?? years[0];
        let cumNeed = 0; years.forEach((y: number, i: number) => { if (y > baseline) cumNeed += tin[i] || 0; });
        setSummary({
          costSM: datasets.length === 1 ? secOf(base).cost_per_hh : null,
          currency: datasets[0]?.country_config?.currency || 'LCU',
          endline: years[endIdx], baseline, firstForecast: baseline + 1,
          bauCov: cov(bau), tgtCov: cov(tgt),
          gapEnd: Math.max(0, Math.min(totEnd, tgt[endIdx]) - Math.min(totEnd, bau[endIdx])),
          t1: t1y, gapT1: gapAt(t1y), t2: t2y, gapT2: gapAt(t2y),
          byTarget: { t1: perTarget(t1y), t2: perTarget(t2y) },
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
        // Cards report the currently-selected target (Target 1 / Target 2 tabs below).
        const g = summary.byTarget?.[gapTarget] || { year: summary.endline, bauCov: summary.bauCov, tgtCov: summary.tgtCov, svcGap: summary.gapEnd, finGap: summary.gapT1 };
        const tLabel = gapTarget === 't1' ? 'target 1' : 'target 2';
        const cards = [
          { label: `BAU coverage · ${g.year}`, value: pct(g.bauCov), sub: 'safely managed, business-as-usual', color: '#0ea5e9' },
          { label: `Service coverage target · ${g.year}`, value: pct(g.tgtCov), sub: 'policy target', color: '#16a34a' },
          { label: `Service gap · ${g.year}`, value: g.svcGap.toFixed(2) + ' M HH', sub: 'households short of target', color: '#f97316' },
          { label: `Financing gap · ${g.year}`, value: money(g.finGap), sub: `annual, at ${tLabel}`, color: '#b91c1c' },
        ];
        return (
          <div style={{ marginBottom: 12 }}>
            {/* Target 1 / Target 2 tabs — switch which target the KPI cards report */}
            <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
              {([['t1', `Target 1 · ${summary.t1}`], ['t2', `Target 2 · ${summary.t2}`]] as const).map(([m, l]) => (
                <button key={m} onClick={() => setGapTarget(m)} style={{
                  padding: '3px 12px', fontSize: 11, border: 'none', cursor: 'pointer',
                  background: gapTarget === m ? '#2563eb' : '#fff', color: gapTarget === m ? '#fff' : '#475569',
                  fontWeight: gapTarget === m ? 700 : 500,
                }}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              {cards.map((c, i) => (
                <div key={i} style={{ flex: '1 1 130px', minWidth: 120, background: '#fff', border: '1px solid #e2e8f0', borderTop: `3px solid ${c.color}`, borderRadius: 8, padding: '8px 10px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 3 }}>{c.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', lineHeight: 1.1 }}>{c.value}</div>
                  <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>{c.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: '3px solid #2563eb', borderRadius: 6, padding: '8px 12px', lineHeight: 1.55 }}>
              <b>Summary.</b> Under business-as-usual, safely-managed {sectorLabel.toLowerCase()} coverage reaches <b>{pct(summary.bauCov)}</b> by {summary.endline}, against a target of <b>{pct(summary.tgtCov)}</b> — a shortfall of <b>{summary.gapEnd.toFixed(2)} M households</b>. Meeting the target needs <b>{Math.round(summary.cumNeed).toLocaleString()} M {cur}</b> cumulatively ({summary.firstForecast}–{summary.endline}); the annual financing gap at {summary.t1} is <b>{money(summary.gapT1)}</b>.
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
        <button onClick={exportPng} style={toolBtn} title="Download this graph as a PNG image">⤓ PNG</button>
        <button onClick={exportCsv} style={toolBtn} title="Download the graph's values as CSV">⤓ CSV</button>
      </div>
      <div ref={chartRef}>
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
      </div>
    </div>
  );
}
