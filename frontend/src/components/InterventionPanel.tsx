import React, { useState } from 'react';
import { InterventionImpactChart } from './StaticCharts';

function Section({ title, children, defaultOpen = false, sectionKey, onFocus }: { title: string; children: React.ReactNode; defaultOpen?: boolean; sectionKey?: string; onFocus?: (key: string) => void }) {
  const [open, setOpen] = useState(defaultOpen);
  const handleClick = () => { const willOpen = !open; setOpen(willOpen); if (willOpen && sectionKey && onFocus) onFocus(sectionKey); };
  return (
    <div style={{ marginBottom: 8, border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
      <button onClick={handleClick} style={{
        width: '100%', padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
        border: 'none', background: open ? '#e8f0fe' : '#fff', fontWeight: 600,
        fontSize: 14, borderRadius: 8, display: 'flex', justifyContent: 'space-between',
      }}>
        {title}<span>{open ? '▴' : '▾'}</span>
      </button>
      {open && <div style={{ padding: '10px 14px 12px' }}>{children}</div>}
    </div>
  );
}

function SubHead({ text }: { text: string }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', margin: '10px 0 6px', borderBottom: '1px solid #e5e7eb', paddingBottom: 3 }}>{text}</div>;
}

function F({ label, value, onChange, unit, step, isPercent, tip, fieldType }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; step?: number; isPercent?: boolean; tip?: string; fieldType?: 'input' | 'linked' | 'computed';
}) {
  const rawPct = Math.round(value * 1e4) / 1e2;
  const displayVal = isPercent ? (fieldType === 'computed' ? Math.round(rawPct * 100) / 100 : rawPct) : Math.round(value * 100) / 100;
  const isDerived = fieldType === 'computed' || fieldType === 'linked';
  // Show thousands separators for large amounts, but never for years or percentages
  const looksLikeYear = !unit && !isPercent && Number.isInteger(value) && value >= 1900 && value <= 2100;
  const useCommas = !isPercent && !looksLikeYear && Math.abs(displayVal) >= 1000;
  const commaStr = useCommas ? displayVal.toLocaleString('en-US') : '';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
    }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#3A4452', lineHeight: 1.3, fontWeight: 500, minHeight: 32 }} title={tip || undefined}>
        {label}
        {tip && <span style={{
          width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
          background: '#C2CBD6', color: '#fff', fontSize: 10, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'help',
          fontStyle: 'italic', fontFamily: 'Georgia, serif', fontWeight: 700,
        }} title={tip}>i</span>}
      </label>
      <input type={useCommas ? 'text' : 'number'} inputMode="decimal"
        value={useCommas ? commaStr : displayVal}
        onChange={e => { const v = parseFloat(e.target.value.replace(/,/g, '')); if (!isNaN(v)) onChange(isPercent ? v / 100 : v); }}
        step={isPercent ? 1 : (step || 1)}
        readOnly={isDerived}
        style={{
          width: '100%', padding: '7px 10px', borderRadius: 4, fontSize: 13, textAlign: 'left',
          border: isDerived ? '1px solid #DDE3EA' : '1px solid #F0D070',
          background: isDerived ? '#F1F3F5' : '#FFF9E6',
          color: isDerived ? '#6B7785' : '#3A4452',
          cursor: isDerived ? 'not-allowed' : 'text',
          boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
        }} />
      {unit && <span style={{ fontSize: 11, color: '#6B7785' }}>{unit}</span>}
    </div>
  );
}

// Toggle with a parameter panel that is opened/closed only by its own Show/Hide button.
// The checkbox just enables/disables the intervention (drives the graph) and never opens or closes the panel.
function InterventionToggle({ label, checked, onChange, children, onFocus }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; onFocus?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom: 8, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        background: checked ? '#eef2ff' : '#fafbfc', borderBottom: expanded ? '1px solid #c7d2fe' : 'none',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}>
          <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: '#2563eb' }} />
          <span style={{ fontSize: 13, color: checked ? '#1e3a5f' : '#475569', fontWeight: checked ? 600 : 400 }}>{label}</span>
        </label>
        <button onClick={() => { const e = !expanded; setExpanded(e); if (e && onFocus) onFocus(); }}
          style={{ border: '1px solid #c7d2fe', background: '#fff', cursor: 'pointer', fontSize: 11, color: '#2563eb', fontWeight: 600, padding: '3px 10px', borderRadius: 12 }}>
          {expanded ? '▴ Hide' : '▾ Show'}
        </button>
      </div>
      {expanded && (
        <div style={{ padding: '10px 14px', background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 16px', alignItems: 'start' }}>
          {children}
        </div>
      )}
    </div>
  );
}

