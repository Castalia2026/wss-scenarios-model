import React, { useState } from 'react';

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 8, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
        border: 'none', background: open ? '#e8f0fe' : '#fff', fontWeight: 600,
        fontSize: 14, borderRadius: 8, display: 'flex', justifyContent: 'space-between',
      }}>
        {title}<span>{open ? '▴' : '▾'}</span>
      </button>
      {open && <div style={{ padding: '10px 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>{children}</div>}
    </div>
  );
}

function SubHead({ text }: { text: string }) {
  return <div style={{ width: '100%', fontSize: 13, fontWeight: 700, color: '#1e3a5f', margin: '6px 0 2px', borderBottom: '1px solid #e5e7eb', paddingBottom: 3 }}>{text}</div>;
}

// Color convention: blue text = editable input, green text = cross-linked, gray = computed/derived
function F({ label, value, onChange, unit, step, isPercent, min, max, tip, slider, fieldType }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; isPercent?: boolean;
  min?: number; max?: number; tip?: string; slider?: boolean; fieldType?: 'input' | 'linked' | 'computed';
}) {
  const labelColor = fieldType === 'linked' ? '#16a34a' : fieldType === 'computed' ? '#94a3b8' : '#0000cc';
  const rawPct = Math.round(value * 1e4) / 1e2; // 2 decimal places for %
  const displayVal = isPercent ? (fieldType === 'computed' ? Math.round(rawPct * 100) / 100 : rawPct) : (fieldType === 'computed' ? Math.round(value * 100) / 100 : value);
  const displayMin = min !== undefined ? (isPercent ? Math.round(min * 1e10) / 1e8 : min) : undefined;
  const displayMax = max !== undefined ? (isPercent ? Math.round(max * 1e10) / 1e8 : max) : undefined;
  const outOfRange = (displayMin !== undefined && displayVal < displayMin) || (displayMax !== undefined && displayVal > displayMax);

  let tooltip = tip || '';
  if (displayMin !== undefined || displayMax !== undefined) {
    const rangeStr = displayMin !== undefined && displayMax !== undefined
      ? `Range: ${displayMin}–${displayMax}${unit ? ' ' + unit : ''}`
      : displayMin !== undefined ? `Min: ${displayMin}${unit ? ' ' + unit : ''}` : `Max: ${displayMax}${unit ? ' ' + unit : ''}`;
    tooltip = tooltip ? `${tooltip}\n${rangeStr}` : rangeStr;
  }

  const showSlider = slider && displayMin !== undefined && displayMax !== undefined;

  return (
    <div style={{
      flex: '1 1 calc(33.33% - 6px)', minWidth: 150, maxWidth: 'calc(33.33% - 6px)',
      padding: '6px 8px', borderRadius: 6,
      background: fieldType === 'computed' ? '#f1f5f9' : fieldType === 'linked' ? '#f0fdf4' : '#f8fafc',
      border: outOfRange ? '1.5px solid #ef4444' : '1px solid #e5e7eb',
    }}>
      <label style={{ display: 'block', fontSize: 11, color: labelColor, lineHeight: 1.3, marginBottom: 4, fontWeight: fieldType === 'computed' ? 400 : 500 }} title={tooltip || undefined}>
        {label}
        {unit && <span style={{ color: '#94a3b8', fontWeight: 400 }}> ({unit})</span>}
        {tooltip && <span style={{ color: '#2563eb', marginLeft: 3, fontSize: 12, fontWeight: 700, cursor: 'help' }} title={tooltip}>ⓘ</span>}
      </label>
      <input type="number" value={displayVal}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(isPercent ? v / 100 : v); }}
        step={isPercent ? 1 : (step || 1)}
        min={displayMin} max={displayMax}
        style={{
          width: '100%', padding: '6px 8px', borderRadius: 4, fontSize: 14, textAlign: 'right',
          border: fieldType === 'computed' ? '1px solid #94a3b8' : '1px solid #ccc',
          background: fieldType === 'computed' ? '#e2e8f0' : fieldType === 'linked' ? '#e8f5e9' : '#fff',
          color: fieldType === 'computed' ? '#475569' : '#000',
          boxSizing: 'border-box',
        }}
        readOnly={fieldType === 'computed' || fieldType === 'linked'}
      />
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

interface Props { inputs: any; onChange: (i: any) => void; onCalculate?: () => void; loading?: boolean; showSection?: string; geoScope?: string; }

