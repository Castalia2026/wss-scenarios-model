import React, { useState } from 'react';
import LiveInterventionChart from './LiveInterventionChart';

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

function F({ label, value, onChange, unit, step, isPercent, tip, fieldType, placeholder }: {
  label: string; value?: number; onChange: (v: number) => void; unit?: string; step?: number; isPercent?: boolean; tip?: string; fieldType?: 'input' | 'linked' | 'computed'; placeholder?: string;
}) {
  const hasVal = typeof value === 'number' && !Number.isNaN(value);
  const rawPct = hasVal ? Math.round((value as number) * 1e4) / 1e2 : NaN;
  const displayVal = !hasVal ? NaN : (isPercent ? (fieldType === 'computed' ? Math.round(rawPct * 100) / 100 : rawPct) : Math.round((value as number) * 100) / 100);
  const isDerived = fieldType === 'computed' || fieldType === 'linked';
  // Show thousands separators for large amounts, but never for years or percentages
  const looksLikeYear = hasVal && !unit && !isPercent && Number.isInteger(value) && (value as number) >= 1900 && (value as number) <= 2100;
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
        value={useCommas ? commaStr : (Number.isNaN(displayVal) ? '' : displayVal)}
        placeholder={placeholder}
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

// Optimised-technology-selection editor: re-weight / re-cost the SAFELY-MANAGED technology mix (pre-filled
// from the BAU mix). Its weighted cost becomes the new SM connection cost from the start year onward. Only
// the SM cost drives new connections in the engine, so this is the SM mix only. The mix lives in the payload
// (techmix_sm_tech_mix); the adapter collapses it to techmix_sm_cost. Equal to the BAU mix ⇒ zero effect.
function TechMixEditor({ inputs, onChange, section, CUR }: {
  inputs: any; onChange: (i: any) => void; section: 'water_interventions' | 'sanitation_interventions'; CUR: string;
}) {
  const iv = inputs[section] || {};
  const costsSection = section === 'water_interventions' ? 'water_costs' : 'sanitation_costs';
  const bauMix: any[] = (inputs[costsSection]?.sm_tech_mix || []).filter((t: any) => t && typeof t === 'object');
  const mix: any[] = (iv.techmix_sm_tech_mix || []).filter((t: any) => t && typeof t === 'object');
  const weighted = (m: any[]) => m.reduce((a: number, t: any) => a + (+t.share || 0) * (+t.cost || 0), 0);
  const bauCost = weighted(bauMix), newCost = weighted(mix);
  const shareSum = mix.reduce((a: number, t: any) => a + (+t.share || 0), 0);
  const okShare = Math.abs(shareSum - 1) < 0.001;
  const pct = bauCost > 0 ? (newCost / bauCost - 1) * 100 : 0;
  const setMix = (m: any[]) => onChange({ ...inputs, [section]: { ...iv, techmix_sm_tech_mix: m } });
  const upd = (i: number, patch: any) => setMix(mix.map((x: any, j: number) => j === i ? { ...x, ...patch } : x));
  const cellStyle: React.CSSProperties = { padding: '4px 6px', border: '1px solid #F0D070', background: '#FFF9E6', borderRadius: 3, fontSize: 11, color: '#3A4452', outline: 'none' };
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ maxWidth: 160 }}>
        <F label="Start year" value={iv.techmix_start_year} onChange={v => onChange({ ...inputs, [section]: { ...iv, techmix_start_year: v } })}
          tip="Year the re-modelled technology mix takes effect. From this year on, new safely-managed connections use the mix below; earlier years keep the BAU mix." />
      </div>
      <div style={{ fontSize: 11, color: '#475569', margin: '8px 0 4px' }}>
        Re-weight or re-cost the <b>safely-managed</b> technology mix (pre-filled from your BAU mix). Its weighted cost becomes the new safely-managed connection cost from the start year — cheaper connections let the same budget reach more households.
      </div>
      <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
        <thead><tr style={{ color: '#64748b' }}><th style={{ textAlign: 'left', padding: '2px 6px' }}>technology</th><th>share %</th><th>cost/HH</th><th></th></tr></thead>
        <tbody>
          {mix.map((t: any, i: number) => (
            <tr key={i}>
              <td><input type="text" style={{ ...cellStyle, width: 180 }} value={t.name || ''} onChange={e => upd(i, { name: e.target.value })} /></td>
              <td><input type="number" style={{ ...cellStyle, width: 60 }} value={Math.round((+t.share || 0) * 1e6) / 1e4} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) upd(i, { share: v / 100 }); }} /></td>
              <td><input type="number" style={{ ...cellStyle, width: 92 }} value={Math.round(+t.cost || 0)} onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) upd(i, { cost: v }); }} /></td>
              <td><button onClick={() => { if (mix.length > 1) setMix(mix.filter((_: any, j: number) => j !== i)); }} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', borderRadius: 3, padding: '2px 7px', cursor: 'pointer', fontSize: 10 }}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, margin: '4px 0' }}>
        <button onClick={() => setMix([...mix, { name: 'New technology', share: 0, cost: 0 }])}
          style={{ padding: '3px 9px', fontSize: 11, border: '1px dashed #0073A8', background: '#fff', color: '#0073A8', borderRadius: 5, cursor: 'pointer' }}>+ Add technology</button>
        <button onClick={() => setMix(bauMix.map((t: any) => ({ ...t })))}
          style={{ padding: '3px 9px', fontSize: 11, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', borderRadius: 5, cursor: 'pointer' }}>↺ Reset to current BAU mix</button>
      </div>
      <div style={{ fontSize: 10.5, color: okShare ? '#0073A8' : '#b91c1c' }}>
        Shares total {(shareSum * 100).toFixed(2)}%{okShare ? '' : ' (they must total 100%)'}.
      </div>
      <div style={{ fontSize: 11, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '5px 9px', marginTop: 4 }}>
        New safely-managed connection cost: <b>{Math.round(newCost).toLocaleString()} {CUR}</b> vs BAU <b>{Math.round(bauCost).toLocaleString()} {CUR}</b>{' '}
        (<b style={{ color: pct < 0 ? '#16a34a' : pct > 0 ? '#b45309' : '#64748b' }}>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</b>). Applied from {iv.techmix_start_year || 'the start year'}.
      </div>
    </div>
  );
}

