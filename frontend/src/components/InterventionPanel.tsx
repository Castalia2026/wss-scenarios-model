import React, { useState } from 'react';

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 6, border: '1px solid #ddd', borderRadius: 6, background: '#fff' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
        border: 'none', background: open ? '#e8f0fe' : '#fff', fontWeight: 600,
        fontSize: 12, borderRadius: 6, display: 'flex', justifyContent: 'space-between',
      }}>{title}<span>{open ? '▾' : '▸'}</span></button>
      {open && <div style={{ padding: '6px 12px 10px' }}>{children}</div>}
    </div>
  );
}

function SubHead({ text }: { text: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', margin: '8px 0 4px', borderBottom: '1px solid #e5e7eb', paddingBottom: 2 }}>{text}</div>;
}

function F({ label, value, onChange, unit, step, isPercent, tip, slider }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; isPercent?: boolean; tip?: string; slider?: boolean;
}) {
  const displayVal = isPercent ? Math.round(value * 1e10) / 1e8 : value;
  return (
    <div style={{ marginBottom: slider ? 6 : 4 }} title={tip || ''}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ flex: 1, fontSize: 11, color: '#0000cc', fontWeight: 500, cursor: tip ? 'help' : 'default' }}>
          {label}{tip && <span style={{ color: '#94a3b8', marginLeft: 3, fontSize: 9 }}>ⓘ</span>}
        </label>
        <input type="number" value={displayVal}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(isPercent ? v / 100 : v); }}
          step={isPercent ? 1 : (step || 1)}
          style={{ width: slider ? 60 : 90, padding: '3px 5px', borderRadius: 3, fontSize: 11, textAlign: 'right', border: '1px solid #ccc' }} />
        {unit && <span style={{ fontSize: 10, color: '#888', minWidth: 24 }}>{unit}</span>}
      </div>
      {slider && <input type="range" value={displayVal} onChange={e => { const v = parseFloat(e.target.value); onChange(isPercent ? v / 100 : v); }}
        min={0} max={isPercent ? 100 : 100} step={isPercent ? 1 : (step || 1)}
        style={{ width: '100%', height: 6, marginTop: 2, accentColor: '#2563eb' }} />}
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

interface Props { inputs: any; onChange: (i: any) => void; }

