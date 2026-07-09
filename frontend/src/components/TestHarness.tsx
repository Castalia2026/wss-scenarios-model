import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Test Harness tab — the engine-validation harness embedded in the demo.
 *
 * IMPORTANT: this tab has NO local copy of the model inputs. Every field below reads from and
 * writes to the SAME shared `inputs` object as the Data Inputs page (the year-by-year data-entry
 * table, targets, unit costs, budget). Edit a value here and it changes on the Data Inputs tab,
 * and vice versa — the harness inputs ARE the actual inputs.
 */
interface Props { inputs: any; onChange: (i: any) => void; }

const taStyle: React.CSSProperties = {
  width: '100%', minHeight: 40, padding: '5px 7px', border: '1px solid #F0D070', background: '#FFF9E6',
  borderRadius: 4, fontSize: 11, fontFamily: 'Consolas, monospace', color: '#3A4452', boxSizing: 'border-box', resize: 'vertical',
};
const inStyle: React.CSSProperties = {
  width: '100%', padding: '5px 7px', border: '1px solid #F0D070', background: '#FFF9E6',
  borderRadius: 4, fontSize: 12, color: '#3A4452', boxSizing: 'border-box',
};
const labStyle: React.CSSProperties = { fontSize: 11, color: '#3A4452', fontWeight: 600, display: 'block', margin: '6px 0 2px' };
const h3Style: React.CSSProperties = { fontSize: 13, color: '#0073A8', margin: '14px 0 4px', borderBottom: '1px solid #dbeafe', paddingBottom: 3 };

/** Space-separated numeric array editor bound to shared state (syncs from props when not focused). */
function ArrField({ label, value, onCommit, note }: { label: string; value: number[]; onCommit: (a: number[]) => void; note?: string }) {
  const [text, setText] = useState((value || []).join(' '));
  const focused = useRef(false);
  const key = JSON.stringify(value || []);
  useEffect(() => { if (!focused.current) setText((value || []).join(' ')); }, [key]);   // eslint-disable-line
  return (
    <div>
      <label style={labStyle}>{label}</label>
      <textarea style={taStyle} value={text}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setText((value || []).join(' ')); }}
        onChange={e => {
          setText(e.target.value);
          const a = e.target.value.trim().split(/[\s,]+/).filter(x => x !== '').map(Number).filter(x => !isNaN(x));
          onCommit(a);
        }} />
      {note && <div style={{ fontSize: 9.5, color: '#64748b' }}>{note}</div>}
    </div>
  );
}

function NumField({ label, value, onCommit, pct, width }: { label: string; value: number; onCommit: (v: number) => void; pct?: boolean; width?: number }) {
  const shown = pct ? Math.round((value || 0) * 1e6) / 1e4 : (value ?? 0);
  return (
    <div style={{ width: width || 150 }}>
      <label style={labStyle}>{label}{pct ? ' (%)' : ''}</label>
      <input type="number" style={inStyle} value={shown}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onCommit(pct ? v / 100 : v); }} />
    </div>
  );
}

