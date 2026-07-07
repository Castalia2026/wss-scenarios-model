import React, { useState, useEffect, useCallback } from 'react';
import InputPanel from './components/InputPanel';
import InterventionPanel from './components/InterventionPanel';
import ResultsDashboard from './components/ResultsDashboard';
import LiveBAUChart from './components/LiveBAUChart';
import TestHarness from './components/TestHarness';
import { fetchDefaults, runCalculation } from './api';

export default function App() {
  const [inputs, setInputs] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [profileList, setProfileList] = useState<string[]>([]);
  const [scenarios, setScenarios] = useState<{name: string, inputs: any}[]>([]);
  // Two data-entry modes: 'urban_rural' (toggle Urban and/or Rural) or 'national' (single national dataset)
  const [scopeMode, setScopeMode] = useState<'urban_rural' | 'national'>('urban_rural');
  const [areaUrban, setAreaUrban] = useState(true);
  const [areaRural, setAreaRural] = useState(true);
  const [subArea, setSubArea] = useState<'urban' | 'rural'>('urban'); // which dataset is being edited when both are on
  const [altInputs, setAltInputs] = useState<Record<string, any>>({});
  const [sectorTab, setSectorTab] = useState<'water' | 'sanitation'>('water');
  const [showGuide, setShowGuide] = useState(false);
  const [guideSection, setGuideSection] = useState<string | null>(null);

  const refreshProfiles = () => {
    fetch('/api/profiles').then(r => r.json()).then(setProfileList).catch(() => {});
  };

  useEffect(() => {
    fetchDefaults().then(setInputs).catch(() => {});
    refreshProfiles();
    const saved = localStorage.getItem('wss_demo_scenarios');
    if (saved) setScenarios(JSON.parse(saved));
  }, []);

  const resizeMacroArrays = useCallback((inp: any) => {
    // Macro series are HARD VALUES ONLY (historical + any forecast years with data): the engine
    // fills the tail itself (ongoing inflation rates, GDP real-growth projection, FX from the
    // inflation differential). So arrays are only TRUNCATED if the model window shrinks — never
    // padded, or the ongoing/projection logic would be silently disabled.
    if (!inp?.period?.model_start_year || !inp?.period?.forecast_end_year || !inp?.macro) return inp;
    const needed = inp.period.forecast_end_year - inp.period.model_start_year + 1;
    const macroFields = ['gdp_growth', 'gdp_nominal_usd', 'inflation_nepal', 'inflation_us', 'exchange_rate'];
    let changed = false;
    const newMacro = { ...inp.macro };
    for (const field of macroFields) {
      const arr = newMacro[field];
      if (!arr || arr.length <= needed) continue;
      changed = true;
      newMacro[field] = arr.slice(0, needed);
    }
    return changed ? { ...inp, macro: newMacro } : inp;
  }, []);

  const handleSetInputs = useCallback((newInputs: any) => {
    setInputs(resizeMacroArrays(newInputs));
  }, [resizeMacroArrays]);

  // Resolve the scope into the concrete area being edited and what the graphs/outputs should show.
  const both = scopeMode === 'urban_rural' && areaUrban && areaRural;
  const onlyUrban = scopeMode === 'urban_rural' && areaUrban && !areaRural;
  const onlyRural = scopeMode === 'urban_rural' && !areaUrban && areaRural;
  // inputScope = which single dataset the input forms currently edit ('urban' | 'rural' | 'national')
  const inputScope = scopeMode === 'national' ? 'national'
    : both ? subArea
    : onlyRural ? 'rural'
    : 'urban';
  // chartScope = what graphs/outputs display: a single area, or the national aggregate when both areas are on
  const chartScope = scopeMode === 'national' ? 'national'
    : both ? 'urban_rural'
    : onlyRural ? 'rural'
    : 'urban';
  // 'urban' is the primary dataset (held in `inputs`); other areas keep their own dataset in altInputs.
  const activeInputs = inputScope === 'urban' ? inputs : (altInputs[inputScope] ?? inputs);
  // Live engine results for the ACTIVE dataset (debounced), so the input table can show the engine's
  // computed forecast-year values (population, GDP, budget, allocated/actual capex, …).
  const [results, setResults] = useState<any>(null);
  useEffect(() => {
    if (!activeInputs) return;
    const h = setTimeout(() => { runCalculation(activeInputs).then(setResults).catch(() => {}); }, 350);
    return () => clearTimeout(h);
  }, [activeInputs]);
  const handleSetActiveInputs = useCallback((newInputs: any) => {
    const resized = resizeMacroArrays(newInputs);
    if (inputScope === 'urban') setInputs(resized);
    else setAltInputs(prev => ({ ...prev, [inputScope]: resized }));
  }, [resizeMacroArrays, inputScope]);

  // Toggle whether Urban / Rural is included (at least one must stay on)
  const toggleArea = (area: 'urban' | 'rural') => {
    if (area === 'urban') {
      if (areaUrban && !areaRural) return;          // don't allow turning the last one off
      const next = !areaUrban;
      setAreaUrban(next);
      if (!next && subArea === 'urban') setSubArea('rural');
    } else {
      if (areaRural && !areaUrban) return;
      const next = !areaRural;
      setAreaRural(next);
      if (!next && subArea === 'rural') setSubArea('urban');
    }
  };

  const saveScenario = () => {
    const name = prompt('Name this scenario:');
    if (!name) return;
    const updated = [...scenarios, { name, inputs: JSON.parse(JSON.stringify(inputs)) }];
    setScenarios(updated);
    localStorage.setItem('wss_demo_scenarios', JSON.stringify(updated));
  };

  const deleteScenario = (idx: number) => {
    const updated = scenarios.filter((_, i) => i !== idx);
    setScenarios(updated);
    localStorage.setItem('wss_demo_scenarios', JSON.stringify(updated));
  };

  // Validation
  const warnings: string[] = [];
  if (inputs) {
    const p = inputs.period;
    // Year sequencing: model start < baseline < forecast end, with the target window inside it.
    if (p.model_start_year >= p.baseline_year) warnings.push('Model start year must be before the baseline year');
    else if (p.baseline_year - p.model_start_year < 3) warnings.push('Model start year should be at least 3 years before the baseline year');
    if (p.forecast_end_year <= p.baseline_year) warnings.push('Forecast end year must be after the baseline year');
    if (p.target1_year && (p.target1_year <= p.baseline_year || p.target1_year > p.forecast_end_year)) warnings.push('Target 1 year must be between the baseline year and the forecast end year');
    if (p.target2_year > p.forecast_end_year) warnings.push('Target 2 year cannot be after the forecast end year');
    if (p.baseline_year >= p.as_is_forecast_start) warnings.push('Baseline year must be before as-is forecast start');
    if (p.target2_year < p.target1_year) warnings.push('Target 2 year must be >= Target 1 year');
    const wt = inputs.water_targets;
    const wsSum = Math.round((wt.target1_serv1 + wt.target1_serv2 + wt.target1_serv3 + wt.target1_serv4 + wt.target1_serv5) * 100);
    if (wsSum !== 100) warnings.push(`Water Target 1 service levels sum to ${wsSum}%, must be 100%`);
    const wsSum2 = Math.round((wt.target2_serv1 + wt.target2_serv2 + wt.target2_serv3 + wt.target2_serv4 + wt.target2_serv5) * 100);
    if (wsSum2 !== 100) warnings.push(`Water Target 2 service levels sum to ${wsSum2}%, must be 100%`);
    if (wt.providers && wt.providers.length) {
      const provSum = Math.round(wt.providers.reduce((s: number, p: any) => s + p.share_pct, 0) * 100);
      if (provSum !== 100) warnings.push(`Water provider shares sum to ${provSum}%, must be 100%`);
    }
    const st = inputs.sanitation_targets;
    const ssSum = Math.round((st.target1_sserv1 + st.target1_sserv2 + st.target1_sserv3 + st.target1_sserv4 + st.target1_sserv5) * 100);
    if (ssSum !== 100) warnings.push(`Sanitation Target 1 service levels sum to ${ssSum}%, must be 100%`);
    if (st.providers && st.providers.length) {
      const sanProvSum = Math.round((st.providers.reduce((s: number, p: any) => s + p.share_pct, 0) + (st.onsite_collection_treatment_pct || 0)) * 100);
      if (sanProvSum !== 100) warnings.push(`Sanitation provider shares + on-site sum to ${sanProvSum}%, must be 100%`);
    }
  }

  const tabs = ['Data Inputs', 'BAU Scenario', 'Intervention Design', 'Results Dashboard', 'Export', 'Test Harness'];
  // Only Data Inputs, BAU and the Test Harness are active in this build; the rest are greyed out
  // until the intervention engine is ported and validated.
  const disabledTabs = new Set([2, 3, 4]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#002244', color: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>WSS Strategic Scenarios Simulation Tool</h1>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{inputs?.country_config?.country || ''} — {inputs?.country_config?.area || ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select onChange={async (e) => {
            const val = e.target.value;
            if (val === '__blank') { const res = await fetch('/api/defaults/blank'); setInputs(await res.json()); }
            else if (val === '__default') { const res = await fetch('/api/defaults'); setInputs(await res.json()); }
            else if (val) { const res = await fetch(`/api/profiles/${val}`); setInputs(await res.json()); }
            e.target.value = '';
          }} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.3)', background: '#1e3a5f', color: '#fff', fontSize: 11, cursor: 'pointer' }}>
            <option value="" style={{ background: '#fff', color: '#333' }}>Load Profile...</option>
            <option value="__default" style={{ background: '#fff', color: '#333' }}>Nepal KV (Default)</option>
            <option value="__blank" style={{ background: '#fff', color: '#333' }}>── New Blank Country ──</option>
            {profileList.length > 0 && <option disabled style={{ background: '#f1f5f9', color: '#94a3b8' }}>── Saved Profiles ──</option>}
            {profileList.map(name => (
              <option key={name} value={name} style={{ background: '#fff', color: '#333' }}>{name.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button onClick={async () => {
            const name = prompt('Save profile as:');
            if (!name) return;
            await fetch(`/api/profiles/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs) });
            refreshProfiles(); alert(`Profile "${name}" saved!`);
          }} style={headerBtnStyle}>💾 Save Profile</button>
          <button onClick={saveScenario} style={headerBtnStyle}>📋 Save Scenario</button>
          <button id="tool-overview-btn" onClick={() => setShowOnboarding(true)} style={headerBtnStyle}>📖 Tool Overview</button>
        </div>
      </header>

      {/* Saved scenarios bar */}
      {scenarios.length > 0 && (
        <div style={{ background: '#f0f9ff', borderBottom: '1px solid #bae6fd', padding: '4px 20px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
          <span style={{ color: '#0369a1', fontWeight: 600 }}>Saved scenarios:</span>
          {scenarios.map((s, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button onClick={() => handleSetInputs(JSON.parse(JSON.stringify(s.inputs)))}
                style={{ padding: '2px 8px', border: '1px solid #bae6fd', borderRadius: 3, background: '#e0f2fe', color: '#0369a1', cursor: 'pointer', fontSize: 10 }}>
                {s.name}
              </button>
              <button onClick={() => {
                // Export individual scenario slide
                fetch('/api/export/pptx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s.inputs) })
                  .then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `${s.name}_slide.pptx`; a.click(); });
              }} style={{ padding: '1px 4px', border: '1px solid #bae6fd', borderRadius: 2, background: '#fff', cursor: 'pointer', fontSize: 9, color: '#0369a1' }}>📑</button>
              <button onClick={() => deleteScenario(i)}
                style={{ padding: '1px 4px', border: '1px solid #fecaca', borderRadius: 2, background: '#fee2e2', cursor: 'pointer', fontSize: 9, color: '#dc2626' }}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <nav style={{ background: '#eef2f7', borderBottom: '2px solid #cbd5e1', display: 'flex', padding: '6px 20px 0', gap: 4 }}>
        {tabs.map((tab, i) => {
          const disabled = disabledTabs.has(i);
          return (
          <button key={tab} onClick={disabled ? undefined : () => setActiveTab(i)}
            disabled={disabled}
            title={disabled ? 'Not available in this build — the intervention engine is not yet ported/validated' : undefined}
            style={{
            padding: '10px 28px', border: 'none',
            borderRadius: '8px 8px 0 0',
            background: activeTab === i ? '#fff' : 'transparent',
            boxShadow: activeTab === i ? '0 -2px 6px rgba(0,0,0,0.08)' : 'none',
            cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: activeTab === i ? 700 : 500,
            color: disabled ? '#c3cbd6' : activeTab === i ? '#1e3a5f' : '#64748b',
            opacity: disabled ? 0.55 : 1,
            borderBottom: activeTab === i ? '2px solid #fff' : '2px solid transparent',
            marginBottom: -2,
            transition: 'all 0.15s',
            position: 'relative',
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                background: disabled ? '#d7dde6' : activeTab === i ? '#2563eb' : '#94a3b8',
                color: '#fff', flexShrink: 0,
              }}>{i + 1}</span>
              {tab}{disabled ? ' 🔒' : ''}
            </span>
          </button>
        );})}
      </nav>

      {warnings.length > 0 && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fbbf24', padding: '6px 20px', fontSize: 11 }}>
          {warnings.map((w, i) => <div key={i} style={{ color: '#92400e' }}>⚠ {w}</div>)}
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Scope bar. Full controls (mode + include) only on Data Inputs; BAU & Intervention get just the Editing switch. The dashboard has its own scope dropdown. */}
        {activeTab <= 2 && (
          <div style={{ background: '#eef2ff', borderBottom: '1px solid #c7d2fe', padding: '8px 24px' }}>
            {activeTab === 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#312e81' }}>Data entry mode:</span>
                  {([
                    { key: 'urban_rural', label: 'Urban / Rural', tip: 'Enter urban and rural data separately. Include both to produce a national total, or just one to analyse that area on its own.' },
                    { key: 'national', label: 'National', tip: 'This option should only be used if you do not have and cannot estimate urban/rural breakdowns for WSS data and access.' },
                  ] as const).map(m => (
                    <button key={m.key} onClick={() => setScopeMode(m.key)} title={m.tip} style={{
                      padding: '6px 20px', border: 'none', borderRadius: 6, cursor: 'pointer',
                      background: scopeMode === m.key ? '#2563eb' : '#fff',
                      color: scopeMode === m.key ? '#fff' : '#374151',
                      fontWeight: scopeMode === m.key ? 700 : 500, fontSize: 13,
                      boxShadow: scopeMode === m.key ? '0 2px 6px rgba(37,99,235,0.3)' : '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s',
                    }}>{m.label}</button>
                  ))}
                </div>
                {scopeMode === 'urban_rural' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Include:</span>
                    {([{ key: 'urban', on: areaUrban }, { key: 'rural', on: areaRural }] as const).map(a => (
                      <button key={a.key} onClick={() => toggleArea(a.key)} style={{
                        padding: '5px 14px', border: a.on ? '1px solid #2563eb' : '1px solid #cbd5e1', borderRadius: 14, cursor: 'pointer',
                        background: a.on ? '#2563eb' : '#fff',
                        color: a.on ? '#fff' : '#94a3b8',
                        fontWeight: a.on ? 700 : 500, fontSize: 12, transition: 'all 0.15s', textTransform: 'capitalize',
                      }}>{a.on ? '✓ ' : ''}{a.key}</button>
                    ))}
                    {both ? (
                      <>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginLeft: 8 }}>Editing:</span>
                        {(['urban', 'rural'] as const).map(a => (
                          <button key={a} onClick={() => setSubArea(a)} style={{
                            padding: '5px 14px', border: '1px solid #c7d2fe', borderRadius: 14, cursor: 'pointer',
                            background: subArea === a ? '#312e81' : '#fff',
                            color: subArea === a ? '#fff' : '#475569',
                            fontWeight: subArea === a ? 700 : 500, fontSize: 12, transition: 'all 0.15s', textTransform: 'capitalize',
                          }}>{a}</button>
                        ))}
                        <span style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>Graphs &amp; outputs show National (Urban + Rural).</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', marginLeft: 4 }}>Graphs &amp; outputs show {onlyRural ? 'Rural' : 'Urban'} only.</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {both ? (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Editing:</span>
                    {(['urban', 'rural'] as const).map(a => (
                      <button key={a} onClick={() => setSubArea(a)} style={{
                        padding: '5px 14px', border: '1px solid #c7d2fe', borderRadius: 14, cursor: 'pointer',
                        background: subArea === a ? '#312e81' : '#fff',
                        color: subArea === a ? '#fff' : '#475569',
                        fontWeight: subArea === a ? 700 : 500, fontSize: 12, transition: 'all 0.15s', textTransform: 'capitalize',
                      }}>{a}</button>
                    ))}
                    <span style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>Graphs &amp; outputs show National (Urban + Rural). Change the scope on the Data Inputs tab.</span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Scope: <strong style={{ color: '#312e81' }}>{scopeMode === 'national' ? 'National' : onlyRural ? 'Rural' : 'Urban'}</strong>
                    <span style={{ fontStyle: 'italic', marginLeft: 6 }}>(set on the Data Inputs tab)</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {activeTab === 0 && inputs && (
          <InputPanel inputs={activeInputs} onChange={handleSetActiveInputs} results={results} geoScope={inputScope} showSection="inputs" onSectionFocus={(key) => { setGuideSection(key); setShowGuide(true); }} />
        )}
        {activeTab === 1 && inputs && (<>
          <div style={{ flex: '0 1 460px', display: 'flex', minWidth: 0 }}>
            <InputPanel inputs={activeInputs} onChange={handleSetActiveInputs} geoScope={inputScope} showSection="bau" bauSector={sectorTab} onBauSectorChange={setSectorTab} onSectionFocus={(key) => { setGuideSection(key); setShowGuide(true); }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', minWidth: 0 }}>
            {chartScope === 'urban_rural' ? (
              // Both areas entered: show Urban, Rural, and the National (Urban + Rural) aggregate.
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <LiveBAUChart inputsList={[inputs]} sector={sectorTab} scopeLabel="Urban" />
                <LiveBAUChart inputsList={[altInputs['rural'] ?? inputs]} sector={sectorTab} scopeLabel="Rural" />
                <LiveBAUChart inputsList={[inputs, altInputs['rural'] ?? inputs]} sector={sectorTab} scopeLabel="National" />
              </div>
            ) : (
              <LiveBAUChart inputsList={[activeInputs]} sector={sectorTab}
                scopeLabel={inputScope === 'national' ? 'National' : inputScope === 'rural' ? 'Rural' : 'Urban'} />
            )}
          </div>
        </>)}
        {activeTab === 2 && inputs && (
          <InterventionPanel inputs={activeInputs} onChange={handleSetActiveInputs} sectorTab={sectorTab} onSectorChange={setSectorTab} geoScope={inputScope} chartScope={chartScope} onSectionFocus={(key) => { setGuideSection(key); setShowGuide(true); }} />
        )}
        {/* Guide panel — tabs 0, 1, 2 */}
        {activeTab <= 2 && (
          <>
            <button onClick={() => setShowGuide(!showGuide)} style={{
              position: 'absolute', right: showGuide ? 320 : 0, top: 12,
              padding: '8px 6px', border: '1px solid #cbd5e1', borderRight: showGuide ? 'none' : undefined,
              borderRadius: '6px 0 0 6px',
              background: showGuide ? '#eef2ff' : '#f8fafc', cursor: 'pointer',
              fontSize: 11, color: '#4338ca', fontWeight: 600, zIndex: 10,
              writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: 1,
              boxShadow: '-2px 0 6px rgba(0,0,0,0.06)', transition: 'right 0.2s',
            }}>
              {showGuide ? '✕ Close' : '📋 Guide'}
            </button>
            {showGuide && <DataGuide tab={activeTab} activeSection={guideSection} />}
          </>
        )}

        {activeTab === 3 && (
          <ResultsDashboard geoScope={chartScope} scenarios={scenarios} inputs={inputs} />
        )}
        {activeTab === 5 && inputs && (
          <TestHarness inputs={activeInputs} onChange={handleSetActiveInputs} />
        )}
        {activeTab === 4 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
            <h2 style={{ fontSize: 18, color: '#1e3a5f', marginBottom: 16 }}>Export Outputs</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Download your scenario results in various formats for reporting and further analysis.</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'PowerPoint Presentation', desc: 'Slides with charts and summary tables', icon: '📊', ext: 'pptx', endpoint: '/api/export/pptx' },
                { label: 'Excel Workbook', desc: 'Full data tables for offline analysis', icon: '📗', ext: 'xlsx', endpoint: '/api/export/xlsx' },
                { label: 'CSV Data', desc: 'Raw data for import into other tools', icon: '📄', ext: 'csv', endpoint: '/api/export/csv' },
              ].map(fmt => (
                <button key={fmt.ext} onClick={() => {
                  fetch(fmt.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs || {}) })
                    .then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `wss_results.${fmt.ext}`; a.click(); });
                }} style={{
                  padding: '20px 24px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff',
                  cursor: 'pointer', textAlign: 'left', width: 220, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{fmt.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e3a5f', marginBottom: 4 }}>{fmt.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{fmt.desc}</div>
                </button>
              ))}
            </div>
            {scenarios.length > 0 && <>
              <h3 style={{ fontSize: 15, color: '#1e3a5f', marginTop: 32, marginBottom: 12 }}>Export Individual Scenarios</h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {scenarios.map((s, i) => (
                  <button key={i} onClick={() => {
                    fetch('/api/export/pptx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s.inputs) })
                      .then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `${s.name}.pptx`; a.click(); });
                  }} style={{ padding: '10px 16px', border: '1px solid #bae6fd', borderRadius: 6, background: '#f0f9ff', cursor: 'pointer', fontSize: 12, color: '#0369a1' }}>
                    📑 {s.name}
                  </button>
                ))}
              </div>
            </>}
          </div>
        )}

        </div>
      </div>

      {/* Onboarding */}
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
    </div>
  );
}

function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [closing, setClosing] = React.useState(false);
  const [showArrow, setShowArrow] = React.useState(false);
  const [ovTab, setOvTab] = React.useState<'start' | 'saving'>('start');

  const handleGetStarted = () => {
    // Show arrow animation pointing to the Tool Overview button — only the first time
    const seen = localStorage.getItem('wss_overview_arrow_seen');
    setClosing(true);
    if (!seen) {
      setShowArrow(true);
      localStorage.setItem('wss_overview_arrow_seen', '1');
      setTimeout(() => { setShowArrow(false); onClose(); }, 1800);
    } else {
      setTimeout(() => { onClose(); }, 300);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: closing ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.5s' }} onClick={closing ? undefined : onClose}>
      {/* Arrow animation pointing up at the Tool Overview button (top-right of header) */}
      {showArrow && (
        <div style={{
          position: 'fixed', top: 48, right: 24, zIndex: 1100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          animation: 'bounceArrow 0.7s ease-in-out infinite',
        }}>
          <span style={{ fontSize: 34, color: '#2563eb', lineHeight: 1, filter: 'drop-shadow(0 2px 6px rgba(37,99,235,0.4))' }}>⬆</span>
          <span style={{ fontSize: 13, color: '#fff', background: '#2563eb', padding: '6px 14px', borderRadius: 20, fontWeight: 600, boxShadow: '0 2px 12px rgba(37,99,235,0.5)', whiteSpace: 'nowrap' }}>
            Reopen this anytime here
          </span>
        </div>
      )}
      <style>{`@keyframes bounceArrow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>

      {!closing && (
        <div style={{ background: '#fff', borderRadius: 12, maxWidth: 1040, width: '96%', maxHeight: '96vh', overflowY: 'auto', padding: '22px 40px' }} onClick={e => e.stopPropagation()}>
          <h2 style={{ fontSize: 20, color: '#002244', margin: '0 0 10px' }}>Tool Overview</h2>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e2e8f0', marginBottom: 14 }}>
            {([{ k: 'start', l: 'How to use this tool' }, { k: 'saving', l: 'Saving your work' }] as const).map(t => (
              <button key={t.k} onClick={() => setOvTab(t.k)} style={{
                padding: '8px 16px', border: 'none', borderBottom: ovTab === t.k ? '2px solid #2563eb' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontSize: 13, marginBottom: -1,
                color: ovTab === t.k ? '#2563eb' : '#64748b', fontWeight: ovTab === t.k ? 700 : 500,
              }}>{t.l}</button>
            ))}
          </div>

          {ovTab === 'start' && <>
          <p style={{ fontSize: 13, color: '#475569', margin: '0 0 8px', lineHeight: 1.5 }}>
            This tool helps you build water supply and sanitation (WSS) financing scenarios for a country or region. You enter recent historical data and policy targets, the tool projects a business-as-usual (BAU) outlook, and you test how interventions close the gap to those targets and what they cost.
          </p>
          <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px', lineHeight: 1.5 }}>
            Work through the steps in order. Tabs run left to right, and the <strong>Guide</strong> panel on the right of each input tab gives field-by-field help for whatever section you are editing.
          </p>

          <ol style={{ margin: 0, padding: '0 0 0 20px', fontSize: 13, color: '#334155', lineHeight: 1.45 }}>
            <li style={{ marginBottom: 6 }}>
              <strong>Make your selections first.</strong> At the top of the screen, choose a <strong>data entry mode</strong>: <em>Urban / Rural</em> (enter urban and rural data separately — include both to produce a national total, or just one to analyse that area on its own) or <em>National</em> (a single national data set, for when you cannot break down by urban and rural). On the input tabs, also use the <strong>Water Supply / Sanitation</strong> toggle to choose which sector you are entering, and switch between the two to complete both.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Data Inputs</strong> — In <em>Country, Region &amp; Currency</em>, select your country and the currency fills in automatically. In <em>Time Scales &amp; Macroeconomics</em>, set the key dates and choose how to provide the WSS budget (as % of GDP or directly year-by-year). Then complete the year-by-year table, which covers economic data (GDP, inflation, exchange rate), demographics (population, households), budget &amp; execution, and historical water and sanitation service levels. Growth rates, household size, and execution rates are calculated for you. Forecast-year service levels are derived from your BAU targets. The BAU data entry also appears further down this tab, where you select Water Supply or Sanitation to fill each sector.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>BAU Scenario</strong> — Pick Water Supply or Sanitation, then work down the sections, which are <em>Targets</em> (service-level shares for the target years), <em>Unit Costs</em>, <em>Planned Investments</em>, and <em>Technical Parameters</em>. These fields are shared with the Data Inputs tab. The BAU graph on the right updates live as you type.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Intervention Design</strong> — Pick Water Supply or Sanitation, switch each intervention on or off with its toggle, and set its parameters, which include collection efficiency, NRW reduction, capital efficiency, tariff reform, borrowing, budget execution, and microfinance for sanitation. Add your own under <em>Custom Interventions</em> at the bottom. The impact graph updates live.
            </li>
            <li style={{ marginBottom: 6 }}>
              <strong>Results Dashboard</strong> — Compare BAU and intervention scenarios. Toggle interventions and adjust the target years to see the impact on coverage and the financing gap.
            </li>
            <li style={{ marginBottom: 0 }}>
              <strong>Export</strong> — Download your results as PowerPoint, Excel, or CSV.
            </li>
          </ol>

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <div style={{ flex: 1, padding: '8px 14px', background: '#f0f4ff', borderRadius: 8, fontSize: 12, color: '#312e81', border: '1px solid #c7d2fe', lineHeight: 1.45 }}>
              <strong>Tip:</strong> Reopen this anytime via <strong>"📖 Tool Overview"</strong> in the top-right, and see <strong>Saving your work</strong> above for how to save and load.
            </div>
            <div style={{ flex: 1, padding: '8px 14px', background: '#fef3c7', borderRadius: 8, fontSize: 12, color: '#92400e', lineHeight: 1.45 }}>
              <strong>Note:</strong> This is an interactive prototype. The Results Dashboard shows static example charts.
            </div>
          </div>
          </>}

          {ovTab === 'saving' && <>
          <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px', lineHeight: 1.5 }}>
            Two save options sit in the top-right of the header. A <strong>Profile</strong> is a complete, reloadable dataset for a place; a <strong>Scenario</strong> is a lightweight snapshot you compare against others.
          </p>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12, lineHeight: 1.5 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>💾 Save Profile</div>
            <div style={{ fontSize: 13, color: '#475569' }}>
              Stores everything you have entered — country settings, the year-by-year data, BAU inputs and interventions — under a name. Saved profiles reappear in the <strong>Load Profile…</strong> dropdown (top-left) so you can return later or keep several places side by side. Loading a profile replaces what is on screen, so save first if needed.
            </div>
          </div>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', lineHeight: 1.5 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>📋 Save Scenario</div>
            <div style={{ fontSize: 13, color: '#475569' }}>
              Captures a snapshot of the current inputs for comparison — e.g. save "Ambitious 2040", change assumptions, save "Conservative 2040". Saved scenarios appear on the Results Dashboard and Export tab, where each can be downloaded as its own PowerPoint slide.
            </div>
          </div>
          </>}

          <button onClick={handleGetStarted}
            style={{ marginTop: 12, width: '100%', padding: '11px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Get Started
          </button>
        </div>
      )}
    </div>
  );
}

function SectorToggle({ value, onChange }: { value: 'water' | 'sanitation'; onChange: (v: 'water' | 'sanitation') => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {(['water', 'sanitation'] as const).map(s => (
        <button key={s} onClick={() => onChange(s)} style={{
          padding: '7px 18px', border: 'none', borderRadius: 5, cursor: 'pointer',
          background: value === s ? '#2563eb' : '#e5e7eb',
          color: value === s ? '#fff' : '#374151', fontWeight: 600, fontSize: 12,
        }}>{s === 'water' ? 'Water Supply' : 'Sanitation'}</button>
      ))}
    </div>
  );
}

// ── Guide content helpers ──
const gSub: React.CSSProperties = { fontWeight: 700, color: '#1e40af', fontSize: 11.5, margin: '12px 0 4px' };
const gFieldLbl: React.CSSProperties = { fontWeight: 700, color: '#334155' };
const gNote: React.CSSProperties = { display: 'block', fontStyle: 'italic', color: '#64748b', margin: '2px 0 0' };
const gFieldWrap: React.CSSProperties = { marginBottom: 8 };

// Turn bare domain/URL substrings (e.g. "data.worldbank.org/indicator/...") into clickable links
const URL_RE = /((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s()]*)?)/gi;
function linkify(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    const url = m[0];
    // Require a path or at least a multi-part domain to avoid matching things like "e.g."
    if (!url.includes('/') && url.split('.').length < 2) continue;
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const href = url.startsWith('http') ? url : `https://${url}`;
    parts.push(
      <a key={key++} href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#4338ca', wordBreak: 'break-all' }}>{url}</a>
    );
    lastIndex = m.index + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : [text];
}

function GFind({ items }: { items: string[] }) {
  return (
    <div style={{ margin: '3px 0 0' }}>
      <div style={{ fontWeight: 600, color: '#475569' }}>How to find it:</div>
      <ul style={{ margin: '2px 0 0', paddingLeft: 16 }}>
        {items.map((it, i) => <li key={i} style={{ marginBottom: 2 }}>{linkify(it)}</li>)}
      </ul>
    </div>
  );
}

// Contextual guide content keyed by sectionKey
const contextualGuide: Record<string, { title: string; content: React.ReactNode; sources?: { name: string; url: string }[] }> = {
  country: {
    title: 'Country & Region',
    content: 'Select the country and sub-national region for the analysis. The currency code sets the unit for all monetary inputs. Choosing a country will auto-fill its currency, but you can change it manually if needed.',
    sources: [{ name: 'World Bank country classification', url: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/906519' }],
  },
  macro: {
    title: 'Time Scales & Macroeconomics',
    content: (
      <div>
        <p style={{ margin: '0 0 6px' }}>Define the analysis time frame for the tool.</p>

        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Model Start Year:</span> The first year of the analysis period. The tool will compute information for every year from the Model Start Year up to the Baseline Year, building the historical record used to construct the Business-as-Usual (BAU) scenario.
          <span style={gNote}>Note: You must have data for at least two historical years from the Model start year to the baseline year, with a gap of at least 2 years, for the tool to build the BAU scenario optimally. For example, if the baseline year is 2026, the model start year must be at least 2022, with data available for inputting the 2022 and 2024 numbers.</span>
        </div>

        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Baseline Year:</span> The present year or the most recent year with complete data, marking the end of the historical analysis period.
          <span style={gNote}>Note: The Baseline Year must be within three years of the present.</span>
        </div>

        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Forecast End Year:</span> The last year of the tool's projection.
          <span style={gNote}>Note: Must be in the future.</span>
        </div>

        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Performance improvement start:</span> The year in which interventions start closing the service level gap.
          <span style={gNote}>Note: This should be after the baseline year with a reasonable gap for the interventions to take effect. For example, if the baseline is 2026, the financing might not be received for a year, and it might take another year for the intervention's effects to start showing, so 2028 would be a reasonable start year for performance improvement.</span>
        </div>

        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Target year:</span> This is the first interim year for which targets will be set. For example, if national targets aim to reach 100% access by 2050, there would be interim targets such as 60% access by 2030 and 80% access by 2040. In this case, the first target year would be 2030, the target year 2 would be 2040, and the model end year would be 2050.
          <span style={gNote}>Note: If there is only one interim target year, please set target year 2 to the same as the model end year.</span>
        </div>

        <div style={gSub}>Macroeconomic assumptions</div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Water supply budget as % of GDP:</span> Please enter an average % of total GDP that is spent on providing water supply services in the region.
        </div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Sanitation supply budget as % of GDP:</span> Please enter an average % of total GDP that is spent on providing sanitation supply services in the region.
        </div>

        <div style={gSub}>Year-by-year data</div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Nominal GDP ($B):</span> The total monetary value of all goods and services produced in the selected country in a given year, expressed in billions of US dollars (current prices). This is used to contextualize investment needs and fiscal capacity over the analysis period.
          <GFind items={[
            'World Bank – data.worldbank.org/indicator/NY.GDP.MKTP.CD (GDP in current USD by country)',
            'IMF World Economic Outlook Database – imf.org/en/Publications/WEO',
            "Your country's central bank or ministry of finance",
          ]} />
        </div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Inflation Local (%):</span> The annual inflation rate for the selected country, expressed as a percentage. Used to adjust local currency monetary values over time.
          <GFind items={[
            'World Bank – data.worldbank.org/indicator/FP.CPI.TOTL.ZG',
            'IMF World Economic Outlook Database – imf.org/en/Publications/WEO',
            'Your country\'s central bank or national statistics office (search "[country] central bank CPI inflation")',
          ]} />
        </div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Inflation US (%):</span> The annual US inflation rate, expressed as a percentage. Used to adjust USD-denominated values over time.
          <GFind items={[
            'US Bureau of Labor Statistics (BLS) – bls.gov/cpi',
            'Federal Reserve Economic Data (FRED) – fred.stlouisfed.org/series/FPCPITOTLZGUSA',
            'World Bank – data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=US',
          ]} />
        </div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>USD to Local Currency Exchange Rate (USD/local currency):</span> The number of local currency units per 1 US Dollar for each year of the analysis. Used to convert between USD and local currency throughout the model.
          <span style={gNote}>Note: Use annual average rates rather than spot rates for consistency across the analysis period.</span>
          <GFind items={[
            'OANDA – oanda.com/currency-converter (historical average exchange rates)',
            'Federal Reserve Economic Data (FRED) – fred.stlouisfed.org (search your currency pair, e.g. "USD to NPR")',
            'World Bank – data.worldbank.org/indicator/PA.NUS.FCRF (official exchange rates by country)',
            "Your country's central bank (most publish official annual average exchange rates)",
          ]} />
        </div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Urban Population:</span> The total number of people living in urban areas within the selected region for each year of the analysis. This forms the baseline from which the model calculates growth and infrastructure demand.
          <GFind items={[
            'World Bank – data.worldbank.org/indicator/SP.URB.TOTL',
            'UN World Urbanization Prospects – population.un.org/wup',
            'Your country\'s national statistics office (for sub-national breakdowns, search "[country] national statistics population census")',
          ]} />
        </div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Households (in millions):</span> The total number of occupied households in the selected urban area for each year of the analysis. Used to estimate residential demand for water and sanitation services.
          <GFind items={[
            "Your country's national statistics office or census bureau (search \"[country] housing census households\")",
            'UN Statistics Division – unstats.un.org',
          ]} />
          <span style={gNote}>Note: If household data is unavailable, it can be estimated by dividing the urban population by the average household size.</span>
        </div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Water Supply (WS) Budget Allocated (in millions):</span> The total budget allocated for water supply infrastructure and services in a given year, expressed in millions of local currency. Sourced from government budget documents.
          <GFind items={[
            "Your country's Ministry of Finance (annual budget documents and Red Books)",
            "Your country's Ministry of Water Supply or equivalent sector ministry",
            'Municipal or utility budget reports (for sub-national analysis)',
          ]} />
        </div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Water Supply (WS) Actual Expenditure (in millions):</span> The amount actually spent on water supply in a given year, expressed in millions of local currency. May differ from the allocated budget due to implementation delays or capacity constraints.
          <GFind items={[
            "Your country's Ministry of Finance (budget execution reports or annual financial statements)",
            "Your country's Ministry of Water Supply or equivalent sector ministry",
            'National audit reports or public financial management systems',
          ]} />
        </div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Sanitation (SAN) Budget Allocated (in millions):</span> The total budget allocated for sanitation infrastructure and services in a given year, expressed in millions of local currency.
          <GFind items={[
            "Your country's Ministry of Finance (annual budget documents)",
            "Your country's Ministry of Water Supply, Sanitation, or equivalent sector ministry",
            'Municipal or utility budget reports (for sub-national analysis)',
          ]} />
        </div>
        <div style={gFieldWrap}>
          <span style={gFieldLbl}>Sanitation (SAN) Actual Expenditure (in Millions):</span> The amount actually spent on sanitation in a given year, expressed in millions of local currency.
          <GFind items={[
            "Your country's Ministry of Finance (budget execution reports or annual financial statements)",
            "Your country's Ministry of Water Supply, Sanitation, or equivalent sector ministry",
            'National audit reports or public financial management systems',
          ]} />
        </div>
      </div>
    ),
  },
  ws_service_levels: {
    title: 'Water Supply Service Levels',
    content: 'Enter the percentage of households at each of the 5 JMP service levels for both the start year and baseline year. All 5 levels must sum to 100%. The model uses these to calculate historical CAGRs and project BAU service levels forward. Enter data for all historical years you have data for. If some are empty and data is unavailable, that is fine, but a minimum of 2 data points is required.',
    sources: [{ name: 'WHO/UNICEF JMP', url: 'https://washdata.org/data/household' }],
  },
  san_service_levels: {
    title: 'Sanitation Supply Service Levels',
    content: 'Enter the percentage of households at each of the 5 JMP service levels for both the start year and baseline year. All 5 levels must sum to 100%. The model uses these to calculate historical CAGRs and project BAU service levels forward. Enter data for all historical years you have data for. If some are empty and data is unavailable, that is fine, but a minimum of 2 data points is required.',
    sources: [{ name: 'WHO/UNICEF JMP', url: 'https://washdata.org/data/household' }],
  },
  ws_targets: {
    title: 'Water Supply Targets',
    content: 'Enter current national targets for water supply service levels at Target 1 and Target 2 years. These represent the government\'s policy targets. Playing with alternative targets is done on the Results Dashboard.',
    sources: [{ name: 'National WASH strategy document', url: '#' }],
  },
  san_targets: {
    title: 'Sanitation Targets',
    content: 'Enter current national targets for sanitation service levels. Include the on-site sanitation share separately.',
    sources: [{ name: 'National WASH strategy document', url: '#' }],
  },
  ws_unit_costs: {
    title: 'Water Supply Unit Costs',
    content: "Enter the capital cost per household to connect to the distribution network at each service level (except No Service). Also, enter the cost per MLD of water treatment and costs for non-piped solutions. All costs should be in real terms at the base year price level. You can use costs for each distribution network and water treatment from the utility's data, and average prices for non-piped solutions from web search.",
    sources: [{ name: 'IBNET benchmarks', url: 'https://www.ib-net.org/' }],
  },
  san_unit_costs: {
    title: 'Sanitation Supply Unit Costs',
    content: "Enter sewerage cost per household at each service level and the on-site facility capex. All costs should be in real terms at the base year price level. You can use costs for each distribution network from the utility's data, and average costs for on-site solutions from a web search.",
    sources: [{ name: 'IBNET benchmarks', url: 'https://www.ib-net.org/' }],
  },
  planned_investments: {
    title: 'Planned Investments',
    content: 'If there are programmed investments that are additional to historical spending trends — with financing secured and genuinely likely to proceed — enter them here by period. These represent a shift from BAU that we are confident will happen. Select the period length and enter planned water supply and sanitation investments per period.',
    sources: [{ name: 'Government budget documents / MTEF', url: '#' }],
  },
  technical: {
    title: 'Technical Parameters',
    content: 'Enter infrastructure parameters: asset useful life, non-household water share, treatment capacity (existing and planned), WHO water requirements, and the wastewater factor. Treatment capacity figures should come from utility records or feasibility studies.',
    sources: [
      { name: 'WHO water requirements guideline', url: 'https://www.who.int/publications/i/item/9789241548151' },
      { name: 'IBNET', url: 'https://www.ib-net.org/' },
    ],
  },
  ws_interventions: {
    title: 'Water Supply Interventions',
    content: (
      <div>
        <p style={{ margin: '0 0 6px' }}>The available water supply interventions are collection efficiency, NRW reduction, capital efficiency, tariff reform, borrowing, and budget execution improvement.</p>
        <p style={{ margin: '0 0 6px' }}><strong>How to enter each one:</strong> Tick its checkbox to switch it on (this adds it to the graph). Click <strong>▾ Show</strong> on the right of its row to open the parameter dropdown, fill in the fields, then click <strong>▴ Hide</strong> to collapse it again. Ticking and the dropdown are independent — you can review parameters without enabling the intervention, and switching it off does not collapse the panel.</p>
        <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
          <li><strong>Collection efficiency:</strong> set the start/target years and the current and target collection ratios (revenue collected ÷ revenue billed).</li>
          <li><strong>NRW reduction:</strong> set current and target non-revenue water. The target cannot go below 3%, as even the best utilities globally achieve only 3–5%. Allow a few years' lag before benefits appear.</li>
          <li><strong>Capital efficiency:</strong> the % reduction in unit capital costs from better procurement and project management (typically 10–30%).</li>
          <li><strong>Tariff reform:</strong> set the affordability ceiling and the O&amp;M cost-recovery target to reach.</li>
          <li><strong>Borrowing:</strong> set the loan terms (DSCR, grace period, tenor, interest rate) used to raise upfront finance against future cashflow.</li>
        </ul>
      </div>
    ),
  },
  san_interventions: {
    title: 'Sanitation Interventions',
    content: (
      <div>
        <p style={{ margin: '0 0 6px' }}>The available sanitation interventions are collection efficiency, capital efficiency, tariff reform, borrowing, budget execution improvement, and microfinance for on-site sanitation.</p>
        <p style={{ margin: '0 0 6px' }}><strong>How to enter each one:</strong> Tick its checkbox to switch it on, then click <strong>▾ Show</strong> to open its parameter dropdown, fill in the fields, and click <strong>▴ Hide</strong> to collapse. The checkbox (which drives the graph) and the Show/Hide dropdown work independently.</p>
        <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
          <li><strong>Collection efficiency:</strong> uses the same ratios as water supply — enter the sewer tariff as a % of the water tariff.</li>
          <li><strong>Capital efficiency, tariff reform, borrowing:</strong> entered the same way as on the water supply side.</li>
          <li><strong>Microfinance:</strong> for households investing in their own on-site sanitation.</li>
        </ul>
      </div>
    ),
  },
  custom_interventions: {
    title: 'Custom Interventions',
    content: (
      <div>
        <p style={{ margin: '0 0 6px' }}>Add interventions not covered by the standard set — for example donor grants, climate finance, or PPP contributions.</p>
        <p style={{ margin: '0 0 6px' }}>Click <strong>+ Add Custom Intervention</strong>, name it, then choose its <strong>Sector</strong> and <strong>Type</strong> from the two dropdowns (▾). A new intervention defaults to the sector currently selected by the Water Supply / Sanitation toggle above; change it to Sanitation or Both if needed.</p>
        <p style={{ margin: 0 }}>The <strong>Type</strong> dropdown sets which fields appear: <em>Fixed annual amount</em> (a constant yearly sum), <em>Revenue stream</em> (a starting amount that grows each year), or <em>Per-household subsidy</em> (an amount per household connected).</p>
      </div>
    ),
  },
};

// Which guide sections belong to each tab (only these show in that tab's Guide panel)
const guideKeysByTab: Record<number, string[]> = {
  // Data Inputs — includes the BAU data entry duplicated onto this tab
  0: ['country', 'macro', 'ws_service_levels', 'san_service_levels', 'ws_targets', 'san_targets', 'ws_unit_costs', 'san_unit_costs', 'planned_investments', 'technical'],
  // BAU Scenario
  1: ['ws_targets', 'san_targets', 'ws_unit_costs', 'san_unit_costs', 'planned_investments', 'technical'],
  // Intervention Design
  2: ['ws_interventions', 'san_interventions', 'custom_interventions'],
};

function DataGuide({ tab, activeSection }: { tab: number; activeSection: string | null }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSection]);

  // Only show the guide sections relevant to the current tab, highlight the active one
  const allKeys = (guideKeysByTab[tab] || Object.keys(contextualGuide)).filter(k => contextualGuide[k]);

  return (
    <div ref={scrollRef} style={{
      width: 320, borderLeft: '1px solid #e2e8f0', background: '#fafaff', overflowY: 'auto',
      padding: '16px 18px', fontSize: 11, flexShrink: 0,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#312e81', margin: '0 0 6px', borderBottom: '2px solid #c7d2fe', paddingBottom: 6 }}>
        Guide
      </h3>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 12 }}>
        Click on any input section to see guidance here.
      </div>

      {allKeys.map(key => {
        const g = contextualGuide[key];
        const isActive = activeSection === key;
        return (
          <div key={key} ref={isActive ? activeRef : undefined} style={{
            marginBottom: 10, padding: '8px 10px', borderRadius: 6,
            background: isActive ? '#eef2ff' : '#fff',
            border: isActive ? '2px solid #2563eb' : '1px solid #e5e7eb',
            transition: 'all 0.3s',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#1e40af' : '#475569', marginBottom: 4 }}>
              {isActive && <span style={{ color: '#2563eb', marginRight: 4 }}>▶</span>}
              {g.title}
            </div>
            {isActive && (
              <>
                <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5, marginBottom: 6 }}>
                  {g.content}
                </div>
                {g.sources && g.sources.length > 0 && (
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    <strong>Sources:</strong>
                    {g.sources.map((s, i) => (
                      <div key={i} style={{ marginTop: 2 }}>
                        {s.url !== '#' ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4338ca' }}>{s.name}</a>
                        ) : (
                          <span style={{ color: '#475569' }}>{s.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const headerBtnStyle: React.CSSProperties = {
  padding: '5px 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4,
  background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: 11,
};