interface Props { inputs: any; onChange: (i: any) => void; results?: any; sectorTab?: 'water' | 'sanitation'; onSectorChange?: (v: 'water' | 'sanitation') => void; onSectionFocus?: (key: string) => void; geoScope?: string; chartScope?: string; }

export default function InterventionPanel({ inputs, onChange, results, sectorTab = 'water', onSectorChange, onSectionFocus, geoScope = 'urban', chartScope }: Props) {
  // Budget execution (executed budget ÷ allocated budget) is COMPUTED by the live engine from the
  // historical budget rows — it is shown read-only as the current value in the Budget-execution
  // intervention (no user override). NB: internally still keyed capeff_*/ws_capital_efficiency_enabled
  // (the same ratio, renamed in the UI).
  const wsCurEff = results?.water_supply?.capex_efficiency_baseline ?? 1;
  const sanCurEff = results?.sanitation?.capex_efficiency_baseline ?? 1;
  const u = (section: string, field: string, value: number | string) => {
    onChange({ ...inputs, [section]: { ...inputs[section], [field]: value } });
  };
  const toggleIntv = (field: string, value: boolean) => {
    onChange({ ...inputs, toggles: { ...inputs.toggles, [field]: value } });
  };
  const CUR = inputs?.country_config?.currency || 'LCU';
  const scopeLabel = geoScope === 'national' ? 'National' : geoScope === 'rural' ? 'Rural' : 'Urban';
  const scopeLower = scopeLabel.toLowerCase();

  // ── Affordability lever (microfinance + means-based grant) helpers ──────────────────────────────
  const miniInput: React.CSSProperties = { width: '100%', padding: '5px 7px', borderRadius: 4, fontSize: 12,
    border: '1px solid #F0D070', background: '#FFF9E6', color: '#3A4452', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' };
  const uArr = (section: string, field: string, idx: number, value: number) => {
    const arr = [...((inputs[section]?.[field]) || [])];
    arr[idx] = value;
    onChange({ ...inputs, [section]: { ...inputs[section], [field]: arr } });
  };
  const uBracket = (idx: number, field: string, value: number) => {
    const brackets = ((inputs.income_distribution?.brackets) || []).map((b: any, i: number) => i === idx ? { ...b, [field]: value } : b);
    onChange({ ...inputs, income_distribution: { ...(inputs.income_distribution || {}), brackets } });
  };
  const bracketLabel = (i: number, n: number) => i === 0 ? 'Poorest' : i === n - 1 ? 'Richest' : `Q${i + 1}`;
  const microfinanceFields = (section: 'water_interventions' | 'sanitation_interventions') => {
    const iv = inputs[section] || {};
    const gaps: number[] = iv.mf_gap_shares || [0, 0, 0, 0, 0];
    const brackets: any[] = inputs.income_distribution?.brackets || [];
    const gapSum = gaps.reduce((s: number, g: number) => s + (+g || 0), 0);
    const shareSum = brackets.reduce((s: number, b: any) => s + (+b.hh_share || 0), 0);
    const svc = section === 'water_interventions' ? 'water' : 'sanitation';
    const smCapex = section === 'water_interventions' ? results?.water_supply?.cost_per_hh : results?.sanitation?.cost_per_hh;
    return (<>
      <F label="Connection fee" value={iv.mf_connection_fee || undefined} onChange={v => u(section, 'mf_connection_fee', v)} step={1000} unit={CUR}
         placeholder={smCapex ? `${Math.round(smCapex).toLocaleString('en-US')} (SM capex)` : 'SM capex'}
         tip="Capital cost of a connection, financed by the loan. Leave blank to use the safely-managed new-service cost (the same capex the rest of the model uses); enter a value to override." />
      <F label="Start year" value={iv.mf_start_year} onChange={v => u(section, 'mf_start_year', v)} tip="Year the microfinance scheme begins." />
      <F label="End year" value={iv.mf_end_year} onChange={v => u(section, 'mf_end_year', v)} tip="Last year new microfinance-financed connections are made." />
      {/* Self-finance carve-out — isolates the BAU-anyway connections so microfinance isn't credited for them */}
      <div style={{ gridColumn: '1 / -1' }}><SubHead text="Self-finance carve-out" /></div>
      <F label="Can pay upfront (share of gap)" value={iv.mf_selffinance_share} onChange={v => u(section, 'mf_selffinance_share', v)} isPercent unit="%" tip="Share of the service gap that can pay the connection upfront from savings. Taken richest-bracket-first, they're treated as connecting anyway (BAU) — ISOLATED out and excluded from the microfinance impact, so it isn't credited for connections that would happen without it." />
      <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b' }}>
        These households don't need a loan, so they're carved out of the microfinance gap and don't count toward its impact — isolating the business-as-usual connections and leaving the BAU baseline unchanged.
      </div>
      <div style={{ gridColumn: '1 / -1' }}><SubHead text="Loan terms" /></div>
      <F label={`Willingness to pay (${svc})`} value={iv.mf_pct_income} onChange={v => u(section, 'mf_pct_income', v)} isPercent unit="%" tip={`Maximum share of monthly household income a household will devote to its ${svc} connection-loan repayment. Income × this = how much loan it can service.`} />
      <F label="Loan interest rate (real)" value={iv.mf_interest_rate} onChange={v => u(section, 'mf_interest_rate', v)} isPercent unit="%" tip="Real annual interest rate on the connection loan." />
      <F label="Loan tenor" value={iv.mf_tenor} onChange={v => u(section, 'mf_tenor', v)} unit="yrs" tip="Loan repayment period, in years." />
      <F label="Take-up rate" value={iv.mf_takeup_rate} onChange={v => u(section, 'mf_takeup_rate', v)} isPercent unit="%" tip="Share of eligible (loan-needing) gap households who take up the loan." />
      <F label="Partial upfront payers" value={iv.mf_partial_share} onChange={v => u(section, 'mf_partial_share', v)} isPercent unit="%" tip="Share of gap households who can pay part of the upfront connection fee themselves, reducing their loan principal. The rest finance the whole connection cost." />
      <F label="Upfront fee they cover" value={iv.mf_upfront_payable_ratio} onChange={v => u(section, 'mf_upfront_payable_ratio', v)} isPercent unit="%" tip="For those partial payers, the fraction of the upfront fee they pay themselves; the remainder is financed by the loan." />
      <div style={{ gridColumn: '1 / -1' }}>
        <SubHead text={`Income distribution — ${brackets.length} brackets (shared by both sectors)`} />
        <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr', gap: '4px 8px', alignItems: 'center', fontSize: 11 }}>
          <span />
          <span style={{ color: '#64748b', fontWeight: 600 }}>Monthly income ({CUR})</span>
          <span style={{ color: '#64748b', fontWeight: 600 }}>% of households</span>
          {brackets.map((b: any, i: number) => (
            <React.Fragment key={i}>
              <span style={{ color: '#475569' }}>{bracketLabel(i, brackets.length)}</span>
              <input type="number" value={b.income_monthly ?? ''} onChange={e => uBracket(i, 'income_monthly', parseFloat(e.target.value) || 0)} style={miniInput} />
              <input type="number" value={Number.isFinite(b.hh_share) ? Math.round((b.hh_share) * 1e4) / 1e2 : ''} onChange={e => uBracket(i, 'hh_share', (parseFloat(e.target.value) || 0) / 100)} style={miniInput} />
            </React.Fragment>
          ))}
        </div>
        <div style={{ fontSize: 10, color: Math.abs(shareSum - 1) > 0.005 ? '#dc2626' : '#16a34a', marginTop: 4 }}>
          Household shares total {Math.round(shareSum * 1000) / 10}%{Math.abs(shareSum - 1) > 0.005 ? ' — should be 100%' : ' ✓'}
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <SubHead text="Service gap by income bracket (typically skewed to the poor)" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {gaps.map((g: number, i: number) => (
            <F key={i} label={bracketLabel(i, gaps.length)} value={g} onChange={v => uArr(section, 'mf_gap_shares', i, v)} isPercent unit="%" tip={`Share of the ${svc} safely-managed service gap that sits in this income bracket.`} />
          ))}
        </div>
        <div style={{ fontSize: 10, color: Math.abs(gapSum - 1) > 0.005 ? '#dc2626' : '#16a34a', marginTop: 4 }}>
          Gap shares total {Math.round(gapSum * 1000) / 10}%{Math.abs(gapSum - 1) > 0.005 ? ' — should be 100%' : ' ✓'}
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b' }}>
        Of the residual gap, households whose income can service the loan become safely-managed connections; those who can't are resized by the <b>means-based grant</b> below.
      </div>
      <div style={{ gridColumn: '1 / -1' }}><SubHead text="Means-based grant" /></div>
      <F label="Grant budget (one-time pool)" value={iv.grant_total} onChange={v => u(section, 'grant_total', v)} step={1000} unit={`${CUR} mn`} tip="Total means-based grant pool, in local-currency millions. It buys down loan principals for gap households who can't service a full loan; the cheapest buy-downs are funded first, so the pool maximises new connections. Leave 0 for no grant." />
      <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b' }}>
        For a household that can service only a smaller loan, the grant covers the shortfall (in present value) so its resized repayment matches what it can afford — turning it into a safely-managed connection.
      </div>
    </>);
  };

  // Which intervention layers are switched on for the active sector — drives the impact graph
  const t = inputs.toggles || {};
  const chartActive = sectorTab === 'water'
    ? {
        collectionNrw: !!(t.ws_collection_efficiency_enabled || t.ws_nrw_enabled),
        capital: !!t.ws_capital_efficiency_enabled,
        tariff: !!t.ws_tariff_enabled,
      }
    : {
        collectionNrw: !!t.san_collection_efficiency_enabled,
        capital: !!t.san_capital_efficiency_enabled,
        tariff: !!t.san_tariff_enabled,
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
            <F label="Volume sold (at start year)" value={inputs.water_interventions.ce_water_sold_mld} onChange={v => u('water_interventions','ce_water_sold_mld',v)} unit="MLD" tip="Volume of water sold/billed at the start year, in million litres per day. It grows each forecast year — with population by default, or at the growth rate below if you set one." />
            <F label="Volume growth rate" value={inputs.water_interventions.ce_vol_growth} onChange={v => u('water_interventions','ce_vol_growth',v)} isPercent unit="%" placeholder="population" tip="Annual real growth of the billed volume from the start year. Leave blank to scale with population; enter a rate to override (e.g. 3%)." />
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
            <F label="Physical losses % of NRW" value={inputs.water_interventions.nrw_physical_loss_pct || 0} onChange={v => u('water_interventions','nrw_physical_loss_pct',v)} isPercent unit="%" tip="Share of NRW from physical leaks in the network. Only this physical (leak) portion frees up deliverable water for basic→SM upgrades; the commercial portion counts only toward revenue. Commercial + physical must sum to 100%." />
            {(() => {
              const s = (inputs.water_interventions.nrw_commercial_loss_pct || 0) + (inputs.water_interventions.nrw_physical_loss_pct || 0);
              const bad = Math.abs(s - 1) > 0.005;
              return <div style={{ gridColumn: '1 / -1', fontSize: 10, fontWeight: 600, color: bad ? '#dc2626' : '#16a34a', padding: '3px 8px', background: bad ? '#fef2f2' : '#f0fdf4', borderRadius: 4, marginBottom: 4 }}>{bad ? `Commercial and physical losses add up to ${Math.round(s * 10000) / 100}% — they should total 100%.` : 'Commercial and physical losses add up to 100%. ✓'}</div>;
            })()}
            <F label="System input volume (at start year)" value={inputs.water_interventions.nrw_system_input_vol || 0} onChange={v => u('water_interventions','nrw_system_input_vol',v)} step={1} unit="MLD" tip="Total water produced / put into the system at the start year, in million litres per day. It grows each forecast year — with population by default, or at the growth rate below if you set one." />
            <F label="Volume growth rate" value={inputs.water_interventions.nrw_vol_growth} onChange={v => u('water_interventions','nrw_vol_growth',v)} isPercent unit="%" placeholder="population" tip="Annual real growth of the system input volume from the start year. Leave blank to scale with population; enter a rate to override (e.g. 3%)." />
            <F label="Water per basic→SM upgrade" value={inputs.water_interventions.nrw_water_per_upgrade || 0} onChange={v => u('water_interventions','nrw_water_per_upgrade',v)} step={5} unit="m³/HH/yr" tip="Extra water a basic household needs each year to become safely managed. Recovered physical water ÷ this = households upgraded." />
            <F label="Cost of fixing" value={inputs.water_interventions.nrw_capex_unit_cost_local || 0} onChange={v => u('water_interventions','nrw_capex_unit_cost_local',v)} step={1000} unit={`${CUR}/m³/day`} tip="Capital cost to recover one cubic metre per day of lost water — leak detection, pipe and meter replacement. Charged as the losses are cut." />
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <label style={{ fontSize: 12, color: '#3A4452', fontWeight: 500 }} title="How to value the recovered water: as tariff revenue from selling it, or as the production cost you no longer have to spend.">Value recovered water at</label>
              <select value={inputs.water_interventions.nrw_value_basis || 'tariff'} onChange={e => u('water_interventions','nrw_value_basis', e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 4, fontSize: 13, border: '1px solid #F0D070', background: '#FFF9E6', color: '#3A4452', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}>
                <option value="tariff">Water tariff — revenue from selling it</option>
                <option value="production">Cost of production — cost avoided</option>
              </select>
            </div>
            {(inputs.water_interventions.nrw_value_basis || 'tariff') === 'production'
              ? <F label="Production cost" value={inputs.water_interventions.nrw_production_cost || 0} onChange={v => u('water_interventions','nrw_production_cost',v)} step={0.5} unit={`${CUR}/m³`} tip="Recovering water avoids producing this much fresh water, per cubic metre." />
              : <F label="Water tariff" value={inputs.water_interventions.nrw_tariff || 0} onChange={v => u('water_interventions','nrw_tariff',v)} step={0.5} unit={`${CUR}/m³`} tip="The recovered water is sold at this price, per cubic metre." />}
          </InterventionToggle>

          <InterventionToggle label="Budget execution improvement" checked={inputs.toggles?.ws_capital_efficiency_enabled ?? false} onChange={v => toggleIntv('ws_capital_efficiency_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Current budget execution" value={wsCurEff} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Executed budget ÷ allocated budget: the share of the allocated capital budget that actually gets spent on new service (unit cost × new households). Computed from your historical budget rows in Data Inputs → Budget — not editable here." />
            <F label="Target budget execution" value={inputs.water_interventions.capeff_target_pct ?? 1} onChange={v => u('water_interventions','capeff_target_pct',v)} isPercent unit="%" tip="The budget execution rate to reach — at most 100% (spend the whole allocated budget). Raising it lets the same allocated budget build more service and shrinks the financing gap." />
            <F label="Start year" value={inputs.water_interventions.capeff_start_year} onChange={v => u('water_interventions','capeff_start_year',v)} tip="Year the budget-execution improvement begins" />
            <F label="Target year" value={inputs.water_interventions.capeff_target_year} onChange={v => u('water_interventions','capeff_target_year',v)} tip="Year the target execution rate is reached; it ramps linearly from the start year to here." />
            <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b' }}>
              Current is <b>{Math.round(wsCurEff * 100)}%</b> (auto-calculated from your budget data) — improving it toward the target spends more of the allocated budget on new service.
            </div>
          </InterventionToggle>

          <InterventionToggle label="Capex efficiency (unit cost)" checked={inputs.toggles?.ws_costeff_enabled ?? false} onChange={v => toggleIntv('ws_costeff_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.costeff_start_year} onChange={v => u('water_interventions','costeff_start_year',v)} tip="Year the capex-efficiency programme begins. At this year the connection cost still equals BAU; the discount then grows toward the target." />
            <F label="Target year" value={inputs.water_interventions.costeff_target_year} onChange={v => u('water_interventions','costeff_target_year',v)} tip="Year the target capex efficiency is reached; the discount ramps linearly from the start year to here, then holds." />
            <F label="Current capex efficiency" value={inputs.water_interventions.costeff_current_pct} onChange={v => u('water_interventions','costeff_current_pct',v)} isPercent unit="%" tip="Today's capex efficiency (the baseline). At the start year the connection cost is unchanged from BAU; only the improvement above this value discounts the cost." />
            <F label="Target capex efficiency" value={inputs.water_interventions.costeff_target_pct} onChange={v => u('water_interventions','costeff_target_pct',v)} isPercent unit="%" tip="Target capex efficiency. By the target year each new safely-managed connection costs (target − current)% less; held constant after. Cheaper connections let the same budget serve more households." />
            <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b' }}>
              Discounts the safely-managed connection cost, ramping up from 0 at the start year to <b>{Math.max(0, Math.round(((inputs.water_interventions.costeff_target_pct||0)-(inputs.water_interventions.costeff_current_pct||0))*1000)/10)}%</b> by the target year — so the same budget builds more connections and the financing gap shrinks.
            </div>
          </InterventionToggle>

          <InterventionToggle label="Optimised technology selection" checked={inputs.toggles?.ws_techmix_enabled ?? false} onChange={v => toggleIntv('ws_techmix_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <TechMixEditor inputs={inputs} onChange={onChange} section="water_interventions" CUR={CUR} />
          </InterventionToggle>

          <InterventionToggle label="Tariff reform" checked={inputs.toggles?.ws_tariff_enabled ?? false} onChange={v => toggleIntv('ws_tariff_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            <F label="Start year" value={inputs.water_interventions.tariff_start_year} onChange={v => u('water_interventions','tariff_start_year',v)} tip="Year the tariff starts rising" />
            <F label="Target year" value={inputs.water_interventions.tariff_target_year} onChange={v => u('water_interventions','tariff_target_year',v)} tip="Year the target tariff is reached; it rises linearly from the start year to here, then holds." />
            <F label="Volume sold (at start year)" value={inputs.water_interventions.tariff_volume_mld} onChange={v => u('water_interventions','tariff_volume_mld',v)} unit="MLD" tip="Volume of water sold/billed at the start year, in million litres per day. Grows with population over the forecast." />
            <F label="Current tariff" value={inputs.water_interventions.tariff_current} onChange={v => u('water_interventions','tariff_current',v)} step={0.5} unit={`${CUR}/m3`} tip="Current average water tariff per cubic metre" />
            <F label="Target tariff" value={inputs.water_interventions.tariff_target} onChange={v => u('water_interventions','tariff_target',v)} step={0.5} unit={`${CUR}/m3`} tip="Target average water tariff per cubic metre. The extra revenue (volume × tariff rise) is recycled into capex for new service." />
          </InterventionToggle>

          <InterventionToggle label="Microfinance" checked={inputs.toggles?.ws_microfinance_enabled ?? false} onChange={v => toggleIntv('ws_microfinance_enabled', v)} onFocus={() => onSectionFocus?.('ws_interventions')}>
            {microfinanceFields('water_interventions')}
          </InterventionToggle>

        </>}

        {/* ===== SANITATION INTERVENTIONS ===== */}
        {sectorTab === 'sanitation' && <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 10 }}>{scopeLabel} Sanitation Interventions</h3>

          <InterventionToggle label="Collection efficiency" checked={inputs.toggles?.san_collection_efficiency_enabled ?? false} onChange={v => toggleIntv('san_collection_efficiency_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.ce_start_year} onChange={v => u('sanitation_interventions','ce_start_year',v)} tip="Year the collection efficiency improvement begins" />
            <F label="Target year" value={inputs.sanitation_interventions.ce_target_year} onChange={v => u('sanitation_interventions','ce_target_year',v)} tip="Year the target is achieved" />
            <F label="Sewer tariff as % of water tariff" value={inputs.sanitation_interventions.ce_sewer_tariff_pct_water || 0} onChange={v => u('sanitation_interventions','ce_sewer_tariff_pct_water',v)} isPercent unit="%" tip="Sewer tariff expressed as a share of the water tariff. Collection ratios are inherited from water supply." />
          </InterventionToggle>

          <InterventionToggle label="Budget execution improvement" checked={inputs.toggles?.san_capital_efficiency_enabled ?? false} onChange={v => toggleIntv('san_capital_efficiency_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Current budget execution" value={sanCurEff} onChange={() => {}} fieldType="computed" isPercent unit="%" tip="Executed budget ÷ allocated budget: the share of the allocated capital budget that actually gets spent on new service. Computed from your historical budget rows in Data Inputs → Budget — not editable here." />
            <F label="Target budget execution" value={inputs.sanitation_interventions.capeff_target_pct ?? 1} onChange={v => u('sanitation_interventions','capeff_target_pct',v)} isPercent unit="%" tip="The budget execution rate to reach — at most 100% (spend the whole allocated budget). Raising it lets the same allocated budget build more service." />
            <F label="Start year" value={inputs.sanitation_interventions.capeff_start_year} onChange={v => u('sanitation_interventions','capeff_start_year',v)} tip="Year the budget-execution improvement begins" />
            <F label="Target year" value={inputs.sanitation_interventions.capeff_target_year} onChange={v => u('sanitation_interventions','capeff_target_year',v)} tip="Year the target execution rate is reached; it ramps linearly from the start year to here." />
            <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b' }}>
              Current is <b>{Math.round(sanCurEff * 100)}%</b> (auto-calculated from your budget data) — improving it toward the target spends more of the allocated budget on new service.
            </div>
          </InterventionToggle>

          <InterventionToggle label="Capex efficiency (unit cost)" checked={inputs.toggles?.san_costeff_enabled ?? false} onChange={v => toggleIntv('san_costeff_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.costeff_start_year} onChange={v => u('sanitation_interventions','costeff_start_year',v)} tip="Year the capex-efficiency programme begins. At this year the connection cost still equals BAU; the discount then grows toward the target." />
            <F label="Target year" value={inputs.sanitation_interventions.costeff_target_year} onChange={v => u('sanitation_interventions','costeff_target_year',v)} tip="Year the target capex efficiency is reached; the discount ramps linearly from the start year to here, then holds." />
            <F label="Current capex efficiency" value={inputs.sanitation_interventions.costeff_current_pct} onChange={v => u('sanitation_interventions','costeff_current_pct',v)} isPercent unit="%" tip="Today's capex efficiency (the baseline). At the start year the connection cost is unchanged from BAU; only the improvement above this value discounts the cost." />
            <F label="Target capex efficiency" value={inputs.sanitation_interventions.costeff_target_pct} onChange={v => u('sanitation_interventions','costeff_target_pct',v)} isPercent unit="%" tip="Target capex efficiency. By the target year each new safely-managed connection costs (target − current)% less; held constant after." />
            <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b' }}>
              Discounts the safely-managed connection cost, ramping up from 0 at the start year to <b>{Math.max(0, Math.round(((inputs.sanitation_interventions.costeff_target_pct||0)-(inputs.sanitation_interventions.costeff_current_pct||0))*1000)/10)}%</b> by the target year — so the same budget builds more connections and the financing gap shrinks.
            </div>
          </InterventionToggle>

          <InterventionToggle label="Optimised technology selection" checked={inputs.toggles?.san_techmix_enabled ?? false} onChange={v => toggleIntv('san_techmix_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <TechMixEditor inputs={inputs} onChange={onChange} section="sanitation_interventions" CUR={CUR} />
          </InterventionToggle>

          <InterventionToggle label="NRW-linked sanitation revenue" checked={inputs.toggles?.san_nrw_link_enabled ?? false} onChange={v => toggleIntv('san_nrw_link_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            {(() => {
              const vols: number[] = results?.water_supply?.scenario_nrw_recovered_phys_vol || [];
              const yrs: number[] = results?.years || [];
              const nrwOn = !!inputs.toggles?.ws_nrw_enabled;
              const endVol = vols.length ? +vols[vols.length - 1] : 0;
              const endYr = yrs.length ? yrs[yrs.length - 1] : 'the end year';
              const iv = inputs.sanitation_interventions || {};
              const ret = +iv.nrw_link_return_ratio || 0, charge = +iv.nrw_link_sewer_charge || 0, coll = +iv.nrw_link_collection_rate || 0;
              const endRev = endVol * ret * charge * coll;   // LC millions/yr at the end year
              return (<>
                <div style={{ gridColumn: '1 / -1', fontSize: 11, lineHeight: 1.5, borderRadius: 6, padding: '7px 10px',
                  background: nrwOn ? '#ecfeff' : '#fef3c7', border: `1px solid ${nrwOn ? '#a5f3fc' : '#fde68a'}`, color: nrwOn ? '#155e75' : '#92400e' }}>
                  {nrwOn
                    ? <>🔗 Linked to <b>Water Supply → NRW reduction</b>. That lever recovers <b>{endVol.toFixed(2)} M m³/yr</b> of physical water by {endYr}; the share returning to the sewer is charged for and the revenue funds new safely-managed sanitation connections.</>
                    : <>⚠ This lever needs <b>NRW reduction</b> switched on under the <b>Water Supply</b> interventions — that is what recovers the water. While it is off there is no recovered volume, so this lever has no effect.</>}
                </div>
                <F label="Wastewater return ratio" value={iv.nrw_link_return_ratio} onChange={v => u('sanitation_interventions','nrw_link_return_ratio',v)} isPercent unit="%" tip="Share of the recovered water that returns to the sewer as wastewater the utility can charge for (the rest is consumptive use or not sewer-connected)." />
                <F label="Sewer charge" value={iv.nrw_link_sewer_charge} onChange={v => u('sanitation_interventions','nrw_link_sewer_charge',v)} step={0.5} unit={`${CUR}/m³`} tip="Sanitation charge per cubic metre of returned wastewater — the revenue earned on it. (Separate from the water tariff the water utility earns.)" />
                <F label="Collection rate" value={iv.nrw_link_collection_rate} onChange={v => u('sanitation_interventions','nrw_link_collection_rate',v)} isPercent unit="%" tip="Share of that billed sanitation revenue actually collected." />
                <div style={{ gridColumn: '1 / -1', fontSize: 11, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '5px 9px' }}>
                  Collected sanitation revenue at {endYr}: <b>{endVol.toFixed(2)}</b> M m³ × {Math.round(ret * 100)}% × {charge.toLocaleString()} {CUR} × {Math.round(coll * 100)}% ≈ <b>{Math.round(endRev).toLocaleString()} {CUR} mn/yr</b>, spent on new safely-managed sanitation connections.
                </div>
              </>);
            })()}
          </InterventionToggle>

          <InterventionToggle label="Tariff reform" checked={inputs.toggles?.san_tariff_enabled ?? false} onChange={v => toggleIntv('san_tariff_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            <F label="Start year" value={inputs.sanitation_interventions.tariff_start_year} onChange={v => u('sanitation_interventions','tariff_start_year',v)} tip="Year the sewer tariff starts rising" />
            <F label="Target year" value={inputs.sanitation_interventions.tariff_target_year} onChange={v => u('sanitation_interventions','tariff_target_year',v)} tip="Year the target sewer tariff is reached; it rises linearly from the start year to here, then holds." />
            <F label="Volume billed (at start year)" value={inputs.sanitation_interventions.tariff_volume_mld} onChange={v => u('sanitation_interventions','tariff_volume_mld',v)} unit="MLD" tip="Volume of wastewater billed at the start year, in million litres per day. Grows with population over the forecast." />
            <F label="Current sewer tariff" value={inputs.sanitation_interventions.tariff_current} onChange={v => u('sanitation_interventions','tariff_current',v)} step={0.5} unit={`${CUR}/m3`} tip="Current average sewer tariff per cubic metre" />
            <F label="Target sewer tariff" value={inputs.sanitation_interventions.tariff_target} onChange={v => u('sanitation_interventions','tariff_target',v)} step={0.5} unit={`${CUR}/m3`} tip="Target average sewer tariff per cubic metre. The extra revenue (volume × tariff rise) is recycled into capex for new service." />
          </InterventionToggle>

          <InterventionToggle label="Microfinance" checked={inputs.toggles?.san_microfinance_enabled ?? false} onChange={v => toggleIntv('san_microfinance_enabled', v)} onFocus={() => onSectionFocus?.('san_interventions')}>
            {microfinanceFields('sanitation_interventions')}
          </InterventionToggle>
        </>}

        {/* ===== CUSTOM INTERVENTIONS (always visible, no dropdown) ===== */}
        <div style={{ marginTop: 16, border: '1px solid #ddd', borderRadius: 8, background: '#fff', padding: '12px 14px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', margin: '0 0 8px' }}>Custom Interventions</h3>
          <div onClick={() => onSectionFocus?.('custom_interventions')}>
            <div style={{ fontSize: 11, color: '#155e75', background: '#ecfeff', border: '1px solid #a5f3fc', padding: '6px 8px', borderRadius: 4, marginBottom: 8, lineHeight: 1.5 }}>
              Custom interventions now <b>affect the calculation</b> and appear on the impact graph. <b>New revenue source</b> — invest to produce an output whose net value funds new safely-managed connections. <b>Cost reduction</b> — lower the per-household connection cost. Pick each one's sector and tick its box to switch it on.
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
                    <input type="checkbox" checked={ci.enabled !== false} onChange={e => updateCI('enabled', e.target.checked)}
                      title="Switch this custom intervention on/off" style={{ width: 16, height: 16, accentColor: '#2563eb', cursor: 'pointer' }} />
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
                        <option value="new_revenue">New revenue source</option>
                        <option value="cost_reduction">Cost reduction</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 14px', alignItems: 'start' }}>
                    {ci.intervention_type === 'cost_reduction' ? (<>
                      <F label="Start year" value={ci.start_year} onChange={v => updateCI('start_year', v)} tip="Year the cost reduction takes effect; the lower cost is held from then on." />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, color: '#3A4452', fontWeight: 500 }}>Outputs affected</label>
                        <select value={ci.outputs_affected || 'sm'} onChange={e => updateCI('outputs_affected', e.target.value)} style={{ ...miniInput, cursor: 'pointer' }}>
                          <option value="sm">Safely-managed connections</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, color: '#3A4452', fontWeight: 500 }}>Cost effect type</label>
                        <select value={ci.cost_effect_mode || 'pct'} onChange={e => updateCI('cost_effect_mode', e.target.value)} style={{ ...miniInput, cursor: 'pointer' }}>
                          <option value="pct">Percentage off</option>
                          <option value="flat">Flat amount off</option>
                        </select>
                      </div>
                      {(ci.cost_effect_mode || 'pct') === 'pct'
                        ? <F label="Cost effect" value={ci.cost_effect} onChange={v => updateCI('cost_effect', v)} isPercent unit="%" tip="Percentage cut in the safely-managed connection cost per household, from the start year." />
                        : <F label="Cost effect" value={ci.cost_effect} onChange={v => updateCI('cost_effect', v)} step={1000} unit={CUR} tip="Flat amount taken off the safely-managed connection cost per household, from the start year." />}
                      <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b' }}>
                        Cuts the per-household safely-managed connection cost from {ci.start_year || 'the start year'} — the same budget then builds more connections and the financing gap shrinks.
                      </div>
                    </>) : (<>
                      <F label="Start time" value={ci.start_year} onChange={v => updateCI('start_year', v)} tip="Year the intervention begins — when the implementation cost starts." />
                      <F label="Cost to implement" value={ci.implement_cost} onChange={v => updateCI('implement_cost', v)} step={100000} unit={CUR} tip="Total cost to implement, in local currency. Spread evenly over the 'Years cost occurs' below, starting at the start time." />
                      <F label="Years cost occurs" value={ci.cost_years} onChange={v => updateCI('cost_years', v)} unit="yrs" tip="Number of years the implementation cost is spread over, from the start time." />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, color: '#3A4452', fontWeight: 500 }}>Unit of output</label>
                        <input type="text" value={ci.output_unit || ''} onChange={e => updateCI('output_unit', e.target.value)} placeholder="e.g. m³, kWh, tonnes" style={{ ...miniInput }} />
                      </div>
                      <F label="When output happens" value={ci.output_start_year} onChange={v => updateCI('output_start_year', v)} tip="Year output (and its revenue) starts, continuing through the forecast end." />
                      <F label={`Output quantity (per yr)`} value={ci.output_quantity} onChange={v => updateCI('output_quantity', v)} step={1000} unit={ci.output_unit || 'units'} tip="Output produced each year, in the unit above." />
                      <F label="Output value" value={ci.output_value} onChange={v => updateCI('output_value', v)} step={1} unit={`${CUR}/${ci.output_unit || 'unit'}`} tip="Value per unit of output. Quantity × value = annual revenue; the net (revenue − implementation cost) funds new safely-managed connections." />
                      <div style={{ gridColumn: '1 / -1', fontSize: 10, color: '#64748b' }}>
                        Net cash each year = output quantity × value (from {ci.output_start_year || 'the output year'}) − cost spread over {ci.cost_years || 0} yr{(ci.cost_years === 1) ? '' : 's'} → folded into {ci.sector === 'both' ? "each sector's" : ci.sector} capex for new connections.
                      </div>
                    </>)}
                  </div>
                </div>
              );
            })}
            <button onClick={() => {
              const existing = inputs.custom_interventions || [];
              const colors = ['#9333ea','#f97316','#06b6d4','#84cc16','#f43f5e'];
              onChange({ ...inputs, custom_interventions: [...existing, {
                name: 'New revenue source', enabled: true, sector: sectorTab, intervention_type: 'new_revenue',
                start_year: 2028, end_year: 2040,
                implement_cost: 0, cost_years: 3, output_unit: 'm³', output_start_year: 2028, output_quantity: 0, output_value: 0,
                outputs_affected: 'sm', cost_effect_mode: 'pct', cost_effect: 0.1,
                color: colors[existing.length % colors.length],
              }] });
            }} style={{ width: '100%', padding: '8px', border: '1px dashed #9333ea', borderRadius: 6, background: 'none', cursor: 'pointer', fontSize: 12, color: '#9333ea', fontWeight: 500 }}>
              + Add Custom Intervention
            </button>
          </div>
        </div>
      </div>

      {/* Right: LIVE intervention impact chart (two-pass BAU vs intervention) for the area being edited. */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px 28px', background: '#fff', borderLeft: '1px solid #e2e8f0' }}>
        <LiveInterventionChart inputs={inputs} sector={sectorTab} scopeLabel={scopeLabel} />
      </div>
    </div>
  );
}