export default function InterventionPanel({ inputs, onChange }: Props) {
  const u = (section: string, field: string, value: number) => {
    onChange({ ...inputs, [section]: { ...inputs[section], [field]: value } });
  };
  const toggleIntv = (field: string, value: boolean) => {
    onChange({ ...inputs, toggles: { ...inputs.toggles, [field]: value } });
  };
  const CUR = inputs?.country_config?.currency || 'LCU';

  return (
    <div style={{ display: 'flex', width: '100%', overflow: 'hidden' }}>
      {/* Left: intervention controls */}
      <div style={{ width: 420, overflowY: 'auto', padding: 12, background: '#fafbfc', borderRight: '1px solid #e0e0e0', fontSize: 11 }}>
        <h2 style={{ fontSize: 14, marginBottom: 10, color: '#1a1a2e' }}>Intervention Selection</h2>

        {/* Toggles */}
        <Section title="Enable/Disable Interventions" defaultOpen>
          <SubHead text="Water Supply" />
          <Toggle label="Collection efficiency & NRW reduction" checked={inputs.toggles?.ws_collection_nrw_enabled ?? true} onChange={v => toggleIntv('ws_collection_nrw_enabled', v)} />
          <Toggle label="Capital expenditure efficiency" checked={inputs.toggles?.ws_capital_efficiency_enabled ?? true} onChange={v => toggleIntv('ws_capital_efficiency_enabled', v)} />
          <Toggle label="Tariff increase" checked={inputs.toggles?.ws_tariff_enabled ?? true} onChange={v => toggleIntv('ws_tariff_enabled', v)} />
          <Toggle label="Borrowing against future cashflow" checked={inputs.toggles?.ws_borrowing_enabled ?? true} onChange={v => toggleIntv('ws_borrowing_enabled', v)} />
          <SubHead text="Sanitation" />
          <Toggle label="Collection efficiency" checked={inputs.toggles?.san_collection_enabled ?? true} onChange={v => toggleIntv('san_collection_enabled', v)} />
          <Toggle label="Capital expenditure efficiency" checked={inputs.toggles?.san_capital_efficiency_enabled ?? true} onChange={v => toggleIntv('san_capital_efficiency_enabled', v)} />
          <Toggle label="Tariff increase" checked={inputs.toggles?.san_tariff_enabled ?? true} onChange={v => toggleIntv('san_tariff_enabled', v)} />
          <Toggle label="Borrowing against future cashflow" checked={inputs.toggles?.san_borrowing_enabled ?? true} onChange={v => toggleIntv('san_borrowing_enabled', v)} />
          <Toggle label="Microfinance for on-site sanitation" checked={inputs.toggles?.san_microfinance_enabled ?? true} onChange={v => toggleIntv('san_microfinance_enabled', v)} />
          <SubHead text="New" />
          <Toggle label="Budget execution improvement" checked={false} onChange={() => {}} />
        </Section>

        {/* Water intervention parameters */}
        <Section title="Water Supply Parameters">
          <SubHead text="Collection efficiency" />
          <F label="Start year" value={inputs.water_interventions.ce_start_year} onChange={v => u('water_interventions','ce_start_year',v)} tip="Year the intervention begins" />
          <F label="Target year" value={inputs.water_interventions.ce_target_year} onChange={v => u('water_interventions','ce_target_year',v)} tip="Year the target is achieved" />
          <F label="Current collection ratio" value={inputs.water_interventions.ce_current_ratio} onChange={v => u('water_interventions','ce_current_ratio',v)} isPercent unit="%" tip="Current fraction of billed amounts collected" />
          <F label="Target collection ratio" value={inputs.water_interventions.ce_target_ratio} onChange={v => u('water_interventions','ce_target_ratio',v)} isPercent unit="%" tip="Target collection ratio" slider />
          <SubHead text="NRW reduction" />
          <F label="Start year" value={inputs.water_interventions.nrw_start_year} onChange={v => u('water_interventions','nrw_start_year',v)} />
          <F label="Target year" value={inputs.water_interventions.nrw_target_year} onChange={v => u('water_interventions','nrw_target_year',v)} />
          <F label="Current NRW %" value={inputs.water_interventions.nrw_current_pct} onChange={v => u('water_interventions','nrw_current_pct',v)} isPercent unit="%" />
          <F label="Target NRW %" value={inputs.water_interventions.nrw_target_pct} onChange={v => u('water_interventions','nrw_target_pct',v)} isPercent unit="%" slider />
          <F label="Lag to benefits" value={inputs.water_interventions.nrw_lag_years} onChange={v => u('water_interventions','nrw_lag_years',v)} unit="yrs" tip="Years between investment and realized improvement" />
          <SubHead text="Capital efficiency" />
          <F label="Start year" value={inputs.water_interventions.capeff_start_year} onChange={v => u('water_interventions','capeff_start_year',v)} />
          <F label="Efficiency gains" value={inputs.water_interventions.capeff_gains_pct} onChange={v => u('water_interventions','capeff_gains_pct',v)} isPercent unit="%" slider />
          <SubHead text="Tariff reform" />
          <F label="Start year" value={inputs.water_interventions.tariff_start_year} onChange={v => u('water_interventions','tariff_start_year',v)} />
          <F label="Target year" value={inputs.water_interventions.tariff_target_year} onChange={v => u('water_interventions','tariff_target_year',v)} />
          <F label="O&M cost recovery target" value={inputs.water_interventions.tariff_om_recovery_target} onChange={v => u('water_interventions','tariff_om_recovery_target',v)} step={0.1} />
          <F label={`Max % income on water`} value={inputs.water_interventions.tariff_max_pct_income_water} onChange={v => u('water_interventions','tariff_max_pct_income_water',v)} isPercent unit="%" slider />
          <SubHead text="Borrowing" />
          <F label="Start year" value={inputs.water_interventions.loan_start_year} onChange={v => u('water_interventions','loan_start_year',v)} />
          <F label="End year" value={inputs.water_interventions.loan_end_year} onChange={v => u('water_interventions','loan_end_year',v)} />
          <F label="DSCR" value={inputs.water_interventions.loan_dscr} onChange={v => u('water_interventions','loan_dscr',v)} step={0.1} />
          <F label="Grace period" value={inputs.water_interventions.loan_grace_years} onChange={v => u('water_interventions','loan_grace_years',v)} unit="yrs" />
          <F label="Tenor" value={inputs.water_interventions.loan_tenor} onChange={v => u('water_interventions','loan_tenor',v)} unit="yrs" />
          <F label="Interest rate" value={inputs.water_interventions.loan_interest_rate} onChange={v => u('water_interventions','loan_interest_rate',v)} isPercent unit="%" />
          <F label="Year for maintenance capex" value={inputs.water_interventions.loan_investment_years} onChange={v => u('water_interventions','loan_investment_years',v)} unit="yrs" />
        </Section>

        {/* Sanitation intervention parameters */}
        <Section title="Sanitation Parameters">
          <SubHead text="Collection efficiency" />
          <F label="Start year" value={inputs.sanitation_interventions.ce_start_year} onChange={v => u('sanitation_interventions','ce_start_year',v)} />
          <F label="Target year" value={inputs.sanitation_interventions.ce_target_year} onChange={v => u('sanitation_interventions','ce_target_year',v)} />
          <F label="Current collection ratio" value={inputs.sanitation_interventions.ce_current_ratio} onChange={v => u('sanitation_interventions','ce_current_ratio',v)} isPercent unit="%" />
          <F label="Target collection ratio" value={inputs.sanitation_interventions.ce_target_ratio} onChange={v => u('sanitation_interventions','ce_target_ratio',v)} isPercent unit="%" slider />
          <SubHead text="Capital efficiency" />
          <F label="Start year" value={inputs.sanitation_interventions.capeff_start_year} onChange={v => u('sanitation_interventions','capeff_start_year',v)} />
          <F label="Efficiency gains" value={inputs.sanitation_interventions.capeff_gains_pct} onChange={v => u('sanitation_interventions','capeff_gains_pct',v)} isPercent unit="%" slider />
          <SubHead text="Tariff reform" />
          <F label="Start year" value={inputs.sanitation_interventions.tariff_start_year} onChange={v => u('sanitation_interventions','tariff_start_year',v)} />
          <F label="Target year" value={inputs.sanitation_interventions.tariff_target_year} onChange={v => u('sanitation_interventions','tariff_target_year',v)} />
          <F label={`Max % income on sanitation`} value={inputs.sanitation_interventions.tariff_max_pct_income_san} onChange={v => u('sanitation_interventions','tariff_max_pct_income_san',v)} isPercent unit="%" slider />
          <SubHead text="Borrowing" />
          <F label="Start year" value={inputs.sanitation_interventions.loan_start_year} onChange={v => u('sanitation_interventions','loan_start_year',v)} />
          <F label="End year" value={inputs.sanitation_interventions.loan_end_year} onChange={v => u('sanitation_interventions','loan_end_year',v)} />
          <F label="DSCR" value={inputs.sanitation_interventions.loan_dscr} onChange={v => u('sanitation_interventions','loan_dscr',v)} step={0.1} />
          <F label="Interest rate" value={inputs.sanitation_interventions.loan_interest_rate} onChange={v => u('sanitation_interventions','loan_interest_rate',v)} isPercent unit="%" />
          <SubHead text="Microfinance" />
          <F label="Start year" value={inputs.sanitation_interventions.mf_start_year} onChange={v => u('sanitation_interventions','mf_start_year',v)} />
          <F label="End year" value={inputs.sanitation_interventions.mf_end_year} onChange={v => u('sanitation_interventions','mf_end_year',v)} />
          <F label={`Facility cost (${CUR})`} value={inputs.sanitation_interventions.mf_onsite_cost} onChange={v => u('sanitation_interventions','mf_onsite_cost',v)} step={1000} unit={CUR} />
          <F label="Interest rate" value={inputs.sanitation_interventions.mf_interest_rate} onChange={v => u('sanitation_interventions','mf_interest_rate',v)} isPercent unit="%" />
          <F label="Max % income" value={inputs.sanitation_interventions.mf_max_pct_income} onChange={v => u('sanitation_interventions','mf_max_pct_income',v)} isPercent unit="%" slider />
        </Section>

        {/* Custom intervention - visible but non-functional */}
        <div style={{ marginTop: 8 }}>
          <button disabled style={{
            width: '100%', padding: '10px', border: '2px dashed #d1d5db', borderRadius: 6,
            background: '#f9fafb', cursor: 'not-allowed', fontSize: 12, color: '#9ca3af',
          }}>
            + Add Custom Intervention <span style={{ fontSize: 10 }}>(coming soon)</span>
          </button>
        </div>
      </div>

      {/* Right: guidance */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', color: '#64748b' }}>
        <p style={{ fontSize: 16, marginBottom: 8 }}>🔧 Intervention Selection</p>
        <p style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 500 }}>
          Toggle interventions on/off using the checkboxes. Adjust parameters for each intervention
          using the input fields. Sliders are provided for key parameters that can be adjusted
          without drastically changing the output.
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 500, marginTop: 12 }}>
          <strong>Note:</strong> In this prototype, data entered is for demonstration purposes.
          The full version will calculate the impact of each intervention on the financing gap
          and show results in the Results Dashboard.
        </p>
      </div>
    </div>
  );
}
