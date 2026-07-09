import React, { useState, useRef } from 'react';
import { downloadTemplate, importTemplate } from '../api';

function Section({ title, children, defaultOpen = false, cols = 3, sectionKey, onFocus }: { title: string; children: React.ReactNode; defaultOpen?: boolean; cols?: number; sectionKey?: string; onFocus?: (key: string) => void }) {
  const [open, setOpen] = useState(defaultOpen);
  // Responsive columns: fields size to a min track and the column count adapts to the available
  // width (so the grid never stretches fields edge-to-edge on wide screens, nor cramps on a laptop).
  // The 2-col target/cost/technical sections keep a slightly wider min than the denser 3-col ones.
  const colMin = cols <= 2 ? 240 : 200;
  const handleClick = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && sectionKey && onFocus) onFocus(sectionKey);
  };
  return (
    <div style={{ marginBottom: 8, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
      <button onClick={handleClick} style={{
        width: '100%', padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
        border: 'none', background: open ? '#EBF6FB' : '#fff', color: open ? '#0073A8' : '#002244', fontWeight: 600,
        fontSize: 14, borderRadius: 8, display: 'flex', justifyContent: 'space-between',
      }}>
        {title}<span>{open ? '▴' : '▾'}</span>
      </button>
      {open && <div onFocusCapture={() => { if (sectionKey && onFocus) onFocus(sectionKey); }} onClickCapture={() => { if (sectionKey && onFocus) onFocus(sectionKey); }} style={{ padding: '10px 14px 12px', display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${colMin}px, 1fr))`, gap: '12px 16px', alignItems: 'start' }}>{children}</div>}
    </div>
  );
}

// Full-width span helper for grid layout
const FULL = { gridColumn: '1 / -1' } as const;

function SubHead({ text }: { text: string }) {
  return <div style={{ gridColumn: '1 / -1', fontSize: 13, fontWeight: 700, color: '#1e3a5f', margin: '6px 0 2px', borderBottom: '1px solid #e5e7eb', paddingBottom: 3 }}>{text}</div>;
}

// Color convention: blue text = editable input, green text = cross-linked, gray = computed/derived
function F({ label, value, onChange, unit, step, isPercent, min, max, tip, slider, fieldType, integer }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; isPercent?: boolean;
  min?: number; max?: number; tip?: string; slider?: boolean; fieldType?: 'input' | 'linked' | 'computed'; integer?: boolean;
}) {
  const labelColor = fieldType === 'linked' ? '#16a34a' : fieldType === 'computed' ? '#94a3b8' : '#0000cc';
  const rawPct = Math.round(value * 1e4) / 1e2; // 2 decimal places for %
  const displayVal = isPercent ? (fieldType === 'computed' ? Math.round(rawPct * 100) / 100 : rawPct) : (integer ? Math.round(value) : Math.round(value * 100) / 100);
  const displayMin = min !== undefined ? (isPercent ? Math.round(min * 1e10) / 1e8 : min) : undefined;
  const displayMax = max !== undefined ? (isPercent ? Math.round(max * 1e10) / 1e8 : max) : undefined;
  const outOfRange = (displayMin !== undefined && displayVal < displayMin) || (displayMax !== undefined && displayVal > displayMax);
  // Show thousands separators for large amounts, but never for years or percentages
  const looksLikeYear = !unit && !isPercent && Number.isInteger(value) && value >= 1900 && value <= 2100;
  const useCommas = !isPercent && !looksLikeYear && Math.abs(displayVal) >= 1000;
  const commaStr = useCommas ? displayVal.toLocaleString('en-US') : '';

  let tooltip = tip || '';
  if (displayMin !== undefined || displayMax !== undefined) {
    const rangeStr = displayMin !== undefined && displayMax !== undefined
      ? `Range: ${displayMin}–${displayMax}${unit ? ' ' + unit : ''}`
      : displayMin !== undefined ? `Min: ${displayMin}${unit ? ' ' + unit : ''}` : `Max: ${displayMax}${unit ? ' ' + unit : ''}`;
    tooltip = tooltip ? `${tooltip}\n${rangeStr}` : rangeStr;
  }

  const showSlider = slider && displayMin !== undefined && displayMax !== undefined;

  // World Bank SSST style: editable = cream, derived = gray
  const isDerived = fieldType === 'computed' || fieldType === 'linked';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
    }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#3A4452', lineHeight: 1.3, fontWeight: 500, minHeight: 32 }} title={tooltip || undefined}>
        {label}
        {tooltip && <span style={{
          width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
          background: '#C2CBD6', color: '#fff', fontSize: 10, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'help',
          fontStyle: 'italic', fontFamily: 'Georgia, serif', fontWeight: 700,
        }} title={tooltip}>i</span>}
      </label>
      <input type={useCommas ? 'text' : 'number'} inputMode="decimal"
        value={useCommas ? commaStr : displayVal}
        onChange={e => { const v = parseFloat(e.target.value.replace(/,/g, '')); if (!isNaN(v)) onChange(isPercent ? v / 100 : v); }}
        step={isPercent ? 1 : (step || 1)}
        min={useCommas ? undefined : displayMin} max={useCommas ? undefined : displayMax}
        style={{
          width: '100%', padding: '7px 10px', borderRadius: 4, fontSize: 13, textAlign: 'left',
          border: outOfRange ? '1.5px solid #E74C3C' : isDerived ? '1px solid #DDE3EA' : '1px solid #F0D070',
          background: outOfRange ? '#FFE9E9' : isDerived ? '#F1F3F5' : '#FFF9E6',
          color: isDerived ? '#6B7785' : '#3A4452',
          cursor: isDerived ? 'not-allowed' : 'text',
          boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
        }}
        readOnly={isDerived}
      />
      {unit && <span style={{ fontSize: 11, color: '#6B7785' }}>{unit}</span>}
      {showSlider && (
        <input type="range" value={displayVal}
          onChange={e => { const v = parseFloat(e.target.value); onChange(isPercent ? v / 100 : v); }}
          min={displayMin} max={displayMax} step={isPercent ? 1 : (step || 1)}
          style={{ width: '100%', height: 6, marginTop: 4, accentColor: '#2563eb' }}
        />
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
      <span style={{ color: checked ? '#1a1a2e' : '#94a3b8', fontWeight: checked ? 600 : 400 }}>{label}</span>
    </label>
  );
}

// A year input that commits only on blur / Enter (not per keystroke), so a half-typed year like "19"
// can't momentarily re-anchor every data series or spawn thousands of table columns mid-edit.
function YearField({ label, value, onCommit, min, max, tip }: {
  label: string; value: number; onCommit: (v: number) => void; min?: number; max?: number; tip?: string;
}) {
  const [txt, setTxt] = useState(String(value ?? ''));
  React.useEffect(() => { setTxt(String(value ?? '')); }, [value]);
  const commit = () => {
    const v = parseInt(txt, 10);
    if (!isNaN(v) && v !== value) onCommit(v); else setTxt(String(value ?? ''));
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#3A4452', lineHeight: 1.3, fontWeight: 500, minHeight: 32 }} title={tip || undefined}>
        {label}
        {tip && <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, background: '#C2CBD6', color: '#fff', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', fontStyle: 'italic', fontFamily: 'Georgia, serif', fontWeight: 700 }} title={tip}>i</span>}
      </label>
      <input type="number" value={txt}
        onChange={e => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        min={min} max={max}
        style={{ width: '100%', padding: '7px 10px', borderRadius: 4, fontSize: 13, textAlign: 'left', border: '1px solid #F0D070', background: '#FFF9E6', color: '#3A4452', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
      />
    </div>
  );
}

interface Props { inputs: any; onChange: (i: any) => void; results?: any; onCalculate?: () => void; loading?: boolean; showSection?: string; geoScope?: string; bauSector?: 'water' | 'sanitation'; onBauSectorChange?: (v: 'water' | 'sanitation') => void; onSectionFocus?: (sectionKey: string) => void; }

export default function InputPanel({ inputs, onChange, results, onCalculate, loading, showSection = 'inputs', geoScope = 'urban', bauSector: bauSectorProp, onBauSectorChange, onSectionFocus }: Props) {
  const [countries, setCountries] = useState<{name:string, currency:string}[]>([]);
  const [bauSectorLocal, setBauSectorLocal] = useState<'water' | 'sanitation'>('water');
  const bauSector = bauSectorProp || bauSectorLocal;
  const setBauSector = onBauSectorChange || setBauSectorLocal;
  // Excel round-trip (download a template of the year-by-year table, fill offline, upload to populate).
  const [xlsxStatus, setXlsxStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' });
  const fileRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch('/api/countries').then(r => r.json()).then(setCountries).catch(() => {});
  }, []);

  const handleXlsxDownload = async () => {
    try { setXlsxStatus({ kind: 'busy', msg: 'Preparing template…' }); await downloadTemplate(inputs); setXlsxStatus({ kind: 'ok', msg: 'Template downloaded — fill the cream cells and upload it back.' }); }
    catch (e) { setXlsxStatus({ kind: 'err', msg: String(e) }); }
  };
  const handleXlsxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setXlsxStatus({ kind: 'busy', msg: `Reading ${f.name}…` });
      const { inputs: merged, cellsUpdated } = await importTemplate(f, inputs);
      onChange(merged);
      setXlsxStatus({ kind: 'ok', msg: `Loaded ${cellsUpdated} value${cellsUpdated === 1 ? '' : 's'} from ${f.name}.` });
    } catch (err) {
      setXlsxStatus({ kind: 'err', msg: String(err) });
    } finally {
      e.target.value = '';   // let the same file be re-selected
    }
  };

  if (!inputs) return null;
  const u = (section: string, field: string, value: number) => {
    onChange({ ...inputs, [section]: { ...inputs[section], [field]: value } });
  };

  // Every macro / population / service / budget series is stored POSITIONALLY (index 0 = model start
  // year). So moving the start year must shift these arrays, otherwise the old values just slide onto
  // the new years (e.g. changing the start to 1999 would show the 2011 numbers under 1999). We re-anchor
  // so each value stays attached to its YEAR: extend the start earlier → the newly-exposed years come in
  // blank; move it later → the dropped leading years fall off.
  const shiftYearSeries = (arr: any, delta: number) =>
    (!Array.isArray(arr) || !delta) ? arr
      : delta > 0 ? arr.slice(delta)                       // start later: drop leading years
      : [...Array(-delta).fill(0), ...arr];                // start earlier: prepend blank years
  const setModelStartYear = (newYr: number) => {
    const oldYr = inputs.period?.model_start_year;
    const delta = (Number.isFinite(newYr) && Number.isFinite(oldYr)) ? (newYr - oldYr) : 0;
    const next: any = { ...inputs, period: { ...inputs.period, model_start_year: newYr } };
    if (delta) {
      const shiftGroup = (obj: any, fields: string[]) => {
        if (!obj) return obj;
        const o = { ...obj };
        fields.forEach(f => { if (Array.isArray(o[f])) o[f] = shiftYearSeries(o[f], delta); });
        return o;
      };
      next.macro = shiftGroup(next.macro, ['gdp_nominal_usd', 'inflation_nepal', 'inflation_us', 'exchange_rate', 'gdp_growth']);
      next.population = shiftGroup(next.population, ['pop_ts', 'hh_ts']);
      next.water_service = shiftGroup(next.water_service, ['serv1_ts', 'serv2_ts', 'serv3_ts', 'serv4_ts', 'serv5_ts']);
      next.sanitation_service = shiftGroup(next.sanitation_service, ['sserv1_ts', 'sserv2_ts', 'sserv3_ts', 'sserv4_ts', 'sserv5_ts']);
      next.bau = shiftGroup(next.bau, ['ws_budget_ts', 'san_budget_ts', 'ws_expend_ts', 'san_expend_ts']);
    }
    onChange(next);
  };
  const toggleIntv = (field: string, value: boolean) => {
    onChange({ ...inputs, toggles: { ...inputs.toggles, [field]: value } });
  };

  // Technology-mix editor (unit-cost sections): Σ(share × cost) is WRITTEN THROUGH to the weighted
  // engine cost field — the same mechanism (and the same shared arrays) as the Test Harness tab.
  const setCostMix = (section: string, rung: string, engineField: string, arr: any[]) => {
    const weighted = arr.reduce((a: number, t: any) => a + (+t.share || 0) * (+t.cost || 0), 0);
    onChange({ ...inputs, [section]: { ...inputs[section], [rung + '_tech_mix']: arr, [engineField]: weighted } });
  };
  // Editing the DIRECT unit-cost field ALSO rescales that rung's technology mix so its weighted cost
  // equals the entered value (shares preserved). Without this, the direct field and the tech-mix
  // calculator can silently disagree — a later tech-mix edit would recompute the weighted from stale
  // rows and clobber the number the user just typed here. Keeping them in sync prevents that.
  const setUnitCost = (section: string, engineField: string, rung: string, value: number) => {
    const mix: any[] = inputs[section]?.[rung + '_tech_mix'] || [];
    const cur = mix.reduce((a: number, t: any) => a + (+t.share || 0) * (+t.cost || 0), 0);
    const next: any = { ...inputs[section], [engineField]: value };
    if (mix.length) {
      next[rung + '_tech_mix'] = cur > 0
        ? mix.map((t: any) => ({ ...t, cost: (+t.cost || 0) * (value / cur) }))   // preserve shares, scale to new weighted
        : mix.map((t: any) => ({ ...t, cost: value }));                            // degenerate (weighted 0): flat cost
    }
    onChange({ ...inputs, [section]: next });
  };
  const renderCostMix = (section: string, rung: string, engineField: string, title: string) => {
    const m: any[] = inputs[section]?.[rung + '_tech_mix'] || [];
    if (!m.length) return null;
    const shareSum = m.reduce((a: number, t: any) => a + (+t.share || 0), 0);
    const weighted = m.reduce((a: number, t: any) => a + (+t.share || 0) * (+t.cost || 0), 0);
    const ok = Math.abs(shareSum - 1) < 0.001;
    const cellStyle: React.CSSProperties = { padding: '4px 6px', border: '1px solid #F0D070', background: '#FFF9E6', borderRadius: 3, fontSize: 11, color: '#3A4452', outline: 'none' };
    return (
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1e3a5f', margin: '4px 0 2px' }}>{title} — technology mix (weighted = Σ share × cost)</div>
        <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
          <thead><tr style={{ color: '#64748b' }}><th style={{ textAlign: 'left', padding: '2px 6px' }}>technology</th><th>share %</th><th>cost/HH</th><th></th></tr></thead>
          <tbody>
            {m.map((t: any, i: number) => (
              <tr key={i}>
                <td><input type="text" style={{ ...cellStyle, width: 170 }} value={t.name || ''}
                  onChange={e => setCostMix(section, rung, engineField, m.map((x: any, j: number) => j === i ? { ...x, name: e.target.value } : x))} /></td>
                <td><input type="number" style={{ ...cellStyle, width: 64 }} value={Math.round((+t.share || 0) * 1e6) / 1e4}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setCostMix(section, rung, engineField, m.map((x: any, j: number) => j === i ? { ...x, share: v / 100 } : x)); }} /></td>
                <td><input type="number" style={{ ...cellStyle, width: 96 }} value={+t.cost || 0}
                  onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setCostMix(section, rung, engineField, m.map((x: any, j: number) => j === i ? { ...x, cost: v } : x)); }} /></td>
                <td><button onClick={() => { if (m.length > 1) setCostMix(section, rung, engineField, m.filter((_: any, j: number) => j !== i)); }}
                  style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 3, padding: '2px 7px', cursor: 'pointer', fontSize: 10 }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => setCostMix(section, rung, engineField, [...m, { name: 'New technology', share: 0, cost: 0 }])}
          style={{ margin: '3px 0', padding: '3px 9px', fontSize: 11, border: '1px dashed #0073A8', background: '#fff', color: '#0073A8', borderRadius: 5, cursor: 'pointer' }}>+ Add technology</button>
        <div style={{ fontSize: 10.5, color: ok ? '#0073A8' : '#b91c1c' }}>
          Σ share {(shareSum * 100).toFixed(2)}% · weighted cost/HH <b>{Math.round(weighted).toLocaleString()}</b> → written to the “{title}” cost field above
        </div>
      </div>
    );
  };

  const setCountryConfig = (field: string, value: string) => {
    const updated = { ...inputs, country_config: { ...inputs.country_config, [field]: value } };
    // Auto-fill currency when country changes
    if (field === 'country') {
      const match = countries.find(c => c.name.toLowerCase() === value.toLowerCase());
      if (match) updated.country_config.currency = match.currency;
    }
    onChange(updated);
  };

  const isInputs = showSection === 'inputs';
  const isBAU = showSection === 'bau';
  const isInterventions = showSection === 'interventions';

  // Dynamic labels from country config and provider lists
  const cc = inputs.country_config || {};
  const wProviders = inputs.water_targets?.providers || [];
  const sProviders = inputs.sanitation_targets?.providers || [];
  const CUR = cc.currency || 'LCU';
  const ws = [cc.ws_serv1_name||'Level 1', cc.ws_serv2_name||'Level 2', cc.ws_serv3_name||'Level 3', cc.ws_serv4_name||'Level 4', cc.ws_serv5_name||'Level 5'];
  const ss = [cc.san_serv1_name||'Level 1', cc.san_serv2_name||'Level 2', cc.san_serv3_name||'Level 3', cc.san_serv4_name||'Level 4', cc.san_serv5_name||'Level 5'];
  const startYr = inputs.period.model_start_year;
  const baseYr = inputs.period.baseline_year;
  const scopeLabel = geoScope === 'national' ? 'National' : geoScope === 'rural' ? 'Rural' : 'Urban';
  const scopeLower = scopeLabel.toLowerCase();
  // How the WSS budget is entered: 'pct_gdp' (full budget = real GDP × %GDP) or 'direct' (enter the
  // actual-expenditure series directly — real terms; it drives the model exactly like the derived budget).
  const budgetMode: 'pct_gdp' | 'direct' = inputs.macro?.budget_input_mode === 'direct' ? 'direct' : 'pct_gdp';
  const setBudgetMode = (m: 'pct_gdp' | 'direct') => onChange({ ...inputs, macro: { ...inputs.macro, budget_input_mode: m } });

  // CAGR helper: (end/start)^(1/n) - 1
  const cagr = (start: number, end: number, years: number) => {
    if (!start || !end || !years || years <= 0 || start <= 0 || end <= 0) return 0;
    return Math.pow(end / start, 1 / years) - 1;
  };
  const nYears = (baseYr && startYr && baseYr > startYr) ? baseYr - startYr : 0;
  const pop = inputs.population || {};
  const popCagr = cagr(pop.total_pop_start, pop.total_pop_baseline, nYears);
  const hhStart = pop.total_hh_start || 0;
  const hhBase = pop.total_hh_baseline || 0;
  const avgHHSizeStart = (hhStart > 0 && pop.total_pop_start > 0) ? pop.total_pop_start / (hhStart * 1e6) : 0;
  const avgHHSizeBase = (hhBase > 0 && pop.total_pop_baseline > 0) ? pop.total_pop_baseline / (hhBase * 1e6) : 0;
  const hhSizeCagr = cagr(avgHHSizeStart, avgHHSizeBase, nYears);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', background: '#fafbfc', fontSize: 12 }}>
      {/* Content is capped to a consistent max width and centered, so section cards don't sprawl
          edge-to-edge on wide screens; the grey scroll container stays full-bleed behind it. */}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 18, fontSize: 12, marginBottom: 12, color: '#3A4452', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid #F0D070', background: '#FFF9E6', display: 'inline-block' }} />
          Editable input
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid #DDE3EA', background: '#F1F3F5', display: 'inline-block' }} />
          Cannot edit (auto-calculated)
        </span>
      </div>

      {/* Area-scope banner — all inputs below apply to this area (also carries the BAU note on the BAU tab) */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, textAlign: 'left',
        padding: '8px 14px', borderRadius: 6, fontSize: 12.5,
        background: '#EBF6FB', border: '1px solid #9fd3ec', borderLeft: '4px solid #0073A8', color: '#0073A8',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontWeight: 600 }}>
          <span style={{ fontSize: 14, lineHeight: 1.3 }}>📍</span>
          <span>Entering <span style={{ display: 'inline-block', background: '#0073A8', color: '#fff', fontWeight: 700, padding: '1px 10px', borderRadius: 12, fontSize: 12, textTransform: 'capitalize', verticalAlign: 'baseline' }}>{scopeLabel}</span> data — every field on this page is {scopeLower}-specific.</span>
        </div>
        {isBAU && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontWeight: 500, lineHeight: 1.5 }}>
            <span style={{ fontSize: 14, lineHeight: 1.3 }}>🔗</span>
            <span><strong>BAU data entry</strong> — Data fields below are synced with corresponding entries on the <strong>Data Inputs</strong> tab. They can be used to edit the BAU scenario directly from this tab.</span>
          </div>
        )}
      </div>

      {/* ===== INTERVENTION TOGGLES (shown in interventions step) ===== */}
      {isInterventions && inputs.toggles && <>
        <Section title="Intervention Toggles" cols={2}>
          <SubHead text="Water Supply" />
          <Toggle label="Collection efficiency" checked={inputs.toggles.ws_collection_enabled} onChange={v => toggleIntv('ws_collection_enabled', v)} />
          <Toggle label="NRW reduction" checked={inputs.toggles.ws_nrw_enabled} onChange={v => toggleIntv('ws_nrw_enabled', v)} />
          <Toggle label="Capital expenditure efficiency" checked={inputs.toggles.ws_capital_efficiency_enabled} onChange={v => toggleIntv('ws_capital_efficiency_enabled', v)} />
          <Toggle label="Tariff increase" checked={inputs.toggles.ws_tariff_enabled} onChange={v => toggleIntv('ws_tariff_enabled', v)} />
          <Toggle label="Borrowing against future cashflow" checked={inputs.toggles.ws_borrowing_enabled} onChange={v => toggleIntv('ws_borrowing_enabled', v)} />
          <Toggle label="Budget execution improvement" checked={inputs.toggles.ws_budget_execution_enabled} onChange={v => toggleIntv('ws_budget_execution_enabled', v)} />
          <SubHead text="Sanitation" />
          <Toggle label="Collection efficiency" checked={inputs.toggles.san_collection_enabled} onChange={v => toggleIntv('san_collection_enabled', v)} />
          <Toggle label="Capital expenditure efficiency" checked={inputs.toggles.san_capital_efficiency_enabled} onChange={v => toggleIntv('san_capital_efficiency_enabled', v)} />
          <Toggle label="Tariff increase" checked={inputs.toggles.san_tariff_enabled} onChange={v => toggleIntv('san_tariff_enabled', v)} />
          <Toggle label="Borrowing against future cashflow" checked={inputs.toggles.san_borrowing_enabled} onChange={v => toggleIntv('san_borrowing_enabled', v)} />
          <Toggle label="Budget execution improvement" checked={inputs.toggles.san_budget_execution_enabled} onChange={v => toggleIntv('san_budget_execution_enabled', v)} />
        </Section>
      </>}

      {isInputs && <>

      {/* ===== EXCEL ROUND-TRIP (bulk year-by-year data entry) ===== */}
      <div style={{ marginBottom: 8, border: '1px solid #c7d2fe', borderLeft: '4px solid #2563eb', borderRadius: 8, background: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>📊 Bulk data entry (Excel)</span>
        <span style={{ fontSize: 11, color: '#64748b', flex: '1 1 220px', minWidth: 180 }}>
          Download a template of the year-by-year table for <b style={{ textTransform: 'capitalize' }}>{scopeLabel}</b>, fill the cream cells offline, then upload it to populate the table.
        </span>
        <button onClick={handleXlsxDownload} disabled={xlsxStatus.kind === 'busy'} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #2563eb', borderRadius: 6, background: '#fff', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>⤓ Download template</button>
        <button onClick={() => fileRef.current?.click()} disabled={xlsxStatus.kind === 'busy'} style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>⤒ Upload filled template</button>
        <input ref={fileRef} type="file" accept=".xlsx" onChange={handleXlsxUpload} style={{ display: 'none' }} />
        {xlsxStatus.kind !== 'idle' && (
          <span style={{ gridColumn: '1 / -1', fontSize: 11, width: '100%',
            color: xlsxStatus.kind === 'err' ? '#b91c1c' : xlsxStatus.kind === 'ok' ? '#15803d' : '#64748b' }}>
            {xlsxStatus.kind === 'busy' ? '⏳ ' : xlsxStatus.kind === 'ok' ? '✓ ' : '⚠ '}{xlsxStatus.msg}
          </span>
        )}
      </div>

      {/* ===== COUNTRY CONFIG ===== */}
      <Section title="1. Country, Region & Currency" sectionKey="country" onFocus={onSectionFocus}>
        {inputs.country_config && <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <label style={{ fontSize: 12, color: '#3A4452', fontWeight: 500 }}>Country</label>
            <input type="text" list="country-list" value={inputs.country_config.country || ''}
              onChange={e => setCountryConfig('country', e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #F0D070', background: '#FFF9E6', borderRadius: 4, fontSize: 13, color: '#3A4452', boxSizing: 'border-box', outline: 'none' }}
              placeholder="Type to search..."
            />
            <datalist id="country-list">
              {countries.map(c => <option key={c.name} value={c.name} />)}
            </datalist>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <label style={{ fontSize: 12, color: '#3A4452', fontWeight: 500 }}>Region</label>
            <input type="text" value={inputs.country_config.area || ''}
              onChange={e => setCountryConfig('area', e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #F0D070', background: '#FFF9E6', borderRadius: 4, fontSize: 13, color: '#3A4452', boxSizing: 'border-box', outline: 'none' }}
              placeholder="e.g. Kathmandu Valley" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <label style={{ fontSize: 12, color: '#3A4452', fontWeight: 500 }}>Currency code</label>
            <input type="text" value={inputs.country_config.currency || ''}
              onChange={e => setCountryConfig('currency', e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #F0D070', background: '#FFF9E6', borderRadius: 4, fontSize: 13, color: '#3A4452', boxSizing: 'border-box', outline: 'none' }} />
          </div>
        </>}
      </Section>

      {/* ===== TIME SCALES & MACROECONOMICS ===== */}
      <Section title="2. Time Scales & Macroeconomics" sectionKey="macro" onFocus={onSectionFocus}>
        <SubHead text="Key dates" />
        <YearField label="Model start year" value={inputs.period.model_start_year} onCommit={setModelStartYear} min={1950} max={inputs.period.baseline_year - 1} tip="First year of historical data; must be at least 3 years before the baseline year. Existing data keeps its year — newly added earlier years come in blank for you to fill." />
        <F label="Baseline year" value={inputs.period.baseline_year} onChange={v => u('period','baseline_year',v)} min={2023} tip="Last year with complete actual data; must be within the last three years" />
        <F label="Forecast end year" value={inputs.period.forecast_end_year} onChange={v => u('period','forecast_end_year',v)} min={inputs.period.baseline_year + 5} tip="Last year of projection" />
        <F label="As-is forecast start" value={inputs.period.as_is_forecast_start || (inputs.period.baseline_year + 1)} onChange={v => u('period','as_is_forecast_start',v)} min={inputs.period.baseline_year + 1} tip="First year of the as-is forecast (workbook G18); usually baseline + 1" />
        <F label="As-is forecast length" value={inputs.period.as_is_forecast_length ?? 2} onChange={v => u('period','as_is_forecast_length',v)} unit="yrs" min={1} max={10} tip="Number of as-is years (workbook G19). End of as-is = start + length − 1; the target path branches from the end-of-as-is year" />
        <F label="Performance improvement start" value={(inputs.period.as_is_forecast_start || inputs.period.baseline_year + 1) + (inputs.period.as_is_forecast_length || 2)} onChange={() => {}} fieldType="computed" tip="Derived: end of as-is forecast + 1 (= as-is start + as-is length). Matches the workbook's G21." />
        <F label="Target 1 year" value={inputs.period.target1_year} onChange={v => u('period','target1_year',v)} tip="First milestone year; must be greater than the performance improvement start year" />
        <F label="Target 2 year" value={inputs.period.target2_year} onChange={v => u('period','target2_year',v)} min={inputs.period.target1_year} max={inputs.period.forecast_end_year} tip="Final milestone year; must be between Target 1 year and forecast end year" />
        <SubHead text="Government budget for WSS" />
        <div style={{ gridColumn: '1 / -1', marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>How would you like to provide the WSS budget?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { k: 'pct_gdp', l: 'As % of GDP', d: 'Enter one share of GDP; the yearly budget = real GDP × %' },
              { k: 'direct', l: 'Direct (budget actually spent)', d: 'Enter the actual expenditure series year-by-year (real terms); the % of GDP is then implied' },
            ] as const).map(opt => (
              <button key={opt.k} onClick={() => setBudgetMode(opt.k)} title={opt.d} style={{
                padding: '6px 14px', borderRadius: 14, border: '1px solid #c7d2fe', cursor: 'pointer', fontSize: 11.5,
                background: budgetMode === opt.k ? '#2563eb' : '#fff',
                color: budgetMode === opt.k ? '#fff' : '#475569', fontWeight: budgetMode === opt.k ? 700 : 500,
              }}>{opt.l}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', marginTop: 4 }}>
            {budgetMode === 'pct_gdp'
              ? 'Budget as % of GDP below; the engine derives each year’s budget from real GDP. The table’s “WS/SAN budget allocated” rows are indicative.'
              : 'Enter the “WS/SAN actual expenditure” rows in the table (real / baseline prices) — historical + 5 hard forecast years; later years grow at the ongoing budget-growth rate below. This spent series drives the model; the % of GDP is implied.'}
          </div>
        </div>
        {(() => {
          // Derive implied average % of GDP from the year-by-year budget (used in 'direct' mode)
          const gdpArr = inputs.macro?.gdp_nominal_usd || [];
          const rateArr = inputs.macro?.exchange_rate || [];
          const yrs = gdpArr.map((_: number, i: number) => (inputs.period.model_start_year || 2011) + i);
          const baseYr2 = inputs.period.baseline_year || 2025;
          // Implied %GDP in direct mode = mean over forecast years of (real expenditure ÷ real GDP).
          // GDP is nominal USD, so real-GDP (local) = USD × 1000 × FX ÷ deflator ≈ USD × 1000 × FX
          // for the baseline year; we approximate with the ratio spent/(GDP_USD × 1000 × FX) which
          // matches the engine's %GDP definition at baseline prices.
          const impliedPct = (spendField: string) => {
            let sum = 0, n = 0;
            yrs.forEach((yr: number, i: number) => {
              if (yr <= baseYr2) return;                                   // forecast years only (what drives the model)
              const b = (inputs.bau?.[spendField] || [])[i] || 0;          // real budget (local M)
              const gdpB = gdpArr[i] || 0; const rate = rateArr[i] || 0;   // USD B ; local per USD
              if (b > 0 && gdpB > 0 && rate > 0) { sum += b / (gdpB * 1000 * rate); n++; }
            });
            return n > 0 ? sum / n : 0;
          };
          const isDirect = budgetMode === 'direct';
          return <>
            <F label="Water supply budget as % of GDP"
              value={isDirect ? impliedPct('ws_expend_ts') : (inputs.macro.ws_budget_pct_gdp || 0)}
              onChange={v => u('macro','ws_budget_pct_gdp',v)} isPercent unit="%"
              fieldType={isDirect ? 'computed' : undefined}
              tip={isDirect ? 'Implied share of GDP, averaged over forecast years from the water actual-expenditure row' : 'Water supply budget as share of GDP. The engine derives each year’s budget = real GDP × this %.'} />
            <F label="Sanitation budget as % of GDP"
              value={isDirect ? impliedPct('san_expend_ts') : (inputs.macro.san_budget_pct_gdp || 0)}
              onChange={v => u('macro','san_budget_pct_gdp',v)} isPercent unit="%"
              fieldType={isDirect ? 'computed' : undefined}
              tip={isDirect ? 'Implied share of GDP, averaged over forecast years from the sanitation actual-expenditure row' : 'Sanitation budget as share of GDP. The engine derives each year’s budget = real GDP × this %.'} />
          </>;
        })()}
        <F label="Water capex share of budget" value={inputs.macro.ws_capex_pct ?? inputs.macro.capex_pct_budget ?? 0.21}
          onChange={v => u('macro','ws_capex_pct',v)} isPercent unit="%"
          tip="Share of the WATER budget that is capital expenditure (workbook G321 = 21%); feeds the water BAU capex budget." />
        <F label="Sanitation capex share of budget" value={inputs.macro.san_capex_pct ?? inputs.macro.capex_pct_budget ?? 0.15}
          onChange={v => u('macro','san_capex_pct',v)} isPercent unit="%"
          tip="Share of the SANITATION budget that is capital expenditure (workbook G328 = 15%, distinct from water); feeds the sanitation BAU capex budget." />
        {budgetMode === 'pct_gdp' && (
          <F label="Budget execution rate" value={inputs.macro.execution_rate ?? 1.0}
            onChange={v => u('macro','execution_rate',v)} isPercent unit="%"
            tip="Share of the ALLOCATED capex budget that is actually spent. Actual expenditure = %GDP × GDP × %capex × execution rate. One rate shared by water and sanitation; drives the BAU service-level growth." />
        )}
        <SubHead text="Ongoing rates — fill every forecast year beyond the hard values in the table" />
        <F label="Real GDP growth — ongoing" value={inputs.macro.gdp_growth_forecast ?? 0.05}
          onChange={v => u('macro','gdp_growth_forecast',v)} isPercent unit="%"
          tip="Applied to every forecast year after the hard GDP series ends (enter 5 hard forecast years of GDP in the table)" />
        <F label="Local inflation — ongoing" value={inputs.macro.inflation_local_ongoing ?? 0.05}
          onChange={v => u('macro','inflation_local_ongoing',v)} isPercent unit="%"
          tip="Fills years beyond the hard local-inflation series" />
        <F label="US inflation — ongoing" value={inputs.macro.inflation_us_ongoing ?? 0.022}
          onChange={v => u('macro','inflation_us_ongoing',v)} isPercent unit="%"
          tip="Fills years beyond the hard US-inflation series; drives the exchange-rate projection" />
        {budgetMode === 'direct' && <>
          <F label="Water budget growth — ongoing" value={inputs.bau?.ws_budget_ongoing ?? 0.05}
            onChange={v => onChange({ ...inputs, bau: { ...inputs.bau, ws_budget_ongoing: v } })} isPercent unit="%"
            tip="Water actual expenditure compounds at this rate for every forecast year beyond the 5 hard values" />
          <F label="Sanitation budget growth — ongoing" value={inputs.bau?.san_budget_ongoing ?? 0.05}
            onChange={v => onChange({ ...inputs, bau: { ...inputs.bau, san_budget_ongoing: v } })} isPercent unit="%"
            tip="Sanitation actual expenditure compounds at this rate for every forecast year beyond the 5 hard values" />
        </>}
        <SubHead text="Year-by-year data" />
        <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b', marginBottom: 4, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          Enter data for historical years. Forecast years are projected. GDP growth, population growth, avg household size, and execution rates are auto-calculated.
        </div>
        {(() => {
          // Table spans the FULL model window (start -> forecast end), independent of series length:
          // hard values render editable; the tail shows grey markers for the engine's fills.
          const startYr2 = inputs.period.model_start_year || 2011;
          const endYr2 = inputs.period.forecast_end_year || 2040;
          // Clamp the rendered span so a half-typed year (e.g. "20" mid-entry) can't spawn thousands of columns.
          const span = Math.max(1, endYr2 - startYr2 + 1);
          const years = Array.from({ length: Math.min(span, 120) }, (_: unknown, i: number) => startYr2 + i);
          const baseYr2 = inputs.period.baseline_year || 2025;
          // Hard-value window for GDP & inflation: historical through the baseline + 5 forecast years.
          const hardFcstEnd = Math.min(baseYr2 + 5, endYr2);
          const gdpArr = inputs.macro.gdp_nominal_usd || [];
          const tsInput = (section: string, field: string, idx: number, val: number, isPct: boolean, padFill: number = 0) => (
            <input type="number" value={isPct ? Math.round(val*10000)/100 : Math.round(val*100)/100}
              onChange={e => { const v=parseFloat(e.target.value); if(!isNaN(v)){
                const a=[...(inputs[section]?.[field] || inputs.macro?.[field] || [])];
                while (a.length <= idx) a.push(padFill);   // grow to reach idx; gap cells take a neutral fill
                a[idx]=isPct?v/100:v;
                if (section === 'macro') onChange({...inputs, macro:{...inputs.macro, [field]:a}});
                else onChange({...inputs, [section]:{...inputs[section], [field]:a}});
              }}}
              style={{ width: 58, padding: '3px 4px', border: '1px solid #F0D070', background: '#FFF9E6', borderRadius: 3, fontSize: 11, textAlign: 'left', color: '#3A4452', outline: 'none' }}
            />
          );
          // Neutral fill for gap cells created when the window grows: inflation rows hold their ongoing
          // rate (so an unedited forecast cell still behaves like the projection); everything else uses 0
          // (0 = "no data, project this year" for GDP; a missing actual for FX / population / households).
          const macroFill = (field: string) => field === 'inflation_nepal' ? (inputs.macro?.inflation_local_ongoing ?? 0.05)
            : field === 'inflation_us' ? (inputs.macro?.inflation_us_ongoing ?? 0.022) : 0;
          const mInput = (field: string, idx: number, val: number, isPct: boolean) => tsInput('macro', field, idx, val, isPct, macroFill(field));
          const grey = (txt: string, note: string) => <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }} title={note}>{txt}</span>;
          // Engine-computed series lookups (from the live /api/calculate results), used to show the
          // ACTUAL projected numbers in forecast years instead of a "→" placeholder.
          const fmtNum = (v: number) => Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : String(Math.round(v * 100) / 100);
          const resAt = (key: string, idx: number): number | null => {
            const a = results?.[key];
            return Array.isArray(a) && idx < a.length && a[idx] != null ? a[idx] : null;
          };
          const secRes = (sector: 'water_supply' | 'sanitation', key: string, idx: number): number | null => {
            const a = results?.[sector]?.[key];
            return Array.isArray(a) && idx < a.length && a[idx] != null ? a[idx] : null;
          };
          // A forecast/projection cell: shows the engine's computed value (grey, non-editable); falls
          // back to "→" until the first calculation returns.
          const projCell = (val: number | null, isPct: boolean, note: string) =>
            val == null ? grey('→', note) : grey(isPct ? (val * 100).toFixed(1) : fmtNum(val), note);
          // A macro series cell: editable while inside the HARD values; beyond that show the engine's
          // projected value for the year (ongoing rate / projection).
          // Editable while inside the field's HARD range, decided by YEAR (not by the current array
          // length) — so extending or shifting the year window always exposes editable cells for the
          // new years instead of freezing at the preset (Nepal) array length. Beyond the hard range,
          // show the engine's projected value (grey).
          const hardCell = (field: string, idx: number, isPct: boolean, note: string, resKey?: string, editThroughYr?: number) => {
            const a = inputs.macro?.[field] || [];
            const editable = editThroughYr != null ? (years[idx] <= editThroughYr) : (idx < a.length);
            if (editable) return mInput(field, idx, a[idx] ?? 0, isPct);
            return projCell(resKey ? resAt(resKey, idx) : null, isPct, note);
          };

          // Direct-mode budget series computed EXACTLY like the engine (sector_full_budget): the entered
          // hard values as-is, then every later year FORECAST — compounded at the ongoing budget-growth
          // rate from the last hard value. Used to SHOW the projected number in the forecast cells.
          const directSeries = (field: string, ongoing: number) => {
            const a = inputs.bau?.[field] || [];
            const g = ongoing || 0;
            const out: number[] = [];
            for (let t = 0; t < years.length; t++) out[t] = (t < a.length) ? (a[t] || 0) : ((out[t - 1] || 0) * (1 + g));
            return out;
          };
          // A direct-mode budget cell: editable through the baseline + 5 forecast years (by YEAR, so it
          // tracks window changes), then FORECAST — the read-only projected value (grown at the ongoing
          // rate), not just an arrow.
          const directCell = (field: string, ongoing: number, idx: number) => {
            if (years[idx] <= hardFcstEnd) return tsInput('bau', field, idx, (inputs.bau?.[field] || [])[idx] ?? 0, false);
            const proj = directSeries(field, ongoing)[idx] || 0;
            return grey(proj > 0 ? fmtNum(proj) : '—',
              `Forecast — grown at the ongoing budget-growth rate (${(ongoing * 100).toFixed(1)}%) from the last hard value (through ${hardFcstEnd}).`);
          };
          // Allocated-capex cell. %GDP mode: PURELY CALCULATED (not editable). DIRECT mode: the user
          // enters the allocated budget through baseline + 5 years; later years are forecast (read-only).
          const budgetCell = (field: string, sector: 'water_supply' | 'sanitation', idx: number, ongoing: number) => {
            if (budgetMode === 'direct') return directCell(field, ongoing, idx);
            const rv = secRes(sector, 'allocated_capex', idx);
            if (rv == null) return grey('…', 'Computing…');
            return grey(rv > 0 ? Math.round(rv).toLocaleString() : '—',
              'Allocated capex = %GDP × real GDP × %capex (engine, real / baseline prices). Calculated — not editable.');
          };
          // Actual-expenditure cell. DIRECT mode DRIVES the model: editable through baseline + 5 forecast
          // years, then forecast (grown at the ongoing budget-growth rate — shown read-only). %GDP mode:
          // PURELY CALCULATED: actual capex = allocated × execution rate.
          const spendCell = (field: string, ongoing: number, idx: number, sector: 'water_supply' | 'sanitation') => {
            if (budgetMode === 'direct') return directCell(field, ongoing, idx);
            const rv = secRes(sector, 'actual_capex', idx);
            if (rv == null) return grey('…', 'Computing…');
            return grey(rv > 0 ? Math.round(rv).toLocaleString() : '—',
              'Actual capex = allocated × execution rate (engine, real / baseline prices). Calculated — not editable.');
          };

          // Service-level cell. The validated model consumes exactly TWO points per rung — the
          // START-year split and the BASELINE-year split (the historical path follows each rung's
          // CAGR internally). Only those two years are editable; in-between years show the
          // engine's historical path; forecast years come from the engine.
          const biSvc = baseYr2 - startYr2;   // baseline offset (index of the baseline-year split)
          // ── Historical service-level display, computed LIVE to MATCH the engine's 4a block ──
          // The engine does NOT interpolate %s linearly. Each rung's UNADJUSTED household COUNT
          // grows geometrically from its start-year count at the rung's historical count-CAGR
          // (count = %·HH), then the adjusted (displayed) counts are rescaled to that year's total
          // HHs. Water rescales ALL rungs proportionally (HH cancels → pure endpoint-% function);
          // sanitation keeps SM as the raw geometric count and plugs Basic (so it needs the HH
          // series). We replicate that here so the grey preview equals what the model uses.
          const svcFields = (section: string) => section === 'water_service'
            ? ['serv1_ts', 'serv2_ts', 'serv3_ts', 'serv4_ts', 'serv5_ts']
            : ['sserv1_ts', 'sserv2_ts', 'sserv3_ts', 'sserv4_ts', 'sserv5_ts'];
          // Projected total households at a year-offset (mirrors engine _project_hh): actuals are
          // hh_ts[:bi]; the baseline year and beyond are projected at the MEAN historical YoY growth.
          const hhSeries = inputs.population?.hh_ts || [];
          const hhProj = (() => {
            const act = hhSeries.slice(0, biSvc);                 // actuals through baseline−1
            if (act.length < 2) return null;
            const yoy: number[] = [];
            for (let i = 1; i < act.length; i++) if (act[i - 1] > 0) yoy.push(act[i] / act[i - 1] - 1);
            const g = yoy.length ? yoy.reduce((a, b) => a + b, 0) / yoy.length : 0;
            return { act, g };
          })();
          const totalHHAt = (t: number) => {
            if (!hhProj) return 0;
            const { act, g } = hhProj;
            return t < act.length ? act[t] : act[act.length - 1] * Math.pow(1 + g, t - (act.length - 1));
          };
          const histSvcPct = (section: string, rung0: number, t: number) => {
            if (biSvc <= 0) return 0;
            const fields = svcFields(section);
            const pctStart = fields.map(f => (inputs[section]?.[f] || [])[0] || 0);
            const pctBase = fields.map(f => (inputs[section]?.[f] || [])[biSvc] || 0);
            const hh0 = totalHHAt(0), hhB = totalHHAt(biSvc), hhT = totalHHAt(t);
            const haveHH = hh0 > 0 && hhB > 0 && hhT > 0;
            // Unadjusted count per rung: base0·(1+count-CAGR)^t, with the engine's guard (a rung
            // with a zero start or baseline % stays flat at its base0, no growth).
            const unadj = pctStart.map((ps, r) => {
              const pb = pctBase[r];
              const base0 = ps * (haveHH ? hh0 : 1);
              if (ps > 0 && pb > 0) {
                const ratio = haveHH ? (pb * hhB) / (ps * hh0) : pb / ps;
                return base0 * Math.pow(ratio, t / biSvc);
              }
              return base0;
            });
            const totalUnadj = unadj.reduce((a, b) => a + b, 0);
            const prop = (r: number) => totalUnadj > 0 ? unadj[r] / totalUnadj : 0;
            // Water (and sanitation fallback when the HH series is unavailable): proportional rescale.
            if (section === 'water_service' || !haveHH) return prop(rung0);
            // Sanitation: SM kept as raw geometric share, lower rungs proportional, Basic = plug.
            const smPct = unadj[0] / hhT;
            if (rung0 === 0) return smPct;
            if (rung0 === 2 || rung0 === 3 || rung0 === 4) return prop(rung0);
            return 1 - smPct - (prop(2) + prop(3) + prop(4));   // Basic
          };

          const svcCell = (section: string, field: string, idx: number) => {
            const yr = years[idx];
            const arr = inputs[section]?.[field] || [];
            if (yr === startYr2 || yr === baseYr2) {
              return tsInput(section, field, idx, arr[idx] || 0, true);
            }
            if (yr < baseYr2) {
              // Display only: recompute the engine's historical path LIVE from the current
              // start-year and baseline-year splits (and, for sanitation, the households series),
              // so it tracks edits to either endpoint and re-spans when the start/baseline YEARS
              // change — and matches what the model actually uses instead of a linear guess.
              const rung0 = parseInt(field.replace(/\D/g, ''), 10) - 1;
              const pct = histSvcPct(section, rung0, yr - startYr2);
              return grey((pct * 100).toFixed(1), 'Display only — follows the engine’s historical path (each rung’s count grows at its historical CAGR, then rescaled to total households), matching the model’s BAU block');
            }
            return grey('—', 'Forecast years are computed by the engine (BAU / targets)');
          };
          const svcRow = (label: string, section: string, field: string) => ({
            label, tip: 'Share of households at this service level. The model uses the START-year and BASELINE-year splits (editable); other years are display-only.',
            cells: years.map((_: number, i: number) => svcCell(section, field, i)),
          });

          // Section headers as row separators
          const sectionRow = (label: string) => ({ label, section: true as const, computed: false, cells: [] as React.ReactNode[] });

          const rows: { label: string; tip?: string; section?: boolean; computed?: boolean; cells: React.ReactNode[] }[] = [
            sectionRow('Economic'),
            ...(budgetMode === 'direct' ? [] : [
              { label: 'Nominal GDP ($B)', tip: 'GDP in current US dollars (billions). Enter historical + 5 hard forecast years; later years are the engine’s projection at the ongoing real growth rate.', cells: years.map((_: number, i: number) => hardCell('gdp_nominal_usd', i, false, 'Engine-projected (nominal USD $B) at the ongoing real GDP growth rate', 'gdp_nominal_usd', hardFcstEnd)) },
              { label: 'Nominal USD growth % (info)', tip: 'Year-on-year growth of the NOMINAL USD series (display only — the engine projects forecast years at the ongoing REAL growth rate)', computed: true, cells: years.map((_: number, i: number) => {
                const g = (i > 0 && gdpArr[i] && gdpArr[i-1] && gdpArr[i-1] !== 0) ? ((gdpArr[i]/gdpArr[i-1])-1)*100 : 0;
                return <span style={{ fontSize: 10, color: '#94a3b8' }}>{i > 0 && gdpArr[i] ? g.toFixed(1)+'%' : '—'}</span>;
              }) },
            ]),
            { label: `Infl ${cc.country || 'Domestic'} %`, tip: 'Annual local inflation. Hard values are editable; later years show the ongoing local inflation rate used by the engine.', cells: years.map((_: number, i: number) => hardCell('inflation_nepal', i, true, 'Ongoing local inflation rate (engine)', 'inflation_local', hardFcstEnd)) },
            { label: 'Infl US %', tip: 'Annual US inflation. Hard values are editable; later years show the ongoing US inflation rate used by the engine.', cells: years.map((_: number, i: number) => hardCell('inflation_us', i, true, 'Ongoing US inflation rate (engine)', 'inflation_us', hardFcstEnd)) },
            { label: `${CUR} per USD`, tip: 'Exchange rate: units of local currency per 1 US dollar. Enter ACTUALS through the year before baseline; the baseline year onward is the engine’s projection: FX[t] = FX[t−1] × (1+local infl)/(1+US infl).', cells: years.map((_: number, i: number) => {
              if (years[i] >= baseYr2) return projCell(resAt('exchange_rate', i), false, 'Engine-projected from the baseline year on: FX[t] = FX[t−1] × (1+local inflation)/(1+US inflation)');
              return hardCell('exchange_rate', i, false, 'Missing actual — supply values through baseline−1', undefined, baseYr2 - 1);
            }) },
            sectionRow('Demographic'),
            { label: `${scopeLabel} population (mill)`, tip: `Total ${scopeLower} population in MILLIONS — actuals through the year before baseline; the baseline year onward is the engine’s projection at mean historical growth`, cells: years.map((_: number, i: number) => {
              if (years[i] >= baseYr2) return projCell(resAt('population', i), false, 'Engine-projected at mean historical population growth from the baseline year on');
              return tsInput('population', 'pop_ts', i, (inputs.population?.pop_ts||[])[i]||0, false);
            }) },
            { label: 'Pop growth %', tip: 'Year-on-year population growth, auto-calculated', computed: true, cells: years.map((_: number, i: number) => {
              const at = (j: number) => (inputs.population?.pop_ts || [])[j] ?? resAt('population', j);
              const cur = at(i), prev = at(i - 1);
              const g = (i > 0 && cur && prev) ? ((cur/prev)-1)*100 : 0;
              return <span style={{ fontSize: 10, color: '#94a3b8' }}>{i > 0 && cur ? g.toFixed(1)+'%' : '—'}</span>;
            }) },
            { label: 'Households (mill)', tip: 'Total households in millions — actuals through the year before baseline; the baseline year onward is the engine’s projection at mean historical household growth (this series DRIVES the model)', cells: years.map((_: number, i: number) => {
              if (years[i] >= baseYr2) return projCell(resAt('total_hh', i), false, 'Engine-projected at mean historical household growth from the baseline year on');
              return tsInput('population', 'hh_ts', i, (inputs.population?.hh_ts||[])[i]||0, false);
            }) },
            { label: 'Avg HH size', tip: 'Average household size, auto-calculated: population (millions) ÷ households (millions)', computed: true, cells: years.map((_: number, i: number) => {
              const p = (inputs.population?.pop_ts||[])[i] ?? resAt('population', i) ?? 0;
              const h = (inputs.population?.hh_ts||[])[i] ?? resAt('total_hh', i) ?? 0;
              const sz = (h > 0 && p > 0) ? p / h : 0;
              return <span style={{ fontSize: 10, color: '#94a3b8' }}>{sz > 0 ? sz.toFixed(2) : '—'}</span>;
            }) },
            sectionRow(`Budget & Execution (${CUR} M, real / baseline prices)` + (budgetMode === 'pct_gdp' ? ' — capex allocated / actual are calculated (not editable)' : ' — “actual expenditure” drives the model')),
            { label: budgetMode === 'pct_gdp' ? 'WS capex allocated' : 'WS budget allocated', tip: budgetMode === 'pct_gdp' ? 'Calculated: allocated capex = “Water supply budget as % of GDP” × real GDP × “Capex share of WSS budget”. Not editable.' : 'Water supply budget allocated by government (reference only — used for the execution-rate display)', computed: budgetMode === 'pct_gdp', cells: years.map((_: number, i: number) => budgetCell('ws_budget_ts', 'water_supply', i, inputs.bau?.ws_budget_ongoing ?? 0.05)) },
            { label: budgetMode === 'pct_gdp' ? 'WS capex actual (drives model)' : '▶ WS actual expenditure (drives model)', tip: budgetMode === 'pct_gdp' ? 'Calculated: actual capex = allocated × budget execution rate. DRIVES the model. Not editable.' : 'The water budget actually spent (real terms) — DRIVES the model. Enter historical + 5 hard forecast years; grey → years grow at the ongoing water budget-growth rate.', computed: budgetMode === 'pct_gdp', cells: years.map((_: number, i: number) => spendCell('ws_expend_ts', inputs.bau?.ws_budget_ongoing ?? 0.05, i, 'water_supply')) },
            { label: 'WS execution rate', tip: budgetMode === 'pct_gdp' ? 'Budget execution rate (input above) — the share of allocated capex actually spent' : 'Budget execution rate: actual expenditure ÷ allocated budget', computed: true, cells: years.map((_: number, i: number) => {
              if (budgetMode === 'pct_gdp') return <span style={{ fontSize: 10, color: '#94a3b8' }}>{((inputs.macro?.execution_rate ?? 1) * 100).toFixed(0)+'%'}</span>;
              const b = (inputs.bau?.ws_budget_ts||[])[i]||0;
              const e = (inputs.bau?.ws_expend_ts||[])[i]||0;
              const r = (b > 0 && e > 0) ? (e/b)*100 : 0;
              return <span style={{ fontSize: 10, color: '#94a3b8' }}>{r > 0 ? r.toFixed(0)+'%' : '—'}</span>;
            }) },
            { label: budgetMode === 'pct_gdp' ? 'SAN capex allocated' : 'SAN budget allocated', tip: budgetMode === 'pct_gdp' ? 'Calculated: allocated capex = “Sanitation budget as % of GDP” × real GDP × “Capex share of WSS budget”. Not editable.' : 'Sanitation budget allocated by government (reference only — used for the execution-rate display)', computed: budgetMode === 'pct_gdp', cells: years.map((_: number, i: number) => budgetCell('san_budget_ts', 'sanitation', i, inputs.bau?.san_budget_ongoing ?? 0.05)) },
            { label: budgetMode === 'pct_gdp' ? 'SAN capex actual (drives model)' : '▶ SAN actual expenditure (drives model)', tip: budgetMode === 'pct_gdp' ? 'Calculated: actual capex = allocated × budget execution rate. DRIVES the model. Not editable.' : 'The sanitation budget actually spent (real terms) — DRIVES the model. Enter historical + 5 hard forecast years; grey → years grow at the ongoing sanitation budget-growth rate.', computed: budgetMode === 'pct_gdp', cells: years.map((_: number, i: number) => spendCell('san_expend_ts', inputs.bau?.san_budget_ongoing ?? 0.05, i, 'sanitation')) },
            { label: 'SAN execution rate', tip: budgetMode === 'pct_gdp' ? 'Budget execution rate (input above) — the share of allocated capex actually spent' : 'Budget execution rate: actual expenditure ÷ allocated budget', computed: true, cells: years.map((_: number, i: number) => {
              if (budgetMode === 'pct_gdp') return <span style={{ fontSize: 10, color: '#94a3b8' }}>{((inputs.macro?.execution_rate ?? 1) * 100).toFixed(0)+'%'}</span>;
              const b = (inputs.bau?.san_budget_ts||[])[i]||0;
              const e = (inputs.bau?.san_expend_ts||[])[i]||0;
              const r = (b > 0 && e > 0) ? (e/b)*100 : 0;
              return <span style={{ fontSize: 10, color: '#94a3b8' }}>{r > 0 ? r.toFixed(0)+'%' : '—'}</span>;
            }) },
            sectionRow(`${scopeLabel} water service levels (% HH)`),
            svcRow(`% ${ws[0]}`, 'water_service', 'serv1_ts'),
            svcRow(`% ${ws[1]}`, 'water_service', 'serv2_ts'),
            svcRow(`% ${ws[2]}`, 'water_service', 'serv3_ts'),
            svcRow(`% ${ws[3]}`, 'water_service', 'serv4_ts'),
            svcRow(`% ${ws[4]}`, 'water_service', 'serv5_ts'),
            sectionRow(`${scopeLabel} sanitation service levels (% HH)`),
            svcRow(`% ${ss[0]}`, 'sanitation_service', 'sserv1_ts'),
            svcRow(`% ${ss[1]}`, 'sanitation_service', 'sserv2_ts'),
            svcRow(`% ${ss[2]}`, 'sanitation_service', 'sserv3_ts'),
            svcRow(`% ${ss[3]}`, 'sanitation_service', 'sserv4_ts'),
            svcRow(`% ${ss[4]}`, 'sanitation_service', 'sserv5_ts'),
          ];
          return (
            <div style={{ gridColumn: '1 / -1', overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '4px 8px', textAlign: 'left', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 1, minWidth: 150 }}></th>
                    {years.map((yr: number) => (
                      <th key={yr} style={{ padding: '4px 4px', textAlign: 'center', fontSize: 10, fontWeight: yr > baseYr2 ? 600 : 500, color: yr > baseYr2 ? '#f59e0b' : '#334155', minWidth: 62 }}>
                        {yr}{yr > baseYr2 && <span style={{ fontSize: 7, verticalAlign: 'super' }}>F</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => row.section ? (
                    <tr key={ri} style={{ background: '#e0e7ff' }}>
                      <td colSpan={years.length + 1} style={{ padding: '5px 8px', fontWeight: 700, fontSize: 11, color: '#312e81', position: 'sticky', left: 0, background: '#e0e7ff', zIndex: 1 }}>
                        {row.label}
                      </td>
                    </tr>
                  ) : (
                    <tr key={ri} style={{ background: ri % 2 ? '#fafbfc' : '#fff' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 600, fontSize: 11, color: row.computed ? '#94a3b8' : '#1e3a5f', position: 'sticky', left: 0, background: ri % 2 ? '#fafbfc' : '#fff', zIndex: 1, whiteSpace: 'nowrap' }} title={row.tip || undefined}>
                        {row.label}
                        {row.tip && <span style={{
                          width: 14, height: 14, borderRadius: '50%', marginLeft: 5,
                          background: '#C2CBD6', color: '#fff', fontSize: 10, display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center', cursor: 'help', verticalAlign: 'middle',
                          fontStyle: 'italic', fontFamily: 'Georgia, serif', fontWeight: 700,
                        }} title={row.tip}>i</span>}
                      </td>
                      {row.cells.map((cell, ci) => (
                        <td key={ci} style={{ padding: '2px 2px', textAlign: 'center' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </Section>

      </>}

      {(isBAU || isInputs) && <>
      {/* Sector toggle for BAU */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['water', 'sanitation'] as const).map(s => (
          <button key={s} onClick={() => setBauSector(s)} style={{
            flex: 1, padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer',
            background: bauSector === s ? '#2563eb' : '#e5e7eb',
            color: bauSector === s ? '#fff' : '#374151', fontWeight: 600, fontSize: 13,
          }}>{s === 'water' ? 'Water Supply' : 'Sanitation'}</button>
        ))}
      </div>

      {/* ===== TARGETS (sector-dependent) ===== */}
      {bauSector === 'water' && (
      <Section title={`3. ${scopeLabel} Water Supply Targets`} cols={2} sectionKey="ws_targets" onFocus={onSectionFocus}>
        <SubHead text="Service Targets" />
        <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b', marginBottom: 6, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          Number of HHs per level calculated automatically from population
        </div>
        <SubHead text="Target 1 (2030)" />
        {(() => { const s = (inputs.water_targets.target1_serv1||0)+(inputs.water_targets.target1_serv2||0)+(inputs.water_targets.target1_serv3||0)+(inputs.water_targets.target1_serv4||0)+(inputs.water_targets.target1_serv5||0); const bad = Math.abs(s-1)>0.005; return <div style={{ gridColumn: '1 / -1', fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>{bad ? `These shares add up to ${Math.round(s*10000)/100}% — they should total 100%.` : 'These shares add up to 100%. ✓'}</div>; })()}
        <F label={`% ${ws[0]}`} value={inputs.water_targets.target1_serv1} onChange={v => u('water_targets','target1_serv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[1]}`} value={inputs.water_targets.target1_serv2} onChange={v => u('water_targets','target1_serv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[2]}`} value={inputs.water_targets.target1_serv3} onChange={v => u('water_targets','target1_serv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[3]}`} value={inputs.water_targets.target1_serv4} onChange={v => u('water_targets','target1_serv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[4]}`} value={inputs.water_targets.target1_serv5} onChange={v => u('water_targets','target1_serv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <SubHead text="Target 2 (2040)" />
        {(() => { const s = (inputs.water_targets.target2_serv1||0)+(inputs.water_targets.target2_serv2||0)+(inputs.water_targets.target2_serv3||0)+(inputs.water_targets.target2_serv4||0)+(inputs.water_targets.target2_serv5||0); const bad = Math.abs(s-1)>0.005; return <div style={{ gridColumn: '1 / -1', fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>{bad ? `These shares add up to ${Math.round(s*10000)/100}% — they should total 100%.` : 'These shares add up to 100%. ✓'}</div>; })()}
        <F label={`% ${ws[0]}`} value={inputs.water_targets.target2_serv1} onChange={v => u('water_targets','target2_serv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[1]}`} value={inputs.water_targets.target2_serv2} onChange={v => u('water_targets','target2_serv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[2]}`} value={inputs.water_targets.target2_serv3} onChange={v => u('water_targets','target2_serv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[3]}`} value={inputs.water_targets.target2_serv4} onChange={v => u('water_targets','target2_serv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[4]}`} value={inputs.water_targets.target2_serv5} onChange={v => u('water_targets','target2_serv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
      </Section>
      )}

      {bauSector === 'sanitation' && (
      <Section title={`3. ${scopeLabel} Sanitation Targets`} cols={2} sectionKey="san_targets" onFocus={onSectionFocus}>
        <SubHead text="Service Targets" />
        <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b', marginBottom: 6, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          Number of HHs per level calculated automatically from population
        </div>
        <SubHead text="Target 1 (2030)" />
        {(() => { const s = (inputs.sanitation_targets.target1_sserv1||0)+(inputs.sanitation_targets.target1_sserv2||0)+(inputs.sanitation_targets.target1_sserv3||0)+(inputs.sanitation_targets.target1_sserv4||0)+(inputs.sanitation_targets.target1_sserv5||0); const bad = Math.abs(s-1)>0.005; return <div style={{ gridColumn: '1 / -1', fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>{bad ? `These shares add up to ${Math.round(s*10000)/100}% — they should total 100%.` : 'These shares add up to 100%. ✓'}</div>; })()}
        <F label={`% ${ss[0]}`} value={inputs.sanitation_targets.target1_sserv1} onChange={v => u('sanitation_targets','target1_sserv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[1]}`} value={inputs.sanitation_targets.target1_sserv2} onChange={v => u('sanitation_targets','target1_sserv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[2]}`} value={inputs.sanitation_targets.target1_sserv3} onChange={v => u('sanitation_targets','target1_sserv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[3]}`} value={inputs.sanitation_targets.target1_sserv4} onChange={v => u('sanitation_targets','target1_sserv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[4]}`} value={inputs.sanitation_targets.target1_sserv5} onChange={v => u('sanitation_targets','target1_sserv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <SubHead text="Target 2 (2040)" />
        {(() => { const s = (inputs.sanitation_targets.target2_sserv1||0)+(inputs.sanitation_targets.target2_sserv2||0)+(inputs.sanitation_targets.target2_sserv3||0)+(inputs.sanitation_targets.target2_sserv4||0)+(inputs.sanitation_targets.target2_sserv5||0); const bad = Math.abs(s-1)>0.005; return <div style={{ gridColumn: '1 / -1', fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>{bad ? `These shares add up to ${Math.round(s*10000)/100}% — they should total 100%.` : 'These shares add up to 100%. ✓'}</div>; })()}
        <F label={`% ${ss[0]}`} value={inputs.sanitation_targets.target2_sserv1} onChange={v => u('sanitation_targets','target2_sserv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[1]}`} value={inputs.sanitation_targets.target2_sserv2} onChange={v => u('sanitation_targets','target2_sserv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[2]}`} value={inputs.sanitation_targets.target2_sserv3} onChange={v => u('sanitation_targets','target2_sserv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[3]}`} value={inputs.sanitation_targets.target2_sserv4} onChange={v => u('sanitation_targets','target2_sserv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[4]}`} value={inputs.sanitation_targets.target2_sserv5} onChange={v => u('sanitation_targets','target2_sserv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
      </Section>
      )}

      {/* ===== UNIT COSTS (sector-dependent) ===== */}
      {bauSector === 'water' && (
      <Section title={`4. ${scopeLabel} Water Supply Unit Costs`} cols={2} sectionKey="ws_unit_costs" onFocus={onSectionFocus}>
        <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#475569', padding: '4px 8px', background: '#f0f9ff', borderRadius: 4, border: '1px solid #bae6fd' }}>
          The validated BAU engine uses the <b>{ws[0]}</b> and <b>{ws[1]}</b> weighted costs — build them from the technology mixes below (also editable on the <b>Test Harness</b> tab; both edit the same data).
        </div>
        <SubHead text="Distribution network cost per HH" />
        <F label={ws[0]} value={inputs.water_costs.network_cost_per_hh_serv1} onChange={v => setUnitCost('water_costs','network_cost_per_hh_serv1','sm',v)} step={1000} unit={CUR} min={0} max={10000000} integer tip="Capital cost to connect one HH to the distribution network. Costs are for the baseline year. Editing this rescales the technology mix below to match." />
        <F label={ws[1]} value={inputs.water_costs.network_cost_per_hh_serv2} onChange={v => setUnitCost('water_costs','network_cost_per_hh_serv2','basic',v)} step={1000} unit={CUR} min={0} max={10000000} integer tip="Capital cost to connect one HH to the distribution network. Costs are for the baseline year. Editing this rescales the technology mix below to match." />
        {renderCostMix('water_costs', 'sm', 'network_cost_per_hh_serv1', ws[0])}
        {renderCostMix('water_costs', 'basic', 'network_cost_per_hh_serv2', ws[1])}
      </Section>
      )}

      {bauSector === 'sanitation' && (
      <Section title={`4. ${scopeLabel} Sanitation Unit Costs`} cols={2} sectionKey="san_unit_costs" onFocus={onSectionFocus}>
        <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#475569', padding: '4px 8px', background: '#f0f9ff', borderRadius: 4, border: '1px solid #bae6fd' }}>
          The validated BAU engine uses the <b>{ss[0]}</b> and <b>{ss[1]}</b> weighted costs — build them from the technology mixes below (also editable on the <b>Test Harness</b> tab; both edit the same data).
        </div>
        <SubHead text="Sewerage cost per HH" />
        <F label={ss[0]} value={inputs.sanitation_costs.sewer_cost_per_hh_sserv1} onChange={v => setUnitCost('sanitation_costs','sewer_cost_per_hh_sserv1','sm',v)} step={1000} unit={CUR} min={0} max={10000000} integer tip="Capital cost to connect one HH to sewer network + house connection. Costs are for the baseline year. Editing this rescales the technology mix below to match." />
        <F label={ss[1]} value={inputs.sanitation_costs.sewer_cost_per_hh_sserv2} onChange={v => setUnitCost('sanitation_costs','sewer_cost_per_hh_sserv2','basic',v)} step={1000} unit={CUR} min={0} max={10000000} integer tip="Capital cost to connect one HH to sewer network + house connection. Costs are for the baseline year. Editing this rescales the technology mix below to match." />
        {renderCostMix('sanitation_costs', 'sm', 'sewer_cost_per_hh_sserv1', ss[0])}
        {renderCostMix('sanitation_costs', 'basic', 'sewer_cost_per_hh_sserv2', ss[1])}
      </Section>
      )}

      {/* ===== TECHNICAL (sector-dependent) ===== */}
      {bauSector === 'water' && (
      <Section title={`5. ${scopeLabel} Water Supply Technical Parameters`} cols={2} sectionKey="ws_technical" onFocus={onSectionFocus}>
        <F label="Useful life of assets" value={inputs.technical.ws_asset_life} onChange={v => u('technical','ws_asset_life',v)} unit="yrs" min={5} max={100} tip="Expected useful life of infrastructure assets — drives the replacement (depreciation) capex." />
        <F label="% water sold to non-household" value={inputs.technical.ws_non_hh_pct || 0} onChange={v => u('technical','ws_non_hh_pct',v)} isPercent unit="%" tip="Share of water sold to non-household customers (commercial, industrial, institutional) — scales the total capex above the household capex." />
        <SubHead text="Non-revenue water — feeds the BAU new-capex adder" />
        <F label="Treatment cost as % of capex" value={inputs.water_interventions?.nrw_treatment_cost_pct_capex ?? 0.4} onChange={v => u('water_interventions','nrw_treatment_cost_pct_capex',v)} isPercent unit="%" tip="Workbook G173 — part of the 4d new-capex adder: cost × (treat% × NRW% × physical%)" />
        <F label="Current NRW" value={inputs.water_interventions?.nrw_current_pct ?? 0.4} onChange={v => u('water_interventions','nrw_current_pct',v)} isPercent unit="%" tip="Workbook G174 — non-revenue water as share of water produced" />
        <F label="Physical losses as % of NRW" value={inputs.water_interventions?.nrw_physical_loss_pct ?? 0.5} onChange={v => u('water_interventions','nrw_physical_loss_pct',v)} isPercent unit="%" tip="Workbook G175 — physical (leakage) share of total NRW" />
      </Section>
      )}

      {bauSector === 'sanitation' && (
      <Section title={`5. ${scopeLabel} Sanitation Technical Parameters`} cols={2} sectionKey="san_technical" onFocus={onSectionFocus}>
        <F label="Useful life of assets" value={inputs.technical.san_asset_life} onChange={v => u('technical','san_asset_life',v)} unit="yrs" min={5} max={100} tip="Expected useful life of infrastructure assets — drives the replacement (depreciation) capex." />
        <F label="% wastewater from non-household" value={inputs.technical.san_non_hh_pct || 0} onChange={v => u('technical','san_non_hh_pct',v)} isPercent unit="%" tip="Share of wastewater from non-household sources (commercial, industrial, institutional) — scales the total capex above the household capex." />
      </Section>
      )}
      </>}

      {isInterventions && <>
      {/* ===== WATER INTERVENTIONS ===== */}
      <Section title="7. Water Supply Interventions" cols={2} sectionKey="ws_interventions" onFocus={onSectionFocus}>
        <SubHead text="Collection efficiency" />
        <F label="Start year" value={inputs.water_interventions.ce_start_year} onChange={v => u('water_interventions','ce_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year the intervention begins; must be after baseline" />
        <F label="Target year" value={inputs.water_interventions.ce_target_year} onChange={v => u('water_interventions','ce_target_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year the target is fully achieved; must be after start year" />
        <F label="Current collection ratio" value={inputs.water_interventions.ce_current_ratio} onChange={v => u('water_interventions','ce_current_ratio',v)} isPercent unit="%" tip="Fraction of billed amounts actually collected" />
        <F label="Target collection ratio" value={inputs.water_interventions.ce_target_ratio} onChange={v => u('water_interventions','ce_target_ratio',v)} isPercent unit="%" tip="Fraction of billed amounts actually collected" />
        <F label="Total water supply volume sold" value={inputs.water_interventions.ce_water_sold_mld} onChange={v => u('water_interventions','ce_water_sold_mld',v)} unit="MLD" min={0} max={10000} tip="Total water supply volume sold in MLD" />
        <F label="Current average water tariff" value={inputs.water_interventions.ce_current_tariff} onChange={v => u('water_interventions','ce_current_tariff',v)} unit={CUR} min={0} max={1000} tip={`Average water tariff in ${CUR} per cubic meter`} />

        <SubHead text="NRW reduction" />
        <F label="Start year" value={inputs.water_interventions.nrw_start_year} onChange={v => u('water_interventions','nrw_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year the NRW reduction begins; must be after baseline" />
        <F label="Target year" value={inputs.water_interventions.nrw_target_year} onChange={v => u('water_interventions','nrw_target_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year the NRW target is fully achieved; must be after start year" />
        <F label="Current NRW %" value={inputs.water_interventions.nrw_current_pct} onChange={v => u('water_interventions','nrw_current_pct',v)} isPercent unit="%" tip="Non-revenue water as share of total water produced" />
        <F label="Target NRW %" value={inputs.water_interventions.nrw_target_pct} onChange={v => u('water_interventions','nrw_target_pct',v)} isPercent unit="%" min={0.03} max={1.0} tip="Minimum 3% — even best-performing utilities globally cannot eliminate NRW below ~3% due to unavoidable physical losses" />
        {(() => {
          const t = inputs.water_interventions.nrw_target_pct || 0;
          if (t > 0 && t < 0.03) return <div style={{ fontSize: 10, fontWeight: 600, color: '#dc2626', padding: '3px 8px', background: '#fef2f2', borderRadius: 4, marginBottom: 4 }}>⛔ Below 3% is unrealistic — no utility globally achieves NRW below ~3%</div>;
          if (t >= 0.03 && t < 0.07) return <div style={{ fontSize: 10, fontWeight: 600, color: '#92400e', padding: '3px 8px', background: '#fef3c7', borderRadius: 4, marginBottom: 4 }}>⚠ 3–7% is highly ambitious — only top-performing utilities (Singapore, Tokyo) achieve this range</div>;
          return null;
        })()}
        <F label="Commercial losses as % of NRW" value={inputs.water_interventions.nrw_commercial_loss_pct} onChange={v => u('water_interventions','nrw_commercial_loss_pct',v)} isPercent unit="%" tip="Commercial (non-physical) losses as share of total NRW; commercial + physical must sum to 100%" />
        <F label="Physical losses as % of NRW" value={inputs.water_interventions.nrw_physical_loss_pct || 0} onChange={v => u('water_interventions','nrw_physical_loss_pct',v)} isPercent unit="%" tip="Physical losses as share of total NRW; commercial + physical must sum to 100%" />
        <F label="Capex unit cost NRW reduction (USD)" value={inputs.water_interventions.nrw_capex_unit_cost_usd} onChange={v => u('water_interventions','nrw_capex_unit_cost_usd',v)} step={10} unit="USD" min={0} max={10000} tip="Cost to reduce NRW by one unit (USD per m3/day)" />
        <F label="Lag between Capex and improvement" value={inputs.water_interventions.nrw_lag_years} onChange={v => u('water_interventions','nrw_lag_years',v)} unit="yrs" min={0} max={5} tip="Years between NRW investment and realized improvement" />
        <F label="Year of maintenance capex" value={inputs.water_interventions.nrw_maintenance_capex_year || 0} onChange={v => u('water_interventions','nrw_maintenance_capex_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year when maintenance capital expenditure occurs" />
        <F label={`Maintenance capex (${CUR} mill)`} value={inputs.water_interventions.nrw_maintenance_capex || 0} onChange={v => u('water_interventions','nrw_maintenance_capex',v)} step={10} unit={`${CUR} M`} min={0} max={1000000} tip="Maintenance capital expenditure amount" />

        <SubHead text="Capital efficiency" />
        <F label="Start year" value={inputs.water_interventions.capeff_start_year} onChange={v => u('water_interventions','capeff_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year capital efficiency gains begin; must be after baseline" />
        <F label="Efficiency gains" value={inputs.water_interventions.capeff_gains_pct} onChange={v => u('water_interventions','capeff_gains_pct',v)} isPercent unit="%" tip="Reduction in unit cost from better procurement/management; typically 10-30%" />

        <SubHead text="Tariff increase" />
        <F label="Start year" value={inputs.water_interventions.tariff_start_year} onChange={v => u('water_interventions','tariff_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year the tariff reform begins; must be after baseline" />
        <F label="Target year" value={inputs.water_interventions.tariff_target_year} onChange={v => u('water_interventions','tariff_target_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year the tariff target is achieved; must be after start year" />
        <F label="Monthly income bottom 20%" value={inputs.water_interventions.tariff_monthly_income_bottom20} onChange={v => u('water_interventions','tariff_monthly_income_bottom20',v)} step={100} unit={CUR} min={0} max={10000000} tip="Monthly income of bottom 20% of population" />
        <F label="Max % income on water" value={inputs.water_interventions.tariff_max_pct_income_water} onChange={v => u('water_interventions','tariff_max_pct_income_water',v)} isPercent unit="%" tip="Maximum affordable share of household income for water" />
        <F label="Current operating revenue" value={inputs.water_interventions.tariff_op_revenue || 0} onChange={v => u('water_interventions','tariff_op_revenue',v)} step={1000000} unit={CUR} min={0} max={10000000} tip="Annual operating revenue" />
        <F label="Current operating expenditure" value={inputs.water_interventions.tariff_op_expenditure || 0} onChange={v => u('water_interventions','tariff_op_expenditure',v)} step={1000000} unit={CUR} min={0} max={10000000} tip="Annual operating expenditure" />
        <F label="Current O&M recovery ratio (calculated)" value={(inputs.water_interventions.tariff_op_revenue && inputs.water_interventions.tariff_op_expenditure) ? inputs.water_interventions.tariff_op_revenue / inputs.water_interventions.tariff_op_expenditure : 0} onChange={() => {}} fieldType="computed" step={0.01} min={0} max={10} tip="Current ratio of operating revenue to operating expenditure (live calculated: revenue / expenditure)" />
        <F label="O&M cost recovery target" value={inputs.water_interventions.tariff_om_recovery_target} onChange={v => u('water_interventions','tariff_om_recovery_target',v)} step={0.1} min={0} max={10} tip="Target ratio of operating revenue to operating expenditure" />

        <SubHead text="Borrowing against future cashflow" />
        <F label="Start year" value={inputs.water_interventions.loan_start_year} onChange={v => u('water_interventions','loan_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year borrowing begins; must be after baseline" />
        <F label="End year" value={inputs.water_interventions.loan_end_year} onChange={v => u('water_interventions','loan_end_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year borrowing ends; must be after start year" />
        <F label="Avg cost per water produced" value={inputs.water_interventions.loan_avg_cost} onChange={v => u('water_interventions','loan_avg_cost',v)} step={0.1} min={0} max={10000} tip="Average cost per unit of water produced (per m3)" />
        <F label="DSCR surplus" value={inputs.water_interventions.loan_dscr} onChange={v => u('water_interventions','loan_dscr',v)} step={0.1} min={0} max={10} tip="Debt service coverage ratio target for loan eligibility" />
        <F label="Repayment grace period" value={inputs.water_interventions.loan_grace_years} onChange={v => u('water_interventions','loan_grace_years',v)} unit="yrs" min={0} max={100} tip="Number of years before loan repayment begins" />
        <F label="Tenor" value={inputs.water_interventions.loan_tenor} onChange={v => u('water_interventions','loan_tenor',v)} unit="yrs" min={0} max={100} tip="Total loan repayment period in years" />
        <F label="Interest rate" value={inputs.water_interventions.loan_interest_rate} onChange={v => u('water_interventions','loan_interest_rate',v)} isPercent unit="%" tip="Annual interest rate on borrowed funds" />
        <F label="Year of investment" value={inputs.water_interventions.loan_investment_year || 0} onChange={v => u('water_interventions','loan_investment_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Specific year in which loan proceeds are invested" />

        <SubHead text="Budget execution improvement" />
        <F label="Start year" value={inputs.water_interventions.budget_exec_start_year || 0} onChange={v => u('water_interventions','budget_exec_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year budget execution improvement begins" />
        <F label="Current execution rate (calculated)" value={inputs.water_interventions.budget_exec_current_rate || 0} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Current budget execution rate (computed from historical data)" />
        <F label="Target execution rate" value={inputs.water_interventions.budget_exec_target_rate || 0} onChange={v => u('water_interventions','budget_exec_target_rate',v)} isPercent unit="%" tip="Target budget execution rate" />
      </Section>

      {/* ===== SANITATION INTERVENTIONS ===== */}
      <Section title="8. Sanitation Interventions" cols={2} sectionKey="san_interventions" onFocus={onSectionFocus}>
        <SubHead text="Collection efficiency" />
        <F label="Start year" value={inputs.sanitation_interventions.ce_start_year} onChange={v => u('sanitation_interventions','ce_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year the intervention begins; must be after baseline" />
        <F label="Target year" value={inputs.sanitation_interventions.ce_target_year} onChange={v => u('sanitation_interventions','ce_target_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year the target is fully achieved; must be after start year" />
        <F label="Sewer tariff as % of water tariff" value={inputs.sanitation_interventions.ce_sewer_tariff_pct_water} onChange={v => u('sanitation_interventions','ce_sewer_tariff_pct_water',v)} isPercent unit="%" tip="Sewer tariff as percentage of water tariff" />

        <SubHead text="Capital efficiency" />
        <F label="Start year" value={inputs.sanitation_interventions.capeff_start_year} onChange={v => u('sanitation_interventions','capeff_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year capital efficiency gains begin; must be after baseline" />
        <F label="Efficiency gains" value={inputs.sanitation_interventions.capeff_gains_pct} onChange={v => u('sanitation_interventions','capeff_gains_pct',v)} isPercent unit="%" tip="Reduction in unit cost from better procurement/management; typically 10-30%" />

        <SubHead text="Tariff increase" />
        <F label="Start year" value={inputs.sanitation_interventions.tariff_start_year} onChange={v => u('sanitation_interventions','tariff_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year the tariff reform begins; must be after baseline" />
        <F label="Target year" value={inputs.sanitation_interventions.tariff_target_year} onChange={v => u('sanitation_interventions','tariff_target_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year the tariff target is achieved; must be after start year" />
        <F label="Max % income on sanitation" value={inputs.sanitation_interventions.tariff_max_pct_income_san} onChange={v => u('sanitation_interventions','tariff_max_pct_income_san',v)} isPercent unit="%" tip="Maximum affordable share of household income for sanitation" />
        <F label="Tariff real growth rate" value={inputs.sanitation_interventions.san_tariff_growth_rate} onChange={v => u('sanitation_interventions','san_tariff_growth_rate',v)} isPercent unit="%" tip="Annual real growth rate of sanitation tariff" />
        <F label="Current operating revenue" value={inputs.sanitation_interventions.tariff_op_revenue || 0} onChange={v => u('sanitation_interventions','tariff_op_revenue',v)} step={1000000} unit={CUR} min={0} max={10000000} tip="Annual sanitation operating revenue" />
        <F label="Current operating expenditure" value={inputs.sanitation_interventions.tariff_op_expenditure || 0} onChange={v => u('sanitation_interventions','tariff_op_expenditure',v)} step={1000000} unit={CUR} min={0} max={10000000} tip="Annual sanitation operating expenditure" />
        <F label="Current O&M recovery ratio (calculated)" value={(inputs.sanitation_interventions.tariff_op_revenue && inputs.sanitation_interventions.tariff_op_expenditure) ? inputs.sanitation_interventions.tariff_op_revenue / inputs.sanitation_interventions.tariff_op_expenditure : 0} onChange={() => {}} fieldType="computed" step={0.01} min={0} max={10} tip="Current ratio of operating revenue to operating expenditure (live calculated: revenue / expenditure)" />
        <F label="O&M recovery target" value={inputs.sanitation_interventions.tariff_om_recovery_target} onChange={v => u('sanitation_interventions','tariff_om_recovery_target',v)} step={0.1} min={0} max={10} tip="Target ratio of operating revenue to operating expenditure" />

        <SubHead text="Borrowing against future cashflow" />
        <F label="Start year" value={inputs.sanitation_interventions.loan_start_year} onChange={v => u('sanitation_interventions','loan_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year borrowing begins; must be after baseline" />
        <F label="End year" value={inputs.sanitation_interventions.loan_end_year} onChange={v => u('sanitation_interventions','loan_end_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year borrowing ends; must be after start year" />
        <F label="Avg cost per wastewater billed" value={inputs.sanitation_interventions.loan_avg_cost} onChange={v => u('sanitation_interventions','loan_avg_cost',v)} step={0.1} min={0} max={10000} tip="Average cost per unit of wastewater billed (per m3)" />
        <F label="DSCR surplus" value={inputs.sanitation_interventions.loan_dscr} onChange={v => u('sanitation_interventions','loan_dscr',v)} step={0.1} min={0} max={10} tip="Debt service coverage ratio target for loan eligibility" />
        <F label="Repayment grace period" value={inputs.sanitation_interventions.loan_grace_years} onChange={v => u('sanitation_interventions','loan_grace_years',v)} unit="yrs" min={0} max={100} tip="Number of years before loan repayment begins" />
        <F label="Tenor" value={inputs.sanitation_interventions.loan_tenor} onChange={v => u('sanitation_interventions','loan_tenor',v)} unit="yrs" min={0} max={100} tip="Total loan repayment period in years" />
        <F label="Interest rate" value={inputs.sanitation_interventions.loan_interest_rate} onChange={v => u('sanitation_interventions','loan_interest_rate',v)} isPercent unit="%" tip="Annual interest rate on borrowed funds" />
        <F label="Year of investment" value={inputs.sanitation_interventions.loan_investment_year || 0} onChange={v => u('sanitation_interventions','loan_investment_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Specific year in which loan proceeds are invested" />

        <SubHead text="Budget execution improvement" />
        <F label="Start year" value={inputs.sanitation_interventions.budget_exec_start_year || 0} onChange={v => u('sanitation_interventions','budget_exec_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year budget execution improvement begins" />
        <F label="Current execution rate (calculated)" value={inputs.sanitation_interventions.budget_exec_current_rate || 0} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Current budget execution rate (computed from historical data)" />
        <F label="Target execution rate" value={inputs.sanitation_interventions.budget_exec_target_rate || 0} onChange={v => u('sanitation_interventions','budget_exec_target_rate',v)} isPercent unit="%" tip="Target budget execution rate" />

        <SubHead text="Microfinance for on-site sanitation" />
        <F label="Start year" value={inputs.sanitation_interventions.mf_start_year || 0} onChange={v => u('sanitation_interventions','mf_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year microfinance program begins" />
        <F label="End year" value={inputs.sanitation_interventions.mf_end_year || 0} onChange={v => u('sanitation_interventions','mf_end_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year microfinance program ends" />
        <F label={`Cost of on-site facility (${CUR})`} value={inputs.sanitation_interventions.mf_onsite_cost || 0} onChange={v => u('sanitation_interventions','mf_onsite_cost',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost of on-site sanitation facility being financed" />
        <F label="Nominal interest rate" value={inputs.sanitation_interventions.mf_interest_rate || 0} onChange={v => u('sanitation_interventions','mf_interest_rate',v)} isPercent unit="%" tip="Nominal annual interest rate on microfinance loans" />
        <F label="Tenor" value={inputs.sanitation_interventions.mf_tenor || 0} onChange={v => u('sanitation_interventions','mf_tenor',v)} unit="yrs" min={0} max={30} tip="Loan repayment period for microfinance" />
        <F label={`Cost of collection & emptying (${CUR})`} value={inputs.sanitation_interventions.mf_collection_cost || 0} onChange={v => u('sanitation_interventions','mf_collection_cost',v)} step={500} unit={CUR} min={0} max={10000000} tip="Annual cost of fecal sludge collection and emptying per household" />
        <F label="Emptying frequency" value={inputs.sanitation_interventions.mf_emptying_frequency || 0} onChange={v => u('sanitation_interventions','mf_emptying_frequency',v)} unit="yrs" min={0} max={20} tip="Average years between emptying of on-site containment" />
        <F label="Max % household income on sanitation" value={inputs.sanitation_interventions.mf_max_pct_income || 0} onChange={v => u('sanitation_interventions','mf_max_pct_income',v)} isPercent unit="%" tip="Maximum affordable share of household income for sanitation" />
        <F label="Adoption rate" value={inputs.sanitation_interventions.mf_adoption_rate || 0} onChange={v => u('sanitation_interventions','mf_adoption_rate',v)} isPercent unit="%" tip="Share of eligible households that take up microfinance" />
      </Section>

      {/* ===== CUSTOM INTERVENTIONS ===== */}
      <Section title="9. Custom Interventions" cols={2} sectionKey="custom_interventions" onFocus={onSectionFocus}>
        {(inputs.custom_interventions || []).map((ci: any, idx: number) => {
          const updateCI = (field: string, val: any) => {
            const arr = [...inputs.custom_interventions];
            arr[idx] = { ...arr[idx], [field]: val };
            onChange({ ...inputs, custom_interventions: arr });
          };
          return (
            <div key={idx} style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', marginBottom: 8, background: '#faf5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <input type="color" value={ci.color || '#9333ea'} onChange={e => updateCI('color', e.target.value)}
                  style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', borderRadius: 3 }} />
                <input type="text" value={ci.name} onChange={e => updateCI('name', e.target.value)}
                  style={{ flex: 1, border: '1px solid #ccc', borderRadius: 3, padding: '3px 6px', fontSize: 12, fontWeight: 600 }} />
                <Toggle label="" checked={ci.enabled} onChange={v => updateCI('enabled', v)} />
                <button onClick={() => {
                  const arr = inputs.custom_interventions.filter((_: any, i: number) => i !== idx);
                  onChange({ ...inputs, custom_interventions: arr });
                }} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: '#64748b' }}>Sector</label>
                  <select value={ci.sector} onChange={e => updateCI('sector', e.target.value)}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 10, background: '#fff', color: '#333', cursor: 'pointer' }}>
                    <option value="water">Water Supply</option>
                    <option value="sanitation">Sanitation</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: '#64748b' }}>Type</label>
                  <select value={ci.intervention_type} onChange={e => updateCI('intervention_type', e.target.value)}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4, fontSize: 10, background: '#fff', color: '#333', cursor: 'pointer' }}>
                    <option value="fixed_annual">Fixed Annual Amount</option>
                    <option value="revenue_stream">Revenue Stream (growing)</option>
                    <option value="per_hh_subsidy">Per-HH Subsidy</option>
                  </select>
                </div>
              </div>
              <F label="Start year" value={ci.start_year} onChange={v => updateCI('start_year', v)}
                min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year this intervention begins" />
              <F label="End year" value={ci.end_year} onChange={v => updateCI('end_year', v)}
                min={ci.start_year} max={inputs.period.forecast_end_year} tip="Year this intervention ends" />
              {ci.intervention_type === 'fixed_annual' && (
                <F label={`Annual amount (${CUR} mill)`} value={ci.annual_amount} onChange={v => updateCI('annual_amount', v)}
                  step={100} min={0} max={1000000} tip="Fixed annual cash amount in currency millions" />
              )}
              {ci.intervention_type === 'revenue_stream' && (<>
                <F label={`Starting amount (${CUR} mill)`} value={ci.starting_amount} onChange={v => updateCI('starting_amount', v)}
                  step={100} min={0} max={1000000} tip="Revenue in the first year, in currency millions" />
                <F label="Annual growth rate" value={ci.growth_rate} onChange={v => updateCI('growth_rate', v)}
                  isPercent unit="%" tip="Annual growth rate of the revenue stream" />
              </>)}
              {ci.intervention_type === 'per_hh_subsidy' && (
                <F label={`Subsidy per HH (${CUR})`} value={ci.subsidy_per_hh} onChange={v => updateCI('subsidy_per_hh', v)}
                  step={1000} min={0} max={10000000} tip="Cost subsidy per household connected" />
              )}
            </div>
          );
        })}
        <button onClick={() => {
          const existing = inputs.custom_interventions || [];
          const colors = ['#9333ea','#f97316','#06b6d4','#84cc16','#f43f5e'];
          const newCI = {
            name: 'New Intervention', enabled: true, sector: 'water', intervention_type: 'fixed_annual',
            start_year: inputs.period.baseline_year + 3, end_year: inputs.period.baseline_year + 7,
            annual_amount: 1000, starting_amount: 500, growth_rate: 0.05, subsidy_per_hh: 10000,
            color: colors[existing.length % colors.length],
          };
          onChange({ ...inputs, custom_interventions: [...existing, newCI] });
        }} style={{ width: '100%', padding: '6px', border: '1px dashed #9333ea', borderRadius: 4, background: 'none', cursor: 'pointer', fontSize: 11, color: '#9333ea' }}>
          + Add Custom Intervention
        </button>
      </Section>
      </>}
      </div>
    </div>
  );
}