export default function InputPanel({ inputs, onChange, onCalculate, loading, showSection = 'inputs', geoScope = 'urban' }: Props) {
  const [countries, setCountries] = useState<{name:string, currency:string}[]>([]);

  React.useEffect(() => {
    fetch('/api/countries').then(r => r.json()).then(setCountries).catch(() => {});
  }, []);

  if (!inputs) return null;
  const u = (section: string, field: string, value: number) => {
    onChange({ ...inputs, [section]: { ...inputs[section], [field]: value } });
  };
  const toggleIntv = (field: string, value: boolean) => {
    onChange({ ...inputs, toggles: { ...inputs.toggles, [field]: value } });
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
      <div style={{ fontSize: 11, color: '#475569', marginBottom: 10, padding: '6px 10px', background: '#f0f4ff', borderRadius: 6, lineHeight: 1.5, border: '1px solid #c7d2fe' }}>
        <span style={{ color: '#0000cc', fontWeight: 600 }}>Blue fields</span> are editable inputs. <span style={{ color: '#64748b', fontWeight: 600, background: '#e2e8f0', padding: '1px 4px', borderRadius: 2 }}>Gray fields</span> are auto-calculated and cannot be edited.
      </div>

      {/* ===== INTERVENTION TOGGLES (shown in interventions step) ===== */}
      {isInterventions && inputs.toggles && <>
        <Section title="Intervention Toggles">
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

      {/* ===== COUNTRY CONFIG ===== */}
      <Section title="1. Country, Region & Currency">
        {inputs.country_config && <>
          <div style={{ flex: '1 1 calc(33.33% - 6px)', minWidth: 150, maxWidth: 'calc(33.33% - 6px)', padding: '6px 8px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
            <label style={{ display: 'block', fontSize: 11, color: '#0000cc', fontWeight: 500, marginBottom: 4 }}>Country</label>
            <input type="text" list="country-list" value={inputs.country_config.country || ''}
              onChange={e => setCountryConfig('country', e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }}
              placeholder="Type to search..."
            />
            <datalist id="country-list">
              {countries.map(c => <option key={c.name} value={c.name} />)}
            </datalist>
          </div>
          <div style={{ flex: '1 1 calc(33.33% - 6px)', minWidth: 150, maxWidth: 'calc(33.33% - 6px)', padding: '6px 8px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
            <label style={{ display: 'block', fontSize: 11, color: '#0000cc', fontWeight: 500, marginBottom: 4 }}>Region</label>
            <input type="text" value={inputs.country_config.area || ''}
              onChange={e => setCountryConfig('area', e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }}
              placeholder="e.g. Kathmandu Valley" />
          </div>
          <div style={{ flex: '1 1 calc(33.33% - 6px)', minWidth: 150, maxWidth: 'calc(33.33% - 6px)', padding: '6px 8px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
            <label style={{ display: 'block', fontSize: 11, color: '#0000cc', fontWeight: 500, marginBottom: 4 }}>Currency code</label>
            <input type="text" value={inputs.country_config.currency || ''}
              onChange={e => setCountryConfig('currency', e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
          </div>
        </>}
      </Section>

      {/* ===== PERIOD ===== */}
      <Section title="2. Time Scales">
        <F label="Model start year" value={inputs.period.model_start_year} onChange={v => u('period','model_start_year',v)} min={1990} max={inputs.period.baseline_year} tip="First year of historical data; must be before or equal to baseline year" />
        <F label="Forecast end year" value={inputs.period.forecast_end_year} onChange={v => u('period','forecast_end_year',v)} min={inputs.period.baseline_year + 5} max={2060} tip="Last year of projection; all years after baseline are forecasted" />
        <F label="Baseline year" value={inputs.period.baseline_year} onChange={v => u('period','baseline_year',v)} min={inputs.period.model_start_year} max={new Date().getFullYear() - 1} tip="Last year with complete actual data; must be a finished year" />
        <F label="Performance improvement start year" value={inputs.period.perf_improvement_start_year || (inputs.period.baseline_year + 1)} onChange={v => u('period','perf_improvement_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year when performance improvements begin" />
        <F label="Target 1 year" value={inputs.period.target1_year} onChange={v => u('period','target1_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="First milestone year; must be after baseline" />
        <F label="Target 2 year" value={inputs.period.target2_year} onChange={v => u('period','target2_year',v)} min={inputs.period.target1_year} max={inputs.period.forecast_end_year} tip="Final milestone year; must equal or exceed Target 1" />
      </Section>

      {/* ===== MACROECONOMICS ===== */}
      <Section title="3. Macroeconomics">
        <F label="Year for real prices" value={inputs.macro.real_price_year} onChange={v => u('macro','real_price_year',v)} min={inputs.period.model_start_year} max={inputs.period.baseline_year} tip="Base year for converting nominal to real values; must be a year with actual data" />
        <F label="Water supply budget as % of GDP" value={inputs.macro.ws_budget_pct_gdp || 0} onChange={v => u('macro','ws_budget_pct_gdp',v)} isPercent unit="%" tip="Water supply budget as share of GDP" />
        <F label="Sanitation budget as % of GDP" value={inputs.macro.san_budget_pct_gdp || 0} onChange={v => u('macro','san_budget_pct_gdp',v)} isPercent unit="%" tip="Sanitation budget as share of GDP" />
        <SubHead text="Time-series data (year by year)" />
        <div style={{ width: '100%', fontSize: 10, color: '#64748b', marginBottom: 4, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          Enter nominal GDP and actual rates for historical years. GDP growth is calculated automatically.
        </div>
        {(() => {
          const arr = inputs.macro.gdp_nominal_usd || inputs.macro.gdp_growth || [];
          const years = arr.map((_: number, i: number) => (inputs.period.model_start_year || 2011) + i);
          const baseYr2 = inputs.period.baseline_year || 2025;
          const gdpArr = inputs.macro.gdp_nominal_usd || [];
          const tsInput = (field: string, idx: number, val: number, isPct: boolean) => (
            <input type="number" value={isPct ? Math.round(val*10000)/100 : Math.round(val*1000)/1000}
              onChange={e => { const v=parseFloat(e.target.value); if(!isNaN(v)){
                const a=[...inputs.macro[field]]; a[idx]=isPct?v/100:v;
                onChange({...inputs, macro:{...inputs.macro, [field]:a}});
              }}}
              style={{ width: 58, padding: '2px 3px', border: '1px solid #ddd', borderRadius: 2, fontSize: 11, textAlign: 'right' }}
            />
          );
          const rows: { label: string; computed?: boolean; cells: React.ReactNode[] }[] = [
            { label: 'Nominal GDP ($B)', cells: years.map((_: number, i: number) => tsInput('gdp_nominal_usd', i, gdpArr[i]||0, false)) },
            { label: 'GDP growth %', computed: true, cells: years.map((_: number, i: number) => {
              const g = (i > 0 && gdpArr[i] && gdpArr[i-1] && gdpArr[i-1] !== 0) ? ((gdpArr[i]/gdpArr[i-1])-1)*100 : 0;
              return <span style={{ fontSize: 10, color: '#94a3b8' }}>{i > 0 ? g.toFixed(1)+'%' : '—'}</span>;
            }) },
            { label: `Infl ${cc.country || 'Domestic'} %`, cells: years.map((_: number, i: number) => tsInput('inflation_nepal', i, (inputs.macro.inflation_nepal||[])[i]||0, true)) },
            { label: 'Infl US %', cells: years.map((_: number, i: number) => tsInput('inflation_us', i, (inputs.macro.inflation_us||[])[i]||0, true)) },
            { label: `USD/${CUR}`, cells: years.map((_: number, i: number) => tsInput('exchange_rate', i, (inputs.macro.exchange_rate||[])[i]||0, false)) },
          ];
          return (
            <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '4px 8px', textAlign: 'left', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 1, minWidth: 120 }}></th>
                    {years.map((yr: number) => (
                      <th key={yr} style={{ padding: '4px 4px', textAlign: 'center', fontSize: 10, fontWeight: yr > baseYr2 ? 600 : 500, color: yr > baseYr2 ? '#f59e0b' : '#334155', minWidth: 62 }}>
                        {yr}{yr > baseYr2 && <span style={{ fontSize: 7, verticalAlign: 'super' }}>F</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 ? '#fafbfc' : '#fff' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 600, fontSize: 12, color: row.computed ? '#94a3b8' : '#1e3a5f', position: 'sticky', left: 0, background: ri % 2 ? '#fafbfc' : '#fff', zIndex: 1, whiteSpace: 'nowrap' }}>
                        {row.label}
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

      {/* ===== POPULATION ===== */}
      <Section title="4. Population">
        <SubHead text={`Start year (${startYr})`} />
        <F label={`${scopeLabel} population, ${startYr}`} value={inputs.population.total_pop_start} onChange={v => u('population','total_pop_start',v)} min={10000} max={100000000} tip={`${scopeLabel} population at model start year (census)`} />
        <F label={`${scopeLabel} households, ${startYr} (mill)`} value={inputs.population.total_hh_start} onChange={v => u('population','total_hh_start',v)} step={0.001} unit="mill" min={0.001} max={50} tip={`Total ${scopeLower} households in millions`} />
        <F label="Avg household size (calculated)" value={avgHHSizeStart} onChange={() => {}} fieldType="computed" tip={`Population / (households × 1,000,000) = ${(pop.total_pop_start||0).toLocaleString()} / ${((pop.total_hh_start||0)*1e6).toLocaleString()}`} />
        <SubHead text={`Baseline year (${baseYr})`} />
        <F label={`${scopeLabel} population, ${baseYr}`} value={inputs.population.total_pop_baseline} onChange={v => u('population','total_pop_baseline',v)} min={10000} max={100000000} tip={`${scopeLabel} population at baseline year (estimate)`} />
        <F label={`${scopeLabel} households, ${baseYr} (mill)`} value={inputs.population.total_hh_baseline} onChange={v => u('population','total_hh_baseline',v)} step={0.01} unit="mill" min={0.001} max={50} tip={`Total ${scopeLower} households in millions`} />
        <F label="Avg household size (calculated)" value={avgHHSizeBase} onChange={() => {}} fieldType="computed" tip={`Population / (households × 1,000,000) = ${(pop.total_pop_baseline||0).toLocaleString()} / ${((pop.total_hh_baseline||0)*1e6).toLocaleString()}`} />
        <SubHead text="Computed growth rates" />
        <F label="Population CAGR (calculated)" value={popCagr} onChange={() => {}} fieldType="computed" isPercent unit="%" tip={`CAGR from ${startYr} to ${baseYr}: (${(pop.total_pop_baseline||0).toLocaleString()} / ${(pop.total_pop_start||0).toLocaleString()})^(1/${nYears}) - 1`} />
        <F label="Avg household size CAGR (calculated)" value={hhSizeCagr} onChange={() => {}} fieldType="computed" isPercent unit="%" tip={`Household size: ${avgHHSizeStart.toFixed(2)} (${startYr}) → ${avgHHSizeBase.toFixed(2)} (${baseYr})`} />
      </Section>

      {/* ===== WATER SERVICE LEVELS ===== */}
      <Section title="5. Water Supply Service Levels">
        <SubHead text={`% HHs by service level, ${startYr}`} />
        <F label={`% HHs ${ws[0]}`} value={inputs.water_service.pct_serv1_start} onChange={v => u('water_service','pct_serv1_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[1]}`} value={inputs.water_service.pct_serv2_start} onChange={v => u('water_service','pct_serv2_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[2]}`} value={inputs.water_service.pct_serv3_start} onChange={v => u('water_service','pct_serv3_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[3]}`} value={inputs.water_service.pct_serv4_start} onChange={v => u('water_service','pct_serv4_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[4]}`} value={inputs.water_service.pct_serv5_start} onChange={v => u('water_service','pct_serv5_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        {(() => { const s = (inputs.water_service.pct_serv1_start||0)+(inputs.water_service.pct_serv2_start||0)+(inputs.water_service.pct_serv3_start||0)+(inputs.water_service.pct_serv4_start||0)+(inputs.water_service.pct_serv5_start||0); const bad = Math.abs(s-1)>0.005; return <div style={{ fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>Sum: {Math.round(s*10000)/100}%{bad?' (must be 100%)':' OK'}</div>; })()}

        <SubHead text={`% HHs by service level, ${baseYr}`} />
        <F label={`% HHs ${ws[0]}`} value={inputs.water_service.pct_serv1_baseline} onChange={v => u('water_service','pct_serv1_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[1]}`} value={inputs.water_service.pct_serv2_baseline} onChange={v => u('water_service','pct_serv2_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[2]}`} value={inputs.water_service.pct_serv3_baseline} onChange={v => u('water_service','pct_serv3_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[3]}`} value={inputs.water_service.pct_serv4_baseline} onChange={v => u('water_service','pct_serv4_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[4]}`} value={inputs.water_service.pct_serv5_baseline} onChange={v => u('water_service','pct_serv5_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        {(() => { const s = (inputs.water_service.pct_serv1_baseline||0)+(inputs.water_service.pct_serv2_baseline||0)+(inputs.water_service.pct_serv3_baseline||0)+(inputs.water_service.pct_serv4_baseline||0)+(inputs.water_service.pct_serv5_baseline||0); const bad = Math.abs(s-1)>0.005; return <div style={{ fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>Sum: {Math.round(s*10000)/100}%{bad?' (must be 100%)':' OK'}</div>; })()}
        {nYears > 0 && <>
          <SubHead text="Service level CAGRs (calculated)" />
          {[
            { name: ws[0], s: inputs.water_service.pct_serv1_start, b: inputs.water_service.pct_serv1_baseline },
            { name: ws[1], s: inputs.water_service.pct_serv2_start, b: inputs.water_service.pct_serv2_baseline },
            { name: ws[2], s: inputs.water_service.pct_serv3_start, b: inputs.water_service.pct_serv3_baseline },
            { name: ws[3], s: inputs.water_service.pct_serv4_start, b: inputs.water_service.pct_serv4_baseline },
            { name: ws[4], s: inputs.water_service.pct_serv5_start, b: inputs.water_service.pct_serv5_baseline },
          ].map((lv, i) => (
            <F key={i} label={`CAGR ${lv.name}`} value={cagr(lv.s || 0.0001, lv.b || 0.0001, nYears)} onChange={() => {}} fieldType="computed" isPercent unit="%" tip={`${(lv.s*100).toFixed(2)}% → ${(lv.b*100).toFixed(2)}% over ${nYears} years`} />
          ))}
        </>}
      </Section>

      {/* ===== SANITATION SERVICE LEVELS ===== */}
      <Section title="6. Sanitation Service Levels">
        <SubHead text={`% HHs by service level, ${startYr}`} />
        <F label={`% ${ss[0]}`} value={inputs.sanitation_service.pct_sserv1_start} onChange={v => u('sanitation_service','pct_sserv1_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[1]}`} value={inputs.sanitation_service.pct_sserv2_start} onChange={v => u('sanitation_service','pct_sserv2_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[2]}`} value={inputs.sanitation_service.pct_sserv3_start} onChange={v => u('sanitation_service','pct_sserv3_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[3]}`} value={inputs.sanitation_service.pct_sserv4_start} onChange={v => u('sanitation_service','pct_sserv4_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[4]}`} value={inputs.sanitation_service.pct_sserv5_start} onChange={v => u('sanitation_service','pct_sserv5_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        {(() => { const s = (inputs.sanitation_service.pct_sserv1_start||0)+(inputs.sanitation_service.pct_sserv2_start||0)+(inputs.sanitation_service.pct_sserv3_start||0)+(inputs.sanitation_service.pct_sserv4_start||0)+(inputs.sanitation_service.pct_sserv5_start||0); const bad = Math.abs(s-1)>0.005; return <div style={{ fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>Sum: {Math.round(s*10000)/100}%{bad?' (must be 100%)':' OK'}</div>; })()}

        <SubHead text={`% HHs by service level, ${baseYr}`} />
        <F label={`% ${ss[0]}`} value={inputs.sanitation_service.pct_sserv1_baseline} onChange={v => u('sanitation_service','pct_sserv1_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[1]}`} value={inputs.sanitation_service.pct_sserv2_baseline} onChange={v => u('sanitation_service','pct_sserv2_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[2]}`} value={inputs.sanitation_service.pct_sserv3_baseline} onChange={v => u('sanitation_service','pct_sserv3_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[3]}`} value={inputs.sanitation_service.pct_sserv4_baseline} onChange={v => u('sanitation_service','pct_sserv4_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[4]}`} value={inputs.sanitation_service.pct_sserv5_baseline} onChange={v => u('sanitation_service','pct_sserv5_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        {(() => { const s = (inputs.sanitation_service.pct_sserv1_baseline||0)+(inputs.sanitation_service.pct_sserv2_baseline||0)+(inputs.sanitation_service.pct_sserv3_baseline||0)+(inputs.sanitation_service.pct_sserv4_baseline||0)+(inputs.sanitation_service.pct_sserv5_baseline||0); const bad = Math.abs(s-1)>0.005; return <div style={{ fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>Sum: {Math.round(s*10000)/100}%{bad?' (must be 100%)':' OK'}</div>; })()}
        {nYears > 0 && <>
          <SubHead text="Service level CAGRs (calculated)" />
          {[
            { name: ss[0], s: inputs.sanitation_service.pct_sserv1_start, b: inputs.sanitation_service.pct_sserv1_baseline },
            { name: ss[1], s: inputs.sanitation_service.pct_sserv2_start, b: inputs.sanitation_service.pct_sserv2_baseline },
            { name: ss[2], s: inputs.sanitation_service.pct_sserv3_start, b: inputs.sanitation_service.pct_sserv3_baseline },
            { name: ss[3], s: inputs.sanitation_service.pct_sserv4_start, b: inputs.sanitation_service.pct_sserv4_baseline },
            { name: ss[4], s: inputs.sanitation_service.pct_sserv5_start, b: inputs.sanitation_service.pct_sserv5_baseline },
          ].map((lv, i) => (
            <F key={i} label={`CAGR ${lv.name}`} value={cagr(lv.s || 0.0001, lv.b || 0.0001, nYears)} onChange={() => {}} fieldType="computed" isPercent unit="%" tip={`${(lv.s*100).toFixed(2)}% → ${(lv.b*100).toFixed(2)}% over ${nYears} years`} />
          ))}
        </>}
      </Section>

      {/* ===== WATER TARGETS ===== */}
      <Section title="7. Water Supply Targets">
        <SubHead text="Service Targets" />
        <div style={{ width: '100%', fontSize: 10, color: '#64748b', marginBottom: 6, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          Number of HHs per level calculated automatically from population
        </div>
        <SubHead text="Target 1 (2030)" />
        <F label={`% ${ws[0]}`} value={inputs.water_targets.target1_serv1} onChange={v => u('water_targets','target1_serv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[1]}`} value={inputs.water_targets.target1_serv2} onChange={v => u('water_targets','target1_serv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[2]}`} value={inputs.water_targets.target1_serv3} onChange={v => u('water_targets','target1_serv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[3]}`} value={inputs.water_targets.target1_serv4} onChange={v => u('water_targets','target1_serv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[4]}`} value={inputs.water_targets.target1_serv5} onChange={v => u('water_targets','target1_serv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        {(() => { const s = (inputs.water_targets.target1_serv1||0)+(inputs.water_targets.target1_serv2||0)+(inputs.water_targets.target1_serv3||0)+(inputs.water_targets.target1_serv4||0)+(inputs.water_targets.target1_serv5||0); const bad = Math.abs(s-1)>0.005; return <div style={{ fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>Sum: {Math.round(s*10000)/100}%{bad?' (must be 100%)':' OK'}</div>; })()}
        <SubHead text="Target 2 (2040)" />
        <F label={`% ${ws[0]}`} value={inputs.water_targets.target2_serv1} onChange={v => u('water_targets','target2_serv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[1]}`} value={inputs.water_targets.target2_serv2} onChange={v => u('water_targets','target2_serv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[2]}`} value={inputs.water_targets.target2_serv3} onChange={v => u('water_targets','target2_serv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[3]}`} value={inputs.water_targets.target2_serv4} onChange={v => u('water_targets','target2_serv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[4]}`} value={inputs.water_targets.target2_serv5} onChange={v => u('water_targets','target2_serv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        {(() => { const s = (inputs.water_targets.target2_serv1||0)+(inputs.water_targets.target2_serv2||0)+(inputs.water_targets.target2_serv3||0)+(inputs.water_targets.target2_serv4||0)+(inputs.water_targets.target2_serv5||0); const bad = Math.abs(s-1)>0.005; return <div style={{ fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>Sum: {Math.round(s*10000)/100}%{bad?' (must be 100%)':' OK'}</div>; })()}
      </Section>

      {/* ===== SANITATION TARGETS ===== */}
      <Section title="8. Sanitation Targets">
        <SubHead text="On-site sanitation" />
        <F label="On-site with collection & treatment %" value={inputs.sanitation_targets.onsite_collection_treatment_pct} onChange={v => u('sanitation_targets','onsite_collection_treatment_pct',v)} isPercent unit="%" min={0} max={1.0} tip="Share of safely managed HHs served by on-site systems (septic tanks with fecal sludge collection). Provider shares + on-site must sum to 100%." />
        <div style={{ width: '100%', fontSize: 10, color: '#64748b', marginBottom: 8, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          Providers ({Math.round((inputs.sanitation_targets.providers || []).reduce((s: number, p: any) => s + p.share_pct, 0) * 100)}%) + On-site ({Math.round((inputs.sanitation_targets.onsite_collection_treatment_pct || 0) * 100)}%) = {Math.round(((inputs.sanitation_targets.providers || []).reduce((s: number, p: any) => s + p.share_pct, 0) + (inputs.sanitation_targets.onsite_collection_treatment_pct || 0)) * 100)}%
        </div>
        <SubHead text="Service Targets" />
        <div style={{ width: '100%', fontSize: 10, color: '#64748b', marginBottom: 6, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          Number of HHs per level calculated automatically from population
        </div>
        <SubHead text="Target 1 (2030)" />
        <F label={`% ${ss[0]}`} value={inputs.sanitation_targets.target1_sserv1} onChange={v => u('sanitation_targets','target1_sserv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[1]}`} value={inputs.sanitation_targets.target1_sserv2} onChange={v => u('sanitation_targets','target1_sserv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[2]}`} value={inputs.sanitation_targets.target1_sserv3} onChange={v => u('sanitation_targets','target1_sserv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[3]}`} value={inputs.sanitation_targets.target1_sserv4} onChange={v => u('sanitation_targets','target1_sserv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[4]}`} value={inputs.sanitation_targets.target1_sserv5} onChange={v => u('sanitation_targets','target1_sserv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        {(() => { const s = (inputs.sanitation_targets.target1_sserv1||0)+(inputs.sanitation_targets.target1_sserv2||0)+(inputs.sanitation_targets.target1_sserv3||0)+(inputs.sanitation_targets.target1_sserv4||0)+(inputs.sanitation_targets.target1_sserv5||0); const bad = Math.abs(s-1)>0.005; return <div style={{ fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>Sum: {Math.round(s*10000)/100}%{bad?' (must be 100%)':' OK'}</div>; })()}
        <SubHead text="Target 2 (2040)" />
        <F label={`% ${ss[0]}`} value={inputs.sanitation_targets.target2_sserv1} onChange={v => u('sanitation_targets','target2_sserv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[1]}`} value={inputs.sanitation_targets.target2_sserv2} onChange={v => u('sanitation_targets','target2_sserv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[2]}`} value={inputs.sanitation_targets.target2_sserv3} onChange={v => u('sanitation_targets','target2_sserv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[3]}`} value={inputs.sanitation_targets.target2_sserv4} onChange={v => u('sanitation_targets','target2_sserv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[4]}`} value={inputs.sanitation_targets.target2_sserv5} onChange={v => u('sanitation_targets','target2_sserv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        {(() => { const s = (inputs.sanitation_targets.target2_sserv1||0)+(inputs.sanitation_targets.target2_sserv2||0)+(inputs.sanitation_targets.target2_sserv3||0)+(inputs.sanitation_targets.target2_sserv4||0)+(inputs.sanitation_targets.target2_sserv5||0); const bad = Math.abs(s-1)>0.005; return <div style={{ fontSize: 10, fontWeight: 600, color: bad?'#dc2626':'#16a34a', padding: '2px 8px', background: bad?'#fef2f2':'#f0fdf4', borderRadius: 4, marginBottom: 4 }}>Sum: {Math.round(s*10000)/100}%{bad?' (must be 100%)':' OK'}</div>; })()}
      </Section>

      {/* ===== HISTORIC BUDGET & EXECUTION ===== */}
      <Section title="9. Historic Budget & Execution">
        <SubHead text="Water supply" />
        <F label={`Historic WS budget allocated (${CUR} mill)`} value={inputs.bau?.ws_budget_allocated || 0} onChange={v => u('bau','ws_budget_allocated',v)} step={100} unit={`${CUR} M`} min={0} max={1000000} tip="Total water supply budget allocated over historical period" />
        <F label={`Historic WS actual expenditure (${CUR} mill)`} value={inputs.bau?.ws_actual_expenditure || 0} onChange={v => u('bau','ws_actual_expenditure',v)} step={100} unit={`${CUR} M`} min={0} max={1000000} tip="Actual water supply expenditure over historical period" />
        <F label="WS execution rate (calculated)" value={(inputs.bau?.ws_budget_allocated && inputs.bau?.ws_actual_expenditure) ? inputs.bau.ws_actual_expenditure / inputs.bau.ws_budget_allocated : 0} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Actual expenditure / budget allocated" />
        <SubHead text="Sanitation" />
        <F label={`Historic SAN budget allocated (${CUR} mill)`} value={inputs.bau?.san_budget_allocated || 0} onChange={v => u('bau','san_budget_allocated',v)} step={100} unit={`${CUR} M`} min={0} max={1000000} tip="Total sanitation budget allocated over historical period" />
        <F label={`Historic SAN actual expenditure (${CUR} mill)`} value={inputs.bau?.san_actual_expenditure || 0} onChange={v => u('bau','san_actual_expenditure',v)} step={100} unit={`${CUR} M`} min={0} max={1000000} tip="Actual sanitation expenditure over historical period" />
        <F label="SAN execution rate (calculated)" value={(inputs.bau?.san_budget_allocated && inputs.bau?.san_actual_expenditure) ? inputs.bau.san_actual_expenditure / inputs.bau.san_budget_allocated : 0} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Actual expenditure / budget allocated" />
        <SubHead text="Historic NRW & collection data" />
        <F label="Current NRW %" value={inputs.water_interventions?.nrw_current_pct || 0} onChange={v => u('water_interventions','nrw_current_pct',v)} isPercent unit="%" tip="Current non-revenue water as share of total water produced" />
        <F label="Current collection ratio" value={inputs.water_interventions?.ce_current_ratio || 0} onChange={v => u('water_interventions','ce_current_ratio',v)} isPercent unit="%" tip="Current fraction of billed amounts actually collected" />
      </Section>
      </>}

      {isBAU && <>
      {/* ===== WATER UNIT COSTS ===== */}
      <Section title="10. Water Supply Unit Costs">
        <SubHead text="Distribution network cost per HH" />
        <F label={ws[0]} value={inputs.water_costs.network_cost_per_hh_serv1} onChange={v => u('water_costs','network_cost_per_hh_serv1',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to the distribution network" />
        <F label={ws[1]} value={inputs.water_costs.network_cost_per_hh_serv2} onChange={v => u('water_costs','network_cost_per_hh_serv2',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to the distribution network" />
        <F label={ws[2]} value={inputs.water_costs.network_cost_per_hh_serv3} onChange={v => u('water_costs','network_cost_per_hh_serv3',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to the distribution network" />
        <F label={ws[3]} value={inputs.water_costs.network_cost_per_hh_serv4} onChange={v => u('water_costs','network_cost_per_hh_serv4',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to the distribution network" />
        <SubHead text="Water treatment" />
        <F label="Cost per MLD water treatment" value={inputs.water_costs.ws_cost_per_mld_treatment || 0} onChange={v => u('water_costs','ws_cost_per_mld_treatment',v)} step={100} unit={`${CUR} M`} min={0} max={100000} tip="Capital cost to build 1 MLD of water treatment capacity" />
        <SubHead text="Non-piped solutions" />
        <F label="Cost of a dug well" value={inputs.water_costs.dug_well_cost} onChange={v => u('water_costs','dug_well_cost',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost of constructing a dug well for one household" />
        <F label="Cost of borehole + handpump" value={inputs.water_costs.borehole_cost} onChange={v => u('water_costs','borehole_cost',v)} step={10000} unit={CUR} min={0} max={10000000} tip="Capital cost of drilling a borehole and installing a handpump" />
        <F label="Cost of HH water treatment system" value={inputs.water_costs.hh_treatment_system_cost} onChange={v => u('water_costs','hh_treatment_system_cost',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost of a household-level water treatment system" />
      </Section>

      {/* ===== SANITATION UNIT COSTS ===== */}
      <Section title="11. Sanitation Unit Costs">
        <SubHead text="Sewerage cost per HH" />
        <F label={ss[0]} value={inputs.sanitation_costs.sewer_cost_per_hh_sserv1} onChange={v => u('sanitation_costs','sewer_cost_per_hh_sserv1',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to sewer network + house connection" />
        <F label={ss[1]} value={inputs.sanitation_costs.sewer_cost_per_hh_sserv2} onChange={v => u('sanitation_costs','sewer_cost_per_hh_sserv2',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to sewer network + house connection" />
        <F label={ss[2]} value={inputs.sanitation_costs.sewer_cost_per_hh_sserv3} onChange={v => u('sanitation_costs','sewer_cost_per_hh_sserv3',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to sewer network + house connection" />
        <F label={ss[3]} value={inputs.sanitation_costs.sewer_cost_per_hh_sserv4} onChange={v => u('sanitation_costs','sewer_cost_per_hh_sserv4',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to sewer network + house connection" />
        <SubHead text="Wastewater treatment" />
        <F label="Cost per MLD wastewater treatment" value={inputs.sanitation_costs.san_cost_per_mld_treatment || 0} onChange={v => u('sanitation_costs','san_cost_per_mld_treatment',v)} step={100} unit={`${CUR} M`} min={0} max={100000} tip="Capital cost to build 1 MLD of wastewater treatment capacity" />
        <SubHead text="On-site sanitation" />
        <F label="On-site facility Capex" value={inputs.sanitation_costs.onsite_facility_capex || 0} onChange={v => u('sanitation_costs','onsite_facility_capex',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Average capital cost per on-site sanitation facility (weighted across facility types)" />
        <SubHead text="Treatment" />
        <F label="Cost per MLD fecal sludge treatment" value={inputs.sanitation_costs.cost_per_mld_fst} onChange={v => u('sanitation_costs','cost_per_mld_fst',v)} step={10} unit={`${CUR} M`} min={0} max={100000} tip="Capital cost to build 1 MLD of fecal sludge treatment capacity" />
      </Section>

      {/* ===== BAU INVESTMENT ===== */}
      <Section title="12. Planned Investments">
        <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, padding: '6px 10px', background: '#f0f9ff', borderRadius: 4, lineHeight: 1.5, border: '1px solid #bae6fd' }}>
          If there are programmed investments that represent a shift from historical spending — additional to past trends, with financing secured and genuinely likely to proceed — enter them here as part of the BAU scenario.
        </div>
        <SubHead text="Investment periods" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <label style={{ flex: 1, fontSize: 11, color: '#0000cc', fontWeight: 500 }}>Period unit (years)</label>
          <select value={inputs.bau.period_unit_years || 5}
            onChange={e => {
              const unit = parseInt(e.target.value);
              const startY = (inputs.period.baseline_year || 2025) + 1;
              const endY = inputs.period.forecast_end_year || 2045;
              const autoPeriods: any[] = [];
              let y = startY;
              while (y <= endY) {
                const pEnd = Math.min(y + unit - 1, endY);
                autoPeriods.push({ start: y, end: pEnd, ws_inv: 0, san_inv: 0, is_custom: false });
                y = pEnd + 1;
              }
              const customPeriods = (inputs.bau.investment_periods || []).filter((p: any) => p.is_custom);
              onChange({ ...inputs, bau: { ...inputs.bau, period_unit_years: unit, investment_periods: [...autoPeriods, ...customPeriods] } });
            }}
            style={{ width: 90, padding: '3px 5px', border: '1px solid #ccc', borderRadius: 3, fontSize: 11 }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {(() => {
          const periods: any[] = inputs.bau.investment_periods || [];
          const updatePeriod = (idx: number, field: string, val: any) => {
            const arr = [...periods];
            arr[idx] = { ...arr[idx], [field]: val };
            onChange({ ...inputs, bau: { ...inputs.bau, investment_periods: arr } });
          };
          const removePeriod = (idx: number) => {
            const arr = periods.filter((_: any, i: number) => i !== idx);
            onChange({ ...inputs, bau: { ...inputs.bau, investment_periods: arr } });
          };
          return <>
            {periods.map((p: any, idx: number) => (
              <div key={idx} style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', marginBottom: 6, background: p.is_custom ? '#fef3c7' : '#f0fdf4' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1e3a5f', flex: 1 }}>
                    {p.is_custom ? 'Custom: ' : `Period ${idx + 1}: `}{p.start}–{p.end}
                  </span>
                  {p.is_custom && (
                    <button onClick={() => removePeriod(idx)} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>✕</button>
                  )}
                </div>
                {p.is_custom && <>
                  <F label="Start year" value={p.start} onChange={v => updatePeriod(idx, 'start', v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} />
                  <F label="End year" value={p.end} onChange={v => updatePeriod(idx, 'end', v)} min={p.start} max={inputs.period.forecast_end_year} />
                </>}
                <F label="Planned water supply investment" value={p.ws_inv || 0} onChange={v => updatePeriod(idx, 'ws_inv', v)} step={100} unit={`${CUR} M`} min={0} max={1000000} tip="Planned water supply investment for this period" />
                <F label="Planned sanitation investment" value={p.san_inv || 0} onChange={v => updatePeriod(idx, 'san_inv', v)} step={100} unit={`${CUR} M`} min={0} max={1000000} tip="Planned sanitation investment for this period" />
              </div>
            ))}
            <button onClick={() => {
              const newP = { start: inputs.period.baseline_year + 1, end: inputs.period.baseline_year + 5, ws_inv: 0, san_inv: 0, is_custom: true };
              onChange({ ...inputs, bau: { ...inputs.bau, investment_periods: [...periods, newP] } });
            }} style={{ width: '100%', padding: '6px', border: '1px dashed #2563eb', borderRadius: 4, background: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', marginBottom: 8 }}>
              + Add Custom Period
            </button>
          </>;
        })()}
        <SubHead text="Sector split of WSS budget (calculated)" />
        {(() => {
          const wsGdp = inputs.macro?.ws_budget_pct_gdp || 0;
          const sanGdp = inputs.macro?.san_budget_pct_gdp || 0;
          const total = wsGdp + sanGdp;
          const wsPct = total > 0 ? wsGdp / total : 0;
          const sanPct = total > 0 ? sanGdp / total : 0;
          return <>
            <div style={{ width: '100%', fontSize: 10, color: '#64748b', marginBottom: 6, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
              Auto-calculated from water/sanitation budget as % of GDP (Data Input tab)
            </div>
            <F label="Water supply % of WSS budget" value={wsPct} onChange={() => {}} fieldType="computed" isPercent unit="%" tip={`Calculated: WS GDP% / (WS GDP% + SAN GDP%) = ${(wsGdp*100).toFixed(2)}% / ${(total*100).toFixed(2)}%`} />
            <F label="Sanitation % of WSS budget" value={sanPct} onChange={() => {}} fieldType="computed" isPercent unit="%" tip={`Calculated: SAN GDP% / (WS GDP% + SAN GDP%) = ${(sanGdp*100).toFixed(2)}% / ${(total*100).toFixed(2)}%`} />
          </>;
        })()}
      </Section>

      {/* ===== TECHNICAL ===== */}
      <Section title="13. Technical Parameters">
        <SubHead text="Water supply" />
        <F label="Useful life of assets" value={inputs.technical.ws_asset_life} onChange={v => u('technical','ws_asset_life',v)} unit="yrs" min={5} max={100} tip="Expected useful life of infrastructure assets" />
        <F label="% water sold to non-household" value={inputs.technical.ws_non_hh_pct || 0} onChange={v => u('technical','ws_non_hh_pct',v)} isPercent unit="%" tip="Share of water sold to non-household customers (commercial, industrial, institutional)" />
        <F label="Existing treatment capacity" value={inputs.technical.ws_existing_treatment_mld || 0} onChange={v => u('technical','ws_existing_treatment_mld',v)} unit="MLD" min={0} max={10000} tip="Existing water treatment capacity at baseline" />
        <F label="Planned treatment capacity" value={inputs.water_targets?.planned_treatment_capacity_mld || 0} onChange={v => u('water_targets','planned_treatment_capacity_mld',v)} unit="MLD" min={0} max={5000} tip="Total planned treatment capacity including existing and new" />
        <F label="Water requirement per WHO" value={inputs.technical.ws_water_req_who_lpcd} onChange={v => u('technical','ws_water_req_who_lpcd',v)} unit="lpcd" min={20} max={200} tip="WHO minimum water requirement per person per day" />
        <SubHead text="Sanitation" />
        <F label="Useful life of assets" value={inputs.technical.san_asset_life} onChange={v => u('technical','san_asset_life',v)} unit="yrs" min={5} max={100} tip="Expected useful life of infrastructure assets" />
        <F label="% wastewater from non-household" value={inputs.technical.san_non_hh_pct || 0} onChange={v => u('technical','san_non_hh_pct',v)} isPercent unit="%" tip="Share of wastewater from non-household sources (commercial, industrial, institutional)" />
        <F label="Factor wastewater of water supply" value={inputs.technical.san_wastewater_factor} onChange={v => u('technical','san_wastewater_factor',v)} isPercent unit="%" tip="Wastewater volume as share of water supply volume" />
        <SubHead text="Wastewater treatment" />
        <F label="Existing WWT capacity" value={inputs.technical.san_existing_wwt_mld || 0} onChange={v => u('technical','san_existing_wwt_mld',v)} unit="MLD" min={0} max={10000} tip="Existing wastewater treatment capacity" />
        <F label="Planned WWT capacity" value={inputs.technical.san_planned_wwt_mld || 0} onChange={v => u('technical','san_planned_wwt_mld',v)} unit="MLD" min={0} max={10000} tip="Total planned wastewater treatment capacity" />
        <F label="Avg capex per MLD for WWT" value={inputs.technical.san_avg_capex_per_mld_wwt || 0} onChange={v => u('technical','san_avg_capex_per_mld_wwt',v)} unit={`${CUR} M/MLD`} min={0} max={100000} tip="Average capital cost per MLD for a wastewater treatment plant" />
        <SubHead text="Fecal sludge" />
        <F label="Avg capex per MLD for FSTP" value={inputs.technical.san_avg_capex_per_mld_fstp || 395} onChange={v => u('technical','san_avg_capex_per_mld_fstp',v)} unit={`${CUR} M/MLD`} min={0} max={100000} tip="Average capital cost per MLD for a fecal sludge treatment plant (e.g. Birendranagar FSTP)" />
        <F label="Existing FST capacity" value={inputs.technical.san_existing_fst_mld} onChange={v => u('technical','san_existing_fst_mld',v)} step={0.0001} unit="MLD" min={0} max={10000} tip="Existing fecal sludge treatment capacity" />
        <F label="Planned FST capacity" value={inputs.technical.san_planned_fst_mld || 0} onChange={v => u('technical','san_planned_fst_mld',v)} step={0.001} unit="MLD" min={0} max={10000} tip="Total planned fecal sludge treatment capacity" />
        <F label="FS per person per day" value={inputs.technical.san_fs_per_person_per_day} onChange={v => u('technical','san_fs_per_person_per_day',v)} step={0.1} unit="liters" min={0} max={10} tip="Volume of fecal sludge generated per person per day in liters" />
      </Section>
      </>}

      {isInterventions && <>
      {/* ===== WATER INTERVENTIONS ===== */}
      <Section title="14. Water Supply Interventions">
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
      <Section title="15. Sanitation Interventions">
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
      <Section title="16. Custom Interventions">
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
  );
}
