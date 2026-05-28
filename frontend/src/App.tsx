import React, { useState, useEffect, useCallback } from 'react';
import InputPanel from './components/InputPanel';
import InterventionPanel from './components/InterventionPanel';
import ResultsDashboard from './components/ResultsDashboard';
import { BAUForecastChart, InterventionImpactChart } from './components/StaticCharts';
import { fetchDefaults } from './api';

export default function App() {
  const [inputs, setInputs] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [profileList, setProfileList] = useState<string[]>([]);
  const [scenarios, setScenarios] = useState<{name: string, inputs: any}[]>([]);
  const [geoScope, setGeoScope] = useState<'urban' | 'rural' | 'national'>('urban');
  const [sectorTab, setSectorTab] = useState<'water' | 'sanitation'>('water');

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
    if (!inp?.period?.model_start_year || !inp?.period?.forecast_end_year || !inp?.macro) return inp;
    const needed = inp.period.forecast_end_year - inp.period.model_start_year + 1;
    const macroFields = ['gdp_growth', 'gdp_nominal_usd', 'inflation_nepal', 'inflation_us', 'exchange_rate'];
    let changed = false;
    const newMacro = { ...inp.macro };
    for (const field of macroFields) {
      const arr = newMacro[field];
      if (!arr || arr.length === needed) continue;
      changed = true;
      newMacro[field] = arr.length < needed
        ? [...arr, ...Array(needed - arr.length).fill(field === 'gdp_nominal_usd' ? 0 : (arr[arr.length - 1] || 0))]
        : arr.slice(0, needed);
    }
    return changed ? { ...inp, macro: newMacro } : inp;
  }, []);

  const handleSetInputs = useCallback((newInputs: any) => {
    setInputs(resizeMacroArrays(newInputs));
  }, [resizeMacroArrays]);

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
    if (p.baseline_year >= p.as_is_forecast_start) warnings.push('Baseline year must be before as-is forecast start');
    if (p.target2_year < p.target1_year) warnings.push('Target 2 year must be >= Target 1 year');
    const wt = inputs.water_targets;
    const wsSum = Math.round((wt.target1_serv1 + wt.target1_serv2 + wt.target1_serv3 + wt.target1_serv4 + wt.target1_serv5) * 100);
    if (wsSum !== 100) warnings.push(`Water Target 1 service levels sum to ${wsSum}%, must be 100%`);
    const wsSum2 = Math.round((wt.target2_serv1 + wt.target2_serv2 + wt.target2_serv3 + wt.target2_serv4 + wt.target2_serv5) * 100);
    if (wsSum2 !== 100) warnings.push(`Water Target 2 service levels sum to ${wsSum2}%, must be 100%`);
    if (wt.providers) {
      const provSum = Math.round(wt.providers.reduce((s: number, p: any) => s + p.share_pct, 0) * 100);
      if (provSum !== 100) warnings.push(`Water provider shares sum to ${provSum}%, must be 100%`);
    }
    const st = inputs.sanitation_targets;
    const ssSum = Math.round((st.target1_sserv1 + st.target1_sserv2 + st.target1_sserv3 + st.target1_sserv4 + st.target1_sserv5) * 100);
    if (ssSum !== 100) warnings.push(`Sanitation Target 1 service levels sum to ${ssSum}%, must be 100%`);
    if (st.providers) {
      const sanProvSum = Math.round((st.providers.reduce((s: number, p: any) => s + p.share_pct, 0) + (st.onsite_collection_treatment_pct || 0)) * 100);
      if (sanProvSum !== 100) warnings.push(`Sanitation provider shares + on-site sum to ${sanProvSum}%, must be 100%`);
    }
  }

  const tabs = ['Data Input', 'BAU & Costs', 'Interventions & Targets', 'Results Dashboard', 'Export'];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#002244', color: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>WSS Strategic Scenarios Simulation Tool</h1>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{inputs?.country_config?.country || ''} — {inputs?.country_config?.area || ''}</span>
          {/* Geographic scope selector */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
            {(['urban', 'rural', 'national'] as const).map(g => (
              <button key={g} onClick={() => setGeoScope(g)} style={{
                padding: '4px 14px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4,
                background: geoScope === g ? '#2563eb' : 'transparent',
                color: '#fff', cursor: 'pointer', fontSize: 11, textTransform: 'capitalize',
                fontWeight: geoScope === g ? 700 : 400,
                transition: 'background 0.15s',
              }}>{g}</button>
            ))}
          </div>
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
          <button onClick={() => setShowOnboarding(true)} style={headerBtnStyle}>? Help</button>
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
        {tabs.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} style={{
            padding: '10px 28px', border: 'none',
            borderRadius: '8px 8px 0 0',
            background: activeTab === i ? '#fff' : 'transparent',
            boxShadow: activeTab === i ? '0 -2px 6px rgba(0,0,0,0.08)' : 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: activeTab === i ? 700 : 500,
            color: activeTab === i ? '#1e3a5f' : '#64748b',
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
                background: activeTab === i ? '#2563eb' : '#94a3b8',
                color: '#fff', flexShrink: 0,
              }}>{i + 1}</span>
              {tab}
            </span>
          </button>
        ))}
      </nav>

      {warnings.length > 0 && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fbbf24', padding: '6px 20px', fontSize: 11 }}>
          {warnings.map((w, i) => <div key={i} style={{ color: '#92400e' }}>⚠ {w}</div>)}
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {activeTab === 0 && inputs && (
          <InputPanel inputs={inputs} onChange={handleSetInputs} geoScope={geoScope} showSection="inputs" />
        )}
        {activeTab === 1 && inputs && (<>
          <InputPanel inputs={inputs} onChange={handleSetInputs} geoScope={geoScope} showSection="bau" />
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            <SectorToggle value={sectorTab} onChange={setSectorTab} />
            <BAUForecastChart sector={sectorTab} />
          </div>
        </>)}
        {activeTab === 2 && inputs && (
          <InterventionPanel inputs={inputs} onChange={handleSetInputs} sectorTab={sectorTab} onSectorChange={setSectorTab} />
        )}
        {activeTab === 3 && (
          <ResultsDashboard geoScope={geoScope} scenarios={scenarios} inputs={inputs} />
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

      {/* Onboarding */}
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
    </div>
  );
}

function OnboardingModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, maxWidth: 560, width: '92%', maxHeight: '85vh', overflowY: 'auto', padding: '28px 36px' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 22, color: '#002244', marginBottom: 6 }}>How to use this tool</h2>
        <p style={{ fontSize: 14, color: '#475569', marginBottom: 20, lineHeight: 1.6 }}>
          Work through the tabs from left to right. Select your geographic scope (Urban, Rural, or National) in the header bar before you begin.
        </p>

        <ol style={{ margin: 0, padding: '0 0 0 20px', fontSize: 14, color: '#334155', lineHeight: 1.8 }}>
          <li style={{ marginBottom: 10 }}><strong>Data Input</strong> — Enter all country data: time scale, macroeconomics, population, service levels, and targets.</li>
          <li style={{ marginBottom: 10 }}><strong>BAU & Costs</strong> — Enter unit costs, planned investments, and technical parameters.</li>
          <li style={{ marginBottom: 10 }}><strong>Intervention Selection</strong> — Define and toggle interventions: collection efficiency, NRW reduction, tariff reform, borrowing, and more.</li>
          <li style={{ marginBottom: 10 }}><strong>Results Dashboard</strong> — View projected coverage, financing gaps, and export results.</li>
        </ol>

        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef3c7', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
          <strong>Note:</strong> This is an interactive prototype. The Results Dashboard shows static example charts.
        </div>

        <button onClick={onClose}
          style={{ marginTop: 18, width: '100%', padding: '12px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Get Started
        </button>
      </div>
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

// ─── Missing Data Checklist (middle panel for tab 0) ───
function DataInputOverview({ inputs, geoScope }: { inputs: any; geoScope: string }) {
  if (!inputs) return null;
  const cc = inputs.country_config || {};
  const p = inputs.period || {};
  const pop = inputs.population || {};
  const m = inputs.macro || {};
  const wt = inputs.water_targets || {};
  const st = inputs.sanitation_targets || {};
  const ws = inputs.water_service || {};
  const san = inputs.sanitation_service || {};
  const scopeLabel = geoScope === 'national' ? 'National' : geoScope === 'rural' ? 'Rural' : 'Urban';

  const filled = (v: any) => v !== undefined && v !== null && v !== 0 && v !== '';

  // Build per-section checklists: each item is { label, ok }
  const checklist: { section: string; sectionNum: string; items: { label: string; ok: boolean }[] }[] = [
    {
      section: 'Country & Region', sectionNum: '0',
      items: [
        { label: 'Country name', ok: filled(cc.country) },
        { label: 'Region / area', ok: filled(cc.area) },
        { label: 'Local currency code', ok: filled(cc.currency) },
      ],
    },
    {
      section: 'Period', sectionNum: '1',
      items: [
        { label: 'Model start year', ok: filled(p.model_start_year) },
        { label: 'Baseline year', ok: filled(p.baseline_year) },
        { label: 'Forecast end year', ok: filled(p.forecast_end_year) },
        { label: 'Performance improvement start year', ok: filled(p.perf_improvement_start_year) },
        { label: 'Target 1 year', ok: filled(p.target1_year) },
        { label: 'Target 2 year', ok: filled(p.target2_year) },
      ],
    },
    {
      section: 'Macroeconomics', sectionNum: '2',
      items: [
        { label: 'GDP growth time series', ok: m.gdp_growth?.some?.((v: number) => v !== 0) || false },
        { label: 'Inflation (domestic) time series', ok: m.inflation_nepal?.some?.((v: number) => v !== 0) || false },
        { label: 'Exchange rate time series', ok: m.exchange_rate?.some?.((v: number) => v !== 0) || false },
        { label: 'GDP nominal (USD) time series', ok: m.gdp_nominal_usd?.some?.((v: number) => v !== 0) || false },
      ],
    },
    {
      section: `Population (${scopeLabel})`, sectionNum: '3',
      items: [
        { label: `Total ${scopeLabel.toLowerCase()} population (start year)`, ok: filled(pop.total_pop_start) },
        { label: `Total ${scopeLabel.toLowerCase()} HHs (start year)`, ok: filled(pop.total_hh_start) },
        { label: `Total ${scopeLabel.toLowerCase()} population (baseline)`, ok: filled(pop.total_pop_baseline) },
        { label: `Total ${scopeLabel.toLowerCase()} HHs (baseline)`, ok: filled(pop.total_hh_baseline) },
      ],
    },
    {
      section: 'Water Supply Service Levels', sectionNum: '4',
      items: [
        { label: '% HHs by service level (start year)', ok: [ws.pct_serv1_start, ws.pct_serv2_start, ws.pct_serv3_start, ws.pct_serv4_start, ws.pct_serv5_start].some((v: number) => filled(v)) },
        { label: '% HHs by service level (baseline)', ok: [ws.pct_serv1_baseline, ws.pct_serv2_baseline, ws.pct_serv3_baseline, ws.pct_serv4_baseline, ws.pct_serv5_baseline].some((v: number) => filled(v)) },
      ],
    },
    {
      section: 'Sanitation Service Levels', sectionNum: '5',
      items: [
        { label: '% HHs by service level (start year)', ok: [san.pct_sserv1_start, san.pct_sserv2_start, san.pct_sserv3_start, san.pct_sserv4_start, san.pct_sserv5_start].some((v: number) => filled(v)) },
        { label: '% HHs by service level (baseline)', ok: [san.pct_sserv1_baseline, san.pct_sserv2_baseline, san.pct_sserv3_baseline, san.pct_sserv4_baseline, san.pct_sserv5_baseline].some((v: number) => filled(v)) },
      ],
    },
    {
      section: 'Water Supply Targets', sectionNum: '6',
      items: [
        { label: 'Target 1 service levels (5 levels)', ok: [wt.target1_serv1, wt.target1_serv2, wt.target1_serv3, wt.target1_serv4, wt.target1_serv5].some((v: number) => filled(v)) },
        { label: 'Target 2 service levels (5 levels)', ok: [wt.target2_serv1, wt.target2_serv2, wt.target2_serv3, wt.target2_serv4, wt.target2_serv5].some((v: number) => filled(v)) },
      ],
    },
    {
      section: 'Sanitation Targets', sectionNum: '7',
      items: [
        { label: 'On-site collection & treatment %', ok: filled(st.onsite_collection_treatment_pct) },
        { label: 'Target 1 service levels (5 levels)', ok: [st.target1_sserv1, st.target1_sserv2, st.target1_sserv3, st.target1_sserv4, st.target1_sserv5].some((v: number) => filled(v)) },
        { label: 'Target 2 service levels (5 levels)', ok: [st.target2_sserv1, st.target2_sserv2, st.target2_sserv3, st.target2_sserv4, st.target2_sserv5].some((v: number) => filled(v)) },
      ],
    },
    // --- BAU & Costs tab (§8-11) ---
    {
      section: 'Water Unit Costs', sectionNum: '8',
      items: [
        { label: 'Distribution network cost per HH (at least 1 level)', ok: filled(inputs.water_costs?.network_cost_per_hh_serv1) || filled(inputs.water_costs?.network_cost_per_hh_serv2) },
        { label: 'Cost per MLD water treatment', ok: filled(inputs.water_costs?.ws_cost_per_mld_treatment) },
      ],
    },
    {
      section: 'Sanitation Unit Costs', sectionNum: '9',
      items: [
        { label: 'Sewerage cost per HH (at least 1 level)', ok: filled(inputs.sanitation_costs?.sewer_cost_per_hh_sserv1) || filled(inputs.sanitation_costs?.sewer_cost_per_hh_sserv2) },
        { label: 'Cost per MLD wastewater treatment', ok: filled(inputs.sanitation_costs?.san_cost_per_mld_treatment) },
      ],
    },
    {
      section: 'BAU Investment', sectionNum: '10',
      items: [
        { label: 'Water/Sanitation % of WSS budget', ok: filled(inputs.bau?.ws_pct_of_wss) },
        { label: 'Capex % of budget', ok: filled(inputs.bau?.capex_pct_budget) },
      ],
    },
    {
      section: 'Technical Inputs', sectionNum: '11',
      items: [
        { label: 'Water asset life', ok: filled(inputs.technical?.ws_asset_life) },
        { label: 'Existing water treatment capacity', ok: filled(inputs.technical?.ws_existing_treatment_mld) },
        { label: 'Sanitation asset life', ok: filled(inputs.technical?.san_asset_life) },
        { label: 'Avg capex/MLD for WWT', ok: filled(inputs.technical?.san_avg_capex_per_mld_wwt) },
        { label: 'Avg capex/MLD for FSTP', ok: filled(inputs.technical?.san_avg_capex_per_mld_fstp) },
      ],
    },
    // --- Intervention tab (§12-13) ---
    {
      section: 'Water Interventions', sectionNum: '12',
      items: [
        { label: 'Collection efficiency (start/target year, ratios)', ok: filled(inputs.water_interventions?.ce_start_year) },
        { label: 'NRW reduction (current/target %, commercial/physical split)', ok: filled(inputs.water_interventions?.nrw_current_pct) },
        { label: 'Tariff (revenue & expenditure)', ok: filled(inputs.water_interventions?.tariff_op_revenue) },
      ],
    },
    {
      section: 'Sanitation Interventions', sectionNum: '13',
      items: [
        { label: 'Sewer tariff as % of water tariff', ok: filled(inputs.sanitation_interventions?.ce_sewer_tariff_pct_water) },
        { label: 'Capital efficiency', ok: filled(inputs.sanitation_interventions?.capeff_start_year) },
      ],
    },
  ];

  const totalItems = checklist.reduce((s, sec) => s + sec.items.length, 0);
  const doneItems = checklist.reduce((s, sec) => s + sec.items.filter(it => it.ok).length, 0);
  const missingItems = totalItems - doneItems;
  const pctDone = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>Data Checklist</h3>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {missingItems === 0
              ? 'All required fields are filled'
              : `${missingItems} field${missingItems > 1 ? 's' : ''} still needed`}
          </div>
        </div>
        <div style={{
          fontSize: 20, fontWeight: 800,
          color: pctDone === 100 ? '#16a34a' : pctDone >= 50 ? '#f59e0b' : '#ef4444',
        }}>
          {pctDone}%
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{
          height: '100%', borderRadius: 3, transition: 'width 0.3s',
          width: `${pctDone}%`,
          background: pctDone === 100 ? '#16a34a' : pctDone >= 50 ? '#f59e0b' : '#ef4444',
        }} />
      </div>

      {/* Section checklists */}
      {checklist.map((sec, si) => {
        const tabLabel = si === 0 ? 'Tab 1: Data Input' : Number(sec.sectionNum) === 8 ? 'Tab 2: BAU & Costs' : Number(sec.sectionNum) === 12 ? 'Tab 3: Intervention Selection' : null;
        const secDone = sec.items.filter(it => it.ok).length;
        const secTotal = sec.items.length;
        const allDone = secDone === secTotal;
        const hasMissing = secDone < secTotal;
        return (
          <React.Fragment key={si}>
          {tabLabel && (
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 1, marginTop: si > 0 ? 14 : 0, marginBottom: 6, padding: '4px 0', borderBottom: '1px solid #e0e7ff' }}>
              {tabLabel}
            </div>
          )}
          <div style={{
            marginBottom: 10, borderRadius: 8, overflow: 'hidden',
            border: `1px solid ${allDone ? '#bbf7d0' : hasMissing ? '#fecaca' : '#e5e7eb'}`,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px',
              background: allDone ? '#f0fdf4' : '#fef2f2',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: allDone ? '#166534' : '#991b1b' }}>
                <span style={{ color: '#94a3b8', fontWeight: 400, marginRight: 4 }}>§{sec.sectionNum}</span>
                {sec.section}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                background: allDone ? '#dcfce7' : '#fee2e2',
                color: allDone ? '#16a34a' : '#dc2626',
              }}>
                {secDone}/{secTotal}
              </span>
            </div>
            {hasMissing && (
              <div style={{ padding: '6px 12px 8px' }}>
                {sec.items.map((item, ii) => (
                  <div key={ii} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '3px 0', fontSize: 11,
                    color: item.ok ? '#16a34a' : '#dc2626',
                  }}>
                    <span style={{ fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0 }}>
                      {item.ok ? '✓' : '✗'}
                    </span>
                    <span style={{
                      fontWeight: item.ok ? 400 : 500,
                      textDecoration: item.ok ? 'line-through' : 'none',
                      color: item.ok ? '#94a3b8' : '#334155',
                    }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          </React.Fragment>
        );
      })}

      {pctDone === 100 && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🎉</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>All required fields across all tabs are complete!</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>You can now review results in the Results Dashboard (Tab 4).</div>
        </div>
      )}
    </div>
  );
}

