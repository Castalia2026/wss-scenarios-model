"""Export helpers: enriched scenario data (per-year series + per-intervention breakdown) and generic
XLSX builders for the frontend's per-table and per-chart export buttons.

All money is exported in the engine's native MILLIONS (full precision) with clear column labels; households
in millions. The per-intervention breakdown mirrors the Results dashboard: cumulative engine passes over the
enabled built-in toggles isolate each lever's marginal safely-managed households, mobilised resources, and
financing-gap reduction. Customs are excluded from the itemisation (they still sit in the scenario totals)."""

import io
import csv
import copy
import base64

from demo_adapter import coerce_to_engine
from model.engine import calculate

# key → (label, resource cash stream or None), in the same cumulative order the dashboard uses.
WATER_INTV = [
    ('ws_collection_efficiency_enabled', 'Increased collection efficiency', 'scenario_collection_cash'),
    ('ws_nrw_enabled', 'NRW reduction', 'scenario_nrw_net'),
    ('ws_capital_efficiency_enabled', 'Budget execution improvement', None),
    ('ws_costeff_enabled', 'Capex efficiency (unit cost)', None),
    ('ws_techmix_enabled', 'Optimised technology selection', None),
    ('ws_tariff_enabled', 'Tariff reform', 'scenario_tariff_cash'),
    ('ws_microfinance_enabled', 'Microfinance', 'scenario_mf_loan_volume'),
]
SAN_INTV = [
    ('san_collection_efficiency_enabled', 'Increased collection efficiency', 'scenario_collection_cash'),
    ('san_capital_efficiency_enabled', 'Budget execution improvement', None),
    ('san_costeff_enabled', 'Capex efficiency (unit cost)', None),
    ('san_techmix_enabled', 'Optimised technology selection', None),
    ('san_nrw_link_enabled', 'NRW-linked sanitation revenue', 'scenario_nrw_link_cash'),
    ('san_tariff_enabled', 'Tariff reform', 'scenario_tariff_cash'),
    ('san_microfinance_enabled', 'Microfinance', 'scenario_mf_loan_volume'),
]


def _cur(inputs):
    return (inputs.get('country_config') or {}).get('currency') or 'LCU'


def _baseline_year(inputs, years):
    return (inputs.get('period') or {}).get('baseline_year', years[0])


# ── enriched per-year series (BAU / target / with-interventions / gaps) ──────────────────────────────
def per_year_table(result, inputs, sector_key):
    """Return (headers, rows) for one sector: everything a reader needs incl. both financing gaps."""
    cur = _cur(inputs)
    years = result['years']
    sec = result[sector_key]
    total = result['total_hh']

    def g(name, i, rung0=True):
        v = sec.get(name)
        if v is None:
            return 0.0
        if rung0 and isinstance(v, list) and v and isinstance(v[0], list):
            v = v[0]
        return (v[i] if i < len(v) else 0.0) or 0.0

    headers = [
        'Year', 'Total HH (M)',
        'BAU safely-managed (M HH)', 'Target safely-managed (M HH)', 'With-interventions safely-managed (M HH)',
        'Service gap (M HH)',
        f'Investment need ({cur} M)', f'BAU investment ({cur} M)',
        f'Financing gap — BAU ({cur} M)', f'Financing gap — with interventions ({cur} M)',
    ]
    rows = []
    for i, y in enumerate(years):
        bau = g('bau_hh', i); scn = g('scenario_hh', i); tgt = g('target_hh', i)
        tot = (total[i] if i < len(total) else 0.0) or 0.0
        rows.append([
            y, round(tot, 6),
            round(min(tot, bau), 6), round(min(tot, tgt), 6), round(min(tot, scn), 6),
            round(g('household_gap', i, rung0=False), 6),
            round(g('total_investment_need', i, rung0=False), 4),
            round(g('bau_available', i, rung0=False), 4),
            round(g('financing_gap', i, rung0=False), 4),
            round(g('scenario_financing_gap', i, rung0=False), 4),
        ])
    return headers, rows


# ── per-intervention breakdown (cumulative passes) ──────────────────────────────────────────────────
def _run(inputs, toggles):
    f = copy.deepcopy(inputs)
    f['toggles'] = toggles
    f['custom_interventions'] = []
    return calculate(coerce_to_engine(f))


def intervention_breakdown(inputs, sector_key, defs):
    """[(label, added_hh_millions, resources_billions_or_None, gap_closed_billions), …] for enabled levers."""
    toggles = dict(inputs.get('toggles') or {})
    enabled = [d for d in defs if toggles.get(d[0])]
    if not enabled:
        return []
    off = {k: False for k in toggles}
    # cumulative passes: BAU, then +each enabled lever
    passes = [_run(inputs, dict(off))]
    acc = dict(off)
    for key, _, _ in enabled:
        acc[key] = True
        passes.append(_run(inputs, dict(acc)))
    years = passes[0]['years']
    by = _baseline_year(inputs, years)
    e = len(years) - 1

    def sm_end(res):
        return (res[sector_key]['scenario_hh'][0][e] or 0.0)

    def cash_cum(res, field):
        arr = res[sector_key].get(field) or []
        return sum((arr[i] or 0.0) for i, y in enumerate(years) if y > by)

    def gap_cum(res):
        arr = res[sector_key].get('scenario_financing_gap') or []
        return sum((arr[i] or 0.0) for i, y in enumerate(years) if y > by)

    out = []
    for idx, (key, label, rkey) in enumerate(enabled):
        before, after = passes[idx], passes[idx + 1]
        add_hh = max(0.0, sm_end(after) - sm_end(before))                 # millions
        res = (cash_cum(after, rkey) - cash_cum(before, rkey)) / 1000.0 if rkey else None  # M → B
        gap_closed = max(0.0, gap_cum(before) - gap_cum(after)) / 1000.0  # M → B
        out.append((label, round(add_hh, 5), (round(res, 4) if res is not None else None), round(gap_closed, 4)))
    return out


