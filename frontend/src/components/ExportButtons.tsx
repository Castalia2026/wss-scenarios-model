import React, { useState } from 'react';

// Download the current scenario (`inputs`) as Excel / PowerPoint / CSV. All three endpoints run the
// live engine on the posted inputs, so the export always matches what's on screen.
const FORMATS = [
  { label: 'Excel', ext: 'xlsx', endpoint: '/api/export/xlsx', icon: '📗' },
  { label: 'PowerPoint', ext: 'pptx', endpoint: '/api/export/pptx', icon: '📊' },
  { label: 'CSV', ext: 'csv', endpoint: '/api/export/csv', icon: '📄' },
];

export default function ExportButtons({ inputs, label = 'Export' }: { inputs: any; label?: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const download = (fmt: typeof FORMATS[number]) => {
    setBusy(fmt.ext);
    fetch(fmt.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputs || {}) })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `wss_scenario.${fmt.ext}`; a.click(); URL.revokeObjectURL(u); })
      .catch(() => alert(`Export failed (${fmt.label}). Please try again.`))
      .finally(() => setBusy(null));
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {label && <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>{label}:</span>}
      {FORMATS.map(f => (
        <button key={f.ext} onClick={() => download(f)} disabled={busy !== null} title={`Download the current scenario as ${f.label}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11.5,
            border: '1px solid #cbd5e1', borderRadius: 6, background: busy === f.ext ? '#eef2ff' : '#fff',
            color: '#334155', cursor: busy ? 'wait' : 'pointer', fontWeight: 500 }}>
          <span>{f.icon}</span>{busy === f.ext ? 'Preparing…' : f.label}
        </button>
      ))}
    </div>
  );
}
