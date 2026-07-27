import React, { useState } from 'react';
import { captureImage, downloadBlob, postForBlob } from './exportUtils';

// Small "⤓ PNG / ⤓ JPG / ⤓ Excel" control for any chart. PNG/JPG capture the referenced chart node via
// html-to-image; Excel posts the captured PNG plus the chart's data series to /api/export/chart, which
// returns a workbook with the chart image on the first sheet and one data sheet per series.
export default function ChartExport({ chartRef, filename, title, sheets, compact }: {
  chartRef: React.RefObject<any>;
  filename: string; title?: string;
  sheets: { name: string; headers: any[]; rows: any[][] }[];
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const btn: React.CSSProperties = {
    padding: compact ? '2px 7px' : '4px 10px', fontSize: 11, border: '1px solid #cbd5e1',
    borderRadius: 6, background: '#fff', color: '#475569', cursor: 'pointer', fontWeight: 500,
  };
  const img = async (fmt: 'png' | 'jpeg') => {
    if (!chartRef.current) return;
    setBusy(fmt);
    try {
      const url = await captureImage(chartRef.current, fmt);
      downloadBlob(await (await fetch(url)).blob(), `${filename}.${fmt === 'jpeg' ? 'jpg' : 'png'}`);
    } catch { alert('Image export failed. Please try again.'); }
    finally { setBusy(null); }
  };
  const xlsx = async () => {
    if (!chartRef.current) return;
    setBusy('xlsx');
    try {
      const image = await captureImage(chartRef.current, 'png');
      await postForBlob('/api/export/chart', { filename, title, image, sheets }, filename + '.xlsx');
    } catch { alert('Excel export failed. Please try again.'); }
    finally { setBusy(null); }
  };
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button style={btn} disabled={busy !== null} title="Download this chart as a PNG image" onClick={() => img('png')}>{busy === 'png' ? '…' : '⤓ PNG'}</button>
      <button style={btn} disabled={busy !== null} title="Download this chart as a JPG image" onClick={() => img('jpeg')}>{busy === 'jpeg' ? '…' : '⤓ JPG'}</button>
      <button style={btn} disabled={busy !== null} title="Download this chart as Excel (chart image + its data series)" onClick={xlsx}>{busy === 'xlsx' ? '…' : '⤓ Excel'}</button>
    </span>
  );
}