def breakdown_table(inputs, sector_key, defs):
    cur = _cur(inputs)
    headers = ['Intervention', 'Added safely-managed (M HH)', f'Resources generated ({cur} B)', f'Financing gap closed ({cur} B)']
    rows = []
    for label, add_hh, res, gap in intervention_breakdown(inputs, sector_key, defs):
        rows.append([label, add_hh, ('—' if res is None else res), gap])
    return headers, rows


# ── whole-scenario CSV / XLSX (everything: per-year series + intervention breakdown, both sectors) ───
def scenario_csv(inputs):
    result = calculate(coerce_to_engine(inputs))
    out = io.StringIO()
    w = csv.writer(out)
    for sk, name in [('water_supply', 'WATER SUPPLY'), ('sanitation', 'SANITATION')]:
        headers, rows = per_year_table(result, inputs, sk)
        w.writerow([name + ' — forecast (per year)'])
        w.writerow(headers)
        w.writerows(rows)
        w.writerow([])
        bh, br = breakdown_table(inputs, sk, WATER_INTV if sk == 'water_supply' else SAN_INTV)
        w.writerow([name + ' — contribution by intervention (cumulative to endline)'])
        w.writerow(bh)
        w.writerows(br if br else [['(no interventions enabled)']])
        w.writerow([]); w.writerow([])
    out.seek(0)
    return '﻿' + out.getvalue()   # BOM so Excel reads the UTF-8 (em-dashes, currency) correctly


def scenario_xlsx(inputs):
    from openpyxl import Workbook
    result = calculate(coerce_to_engine(inputs))
    wb = Workbook()
    wb.remove(wb.active)
    for sk, name in [('water_supply', 'Water'), ('sanitation', 'Sanitation')]:
        h, r = per_year_table(result, inputs, sk)
        _write_sheet(wb, f'{name} — forecast', h, r)
        bh, br = breakdown_table(inputs, sk, WATER_INTV if sk == 'water_supply' else SAN_INTV)
        _write_sheet(wb, f'{name} — interventions', bh, br if br else [['(no interventions enabled)']])
    return _save(wb)


# ── generic builders used by the per-table and per-chart export buttons ──────────────────────────────
def _safe_title(s):
    """Excel forbids : \\ / ? * [ ] in sheet names and caps them at 31 chars."""
    import re
    return (re.sub(r'[:\\/?*\[\]]', ' ', str(s or 'Sheet')).strip() or 'Sheet')[:31]


def _write_sheet(wb, title, headers, rows):
    from openpyxl.styles import Font, PatternFill, Alignment
    ws = wb.create_sheet(title=_safe_title(title))
    hdr_fill = PatternFill('solid', fgColor='0EA5E9')
    hdr_font = Font(bold=True, color='FFFFFF')
    ws.append([str(h) for h in headers])
    for c in ws[1]:
        c.fill = hdr_fill; c.font = hdr_font; c.alignment = Alignment(horizontal='center')
    for row in rows:
        ws.append(list(row))
    for i, h in enumerate(headers, 1):
        cell_lens = [len(str(row[i - 1])) for row in rows if i - 1 < len(row)]   # rows may be ragged
        width = max([len(str(h))] + cell_lens)
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = min(46, max(10, width + 2))
    ws.freeze_panes = 'A2'
    return ws


def _save(wb):
    out = io.BytesIO(); wb.save(out); out.seek(0)
    return out


def table_xlsx(sheets):
    """sheets = [{name, headers, rows}] → a workbook, one sheet each."""
    from openpyxl import Workbook
    wb = Workbook(); wb.remove(wb.active)
    for s in sheets:
        _write_sheet(wb, s.get('name', 'Sheet'), s.get('headers', []), s.get('rows', []))
    if not wb.sheetnames:
        wb.create_sheet('Sheet')
    return _save(wb)


def chart_xlsx(title, image_data_url, sheets):
    """A workbook whose first sheet embeds the chart PNG, followed by one sheet per data series table."""
    from openpyxl import Workbook
    from openpyxl.drawing.image import Image as XLImage
    wb = Workbook(); wb.remove(wb.active)
    chart_ws = wb.create_sheet(title=_safe_title(title or 'Chart'))
    if title:
        chart_ws['A1'] = title
        from openpyxl.styles import Font
        chart_ws['A1'].font = Font(bold=True, size=13)
    if image_data_url and ',' in image_data_url:
        raw = base64.b64decode(image_data_url.split(',', 1)[1])
        img = XLImage(io.BytesIO(raw))
        # scale to a sensible width (px), keeping aspect
        if img.width:
            scale = min(1.0, 900.0 / img.width)
            img.width = int(img.width * scale); img.height = int(img.height * scale)
        chart_ws.add_image(img, 'A3')
    for s in sheets:
        _write_sheet(wb, s.get('name', 'Data'), s.get('headers', []), s.get('rows', []))
    return _save(wb)