interface Props { inputs: any; onChange: (i: any) => void; sectorTab?: 'water' | 'sanitation'; onSectorChange?: (v: 'water' | 'sanitation') => void; onSectionFocus?: (key: string) => void; geoScope?: string; chartScope?: string; }

export default function InterventionPanel({ inputs, onChange, sectorTab = 'water', onSectorChange, onSectionFocus, geoScope = 'urban', chartScope }: Props) {
  const u = (section: string, field: string, value: number) => {
    onChange({ ...inputs, [section]: { ...inputs[section], [field]: value } });
  };
  const toggleIntv = (field: string, value: boolean) => {
    onChange({ ...inputs, toggles: { ...inputs.toggles, [field]: value } });
  };
  const CUR = inputs?.country_config?.currency || 'LCU';
  const scopeLabel = geoScope === 'national' ? 'National' : geoScope === 'rural' ? 'Rural' : 'Urban';
  const scopeLower = scopeLabel.toLowerCase();

  // Which intervention layers are switched on for the active sector — drives the impact graph
  const t = inputs.toggles || {};
  const chartActive = sectorTab === 'water'
    ? {
        collectionNrw: !!(t.ws_collection_efficiency_enabled || t.ws_nrw_enabled),
        capital: !!t.ws_capital_efficiency_enabled,
        tariff: !!t.ws_tariff_enabled,
        borrowing: !!t.ws_borrowing_enabled,
      }
    : {
        collectionNrw: !!t.san_collection_enabled,
        capital: !!t.san_capital_efficiency_enabled,
        tariff: !!t.san_tariff_enabled,
        borrowing: !!t.san_borrowing_enabled,
      };

  // Keep custom interventions on the sector selected by the top toggle (leave any set to "Both" alone)
  const prevSector = React.useRef(sectorTab);
  React.useEffect(() => {
    if (prevSector.current === sectorTab) return;
    prevSector.current = sectorTab;
    const ci = inputs.custom_interventions || [];
    if (ci.some((c: any) => c.sector !== 'both' && c.sector !== sectorTab)) {
      onChange({ ...inputs, custom_interventions: ci.map((c: any) => c.sector === 'both' ? c : { ...c, sector: sectorTab }) });
    }
  }, [sectorTab]);

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, overflow: 'hidden' }}>
      {/* Left: intervention controls */}
      <div style={{ flex: '0 1 460px', minWidth: 0, overflowY: 'auto', padding: '16px 24px', background: '#fafbfc', borderRight: '1px solid #e0e0e0', fontSize: 12 }}>

        {/* Area-scope banner */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, textAlign: 'left',
          padding: '8px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
          background: '#EBF6FB', border: '1px solid #b6e0f0', color: '#0073A8',
        }}>
          <span style={{ fontSize: 14, lineHeight: 1.3 }}>📍</span>
          <span>Configuring <span style={{ textTransform: 'capitalize' }}>{scopeLabel}</span> interventions — every field below is {scopeLower}-specific.</span>
        </div>

        {/* Sector toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['water', 'sanitation'] as const).map(s => (
            <button key={s} onClick={() => { onSectorChange?.(s); onSectionFocus?.(s === 'water' ? 'ws_interventions' : 'san_interventions'); }} style={{
              flex: 1, padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: sectorTab === s ? '#2563eb' : '#e5e7eb',
              color: sectorTab === s ? '#fff' : '#374151', fontWeight: 600, fontSize: 13,
            }}>{s === 'water' ? 'Water Supply' : 'Sanitation'}</button>
          ))}
        </div>

        {/* ===== WATER SUPPLY INTERVENTIONS ===== */}
        {sectorTab === 'water' && <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 10 }}>{scopeLabel} Water Supply Interventions</h3>

          <InterventionToggle label="Collection efficiency" checked={inputs.toggles?.ws_collection_efficiency_enabled ?? false} onChange={v => toggleIntv('ws_collection_efficiency_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.ce_start_year} onChange={v => u('water_interventions','ce_start_year',v)} tip="Year the collection efficiency improvement begins" />
            <F label="Target year" value={inputs.water_interventions.ce_target_year} onChange={v => u('water_interventions','ce_target_year',v)} tip="Year the target collection ratio is achieved" />
            <F label="Current collection ratio" value={inputs.water_interventions.ce_current_ratio} onChange={v => u('water_interventions','ce_current_ratio',v)} isPercent unit="%" tip="Current revenue collected ÷ revenue billed. Represents how much of what is billed is actually collected." />
            <F label="Target collection ratio" value={inputs.water_interventions.ce_target_ratio} onChange={v => u('water_interventions','ce_target_ratio',v)} isPercent unit="%" tip="Target collection ratio for the model end year" />
            <F label="Water volume sold" value={inputs.water_interventions.ce_water_sold_mld} onChange={v => u('water_interventions','ce_water_sold_mld',v)} unit="MLD" tip="Total volume of water sold/billed to customers, in million litres per day" />
            <F label="Current tariff" value={inputs.water_interventions.ce_current_tariff} onChange={v => u('water_interventions','ce_current_tariff',v)} unit={`${CUR}/m3`} tip="Current average water tariff per cubic metre" />
          </InterventionToggle>

          <InterventionToggle label="NRW reduction" checked={inputs.toggles?.ws_nrw_enabled ?? false} onChange={v => toggleIntv('ws_nrw_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.nrw_start_year} onChange={v => u('water_interventions','nrw_start_year',v)} tip="Year the NRW reduction programme begins" />
            <F label="Target year" value={inputs.water_interventions.nrw_target_year} onChange={v => u('water_interventions','nrw_target_year',v)} tip="Year the target NRW level is achieved" />
            <F label="Current NRW %" value={inputs.water_interventions.nrw_current_pct} onChange={v => u('water_interventions','nrw_current_pct',v)} isPercent unit="%" tip="Current non-revenue water: share of water produced that is not billed (physical leaks + commercial losses)" />
            <F label="Target NRW %" value={inputs.water_interventions.nrw_target_pct} onChange={v => u('water_interventions','nrw_target_pct',v)} isPercent unit="%" tip="Target non-revenue water for the model end year (minimum 3%)." />
            {(() => {
              const t = inputs.water_interventions.nrw_target_pct || 0;
              if (t > 0 && t < 0.03) return <div style={{ gridColumn: '1 / -1', fontSize: 10, fontWeight: 600, color: '#dc2626', padding: '3px 8px', background: '#fef2f2', borderRadius: 4, marginBottom: 4 }}>⛔ Below 3% is unrealistic</div>;
              if (t >= 0.03 && t < 0.07) return <div style={{ gridColumn: '1 / -1', fontSize: 10, fontWeight: 600, color: '#92400e', padding: '3px 8px', background: '#fef3c7', borderRadius: 4, marginBottom: 4 }}>⚠ 3–7% is highly ambitious</div>;
              return null;
            })()}
            <F label="Commercial losses % of NRW" value={inputs.water_interventions.nrw_commercial_loss_pct || 0} onChange={v => u('water_interventions','nrw_commercial_loss_pct',v)} isPercent unit="%" tip="Share of NRW from commercial losses (metering errors, theft, unbilled use). Commercial + physical must sum to 100%." />
            <F label="Physical losses % of NRW" value={inputs.water_interventions.nrw_physical_loss_pct || 0} onChange={v => u('water_interventions','nrw_physical_loss_pct',v)} isPercent unit="%" tip="Share of NRW from physical leaks in the network. Commercial + physical must sum to 100%." />
            {(() => {
              const s = (inputs.water_interventions.nrw_commercial_loss_pct || 0) + (inputs.water_interventions.nrw_physical_loss_pct || 0);
              const bad = Math.abs(s - 1) > 0.005;
              return <div style={{ gridColumn: '1 / -1', fontSize: 10, fontWeight: 600, color: bad ? '#dc2626' : '#16a34a', padding: '3px 8px', background: bad ? '#fef2f2' : '#f0fdf4', borderRadius: 4, marginBottom: 4 }}>{bad ? `Commercial and physical losses add up to ${Math.round(s * 10000) / 100}% — they should total 100%.` : 'Commercial and physical losses add up to 100%. ✓'}</div>;
            })()}
            <F label="Capex unit cost NRW reduction" value={inputs.water_interventions.nrw_capex_unit_cost_usd || 0} onChange={v => u('water_interventions','nrw_capex_unit_cost_usd',v)} step={10} unit="USD/m3/day" tip="Capital cost to recover one cubic metre per day of lost water through NRW reduction" />
            <F label="Lag to benefits" value={inputs.water_interventions.nrw_lag_years} onChange={v => u('water_interventions','nrw_lag_years',v)} unit="yrs" tip="NRW reduction does not pay off immediately: leak detection surveys, pipe and meter replacement, and pressure management must be planned, procured, and rolled out across the network before non-revenue water actually falls. Enter the number of years between the investment and when the reduction takes effect (typically 2–4)." />
            <F label="Year of maintenance capex" value={inputs.water_interventions.nrw_maintenance_capex_year || 0} onChange={v => u('water_interventions','nrw_maintenance_capex_year',v)} tip="Year in which periodic maintenance capital expenditure on NRW is incurred" />
            <F label="Maintenance capex" value={inputs.water_interventions.nrw_maintenance_capex || 0} onChange={v => u('water_interventions','nrw_maintenance_capex',v)} step={10} unit={`${CUR} M`} tip="Maintenance capital expenditure to sustain the NRW reduction" />
          </InterventionToggle>

          <InterventionToggle label="Capital expenditure efficiency" checked={inputs.toggles?.ws_capital_efficiency_enabled ?? false} onChange={v => toggleIntv('ws_capital_efficiency_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.capeff_start_year} onChange={v => u('water_interventions','capeff_start_year',v)} tip="Year capital efficiency improvements begin" />
            <F label="Efficiency gains" value={inputs.water_interventions.capeff_gains_pct} onChange={v => u('water_interventions','capeff_gains_pct',v)} isPercent unit="%" tip="Reduction in unit capital costs from better procurement and project management. Typically 10–30%." />
          </InterventionToggle>

          <InterventionToggle label="Tariff reform" checked={inputs.toggles?.ws_tariff_enabled ?? false} onChange={v => toggleIntv('ws_tariff_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.tariff_start_year} onChange={v => u('water_interventions','tariff_start_year',v)} tip="Year the tariff reform begins" />
            <F label="Target year" value={inputs.water_interventions.tariff_target_year} onChange={v => u('water_interventions','tariff_target_year',v)} tip="Year the target tariff/cost recovery is reached" />
            <F label="Monthly income bottom 20%" value={inputs.water_interventions.tariff_monthly_income_bottom20 || 0} onChange={v => u('water_interventions','tariff_monthly_income_bottom20',v)} step={100} unit={CUR} tip="Average monthly household income for the poorest 20% — used to check tariff affordability" />
            <F label="Max % income on water" value={inputs.water_interventions.tariff_max_pct_income_water} onChange={v => u('water_interventions','tariff_max_pct_income_water',v)} isPercent unit="%" tip="Maximum share of household income that should be spent on water (affordability ceiling)" />
            <F label="Current operating revenue" value={inputs.water_interventions.tariff_op_revenue || 0} onChange={v => u('water_interventions','tariff_op_revenue',v)} step={1000000} unit={CUR} tip="Current annual operating revenue from water sales" />
            <F label="Current operating expenditure" value={inputs.water_interventions.tariff_op_expenditure || 0} onChange={v => u('water_interventions','tariff_op_expenditure',v)} step={1000000} unit={CUR} tip="Current annual operating expenditure (O&M costs)" />
            <F label="Current O&M ratio (calculated)" value={(inputs.water_interventions.tariff_op_revenue && inputs.water_interventions.tariff_op_expenditure) ? Math.round(inputs.water_interventions.tariff_op_revenue / inputs.water_interventions.tariff_op_expenditure * 100) / 100 : 0} onChange={() => {}} fieldType="computed" tip="Operating revenue ÷ operating expenditure. A ratio of 1.0 means O&M costs are fully covered." />
            <F label="O&M recovery target" value={inputs.water_interventions.tariff_om_recovery_target} onChange={v => u('water_interventions','tariff_om_recovery_target',v)} step={0.1} tip="Target operating revenue ÷ expenditure ratio to reach through tariff reform" />
          </InterventionToggle>

          <InterventionToggle label="Borrowing against future cashflow" checked={inputs.toggles?.ws_borrowing_enabled ?? false} onChange={v => toggleIntv('ws_borrowing_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.loan_start_year} onChange={v => u('water_interventions','loan_start_year',v)} tip="Year borrowing begins" />
            <F label="End year" value={inputs.water_interventions.loan_end_year} onChange={v => u('water_interventions','loan_end_year',v)} tip="Last year in which new loans are drawn down" />
            <F label="Avg cost per water produced" value={inputs.water_interventions.loan_avg_cost || 0} onChange={v => u('water_interventions','loan_avg_cost',v)} step={0.1} unit={`${CUR}/m3`} tip="Average operating cost per cubic metre of water produced — used to estimate the surplus available to service debt" />
            <F label="DSCR" value={inputs.water_interventions.loan_dscr} onChange={v => u('water_interventions','loan_dscr',v)} step={0.1} tip="Debt service coverage ratio — minimum ratio of operating surplus to debt repayments lenders require" />
            <F label="Grace period" value={inputs.water_interventions.loan_grace_years} onChange={v => u('water_interventions','loan_grace_years',v)} unit="yrs" tip="Years before loan principal repayment begins" />
            <F label="Tenor" value={inputs.water_interventions.loan_tenor} onChange={v => u('water_interventions','loan_tenor',v)} unit="yrs" tip="Total repayment period of the loan" />
            <F label="Interest rate" value={inputs.water_interventions.loan_interest_rate} onChange={v => u('water_interventions','loan_interest_rate',v)} isPercent unit="%" tip="Annual interest rate on the borrowing" />
            <F label="Year of investment" value={inputs.water_interventions.loan_investment_year || 0} onChange={v => u('water_interventions','loan_investment_year',v)} tip="Year in which the borrowed funds are invested" />
          </InterventionToggle>

          <InterventionToggle label="Budget execution improvement" checked={inputs.toggles?.ws_budget_execution_enabled ?? false} onChange={v => toggleIntv('ws_budget_execution_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.budget_exec_start_year || 0} onChange={v => u('water_interventions','budget_exec_start_year',v)} tip="Year budget execution improvements begin" />
            <F label="Current execution rate (calculated)" value={inputs.water_interventions.budget_exec_current_rate || 0} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Current budget execution rate, calculated from actual expenditure ÷ allocated budget in Data Inputs" />
            <F label="Target execution rate" value={inputs.water_interventions.budget_exec_target_rate || 0} onChange={v => u('water_interventions','budget_exec_target_rate',v)} isPercent unit="%" tip="Target share of allocated budget that is actually spent each year" />
          </InterventionToggle>
        </>}

        {/* ===== SANITATION INTERVENTIONS ===== */}
        {sectorTab === 'sanitation' && <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 10 }}>{scopeLabel} Sanitation Interventions</h3>

          <InterventionToggle label="Collection efficiency" checked={inputs.toggles?.san_collection_enabled ?? false} onChange={v => toggleIntv('san_collection_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.ce_start_year} onChange={v => u('sanitation_interventions','ce_start_year',v)} tip="Year the collection efficiency improvement begins" />
            <F label="Target year" value={inputs.sanitation_interventions.ce_target_year} onChange={v => u('sanitation_interventions','ce_target_year',v)} tip="Year the target is achieved" />
            <F label="Sewer tariff as % of water tariff" value={inputs.sanitation_interventions.ce_sewer_tariff_pct_water || 0} onChange={v => u('sanitation_interventions','ce_sewer_tariff_pct_water',v)} isPercent unit="%" tip="Sewer tariff expressed as a share of the water tariff. Collection ratios are inherited from water supply." />
          </InterventionToggle>

          <InterventionToggle label="Capital expenditure efficiency" checked={inputs.toggles?.san_capital_efficiency_enabled ?? false} onChange={v => toggleIntv('san_capital_efficiency_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.capeff_start_year} onChange={v => u('sanitation_interventions','capeff_start_year',v)} tip="Year capital efficiency improvements begin" />
            <F label="Efficiency gains" value={inputs.sanitation_interventions.capeff_gains_pct} onChange={v => u('sanitation_interventions','capeff_gains_pct',v)} isPercent unit="%" tip="Reduction in unit capital costs from better procurement and project management. Typically 10–30%." />
          </InterventionToggle>

          <InterventionToggle label="Tariff reform" checked={inputs.toggles?.san_tariff_enabled ?? false} onChange={v => toggleIntv('san_tariff_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.tariff_start_year} onChange={v => u('sanitation_interventions','tariff_start_year',v)} tip="Year the tariff reform begins" />
            <F label="Target year" value={inputs.sanitation_interventions.tariff_target_year} onChange={v => u('sanitation_interventions','tariff_target_year',v)} tip="Year the target tariff/cost recovery is reached" />
            <F label="Max % income on sanitation" value={inputs.sanitation_interventions.tariff_max_pct_income_san} onChange={v => u('sanitation_interventions','tariff_max_pct_income_san',v)} isPercent unit="%" tip="Maximum share of household income that should be spent on sanitation (affordability ceiling)" />
            <F label="Tariff real growth rate" value={inputs.sanitation_interventions.san_tariff_growth_rate || 0} onChange={v => u('sanitation_interventions','san_tariff_growth_rate',v)} isPercent unit="%" tip="Annual real (inflation-adjusted) growth rate of the sanitation tariff" />
            <F label="Current operating revenue" value={inputs.sanitation_interventions.tariff_op_revenue || 0} onChange={v => u('sanitation_interventions','tariff_op_revenue',v)} step={1000000} unit={CUR} tip="Current annual operating revenue from sanitation services" />
            <F label="Current operating expenditure" value={inputs.sanitation_interventions.tariff_op_expenditure || 0} onChange={v => u('sanitation_interventions','tariff_op_expenditure',v)} step={1000000} unit={CUR} tip="Current annual operating expenditure (O&M costs)" />
            <F label="Current O&M ratio (calculated)" value={(inputs.sanitation_interventions.tariff_op_revenue && inputs.sanitation_interventions.tariff_op_expenditure) ? Math.round(inputs.sanitation_interventions.tariff_op_revenue / inputs.sanitation_interventions.tariff_op_expenditure * 100) / 100 : 0} onChange={() => {}} fieldType="computed" tip="Operating revenue ÷ operating expenditure. A ratio of 1.0 means O&M costs are fully covered." />
            <F label="O&M recovery target" value={inputs.sanitation_interventions.tariff_om_recovery_target || 0} onChange={v => u('sanitation_interventions','tariff_om_recovery_target',v)} step={0.1} tip="Target operating revenue ÷ expenditure ratio to reach through tariff reform" />
          </InterventionToggle>

          <InterventionToggle label="Borrowing against future cashflow" checked={inputs.toggles?.san_borrowing_enabled ?? false} onChange={v => toggleIntv('san_borrowing_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.loan_start_year} onChange={v => u('sanitation_interventions','loan_start_year',v)} tip="Year borrowing begins" />
            <F label="End year" value={inputs.sanitation_interventions.loan_end_year} onChange={v => u('sanitation_interventions','loan_end_year',v)} tip="Last year in which new loans are drawn down" />
            <F label="Avg cost per wastewater billed" value={inputs.sanitation_interventions.loan_avg_cost || 0} onChange={v => u('sanitation_interventions','loan_avg_cost',v)} step={0.1} unit={`${CUR}/m3`} tip="Average operating cost per cubic metre of wastewater billed — used to estimate the surplus available to service debt" />
            <F label="DSCR" value={inputs.sanitation_interventions.loan_dscr} onChange={v => u('sanitation_interventions','loan_dscr',v)} step={0.1} tip="Debt service coverage ratio — minimum ratio of operating surplus to debt repayments lenders require" />
            <F label="Grace period" value={inputs.sanitation_interventions.loan_grace_years || 0} onChange={v => u('sanitation_interventions','loan_grace_years',v)} unit="yrs" tip="Years before loan principal repayment begins" />
            <F label="Tenor" value={inputs.sanitation_interventions.loan_tenor || 0} onChange={v => u('sanitation_interventions','loan_tenor',v)} unit="yrs" tip="Total repayment period of the loan" />
            <F label="Interest rate" value={inputs.sanitation_interventions.loan_interest_rate} onChange={v => u('sanitation_interventions','loan_interest_rate',v)} isPercent unit="%" tip="Annual interest rate on the borrowing" />
            <F label="Year of investment" value={inputs.sanitation_interventions.loan_investment_year || 0} onChange={v => u('sanitation_interventions','loan_investment_year',v)} tip="Year in which the borrowed funds are invested" />
          </InterventionToggle>

          <InterventionToggle label="Budget execution improvement" checked={inputs.toggles?.san_budget_execution_enabled ?? false} onChange={v => toggleIntv('san_budget_execution_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.budget_exec_start_year || 0} onChange={v => u('sanitation_interventions','budget_exec_start_year',v)} tip="Year budget execution improvements begin" />
            <F label="Current execution rate (calculated)" value={inputs.sanitation_interventions.budget_exec_current_rate || 0} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Current budget execution rate, calculated from actual expenditure ÷ allocated budget in Data Inputs" />
            <F label="Target execution rate" value={inputs.sanitation_interventions.budget_exec_target_rate || 0} onChange={v => u('sanitation_interventions','budget_exec_target_rate',v)} isPercent unit="%" tip="Target share of allocated budget that is actually spent each year" />
          </InterventionToggle>

          <InterventionToggle label="Microfinance for on-site sanitation" checked={inputs.toggles?.san_microfinance_enabled ?? false} onChange={v => toggleIntv('san_microfinance_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.mf_start_year || 0} onChange={v => u('sanitation_interventions','mf_start_year',v)} tip="Year the microfinance scheme begins" />
            <F label="End year" value={inputs.sanitation_interventions.mf_end_year || 0} onChange={v => u('sanitation_interventions','mf_end_year',v)} tip="Last year microfinance loans are issued" />
            <F label="Facility cost" value={inputs.sanitation_interventions.mf_onsite_cost || 0} onChange={v => u('sanitation_interventions','mf_onsite_cost',v)} step={1000} unit={CUR} tip="Capital cost of an on-site sanitation facility financed by the loan" />
            <F label="Interest rate" value={inputs.sanitation_interventions.mf_interest_rate || 0} onChange={v => u('sanitation_interventions','mf_interest_rate',v)} isPercent unit="%" tip="Annual interest rate on microfinance loans" />
            <F label="Tenor" value={inputs.sanitation_interventions.mf_tenor || 0} onChange={v => u('sanitation_interventions','mf_tenor',v)} unit="yrs" tip="Repayment period of the microfinance loan" />
            <F label="Collection & emptying cost" value={inputs.sanitation_interventions.mf_collection_cost || 0} onChange={v => u('sanitation_interventions','mf_collection_cost',v)} step={500} unit={CUR} tip="Cost per emptying of the on-site containment (fecal sludge collection)" />
            <F label="Emptying frequency" value={inputs.sanitation_interventions.mf_emptying_frequency || 0} onChange={v => u('sanitation_interventions','mf_emptying_frequency',v)} unit="yrs" tip="Years between each emptying of the on-site facility" />
            <F label="Max % income on sanitation" value={inputs.sanitation_interventions.mf_max_pct_income || 0} onChange={v => u('sanitation_interventions','mf_max_pct_income',v)} isPercent unit="%" tip="Maximum share of household income that can go to loan repayments (affordability ceiling)" />
            <F label="Adoption rate" value={inputs.sanitation_interventions.mf_adoption_rate || 0} onChange={v => u('sanitation_interventions','mf_adoption_rate',v)} isPercent unit="%" tip="Share of eligible households expected to take up the microfinance scheme" />
          </InterventionToggle>
        </>}

        {/* ===== CUSTOM INTERVENTIONS (always visible, no dropdown) ===== */}
        <div style={{ marginTop: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff', padding: '12px 14px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', margin: '0 0 8px' }}>Custom Interventions</h3>
          <div onClick={() => onSectionFocus?.('custom_interventions')}>
            <div style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', padding: '6px 8px', borderRadius: 4, marginBottom: 8 }}>
              Custom interventions are saved with your scenario. In the full tool, they will affect calculations.
            </div>
            {(inputs.custom_interventions || []).map((ci: any, idx: number) => {
              const updateCI = (field: string, val: any) => {
                const arr = [...inputs.custom_interventions];
                arr[idx] = { ...arr[idx], [field]: val };
                onChange({ ...inputs, custom_interventions: arr });
              };
              return (
                <div key={idx} style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', marginBottom: 8, background: '#faf5ff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <input type="color" value={ci.color || '#9333ea'} onChange={e => updateCI('color', e.target.value)}
                      style={{ width: 20, height: 20, border: 'none', cursor: 'pointer', borderRadius: 3 }} />
                    <input type="text" value={ci.name} onChange={e => updateCI('name', e.target.value)}
                      style={{ flex: 1, border: '1px solid #ccc', borderRadius: 3, padding: '3px 6px', fontSize: 12, fontWeight: 600 }} />
                    <button onClick={() => {
                      const arr = inputs.custom_interventions.filter((_: any, i: number) => i !== idx);
                      onChange({ ...inputs, custom_interventions: arr });
                    }} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontSize: 10 }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, color: '#64748b' }}>Sector ▾</label>
                      <select value={ci.sector} onChange={e => updateCI('sector', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid #94a3b8', borderRadius: 3, fontSize: 11, background: '#fff', cursor: 'pointer' }}>
                        <option value="water">Water Supply</option>
                        <option value="sanitation">Sanitation</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, color: '#64748b' }}>Type ▾</label>
                      <select value={ci.intervention_type} onChange={e => updateCI('intervention_type', e.target.value)}
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid #94a3b8', borderRadius: 3, fontSize: 11, background: '#fff', cursor: 'pointer' }}>
                        <option value="fixed_annual">Fixed Annual Amount</option>
                        <option value="revenue_stream">Revenue Stream</option>
                        <option value="per_hh_subsidy">Per-HH Subsidy</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 16px', alignItems: 'start' }}>
                    <F label="Start year" value={ci.start_year} onChange={v => updateCI('start_year', v)} tip="Year this custom intervention begins" />
                    <F label="End year" value={ci.end_year} onChange={v => updateCI('end_year', v)} tip="Year this custom intervention ends" />
                    {ci.intervention_type === 'fixed_annual' && (
                      <F label="Annual amount (mill)" value={ci.annual_amount} onChange={v => updateCI('annual_amount', v)} step={100} tip="Fixed amount of funding provided each year" />
                    )}
                    {ci.intervention_type === 'revenue_stream' && (<>
                      <F label="Starting amount (mill)" value={ci.starting_amount} onChange={v => updateCI('starting_amount', v)} step={100} tip="Funding amount in the first year of the revenue stream" />
                      <F label="Growth rate" value={ci.growth_rate} onChange={v => updateCI('growth_rate', v)} isPercent unit="%" tip="Annual growth rate of the revenue stream" />
                    </>)}
                    {ci.intervention_type === 'per_hh_subsidy' && (
                      <F label="Subsidy per HH" value={ci.subsidy_per_hh} onChange={v => updateCI('subsidy_per_hh', v)} step={1000} tip="Subsidy amount provided per household connected" />
                    )}
                  </div>
                </div>
              );
            })}
            <button onClick={() => {
              const existing = inputs.custom_interventions || [];
              const colors = ['#9333ea','#f97316','#06b6d4','#84cc16','#f43f5e'];
              onChange({ ...inputs, custom_interventions: [...existing, {
                name: 'New Intervention', enabled: true, sector: sectorTab, intervention_type: 'fixed_annual',
                start_year: 2028, end_year: 2035, annual_amount: 1000, starting_amount: 500,
                growth_rate: 0.05, subsidy_per_hh: 10000, color: colors[existing.length % colors.length],
              }] });
            }} style={{ width: '100%', padding: '8px', border: '1px dashed #9333ea', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 12, color: '#9333ea', fontWeight: 500 }}>
              + Add Custom Intervention
            </button>
          </div>
        </div>
      </div>

      {/* Right: intervention impact chart */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px 28px' }}>
        {(chartScope || geoScope) === 'urban_rural' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <InterventionImpactChart sector={sectorTab} geoScope="urban" active={chartActive} />
            <InterventionImpactChart sector={sectorTab} geoScope="rural" active={chartActive} />
            <InterventionImpactChart sector={sectorTab} geoScope="urban_rural" active={chartActive} />
          </div>
        ) : (
          <InterventionImpactChart sector={sectorTab} geoScope={chartScope || geoScope} active={chartActive} />
        )}
      </div>
    </div>
  );
}