const M = (x: number) => (x ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
const HH = (x: number) => (x ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function TestHarness({ inputs, onChange }: Props) {
  const [sector, setSector] = useState<'water' | 'sanitation'>('water');
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const per = inputs?.period || {};
  const macro = inputs?.macro || {};
  const pop = inputs?.population || {};
  const tech = inputs?.technical || {};
  const bau = inputs?.bau || {};
  const budgetMode: 'pct_gdp' | 'direct' = macro.budget_input_mode === 'direct' ? 'direct' : 'pct_gdp';
  const bi = (per.baseline_year || 2025) - (per.model_start_year || 2011);
  const nYears = (per.forecast_end_year || 2040) - (per.model_start_year || 2011) + 1;

  const setIn = useCallback((section: string, field: string, value: any) => {
    onChange({ ...inputs, [section]: { ...(inputs?.[section] || {}), [field]: value } });
  }, [inputs, onChange]);

  // Service-level start/baseline editor: writes the SAME serv{i}_ts arrays the Data Inputs
  // year-by-year table shows (linear interpolation start→baseline over the historical years).
  const svcKey = (i: number) => sector === 'water' ? `serv${i}_ts` : `sserv${i}_ts`;
  const svcSection = sector === 'water' ? 'water_service' : 'sanitation_service';
  const svcAt = (i: number, idx: number) => ((inputs?.[svcSection]?.[svcKey(i)] || [])[idx]) || 0;
  const setSvc = (i: number, which: 'start' | 'baseline', v: number) => {
    const arr = [...(inputs?.[svcSection]?.[svcKey(i)] || Array(nYears).fill(0))];
    while (arr.length < nYears) arr.push(arr[arr.length - 1] || 0);
    const start = which === 'start' ? v : (arr[0] || 0);
    const base = which === 'baseline' ? v : (arr[bi] || 0);
    for (let t = 0; t < nYears; t++) arr[t] = t <= bi ? start + (base - start) * (bi ? t / bi : 1) : base;
    setIn(svcSection, svcKey(i), arr);
  };

  const tgtSection = sector === 'water' ? 'water_targets' : 'sanitation_targets';
  const tgtKey = (t: 1 | 2, i: number) => sector === 'water' ? `target${t}_serv${i}` : `target${t}_sserv${i}`;
  const tgtAt = (t: 1 | 2, i: number) => (inputs?.[tgtSection]?.[tgtKey(t, i)]) || 0;

  // Technology-mix calculators — Σ(share × cost) per rung, WRITTEN THROUGH to the weighted
  // SM/Basic cost fields the engine consumes (water_costs.network_cost_per_hh_serv1/2,
  // sanitation_costs.sewer_cost_per_hh_sserv1/2), which are the same fields as Data Inputs.
  const costSection = sector === 'water' ? 'water_costs' : 'sanitation_costs';
  const costField = (rung: 'sm' | 'basic') => sector === 'water'
    ? (rung === 'sm' ? 'network_cost_per_hh_serv1' : 'network_cost_per_hh_serv2')
    : (rung === 'sm' ? 'sewer_cost_per_hh_sserv1' : 'sewer_cost_per_hh_sserv2');
  const mixOf = (rung: 'sm' | 'basic'): any[] => inputs?.[costSection]?.[rung + '_tech_mix'] || [];
  const mixWeighted = (rung: 'sm' | 'basic') => mixOf(rung).reduce((a, t) => a + (+t.share || 0) * (+t.cost || 0), 0);
  const mixShareSum = (rung: 'sm' | 'basic') => mixOf(rung).reduce((a, t) => a + (+t.share || 0), 0);
  const setMix = (rung: 'sm' | 'basic', arr: any[]) => {
    const weighted = arr.reduce((a, t) => a + (+t.share || 0) * (+t.cost || 0), 0);
    onChange({ ...inputs, [costSection]: { ...(inputs?.[costSection] || {}), [rung + '_tech_mix']: arr, [costField(rung)]: weighted } });
  };
  const renderMix = (rung: 'sm' | 'basic', title: string) => {
    const m = mixOf(rung);
    if (!m.length) return null;
    const engineCost = inputs?.[costSection]?.[costField(rung)] ?? 0;
    const w = mixWeighted(rung);
    const stale = Math.abs(w - engineCost) > 0.51;
    const shareOk = Math.abs(mixShareSum(rung) - 1) < 0.001;
    return (
      <div style={{ width: '100%', marginTop: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0073A8' }}>{title} — technology mix (weighted = Σ share × cost)</div>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead><tr style={{ color: '#64748b' }}><th style={{ textAlign: 'left' }}>technology</th><th>share %</th><th>cost/HH</th><th></th></tr></thead>
          <tbody>
            {m.map((t: any, i: number) => (
              <tr key={i}>
                <td><input type="text" style={{ ...inStyle, padding: '3px 5px' }} value={t.name || ''}
                  onChange={e => setMix(rung, m.map((x: any, j: number) => j === i ? { ...x, name: e.target.value } : x))} /></td>
                <td><input type="number" style={{ ...inStyle, width: 64, padding: '3px 5px' }} value={Math.round((+t.share || 0) * 1e6) / 1e4}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setMix(rung, m.map((x: any, j: number) => j === i ? { ...x, share: v / 100 } : x)); }} /></td>
                <td><input type="number" style={{ ...inStyle, width: 92, padding: '3px 5px' }} value={+t.cost || 0}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setMix(rung, m.map((x: any, j: number) => j === i ? { ...x, cost: v } : x)); }} /></td>
                <td><button type="button" onClick={() => { if (m.length > 1) setMix(rung, m.filter((_: any, j: number) => j !== i)); }}
                  style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 3, padding: '2px 7px', cursor: 'pointer', fontSize: 10 }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={() => setMix(rung, [...m, { name: 'New technology', share: 0, cost: 0 }])}
          style={{ margin: '3px 0', padding: '3px 9px', fontSize: 11, border: '1px dashed #0073A8', background: '#fff', color: '#0073A8', borderRadius: 5, cursor: 'pointer' }}>+ Add technology</button>
        <div style={{ fontSize: 10.5, color: shareOk ? '#0073A8' : '#b91c1c' }}>
          Σ share {(mixShareSum(rung) * 100).toFixed(2)}% · weighted cost/HH <b>{Math.round(w).toLocaleString()}</b>
          {stale && <span style={{ color: '#b45309' }}> ⚠ engine field = {Math.round(engineCost).toLocaleString()} (edited directly) — change any mix cell to re-apply</span>}
        </div>
      </div>
    );
  };

  // GDP hard-forecast check: the model expects 5 hard forecast years (baseline+1 … baseline+5)
  const histN = (per.baseline_year || 2025) - (per.model_start_year || 2011) + 1;
  const gdpFcHard = Math.max(0, (macro.gdp_nominal_usd || []).length - histN);

  const run = useCallback(() => {
    setRunning(true); setError(null);
    fetch('/api/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs) })
      .then(r => { if (!r.ok) return r.text().then(t => { throw new Error(r.status + ' ' + t.slice(0, 300)); }); return r.json(); })
      .then(res => { setResult(res); setRunning(false); })
      .catch(e => { setError(String(e)); setRunning(false); });
  }, [inputs]);

  useEffect(() => { if (inputs) run(); }, []);   // eslint-disable-line — auto-run once on mount

  // validation: shares must total 100%
  const rungNames = ['Safely managed', 'Basic', 'Limited', 'Unimproved', 'No service'];
  const checks: { name: string; sum: number }[] = [
    { name: 'Service — start', sum: [1, 2, 3, 4, 5].reduce((a, i) => a + svcAt(i, 0), 0) },
    { name: 'Service — baseline', sum: [1, 2, 3, 4, 5].reduce((a, i) => a + svcAt(i, bi), 0) },
    { name: 'Target 1', sum: [1, 2, 3, 4, 5].reduce((a, i) => a + tgtAt(1, i), 0) },
    { name: 'Target 2', sum: [1, 2, 3, 4, 5].reduce((a, i) => a + tgtAt(2, i), 0) },
    ...(mixOf('sm').length ? [{ name: 'Safely-managed tech-mix shares', sum: mixShareSum('sm') }] : []),
    ...(mixOf('basic').length ? [{ name: 'Basic tech-mix shares', sum: mixShareSum('basic') }] : []),
  ];

  const sec = result ? (sector === 'water' ? result.water_supply : result.sanitation) : null;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', fontSize: 12 }}>
      {/* ── input column (shared state — same data as the Data Inputs tab) ── */}
      <div style={{ flex: '0 0 430px', overflowY: 'auto', padding: '14px 18px', background: '#fafbfc', borderRight: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 11.5, color: '#0073A8', background: '#EBF6FB', border: '1px solid #b6e0f0', borderRadius: 6, padding: '7px 10px', marginBottom: 10, lineHeight: 1.45 }}>
          🔗 <b>Linked inputs</b> — every field below is the same underlying data as the <b>Data Inputs</b> tab.
          Edits here appear there instantly (and vice versa); this harness runs the validated calculation engine on those actual inputs.
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {(['water', 'sanitation'] as const).map(s => (
            <button key={s} onClick={() => { setSector(s); }} style={{
              flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: sector === s ? '#2563eb' : '#e5e7eb', color: sector === s ? '#fff' : '#374151',
              fontWeight: 600, fontSize: 12.5,
            }}>{s === 'water' ? 'Water Supply' : 'Sanitation'}</button>
          ))}
        </div>

        <h3 style={h3Style}>Time scales</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <NumField width={95} label="Model start" value={per.model_start_year} onCommit={v => setIn('period', 'model_start_year', v)} />
          <NumField width={95} label="Baseline" value={per.baseline_year} onCommit={v => setIn('period', 'baseline_year', v)} />
          <NumField width={95} label="Forecast end" value={per.forecast_end_year} onCommit={v => setIn('period', 'forecast_end_year', v)} />
          <NumField width={95} label="As-is start" value={per.as_is_forecast_start} onCommit={v => setIn('period', 'as_is_forecast_start', v)} />
          <NumField width={95} label="As-is length" value={per.as_is_forecast_length} onCommit={v => setIn('period', 'as_is_forecast_length', v)} />
          <NumField width={95} label="Target 1 yr" value={per.target1_year} onCommit={v => setIn('period', 'target1_year', v)} />
          <NumField width={95} label="Target 2 yr" value={per.target2_year} onCommit={v => setIn('period', 'target2_year', v)} />
        </div>

        <h3 style={h3Style}>Macro ({per.model_start_year}→{per.forecast_end_year})</h3>
        <ArrField label="GDP nominal (USD bn) — hard values (historical + 5 forecast yrs)" value={macro.gdp_nominal_usd || []}
          onCommit={a => setIn('macro', 'gdp_nominal_usd', a)}
          note="Enter historical + 5 hard forecast years; later years are projected at the ongoing real growth below." />
        <div style={{ display: 'flex', gap: 8 }}>
          <NumField width={200} label="GDP ongoing real growth" pct value={macro.gdp_growth_forecast ?? 0.05} onCommit={v => setIn('macro', 'gdp_growth_forecast', v)} />
        </div>
        <ArrField label={`Inflation ${inputs?.country_config?.country || 'local'} (fraction/yr) — hard values`} value={macro.inflation_nepal || []}
          onCommit={a => setIn('macro', 'inflation_nepal', a)} />
        <ArrField label="Inflation US (fraction/yr) — hard values" value={macro.inflation_us || []}
          onCommit={a => setIn('macro', 'inflation_us', a)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <NumField width={180} label="Inflation local ongoing" pct value={macro.inflation_local_ongoing ?? 0.05} onCommit={v => setIn('macro', 'inflation_local_ongoing', v)} />
          <NumField width={180} label="Inflation US ongoing" pct value={macro.inflation_us_ongoing ?? 0.022} onCommit={v => setIn('macro', 'inflation_us_ongoing', v)} />
        </div>
        <div style={{ fontSize: 9.5, color: '#64748b' }}>Ongoing rates fill every forecast year beyond the hard values above.</div>
        <ArrField label="Exchange rate (local per USD) — actuals through baseline−1" value={macro.exchange_rate || []}
          onCommit={a => setIn('macro', 'exchange_rate', a)}
          note="Baseline year onward is derived: FX[t] = FX[t−1] × (1+local infl)/(1+US infl)." />

        <h3 style={h3Style}>WSS budget</h3>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {([['pct_gdp', 'As % of GDP'], ['direct', 'Direct (spent)']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setIn('macro', 'budget_input_mode', k)} style={{
              flex: 1, padding: '5px 0', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11.5,
              background: budgetMode === k ? '#2563eb' : '#e5e7eb', color: budgetMode === k ? '#fff' : '#374151', fontWeight: 600,
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <NumField width={130} label="Capex % of budget" pct value={macro.capex_pct_budget ?? 0.21} onCommit={v => setIn('macro', 'capex_pct_budget', v)} />
          {budgetMode === 'pct_gdp' ? (<>
            <NumField width={130} label={sector === 'water' ? 'Water budget %GDP' : 'Sanit. budget %GDP'} pct
              value={(sector === 'water' ? macro.ws_budget_pct_gdp : macro.san_budget_pct_gdp) ?? 0}
              onCommit={v => setIn('macro', sector === 'water' ? 'ws_budget_pct_gdp' : 'san_budget_pct_gdp', v)} />
          </>) : (
            <NumField width={190} label={`${sector === 'water' ? 'Water' : 'Sanit.'} budget growth — ongoing`} pct
              value={(sector === 'water' ? bau?.ws_budget_ongoing : bau?.san_budget_ongoing) ?? 0.05}
              onCommit={v => onChange({ ...inputs, bau: { ...(inputs?.bau || {}), [sector === 'water' ? 'ws_budget_ongoing' : 'san_budget_ongoing']: v } })} />
          )}
        </div>
        {budgetMode === 'direct' && (
          <ArrField label={`${sector === 'water' ? 'Water' : 'Sanitation'} actual expenditure — full budget, real terms (historical + 5 hard forecast years)`}
            value={(sector === 'water' ? bau?.ws_expend_ts : bau?.san_expend_ts) || []}
            onCommit={a => onChange({ ...inputs, bau: { ...(inputs?.bau || {}), [sector === 'water' ? 'ws_expend_ts' : 'san_expend_ts']: a } })}
            note="This spent series DRIVES the model (same role as GDP × %GDP). Forecast years beyond the hard values grow at the ongoing rate above." />
        )}

        <h3 style={h3Style}>Population (actuals through baseline−1)</h3>
        <ArrField label="Total households (millions)" value={pop.hh_ts || []} onCommit={a => setIn('population', 'hh_ts', a)}
          note="Baseline year onward projected at mean historical household growth." />
        <ArrField label="Total population (millions)" value={pop.pop_ts || []} onCommit={a => setIn('population', 'pop_ts', a)} />

        <h3 style={h3Style}>{sector === 'water' ? 'Water' : 'Sanitation'} — service levels (% of HHs)</h3>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead><tr style={{ color: '#64748b' }}><th style={{ textAlign: 'left' }}>rung</th><th>start {per.model_start_year}</th><th>baseline {per.baseline_year}</th></tr></thead>
          <tbody>
            {rungNames.map((nm, j) => {
              const i = j + 1;
              return (
                <tr key={i}>
                  <td style={{ padding: '2px 4px' }}>{nm}</td>
                  <td><input type="number" style={{ ...inStyle, width: 90, padding: '3px 5px' }} value={Math.round(svcAt(i, 0) * 1e6) / 1e4}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setSvc(i, 'start', v / 100); }} /></td>
                  <td><input type="number" style={{ ...inStyle, width: 90, padding: '3px 5px' }} value={Math.round(svcAt(i, bi) * 1e6) / 1e4}
                    onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setSvc(i, 'baseline', v / 100); }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 style={h3Style}>{sector === 'water' ? 'Water' : 'Sanitation'} — targets (T1 {per.target1_year} / T2 {per.target2_year})</h3>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead><tr style={{ color: '#64748b' }}><th style={{ textAlign: 'left' }}>rung</th><th>T1 %</th><th>T2 %</th></tr></thead>
          <tbody>
            {rungNames.map((nm, j) => {
              const i = j + 1;
              return (
                <tr key={i}>
                  <td style={{ padding: '2px 4px' }}>{nm}</td>
                  {([1, 2] as const).map(t => (
                    <td key={t}><input type="number" style={{ ...inStyle, width: 90, padding: '3px 5px' }} value={Math.round(tgtAt(t, i) * 1e6) / 1e4}
                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setIn(tgtSection, tgtKey(t, i), v / 100); }} /></td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 style={h3Style}>{sector === 'water' ? 'Water' : 'Sanitation'} — unit costs & technical</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {sector === 'water' ? (<>
            <NumField width={160} label="Safely-managed cost/HH (engine)" value={inputs?.water_costs?.network_cost_per_hh_serv1 ?? 0} onCommit={v => setIn('water_costs', 'network_cost_per_hh_serv1', v)} />
            <NumField width={160} label="Basic cost/HH (engine)" value={inputs?.water_costs?.network_cost_per_hh_serv2 ?? 0} onCommit={v => setIn('water_costs', 'network_cost_per_hh_serv2', v)} />
            <NumField width={130} label="NRW treat % capex" pct value={inputs?.water_interventions?.nrw_treatment_cost_pct_capex ?? 0.4} onCommit={v => setIn('water_interventions', 'nrw_treatment_cost_pct_capex', v)} />
            <NumField width={130} label="Current NRW" pct value={inputs?.water_interventions?.nrw_current_pct ?? 0.4} onCommit={v => setIn('water_interventions', 'nrw_current_pct', v)} />
            <NumField width={130} label="Physical loss % NRW" pct value={inputs?.water_interventions?.nrw_physical_loss_pct ?? 0.5} onCommit={v => setIn('water_interventions', 'nrw_physical_loss_pct', v)} />
            <NumField width={130} label="% non-HH" pct value={tech.ws_non_hh_pct ?? 0.1} onCommit={v => setIn('technical', 'ws_non_hh_pct', v)} />
            <NumField width={130} label="Asset life (yrs)" value={tech.ws_asset_life ?? 30} onCommit={v => setIn('technical', 'ws_asset_life', v)} />
          </>) : (<>
            <NumField width={160} label="Safely-managed cost/HH (engine)" value={inputs?.sanitation_costs?.sewer_cost_per_hh_sserv1 ?? 0} onCommit={v => setIn('sanitation_costs', 'sewer_cost_per_hh_sserv1', v)} />
            <NumField width={160} label="Basic cost/HH (engine)" value={inputs?.sanitation_costs?.sewer_cost_per_hh_sserv2 ?? 0} onCommit={v => setIn('sanitation_costs', 'sewer_cost_per_hh_sserv2', v)} />
            <NumField width={130} label="% non-HH" pct value={tech.san_non_hh_pct ?? 0.1} onCommit={v => setIn('technical', 'san_non_hh_pct', v)} />
            <NumField width={130} label="Asset life (yrs)" value={tech.san_asset_life ?? 30} onCommit={v => setIn('technical', 'san_asset_life', v)} />
          </>)}
        </div>
        {renderMix('sm', 'Safely managed')}
        {renderMix('basic', 'Basic')}

        <div style={{ margin: '12px 0 6px', fontSize: 11, lineHeight: 1.6 }}>
          <b>{sector === 'water' ? 'Water' : 'Sanitation'} checks (must total 100%)</b>
          {checks.map(c => {
            const ok = Math.abs(c.sum - 1) < 0.001;
            return <div key={c.name} style={{ color: ok ? '#16a34a' : '#b91c1c' }}>{ok ? '✓' : '✗'} {c.name}: {(c.sum * 100).toFixed(2)}%</div>;
          })}
          <div style={{ color: gdpFcHard === 5 ? '#16a34a' : '#b45309' }}>
            {gdpFcHard === 5 ? '✓' : '⚠'} GDP hard forecast years: {gdpFcHard}
            {gdpFcHard !== 5 && ' — enter 5 (baseline+1 … baseline+5); the ongoing growth rate fills the rest'}
          </div>
        </div>

        <button onClick={run} disabled={running} style={{
          width: '100%', padding: '10px 0', marginTop: 6, border: 'none', borderRadius: 6,
          background: '#0073A8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>{running ? 'Running…' : '▶ Run BAU'}</button>
      </div>

      {/* ── output ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {error && <div style={{ color: '#b91c1c', whiteSpace: 'pre-wrap', fontSize: 11 }}>{error}</div>}
        {!result && !error && <div style={{ color: '#64748b' }}>Click <b>Run BAU</b>. Households in millions; money in LCU millions.</div>}
        {sec && (
          <>
            <h3 style={{ margin: '0 0 6px', fontSize: 15, color: '#1e3a5f' }}>{sector === 'water' ? 'Water Supply' : 'Sanitation'} — BAU (validated engine)</h3>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
              cost/HH (SM) = <b>{Math.round(sec.cost_per_hh).toLocaleString()}</b>
              {' · '}hist CAGR = {sec.hist_cagr.map((x: number) => (x * 100).toFixed(2) + '%').join(' / ')}
              {' · '}opening stock = <b>{M(sec.opening_stock)}</b> M
              {' · '}end-of-as-is = <b>{result.end_asis_year}</b>
            </div>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {['Year', 'Total HH', 'BAU SM', 'BAU Basic', 'BAU Limited', 'BAU Unimp', 'BAU NoServ', 'Σ rungs', 'Target SM', 'New capex', 'Replace', 'Total need', 'Fin. gap'].map(c =>
                    <th key={c} style={{ padding: '4px 8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.years.map((yr: number, i: number) => {
                  const fc = yr > (per.baseline_year || 2025);
                  const sum = [0, 1, 2, 3, 4].reduce((a, rn) => a + sec.bau_hh[rn][i], 0);
                  return (
                    <tr key={yr} style={{ background: fc ? '#fffbeb' : '#fff' }}>
                      <td style={{ padding: '3px 8px', border: '1px solid #eef2f7', fontWeight: 600 }}>{yr}</td>
                      <td style={{ padding: '3px 8px', border: '1px solid #eef2f7', textAlign: 'right' }}>{HH(result.total_hh[i])}</td>
                      {[0, 1, 2, 3, 4].map(rn => <td key={rn} style={{ padding: '3px 8px', border: '1px solid #eef2f7', textAlign: 'right' }}>{HH(sec.bau_hh[rn][i])}</td>)}
                      <td style={{ padding: '3px 8px', border: '1px solid #eef2f7', textAlign: 'right', color: '#94a3b8' }}>{HH(sum)}</td>
                      <td style={{ padding: '3px 8px', border: '1px solid #eef2f7', textAlign: 'right', color: '#16a34a' }}>{HH(sec.target_hh[0][i])}</td>
                      <td style={{ padding: '3px 8px', border: '1px solid #eef2f7', textAlign: 'right' }}>{M(sec.new_capex_total[i])}</td>
                      <td style={{ padding: '3px 8px', border: '1px solid #eef2f7', textAlign: 'right' }}>{M(sec.replacement_capex[i])}</td>
                      <td style={{ padding: '3px 8px', border: '1px solid #eef2f7', textAlign: 'right' }}>{M(sec.total_investment_need[i])}</td>
                      <td style={{ padding: '3px 8px', border: '1px solid #eef2f7', textAlign: 'right', fontWeight: 600, color: '#b91c1c' }}>{M(sec.financing_gap[i])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
