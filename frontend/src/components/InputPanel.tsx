import React, { useState } from 'react';

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 6, border: '1px solid #ddd', borderRadius: 6, background: '#fff' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
        border: 'none', background: open ? '#e8f0fe' : '#fff', fontWeight: 600,
        fontSize: 12, borderRadius: 6, display: 'flex', justifyContent: 'space-between',
      }}>
        {title}<span>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div style={{ padding: '6px 12px 10px' }}>{children}</div>}
    </div>
  );
}

function SubHead({ text }: { text: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', margin: '8px 0 4px', borderBottom: '1px solid #e5e7eb', paddingBottom: 2 }}>{text}</div>;
}

// Color convention: blue text = editable input, green text = cross-linked, gray = computed/derived
function F({ label, value, onChange, unit, step, isPercent, min, max, tip, slider, fieldType }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; isPercent?: boolean;
  min?: number; max?: number; tip?: string; slider?: boolean; fieldType?: 'input' | 'linked' | 'computed';
}) {
  const labelColor = fieldType === 'linked' ? '#16a34a' : fieldType === 'computed' ? '#94a3b8' : '#0000cc';
  const rawPct = Math.round(value * 1e10) / 1e8;
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
    <div style={{ marginBottom: showSlider ? 6 : 4 }} title={tooltip}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ flex: 1, fontSize: 11, color: labelColor, lineHeight: 1.2, cursor: tooltip ? 'help' : 'default', fontWeight: fieldType === 'computed' ? 400 : 500 }}>
          {label}
          {tooltip && <span style={{ color: '#94a3b8', marginLeft: 3, fontSize: 9 }}>ⓘ</span>}
        </label>
        <input type="number" value={displayVal}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(isPercent ? v / 100 : v); }}
          step={isPercent ? 1 : (step || 1)}
          min={displayMin} max={displayMax}
          style={{
            width: showSlider ? 60 : 90, padding: '3px 5px', borderRadius: 3, fontSize: 11, textAlign: 'right',
            border: outOfRange ? '1.5px solid #ef4444' : '1px solid #ccc',
            background: outOfRange ? '#fef2f2' : fieldType === 'computed' ? '#f1f5f9' : '#fff',
          }}
          readOnly={fieldType === 'computed'}
        />
        {unit && <span style={{ fontSize: 10, color: '#888', minWidth: 24 }}>{unit}</span>}
      </div>
      {showSlider && (
        <input type="range" value={displayVal}
          onChange={e => { const v = parseFloat(e.target.value); onChange(isPercent ? v / 100 : v); }}
          min={displayMin} max={displayMax} step={isPercent ? 1 : (step || 1)}
          style={{ width: '100%', height: 6, marginTop: 2, accentColor: '#2563eb' }}
        />
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 12 }}>
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
    <div style={{ width: 400, overflowY: 'auto', padding: 12, background: '#fafbfc', borderRight: '1px solid #e0e0e0', fontSize: 11 }}>
      <h2 style={{ fontSize: 14, marginBottom: 6, color: '#1a1a2e' }}>
        {isInputs ? 'Data Inputs & Assumptions' : isBAU ? 'BAU & Costs' : 'Interventions'}
      </h2>
      {(isInputs || isBAU) && geoScope && (
        <div style={{ fontSize: 10, color: '#0369a1', background: '#e0f2fe', padding: '4px 10px', borderRadius: 4, marginBottom: 8, display: 'inline-block' }}>
          Entering data for: <strong>{geoScope.charAt(0).toUpperCase() + geoScope.slice(1)}</strong> area
          {geoScope === 'national' && ' (urban + rural → national rollup)'}
        </div>
      )}
      <h2 style={{ display: 'none' }}>
      </h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 9, color: '#64748b' }}>
        <span><span style={{ color: '#0000cc', fontWeight: 600 }}>Blue</span> = editable input</span>
        <span><span style={{ color: '#16a34a', fontWeight: 600 }}>Green</span> = linked from another section</span>
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
      <Section title="0. Country & Region">
        {inputs.country_config && <>
          {/* Country with searchable dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, gap: 6 }}>
            <label style={{ flex: 1, fontSize: 11, color: '#0000cc', fontWeight: 500 }}>Country</label>
            <input type="text" list="country-list" value={inputs.country_config.country || ''}
              onChange={e => setCountryConfig('country', e.target.value)}
              style={{ width: 120, padding: '3px 5px', border: '1px solid #ccc', borderRadius: 3, fontSize: 11 }}
              placeholder="Type to search..."
            />
            <datalist id="country-list">
              {countries.map(c => <option key={c.name} value={c.name} />)}
            </datalist>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, gap: 6 }}>
            <label style={{ flex: 1, fontSize: 11, color: '#0000cc', fontWeight: 500 }}>Region</label>
            <input type="text" value={inputs.country_config.area || ''}
              onChange={e => setCountryConfig('area', e.target.value)}
              style={{ width: 120, padding: '3px 5px', border: '1px solid #ccc', borderRadius: 3, fontSize: 11 }}
              placeholder="e.g. Kathmandu Valley" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, gap: 6 }}>
            <label style={{ flex: 1, fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>Scope</label>
            <span style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, padding: '3px 8px', background: '#e0f2fe', borderRadius: 3 }}>
              {geoScope.charAt(0).toUpperCase() + geoScope.slice(1)}
            </span>
            <span style={{ fontSize: 9, color: '#94a3b8' }}>(set in header)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, gap: 6 }}>
            <label style={{ flex: 1, fontSize: 11, color: '#0000cc', fontWeight: 500 }}>Local currency code</label>
            <input type="text" value={inputs.country_config.currency || ''}
              onChange={e => setCountryConfig('currency', e.target.value)}
              style={{ width: 120, padding: '3px 5px', border: '1px solid #ccc', borderRadius: 3, fontSize: 11 }} />
          </div>
        </>}
      </Section>

      {/* ===== PERIOD ===== */}
      <Section title="1. Period">
        <F label="Model start year" value={inputs.period.model_start_year} onChange={v => u('period','model_start_year',v)} min={1990} max={inputs.period.baseline_year} tip="First year of historical data; must be before or equal to baseline year" />
        <F label="Forecast end year" value={inputs.period.forecast_end_year} onChange={v => u('period','forecast_end_year',v)} min={inputs.period.baseline_year + 5} max={2060} tip="Last year of projection; all years after baseline are forecasted" />
        <F label="Baseline year" value={inputs.period.baseline_year} onChange={v => u('period','baseline_year',v)} min={inputs.period.model_start_year} max={new Date().getFullYear() - 1} tip="Last year with complete actual data; must be a finished year" />
        <F label="Performance improvement start year" value={inputs.period.perf_improvement_start_year || (inputs.period.baseline_year + 1)} onChange={v => u('period','perf_improvement_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year when performance improvements begin" />
        <F label="Target 1 year" value={inputs.period.target1_year} onChange={v => u('period','target1_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="First milestone year; must be after baseline" />
        <F label="Target 2 year" value={inputs.period.target2_year} onChange={v => u('period','target2_year',v)} min={inputs.period.target1_year} max={inputs.period.forecast_end_year} tip="Final milestone year; must equal or exceed Target 1" />
      </Section>

      {/* ===== MACROECONOMICS ===== */}
      <Section title="2. Macroeconomics">
        <F label="Year for real prices" value={inputs.macro.real_price_year} onChange={v => u('macro','real_price_year',v)} min={inputs.period.model_start_year} max={inputs.period.baseline_year} tip="Base year for converting nominal to real values; must be a year with actual data" />
        <SubHead text="Time-series data (year by year)" />
        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                <th style={{ padding: '3px 4px', textAlign: 'left' }}>Year</th>
                <th style={{ padding: '3px 4px', textAlign: 'right' }}>GDP gr%</th>
                <th style={{ padding: '3px 4px', textAlign: 'right' }}>Infl Nepal%</th>
                <th style={{ padding: '3px 4px', textAlign: 'right' }}>Infl US%</th>
                <th style={{ padding: '3px 4px', textAlign: 'right' }}>USD/NPR</th>
                <th style={{ padding: '3px 4px', textAlign: 'right' }}>GDP $B</th>
              </tr>
            </thead>
            <tbody>
              {inputs.macro.gdp_growth.map((_: number, i: number) => {
                const yr = (inputs.period.model_start_year || 2011) + i;
                const tsInput = (field: string, idx: number, val: number, isPct: boolean) => (
                  <input type="number" value={isPct ? Math.round(val*10000)/100 : Math.round(val*1000)/1000}
                    onChange={e => { const v=parseFloat(e.target.value); if(!isNaN(v)){
                      const arr=[...inputs.macro[field]]; arr[idx]=isPct?v/100:v;
                      onChange({...inputs, macro:{...inputs.macro, [field]:arr}});
                    }}}
                    style={{ width: 52, padding: '1px 2px', border: '1px solid #ddd', borderRadius: 2, fontSize: 10, textAlign: 'right' }}
                  />
                );
                return (
                  <tr key={i} style={{ background: i % 2 ? '#fafbfc' : '#fff' }}>
                    <td style={{ padding: '1px 4px', fontWeight: 600 }}>{yr}</td>
                    <td style={{ padding: '1px 2px' }}>{tsInput('gdp_growth',i,inputs.macro.gdp_growth[i],true)}</td>
                    <td style={{ padding: '1px 2px' }}>{tsInput('inflation_nepal',i,inputs.macro.inflation_nepal[i],true)}</td>
                    <td style={{ padding: '1px 2px' }}>{tsInput('inflation_us',i,inputs.macro.inflation_us[i],true)}</td>
                    <td style={{ padding: '1px 2px' }}>{tsInput('exchange_rate',i,inputs.macro.exchange_rate[i],false)}</td>
                    <td style={{ padding: '1px 2px' }}>{tsInput('gdp_nominal_usd',i,inputs.macro.gdp_nominal_usd[i],false)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ===== POPULATION ===== */}
      <Section title="3. Population">
        <SubHead text={`Start year (${startYr})`} />
        <F label={`Total ${scopeLabel} population, ${startYr}`} value={inputs.population.total_pop_start} onChange={v => u('population','total_pop_start',v)} min={10000} max={100000000} tip={`${scopeLabel} population at model start year (census)`} />
        <F label={`Total ${scopeLabel} HHs, ${startYr} (mill)`} value={inputs.population.total_hh_start} onChange={v => u('population','total_hh_start',v)} step={0.001} unit="mill" min={0.001} max={50} tip={`Total ${scopeLower} households in millions`} />
        <SubHead text={`Baseline year (${baseYr})`} />
        <F label={`Total ${scopeLabel} population, ${baseYr}`} value={inputs.population.total_pop_baseline} onChange={v => u('population','total_pop_baseline',v)} min={10000} max={100000000} tip={`${scopeLabel} population at baseline year (estimate)`} />
        <F label={`Total ${scopeLabel} HHs, ${baseYr} (mill)`} value={inputs.population.total_hh_baseline} onChange={v => u('population','total_hh_baseline',v)} step={0.01} unit="mill" min={0.001} max={50} tip={`Total ${scopeLower} households in millions`} />
        <SubHead text="Computed growth rates" />
        <F label="Population CAGR (calculated)" value={popCagr} onChange={() => {}} fieldType="computed" isPercent unit="%" tip={`CAGR from ${startYr} to ${baseYr}: (${(pop.total_pop_baseline||0).toLocaleString()} / ${(pop.total_pop_start||0).toLocaleString()})^(1/${nYears}) - 1`} />
        <F label="Avg HH size CAGR (calculated)" value={hhSizeCagr} onChange={() => {}} fieldType="computed" isPercent unit="%" tip={`Average HH size: ${avgHHSizeStart.toFixed(2)} (${startYr}) → ${avgHHSizeBase.toFixed(2)} (${baseYr})`} />
      </Section>

      {/* ===== WATER SERVICE LEVELS ===== */}
      <Section title="4. Water Supply Service Levels">
        <SubHead text={`% HHs by service level, ${startYr}`} />
        <F label={`% HHs ${ws[0]}`} value={inputs.water_service.pct_serv1_start} onChange={v => u('water_service','pct_serv1_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[1]}`} value={inputs.water_service.pct_serv2_start} onChange={v => u('water_service','pct_serv2_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[2]}`} value={inputs.water_service.pct_serv3_start} onChange={v => u('water_service','pct_serv3_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[3]}`} value={inputs.water_service.pct_serv4_start} onChange={v => u('water_service','pct_serv4_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[4]}`} value={inputs.water_service.pct_serv5_start} onChange={v => u('water_service','pct_serv5_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />

        <SubHead text={`% HHs by service level, ${baseYr}`} />
        <F label={`% HHs ${ws[0]}`} value={inputs.water_service.pct_serv1_baseline} onChange={v => u('water_service','pct_serv1_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[1]}`} value={inputs.water_service.pct_serv2_baseline} onChange={v => u('water_service','pct_serv2_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[2]}`} value={inputs.water_service.pct_serv3_baseline} onChange={v => u('water_service','pct_serv3_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[3]}`} value={inputs.water_service.pct_serv4_baseline} onChange={v => u('water_service','pct_serv4_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% HHs ${ws[4]}`} value={inputs.water_service.pct_serv5_baseline} onChange={v => u('water_service','pct_serv5_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
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
      <Section title="5. Sanitation Service Levels">
        <SubHead text={`% HHs by service level, ${startYr}`} />
        <F label={`% ${ss[0]}`} value={inputs.sanitation_service.pct_sserv1_start} onChange={v => u('sanitation_service','pct_sserv1_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[1]}`} value={inputs.sanitation_service.pct_sserv2_start} onChange={v => u('sanitation_service','pct_sserv2_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[2]}`} value={inputs.sanitation_service.pct_sserv3_start} onChange={v => u('sanitation_service','pct_sserv3_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[3]}`} value={inputs.sanitation_service.pct_sserv4_start} onChange={v => u('sanitation_service','pct_sserv4_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[4]}`} value={inputs.sanitation_service.pct_sserv5_start} onChange={v => u('sanitation_service','pct_sserv5_start',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />

        <SubHead text={`% HHs by service level, ${baseYr}`} />
        <F label={`% ${ss[0]}`} value={inputs.sanitation_service.pct_sserv1_baseline} onChange={v => u('sanitation_service','pct_sserv1_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[1]}`} value={inputs.sanitation_service.pct_sserv2_baseline} onChange={v => u('sanitation_service','pct_sserv2_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[2]}`} value={inputs.sanitation_service.pct_sserv3_baseline} onChange={v => u('sanitation_service','pct_sserv3_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[3]}`} value={inputs.sanitation_service.pct_sserv4_baseline} onChange={v => u('sanitation_service','pct_sserv4_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
        <F label={`% ${ss[4]}`} value={inputs.sanitation_service.pct_sserv5_baseline} onChange={v => u('sanitation_service','pct_sserv5_baseline',v)} isPercent unit="%" min={0} max={1.0} tip={`Share of ${scopeLower} HHs at this service level; all 5 must sum to 100%`} />
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
      <Section title="6. Water Supply Targets">
        <SubHead text="Service Capacity" />
        <F label="Total planned treatment capacity" value={inputs.water_targets.planned_treatment_capacity_mld} onChange={v => u('water_targets','planned_treatment_capacity_mld',v)} unit="MLD" min={0} max={5000} tip="Total planned treatment capacity including existing and new" />
        <SubHead text="Water providers" />
        {(inputs.water_targets.providers || []).map((prov: any, idx: number) => {
          const updateProv = (field: string, val: any) => {
            const provs = [...inputs.water_targets.providers];
            provs[idx] = { ...provs[idx], [field]: val };
            onChange({ ...inputs, water_targets: { ...inputs.water_targets, providers: provs } });
          };
          return (
            <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', marginBottom: 6, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <input type="text" value={prov.name} onChange={e => updateProv('name', e.target.value)}
                  style={{ flex: 1, border: '1px solid #ccc', borderRadius: 3, padding: '2px 5px', fontSize: 11, fontWeight: 600 }} />
                {inputs.water_targets.providers.length > 1 && (
                  <button onClick={() => {
                    const provs = inputs.water_targets.providers.filter((_: any, i: number) => i !== idx);
                    onChange({ ...inputs, water_targets: { ...inputs.water_targets, providers: provs } });
                  }} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>✕</button>
                )}
              </div>
              <F label="Share %" value={prov.share_pct} onChange={v => updateProv('share_pct', v)} isPercent unit="%" min={0} max={1.0} tip="Share of target HHs served by this provider; all must sum to 100%" />
              <F label="Network cost per HH" value={prov.network_cost_per_hh} onChange={v => updateProv('network_cost_per_hh', v)} unit={CUR} min={0} max={10000000} tip="Cost to connect one HH" />
              <F label="Treatment cost per MLD" value={prov.cost_per_mld_treatment} onChange={v => updateProv('cost_per_mld_treatment', v)} unit={`${CUR} M`} min={0} max={100000} tip="Cost to build 1 MLD treatment capacity" />
              <F label="Existing capacity" value={prov.existing_capacity_mld} onChange={v => updateProv('existing_capacity_mld', v)} unit="MLD" min={0} max={10000} tip="Existing treatment capacity at baseline" />
            </div>
          );
        })}
        <button onClick={() => {
          const provs = [...(inputs.water_targets.providers || []), { name: 'New Provider', share_pct: 0, network_cost_per_hh: 0, cost_per_mld_treatment: 0, existing_capacity_mld: 0 }];
          onChange({ ...inputs, water_targets: { ...inputs.water_targets, providers: provs } });
        }} style={{ width: '100%', padding: '4px', border: '1px dashed #94a3b8', borderRadius: 4, background: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', marginBottom: 8 }}>
          + Add Water Provider
        </button>
        <SubHead text="Service Targets" />
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          Number of HHs per level calculated automatically from population
        </div>
        <SubHead text="Target 1 (2030)" />
        <F label={`% ${ws[0]}`} value={inputs.water_targets.target1_serv1} onChange={v => u('water_targets','target1_serv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[1]}`} value={inputs.water_targets.target1_serv2} onChange={v => u('water_targets','target1_serv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[2]}`} value={inputs.water_targets.target1_serv3} onChange={v => u('water_targets','target1_serv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[3]}`} value={inputs.water_targets.target1_serv4} onChange={v => u('water_targets','target1_serv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[4]}`} value={inputs.water_targets.target1_serv5} onChange={v => u('water_targets','target1_serv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <SubHead text="Target 2 (2040)" />
        <F label={`% ${ws[0]}`} value={inputs.water_targets.target2_serv1} onChange={v => u('water_targets','target2_serv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[1]}`} value={inputs.water_targets.target2_serv2} onChange={v => u('water_targets','target2_serv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[2]}`} value={inputs.water_targets.target2_serv3} onChange={v => u('water_targets','target2_serv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[3]}`} value={inputs.water_targets.target2_serv4} onChange={v => u('water_targets','target2_serv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
        <F label={`% ${ws[4]}`} value={inputs.water_targets.target2_serv5} onChange={v => u('water_targets','target2_serv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share of HHs at this service level; all 5 must sum to 100%" />
      </Section>

      {/* ===== SANITATION TARGETS ===== */}
      <Section title="7. Sanitation Targets">
        <SubHead text="Service Capacity" />
        <SubHead text="Sanitation providers" />
        {(inputs.sanitation_targets.providers || []).map((prov: any, idx: number) => {
          const updateSanProv = (field: string, val: any) => {
            const provs = [...inputs.sanitation_targets.providers];
            provs[idx] = { ...provs[idx], [field]: val };
            onChange({ ...inputs, sanitation_targets: { ...inputs.sanitation_targets, providers: provs } });
          };
          return (
            <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', marginBottom: 6, background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <input type="text" value={prov.name} onChange={e => updateSanProv('name', e.target.value)}
                  style={{ flex: 1, border: '1px solid #ccc', borderRadius: 3, padding: '2px 5px', fontSize: 11, fontWeight: 600 }} />
                {inputs.sanitation_targets.providers.length > 1 && (
                  <button onClick={() => {
                    const provs = inputs.sanitation_targets.providers.filter((_: any, i: number) => i !== idx);
                    onChange({ ...inputs, sanitation_targets: { ...inputs.sanitation_targets, providers: provs } });
                  }} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>✕</button>
                )}
              </div>
              <F label="Share %" value={prov.share_pct} onChange={v => updateSanProv('share_pct', v)} isPercent unit="%" min={0} max={1.0} tip="Share of target HHs; all must sum to 100%" />
              <F label="Sewer cost per HH" value={prov.sewer_cost_per_hh} onChange={v => updateSanProv('sewer_cost_per_hh', v)} unit={CUR} min={0} max={10000000} />
              <F label="WWT cost per MLD" value={prov.wwt_cost_per_mld} onChange={v => updateSanProv('wwt_cost_per_mld', v)} unit={`${CUR} M`} min={0} max={100000} />
              <F label="Existing WWT capacity" value={prov.existing_wwt_capacity_mld} onChange={v => updateSanProv('existing_wwt_capacity_mld', v)} unit="MLD" min={0} max={10000} />
            </div>
          );
        })}
        <button onClick={() => {
          const provs = [...(inputs.sanitation_targets.providers || []), { name: 'New Provider', share_pct: 0, sewer_cost_per_hh: 0, wwt_cost_per_mld: 0, existing_wwt_capacity_mld: 0 }];
          onChange({ ...inputs, sanitation_targets: { ...inputs.sanitation_targets, providers: provs } });
        }} style={{ width: '100%', padding: '4px', border: '1px dashed #94a3b8', borderRadius: 4, background: 'none', cursor: 'pointer', fontSize: 11, color: '#2563eb', marginBottom: 8 }}>
          + Add Sanitation Provider
        </button>
        <SubHead text="On-site sanitation (separate from sewered providers)" />
        <F label="On-site with collection & treatment %" value={inputs.sanitation_targets.onsite_collection_treatment_pct} onChange={v => u('sanitation_targets','onsite_collection_treatment_pct',v)} isPercent unit="%" min={0} max={1.0} tip="Share of safely managed HHs served by on-site systems (septic tanks with fecal sludge collection). Provider shares + on-site must sum to 100%." />
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          Providers ({Math.round((inputs.sanitation_targets.providers || []).reduce((s: number, p: any) => s + p.share_pct, 0) * 100)}%) + On-site ({Math.round((inputs.sanitation_targets.onsite_collection_treatment_pct || 0) * 100)}%) = {Math.round(((inputs.sanitation_targets.providers || []).reduce((s: number, p: any) => s + p.share_pct, 0) + (inputs.sanitation_targets.onsite_collection_treatment_pct || 0)) * 100)}%
        </div>
        <SubHead text="Service Targets" />
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, padding: '4px 8px', background: '#f8fafc', borderRadius: 4 }}>
          Number of HHs per level calculated automatically from population
        </div>
        <SubHead text="Target 1 (2030)" />
        <F label={`% ${ss[0]}`} value={inputs.sanitation_targets.target1_sserv1} onChange={v => u('sanitation_targets','target1_sserv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[1]}`} value={inputs.sanitation_targets.target1_sserv2} onChange={v => u('sanitation_targets','target1_sserv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[2]}`} value={inputs.sanitation_targets.target1_sserv3} onChange={v => u('sanitation_targets','target1_sserv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[3]}`} value={inputs.sanitation_targets.target1_sserv4} onChange={v => u('sanitation_targets','target1_sserv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[4]}`} value={inputs.sanitation_targets.target1_sserv5} onChange={v => u('sanitation_targets','target1_sserv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <SubHead text="Target 2 (2040)" />
        <F label={`% ${ss[0]}`} value={inputs.sanitation_targets.target2_sserv1} onChange={v => u('sanitation_targets','target2_sserv1',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[1]}`} value={inputs.sanitation_targets.target2_sserv2} onChange={v => u('sanitation_targets','target2_sserv2',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[2]}`} value={inputs.sanitation_targets.target2_sserv3} onChange={v => u('sanitation_targets','target2_sserv3',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[3]}`} value={inputs.sanitation_targets.target2_sserv4} onChange={v => u('sanitation_targets','target2_sserv4',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
        <F label={`% ${ss[4]}`} value={inputs.sanitation_targets.target2_sserv5} onChange={v => u('sanitation_targets','target2_sserv5',v)} isPercent unit="%" min={0} max={1.0} tip="Target share at this service level; all 5 must sum to 100%" />
      </Section>
      </>}

      {isBAU && <>
      {/* ===== WATER UNIT COSTS ===== */}
      <Section title="8. Water Supply Unit Costs">
        <SubHead text="Distribution network cost per HH" />
        <F label={ws[0]} value={inputs.water_costs.network_cost_per_hh_serv1} onChange={v => u('water_costs','network_cost_per_hh_serv1',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to the distribution network" />
        <F label={ws[1]} value={inputs.water_costs.network_cost_per_hh_serv2} onChange={v => u('water_costs','network_cost_per_hh_serv2',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to the distribution network" />
        <F label={ws[2]} value={inputs.water_costs.network_cost_per_hh_serv3} onChange={v => u('water_costs','network_cost_per_hh_serv3',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to the distribution network" />
        <F label={ws[3]} value={inputs.water_costs.network_cost_per_hh_serv4} onChange={v => u('water_costs','network_cost_per_hh_serv4',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to the distribution network" />
        <F label={ws[4]} value={inputs.water_costs.network_cost_per_hh_serv5} onChange={v => u('water_costs','network_cost_per_hh_serv5',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to the distribution network" />
        <SubHead text="Water treatment" />
        <F label="Cost per MLD water treatment" value={inputs.water_costs.ws_cost_per_mld_treatment || 0} onChange={v => u('water_costs','ws_cost_per_mld_treatment',v)} step={100} unit={`${CUR} M`} min={0} max={100000} tip="Capital cost to build 1 MLD of water treatment capacity" />
        <SubHead text="Non-piped solutions" />
        <F label="Cost of a dug well" value={inputs.water_costs.dug_well_cost} onChange={v => u('water_costs','dug_well_cost',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost of constructing a dug well for one household" />
        <F label="Cost of borehole + handpump" value={inputs.water_costs.borehole_cost} onChange={v => u('water_costs','borehole_cost',v)} step={10000} unit={CUR} min={0} max={10000000} tip="Capital cost of drilling a borehole and installing a handpump" />
        <F label="Cost of HH water treatment system" value={inputs.water_costs.hh_treatment_system_cost} onChange={v => u('water_costs','hh_treatment_system_cost',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost of a household-level water treatment system" />
      </Section>

      {/* ===== SANITATION UNIT COSTS ===== */}
      <Section title="9. Sanitation Unit Costs">
        <SubHead text="Sewerage cost per HH" />
        <F label={ss[0]} value={inputs.sanitation_costs.sewer_cost_per_hh_sserv1} onChange={v => u('sanitation_costs','sewer_cost_per_hh_sserv1',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to sewer network + house connection" />
        <F label={ss[1]} value={inputs.sanitation_costs.sewer_cost_per_hh_sserv2} onChange={v => u('sanitation_costs','sewer_cost_per_hh_sserv2',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to sewer network + house connection" />
        <F label={ss[2]} value={inputs.sanitation_costs.sewer_cost_per_hh_sserv3} onChange={v => u('sanitation_costs','sewer_cost_per_hh_sserv3',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to sewer network + house connection" />
        <F label={ss[3]} value={inputs.sanitation_costs.sewer_cost_per_hh_sserv4} onChange={v => u('sanitation_costs','sewer_cost_per_hh_sserv4',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to sewer network + house connection" />
        <F label={ss[4]} value={inputs.sanitation_costs.sewer_cost_per_hh_sserv5} onChange={v => u('sanitation_costs','sewer_cost_per_hh_sserv5',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost to connect one HH to sewer network + house connection" />
        <SubHead text="Wastewater treatment" />
        <F label="Cost per MLD wastewater treatment" value={inputs.sanitation_costs.san_cost_per_mld_treatment || 0} onChange={v => u('sanitation_costs','san_cost_per_mld_treatment',v)} step={100} unit={`${CUR} M`} min={0} max={100000} tip="Capital cost to build 1 MLD of wastewater treatment capacity" />
        <SubHead text="On-site facility" />
        <F label="On-site facility Capex" value={inputs.sanitation_costs.onsite_facility_capex} onChange={v => u('sanitation_costs','onsite_facility_capex',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost of on-site sanitation facility" />
        <SubHead text={`Adoption rates (whole ${scopeLower} pop)`} />
        <F label="Septic tank" value={inputs.sanitation_costs.adopt_septic_tank} onChange={v => u('sanitation_costs','adopt_septic_tank',v)} isPercent unit="%" tip={`Share of ${scopeLower} population using this type; all types should sum to total on-site %`} />
        <F label="Pit latrine" value={inputs.sanitation_costs.adopt_pit_latrine} onChange={v => u('sanitation_costs','adopt_pit_latrine',v)} isPercent unit="%" tip={`Share of ${scopeLower} population using this type; all types should sum to total on-site %`} />
        <F label="VIP latrine" value={inputs.sanitation_costs.adopt_vip_latrine} onChange={v => u('sanitation_costs','adopt_vip_latrine',v)} isPercent unit="%" tip={`Share of ${scopeLower} population using this type; all types should sum to total on-site %`} />
        <F label="Pit latrine with slab" value={inputs.sanitation_costs.adopt_pit_with_slab} onChange={v => u('sanitation_costs','adopt_pit_with_slab',v)} isPercent unit="%" tip={`Share of ${scopeLower} population using this type; all types should sum to total on-site %`} />
        <F label="Composting toilet" value={inputs.sanitation_costs.adopt_composting_toilet} onChange={v => u('sanitation_costs','adopt_composting_toilet',v)} isPercent unit="%" tip={`Share of ${scopeLower} population using this type; all types should sum to total on-site %`} />
        <SubHead text="Cost per facility type" />
        <F label="Septic tank" value={inputs.sanitation_costs.cost_septic_tank} onChange={v => u('sanitation_costs','cost_septic_tank',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost of on-site sanitation facility" />
        <F label="Pit latrine" value={inputs.sanitation_costs.cost_pit_latrine} onChange={v => u('sanitation_costs','cost_pit_latrine',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost of on-site sanitation facility" />
        <F label="VIP latrine" value={inputs.sanitation_costs.cost_vip_latrine} onChange={v => u('sanitation_costs','cost_vip_latrine',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost of on-site sanitation facility" />
        <F label="Pit latrine with slab" value={inputs.sanitation_costs.cost_pit_with_slab} onChange={v => u('sanitation_costs','cost_pit_with_slab',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost of on-site sanitation facility" />
        <F label="Composting toilet" value={inputs.sanitation_costs.cost_composting_toilet} onChange={v => u('sanitation_costs','cost_composting_toilet',v)} step={1000} unit={CUR} min={0} max={10000000} tip="Capital cost of on-site sanitation facility" />
        <SubHead text="Collection capex" />
        <F label="Cost of FS collection truck" value={inputs.sanitation_costs.fs_truck_cost_mill} onChange={v => u('sanitation_costs','fs_truck_cost_mill',v)} step={0.5} unit={`${CUR} M`} min={0} max={100000} tip={`Capital cost of one fecal sludge collection truck in ${CUR} millions`} />
        <F label="Truck size" value={inputs.sanitation_costs.truck_size_m3} onChange={v => u('sanitation_costs','truck_size_m3',v)} unit="m3" min={0} max={100} tip="Volume capacity of one fecal sludge collection truck in cubic meters" />
        <F label="FS generated per person per day" value={inputs.sanitation_costs.fs_per_person_per_day_liters} onChange={v => u('sanitation_costs','fs_per_person_per_day_liters',v)} step={0.1} unit="liters" min={0} max={10} tip="Volume of fecal sludge generated per person per day in liters" />
        <F label="Emptying frequency" value={inputs.sanitation_costs.emptying_frequency_years} onChange={v => u('sanitation_costs','emptying_frequency_years',v)} unit="yrs" min={0} max={100} tip="Average years between emptying of on-site containment" />
        <F label="Trips per truck per year" value={inputs.sanitation_costs.trips_per_truck_year} onChange={v => u('sanitation_costs','trips_per_truck_year',v)} min={0} max={10000} tip="Number of collection trips one truck can make per year" />
        <F label="Cost of collection per HH" value={inputs.sanitation_costs.cost_collection_per_hh} onChange={v => u('sanitation_costs','cost_collection_per_hh',v)} step={500} unit={CUR} min={0} max={10000000} tip={`Cost in ${CUR}`} />
        <SubHead text="Treatment" />
        <F label="Cost per MLD fecal sludge treatment" value={inputs.sanitation_costs.cost_per_mld_fst} onChange={v => u('sanitation_costs','cost_per_mld_fst',v)} step={10} unit={`${CUR} M`} min={0} max={100000} tip="Capital cost to build 1 MLD of fecal sludge treatment capacity" />
      </Section>

      {/* ===== BAU INVESTMENT ===== */}
      <Section title="10. BAU Investment">
        <SubHead text="Investment periods" />
        <F label="Period 1 start" value={inputs.bau.period1_start} onChange={v => u('bau','period1_start',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Start of first planned investment period; must be after baseline" />
        <F label="Period 1 end" value={inputs.bau.period1_end} onChange={v => u('bau','period1_end',v)} min={inputs.bau.period1_start} max={inputs.period.forecast_end_year} tip="End of first planned investment period" />
        <F label="Period 2 start" value={inputs.bau.period2_start} onChange={v => u('bau','period2_start',v)} min={inputs.bau.period1_end + 1} max={inputs.period.forecast_end_year} tip="Start of second period; must be after period 1 ends" />
        <F label="Period 2 end" value={inputs.bau.period2_end} onChange={v => u('bau','period2_end',v)} min={inputs.bau.period2_start} max={inputs.period.forecast_end_year} tip="End of second planned investment period" />
        <F label="Period 3 start" value={inputs.bau.period3_start} onChange={v => u('bau','period3_start',v)} min={inputs.bau.period2_end + 1} max={inputs.period.forecast_end_year} tip="Start of third period; must be after period 2 ends" />
        <F label="Period 3 end" value={inputs.bau.period3_end} onChange={v => u('bau','period3_end',v)} min={inputs.bau.period3_start} max={inputs.period.forecast_end_year} tip="End of third planned investment period" />
        <SubHead text="Historic WASH spending as % of GDP" />
        <F label="Water as % of GDP, 2021" value={inputs.bau.ws_gdp_share_2021 || 0} onChange={v => u('bau','ws_gdp_share_2021',v)} isPercent unit="%" tip="Water sector spending as percentage of GDP" />
        <F label="Water as % of GDP, 2022" value={inputs.bau.ws_gdp_share_2022 || 0} onChange={v => u('bau','ws_gdp_share_2022',v)} isPercent unit="%" tip="Water sector spending as percentage of GDP" />
        <F label="Water as % of GDP, 2023" value={inputs.bau.ws_gdp_share_2023 || 0} onChange={v => u('bau','ws_gdp_share_2023',v)} isPercent unit="%" tip="Water sector spending as percentage of GDP" />
        <F label="Water as % of GDP, average" value={inputs.bau.ws_gdp_share_avg || 0} onChange={v => u('bau','ws_gdp_share_avg',v)} isPercent unit="%" tip="Water sector spending as percentage of GDP (average)" />
        <F label="Sanitation as % of GDP, 2021" value={inputs.bau.san_gdp_share_2021 || 0} onChange={v => u('bau','san_gdp_share_2021',v)} isPercent unit="%" tip="Sanitation sector spending as percentage of GDP" />
        <F label="Sanitation as % of GDP, 2022" value={inputs.bau.san_gdp_share_2022 || 0} onChange={v => u('bau','san_gdp_share_2022',v)} isPercent unit="%" tip="Sanitation sector spending as percentage of GDP" />
        <F label="Sanitation as % of GDP, 2023" value={inputs.bau.san_gdp_share_2023 || 0} onChange={v => u('bau','san_gdp_share_2023',v)} isPercent unit="%" tip="Sanitation sector spending as percentage of GDP" />
        <F label="Sanitation as % of GDP, average" value={inputs.bau.san_gdp_share_avg || 0} onChange={v => u('bau','san_gdp_share_avg',v)} isPercent unit="%" tip="Sanitation sector spending as percentage of GDP (average)" />
        <F label="WASH as % of GDP, 2021" value={inputs.bau.wash_gdp_share_2021 || 0} onChange={v => u('bau','wash_gdp_share_2021',v)} isPercent unit="%" tip="Combined WASH spending as percentage of GDP" />
        <F label="WASH as % of GDP, 2022" value={inputs.bau.wash_gdp_share_2022 || 0} onChange={v => u('bau','wash_gdp_share_2022',v)} isPercent unit="%" tip="Combined WASH spending as percentage of GDP" />
        <F label="WASH as % of GDP, 2023" value={inputs.bau.wash_gdp_share_2023 || 0} onChange={v => u('bau','wash_gdp_share_2023',v)} isPercent unit="%" tip="Combined WASH spending as percentage of GDP" />
        <F label="WASH as % of GDP, average" value={inputs.bau.wash_gdp_share_avg || 0} onChange={v => u('bau','wash_gdp_share_avg',v)} isPercent unit="%" tip="Combined WASH spending as percentage of GDP (average)" />
        <SubHead text="Budget allocation" />
        <F label="Proportion large urban networks" value={inputs.bau.large_urban_pct} onChange={v => u('bau','large_urban_pct',v)} isPercent unit="%" tip="Share of sector budget going to large urban networks" />
        <F label="Capital expenditure % of budget" value={inputs.bau.capex_pct_budget} onChange={v => u('bau','capex_pct_budget',v)} isPercent unit="%" tip="Share of total budget that is capital expenditure" />
      </Section>

      {/* ===== TECHNICAL ===== */}
      <Section title="11. Technical Inputs">
        <SubHead text="Water supply" />
        <F label="% water sold to domestic" value={inputs.technical.ws_pct_domestic} onChange={v => u('technical','ws_pct_domestic',v)} isPercent unit="%" tip="Share of water/wastewater sold to domestic customers" />
        <F label="Non-HH as % of HH" value={inputs.technical.ws_non_hh_pct_of_hh} onChange={v => u('technical','ws_non_hh_pct_of_hh',v)} isPercent unit="%" tip="Non-household infrastructure as percentage of household investment" />
        <F label="Useful life of assets" value={inputs.technical.ws_asset_life} onChange={v => u('technical','ws_asset_life',v)} unit="yrs" min={5} max={100} tip="Expected useful life of infrastructure assets" />
        <F label="Existing water treatment capacity" value={inputs.technical.ws_existing_treatment_mld} onChange={v => u('technical','ws_existing_treatment_mld',v)} unit="MLD" min={0} max={10000} tip="Capacity in million liters per day" />
        <F label="Number of treatment plants" value={inputs.technical.ws_num_treatment_plants} onChange={v => u('technical','ws_num_treatment_plants',v)} min={0} max={100} tip="Total number of water treatment plants in operation" />
        <F label="Water requirement per WHO" value={inputs.technical.ws_water_req_who_lpcd} onChange={v => u('technical','ws_water_req_who_lpcd',v)} unit="lpcd" min={20} max={200} tip="WHO minimum water requirement per person per day" />
        <SubHead text="Sanitation" />
        <F label="% wastewater sold to domestic" value={inputs.technical.san_pct_domestic} onChange={v => u('technical','san_pct_domestic',v)} isPercent unit="%" tip="Share of wastewater sold to domestic customers" />
        <F label="Non-HH as % of HH" value={inputs.technical.san_non_hh_pct_of_hh} onChange={v => u('technical','san_non_hh_pct_of_hh',v)} isPercent unit="%" tip="Non-household infrastructure as percentage of household investment" />
        <F label="Useful life of assets" value={inputs.technical.san_asset_life} onChange={v => u('technical','san_asset_life',v)} unit="yrs" min={5} max={100} tip="Expected useful life of infrastructure assets" />
        <SubHead text="Fecal sludge" />
        <F label="Existing FST capacity" value={inputs.technical.san_existing_fst_mld} onChange={v => u('technical','san_existing_fst_mld',v)} step={0.0001} unit="MLD" min={0} max={10000} tip="Capacity in million liters per day" />
        <F label="FS per person per day" value={inputs.technical.san_fs_per_person_per_day} onChange={v => u('technical','san_fs_per_person_per_day',v)} step={0.1} unit="liters" min={0} max={10} tip="Volume of fecal sludge generated per person per day in liters" />
        <F label="Factor wastewater of water supply" value={inputs.technical.san_wastewater_factor} onChange={v => u('technical','san_wastewater_factor',v)} isPercent unit="%" tip="Wastewater volume as share of water supply volume" />
      </Section>
      </>}

      {isInterventions && <>
      {/* ===== WATER INTERVENTIONS ===== */}
      <Section title="12. Water Interventions">
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
        <F label="Target NRW %" value={inputs.water_interventions.nrw_target_pct} onChange={v => u('water_interventions','nrw_target_pct',v)} isPercent unit="%" tip="Non-revenue water as share of total water produced" />
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
        <F label="Current O&M recovery ratio (calculated)" value={inputs.water_interventions.tariff_current_om_recovery || 0} onChange={() => {}} fieldType="computed" step={0.01} min={0} max={10} tip="Current ratio of operating revenue to operating expenditure (calculated)" />
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
        <F label={`Loan cap (${CUR} mill)`} value={inputs.water_interventions.loan_cap} onChange={v => u('water_interventions','loan_cap',v)} step={500} min={0} max={1000000} tip={`Maximum total loan amount in ${CUR} millions`} />

        <SubHead text="Budget execution improvement" />
        <F label="Start year" value={inputs.water_interventions.budget_exec_start_year || 0} onChange={v => u('water_interventions','budget_exec_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year budget execution improvement begins" />
        <F label="Current execution rate (calculated)" value={inputs.water_interventions.budget_exec_current_rate || 0} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Current budget execution rate (computed from historical data)" />
        <F label="Target execution rate" value={inputs.water_interventions.budget_exec_target_rate || 0} onChange={v => u('water_interventions','budget_exec_target_rate',v)} isPercent unit="%" tip="Target budget execution rate" />
      </Section>

      {/* ===== SANITATION INTERVENTIONS ===== */}
      <Section title="13. Sanitation Interventions">
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
        <F label="Current O&M recovery ratio" value={inputs.sanitation_interventions.tariff_current_om_recovery} onChange={v => u('sanitation_interventions','tariff_current_om_recovery',v)} step={0.1} min={0} max={10} tip="Current ratio of operating revenue to operating expenditure" />
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
        <F label={`Loan cap (${CUR} mill)`} value={inputs.sanitation_interventions.loan_cap} onChange={v => u('sanitation_interventions','loan_cap',v)} step={500} min={0} max={1000000} tip={`Maximum total loan amount in ${CUR} millions`} />

        <SubHead text="Budget execution improvement" />
        <F label="Start year" value={inputs.sanitation_interventions.budget_exec_start_year || 0} onChange={v => u('sanitation_interventions','budget_exec_start_year',v)} min={inputs.period.baseline_year + 1} max={inputs.period.forecast_end_year} tip="Year budget execution improvement begins" />
        <F label="Current execution rate (calculated)" value={inputs.sanitation_interventions.budget_exec_current_rate || 0} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Current budget execution rate (computed from historical data)" />
        <F label="Target execution rate" value={inputs.sanitation_interventions.budget_exec_target_rate || 0} onChange={v => u('sanitation_interventions','budget_exec_target_rate',v)} isPercent unit="%" tip="Target budget execution rate" />
      </Section>

      {/* ===== CUSTOM INTERVENTIONS ===== */}
      <Section title="14. Custom Interventions">
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