// ─── Data Guide per tab ───
const guideData: Record<number, { title: string; sections: { heading: string; items: { field: string; source: string; url: string }[] }[] }> = {
  0: {
    title: 'Data Input — Where to Find the Data',
    sections: [
      {
        heading: '0. Country & Region',
        items: [
          { field: 'Country name & currency', source: 'World Bank country classification', url: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/906519' },
          { field: 'Region / area name', source: 'Government administrative divisions or project TOR', url: '#' },
        ],
      },
      {
        heading: '1. Period',
        items: [
          { field: 'Model start / baseline / forecast years', source: 'Project TOR or latest available census/survey year', url: '#' },
          { field: 'Target years (SDG milestones)', source: 'National WASH strategy or SDG 6 targets', url: 'https://sdgs.un.org/goals/goal6' },
        ],
      },
      {
        heading: '2. Macroeconomics',
        items: [
          { field: 'GDP growth, nominal GDP', source: 'IMF World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO' },
          { field: 'Inflation (domestic & US)', source: 'World Bank Indicators or central bank', url: 'https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG' },
          { field: 'Exchange rate (USD/LCU)', source: 'World Bank or central bank', url: 'https://data.worldbank.org/indicator/PA.NUS.FCRF' },
          { field: 'WASH budget % of GDP', source: 'Government budget documents, UNICEF WASH budget briefs', url: 'https://www.unicef.org/documents/wash-budget-briefs' },
        ],
      },
      {
        heading: '3. Population',
        items: [
          { field: 'Total population & HHs (start/baseline)', source: 'National census or UN Population Division', url: 'https://population.un.org/wpp/' },
          { field: 'Population growth CAGR', source: 'UN Population Division or national statistics office', url: 'https://population.un.org/wpp/' },
          { field: 'Average HH size trend', source: 'DHS or national household survey', url: 'https://dhsprogram.com/' },
        ],
      },
      {
        heading: '4–5. Service Levels (Water & Sanitation)',
        items: [
          { field: 'HHs by service level (JMP ladder)', source: 'WHO/UNICEF JMP country files', url: 'https://washdata.org/data/household' },
          { field: 'HHs with piped/treated water', source: 'Utility annual reports or JMP', url: 'https://washdata.org/' },
          { field: 'HHs with sewered / on-site sanitation', source: 'Utility data, JMP, or national sanitation survey', url: 'https://washdata.org/data/household' },
          { field: 'Provider-specific HH counts', source: 'Individual utility annual reports or regulator', url: '#' },
        ],
      },
      {
        heading: '6–7. Targets (Water & Sanitation)',
        items: [
          { field: 'Target service level distribution', source: 'National WASH policy/strategy document', url: '#' },
          { field: 'Provider share allocations', source: 'Government master plan or utility business plans', url: '#' },
          { field: 'Treatment capacity plans', source: 'Utility capital investment plans', url: '#' },
        ],
      },
    ],
  },
  1: {
    title: 'BAU & Costs — Where to Find the Data',
    sections: [
      {
        heading: '8. Water Supply Unit Costs',
        items: [
          { field: 'Network cost per HH (by service level)', source: 'Utility capital budgets or World Bank project appraisals', url: '#' },
          { field: 'Provider-specific connection costs', source: 'Individual utility annual reports', url: '#' },
          { field: 'Treatment cost per MLD', source: 'Engineering feasibility studies or IBNET', url: 'https://www.ib-net.org/' },
          { field: 'Non-piped solution costs (wells, boreholes)', source: 'UNICEF cost benchmarks or national WASH surveys', url: '#' },
        ],
      },
      {
        heading: '9. Sanitation Unit Costs',
        items: [
          { field: 'Sewerage cost per HH', source: 'Utility capital budgets or World Bank project appraisals', url: '#' },
          { field: 'WWT cost per MLD', source: 'Engineering studies or IBNET', url: 'https://www.ib-net.org/' },
          { field: 'On-site facility costs (septic, latrine)', source: 'National sanitation cost study or UNICEF', url: '#' },
          { field: 'FS collection & treatment costs', source: 'FSM cost studies (e.g., World Bank FSM toolbox)', url: 'https://www.worldbank.org/en/topic/sanitation/brief/fecal-sludge-management-tools' },
        ],
      },
      {
        heading: '10. BAU Investment',
        items: [
          { field: 'Historical & planned investment amounts', source: 'Government budget books, MTEF, or donor databases', url: '#' },
          { field: 'Regional spending shares', source: 'Government budget allocation documents', url: '#' },
          { field: 'Sector splits (water vs sanitation)', source: 'WASH sector review or TrackFin', url: 'https://www.who.int/teams/environment-climate-change-and-health/water-sanitation-and-health/monitoring-and-evidence/wash-systems-monitoring/un-water-glaas/trackfin' },
          { field: 'Budget execution rates', source: 'Public expenditure reviews (PER) or PEFA assessments', url: 'https://www.pefa.org/' },
          { field: 'WASH budget as % of GDP', source: 'UN-Water GLAAS report or government budget docs', url: 'https://www.who.int/teams/environment-climate-change-and-health/water-sanitation-and-health/monitoring-and-evidence/wash-systems-monitoring/un-water-glaas' },
        ],
      },
      {
        heading: '11. Technical Inputs',
        items: [
          { field: 'Asset useful life', source: 'Engineering standards or utility asset management plans', url: '#' },
          { field: 'Treatment capacity (existing & proposed)', source: 'Utility asset registers or feasibility studies', url: '#' },
          { field: 'Water requirement per WHO (lpcd)', source: 'WHO guidelines (50–100 lpcd)', url: 'https://www.who.int/publications/i/item/9789241548151' },
          { field: 'Wastewater factor (% of water supply)', source: 'Engineering norms (typically 70–80%)', url: '#' },
        ],
      },
    ],
  },
  2: {
    title: 'Interventions — Where to Find the Data',
    sections: [
      {
        heading: '12. Water Interventions',
        items: [
          { field: 'Collection efficiency (current & target ratio)', source: 'Utility billing & collection reports', url: '#' },
          { field: 'NRW % (current & target)', source: 'Utility NRW assessment or IBNET benchmarks. Target NRW has a 3% floor — even the best-performing utilities globally (e.g. Singapore, Tokyo, Copenhagen) report NRW of 3–5% due to unavoidable physical losses from meter inaccuracies, fire hydrant use, and authorized unbilled consumption. Setting a target below 3% is unrealistic for any utility.', url: 'https://www.ib-net.org/' },
          { field: 'NRW capex unit cost (USD per m3/day)', source: 'World Bank NRW reduction cost studies', url: '#' },
          { field: 'Capital efficiency gains %', source: 'Procurement reform benchmarks (typically 10–30%)', url: '#' },
          { field: 'Tariff data (income, revenue, expenditure)', source: 'Utility financial statements + household surveys', url: '#' },
          { field: 'Borrowing parameters (DSCR, tenor, rate)', source: 'Local financial market or development bank terms', url: '#' },
        ],
      },
      {
        heading: '13. Sanitation Interventions',
        items: [
          { field: 'Collection efficiency & sewer tariff', source: 'Sanitation utility billing data', url: '#' },
          { field: 'Capital efficiency gains', source: 'Same procurement reform benchmarks as water', url: '#' },
          { field: 'Tariff & O&M recovery', source: 'Utility financial statements', url: '#' },
          { field: 'Borrowing parameters', source: 'Local financial market or development bank terms', url: '#' },
          { field: 'Sewer tariff as % of water tariff', source: 'Utility billing data or tariff schedule', url: '#' },
        ],
      },
      {
        heading: '14. Custom Interventions',
        items: [
          { field: 'Donor grants / government transfers', source: 'Donor commitment letters or project appraisals', url: '#' },
          { field: 'Climate finance or carbon credits', source: 'GCF, GEF, or carbon market platforms', url: 'https://www.greenclimate.fund/' },
          { field: 'PPP / private sector contributions', source: 'PPP contract or transaction advisor reports', url: '#' },
        ],
      },
    ],
  },
  3: {
    title: 'Results Dashboard — Guide',
    sections: [
      {
        heading: 'Reading the Charts',
        items: [
          { field: 'Coverage progress (stacked area)', source: 'Shows projected HHs by service level over time', url: '#' },
          { field: 'Financing gap chart', source: 'BAU investment vs. target investment needed', url: '#' },
          { field: 'National = Urban + Rural rollup', source: 'Switch to National scope in header to see all three charts', url: '#' },
        ],
      },
      {
        heading: 'Exporting Results',
        items: [
          { field: 'PowerPoint export', source: 'Generates presentation slides with charts & tables', url: '#' },
          { field: 'Excel export', source: 'Full data tables for offline analysis', url: '#' },
          { field: 'CSV export', source: 'Raw data for import into other tools', url: '#' },
        ],
      },
      {
        heading: 'Scenario Comparison',
        items: [
          { field: 'Save scenarios from header bar', source: 'Click "Save Scenario" to snapshot current inputs', url: '#' },
          { field: 'Load & compare saved scenarios', source: 'Click scenario name in the scenarios bar to restore', url: '#' },
          { field: 'Export individual scenario slides', source: 'Click the 📑 icon next to a saved scenario', url: '#' },
        ],
      },
    ],
  },
};

function DataGuide({ tab }: { tab: number }) {
  const guide = guideData[tab];
  if (!guide) return null;
  return (
    <div style={{
      width: 340, borderLeft: '1px solid #e2e8f0', background: '#fafaff', overflowY: 'auto',
      padding: '16px 18px', fontSize: 11, flexShrink: 0,
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#312e81', margin: '0 0 12px', borderBottom: '2px solid #c7d2fe', paddingBottom: 6 }}>
        {guide.title}
      </h3>
      {guide.sections.map((sec, si) => (
        <div key={si} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', marginBottom: 6, background: '#e0e7ff', padding: '4px 8px', borderRadius: 4 }}>
            {sec.heading}
          </div>
          {sec.items.map((item, ii) => (
            <div key={ii} style={{ marginBottom: 8, paddingLeft: 8, borderLeft: '2px solid #e0e7ff' }}>
              <div style={{ fontWeight: 600, color: '#334155', marginBottom: 2 }}>{item.field}</div>
              <div style={{ color: '#64748b', lineHeight: 1.4 }}>
                {item.source}
                {item.url !== '#' && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', color: '#4338ca', fontSize: 10, marginTop: 2, wordBreak: 'break-all' }}>
                    {item.url}
                  </a>
                )}
                {item.url === '#' && (
                  <span style={{ display: 'block', color: '#94a3b8', fontSize: 10, marginTop: 2, fontStyle: 'italic' }}>
                    URL placeholder — to be updated
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 12, padding: '8px 10px', background: '#fef3c7', borderRadius: 6, fontSize: 10, color: '#92400e' }}>
        <strong>Tip:</strong> If a specific data source is unavailable for your country, check the World Bank Open Data portal or contact the local WASH sector coordinator.
        <a href="https://data.worldbank.org/" target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', color: '#92400e', marginTop: 4 }}>
          https://data.worldbank.org/
        </a>
      </div>
    </div>
  );
}

const headerBtnStyle: React.CSSProperties = {
  padding: '5px 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4,
  background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: 11,
};
