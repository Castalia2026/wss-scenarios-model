"""
Calculation engine entry point.

Builds the shared time axis and macro context from `ModelInputs`, then runs the
per-sector calculations. Currently implements the Water Supply sheet
(sections 4a-4d). Sanitation is analogous and not yet ported to the new schema.

All formulas are traced back to the Excel WS sheet; see `water_supply.py` for the
row-by-row mapping and the OPEN QUESTIONS / assumptions list.
"""

import numpy as np
from .inputs import ModelInputs
from .water_supply import calculate_water_supply
from .sanitation import calculate_sanitation


def _series(arr, n, default=0.0):
    """Coerce a list to a length-n float array; pad short series by holding the last value."""
    a = np.array(arr, dtype=float) if arr else np.array([], dtype=float)
    if len(a) >= n:
        return a[:n].astype(float)
    out = np.full(n, default, dtype=float)
    if len(a):
        out[:len(a)] = a
        out[len(a):] = a[-1]   # hold last known value forward
    return out


def _series_with_ongoing(arr, n, ongoing):
    """Hard values (historical + any forecast years with real data) followed by a fixed 'ongoing'
    rate that fills EVERY remaining forecast year. Used for inflation (local & US): the user enters
    the years they know plus one long-run assumption for the tail."""
    a = np.array(arr, dtype=float) if arr else np.array([], dtype=float)
    if len(a) >= n:
        return a[:n].astype(float)
    out = np.full(n, float(ongoing), dtype=float)
    if len(a):
        out[:len(a)] = a
    return out


def _zero_pad(arr, n):
    """GDP-USD hard values, zero-padded. Zero marks 'no direct data' so those forecast years are
    projected at the fixed real growth rate instead of read as input."""
    a = np.array(arr, dtype=float) if arr else np.array([], dtype=float)
    out = np.zeros(n, dtype=float)
    k = min(len(a), n)
    if k:
        out[:k] = a[:k]
    return out


def _project_fx(arr, local_infl, us_infl, n):
    """Exchange-rate series. If shorter than n, project forward by the inflation differential:
    FX[t] = FX[t-1] × (1 + local_inflation[t]) / (1 + US_inflation[t])  — the sheet's FX formula."""
    a = np.array(arr, dtype=float) if arr else np.array([], dtype=float)
    if len(a) >= n:
        return a[:n].astype(float)
    out = np.zeros(n, dtype=float)
    if len(a) == 0:
        return out
    out[:len(a)] = a
    for t in range(len(a), n):
        out[t] = out[t - 1] * (1.0 + local_infl[t]) / (1.0 + us_infl[t])
    return out


def _project_hh(arr, n):
    """Time series (households I!92 or population I!89), millions. If supplied full-length, used
    as-is. If shorter, the tail is projected forward by compounding the MEAN of the historical
    year-on-year growth rates (Excel: forward = last_actual * (1 + G)^k, G = AVERAGE of historical
    YoY growth — G93 for households, G90 for population)."""
    a = np.array(arr, dtype=float) if arr else np.array([], dtype=float)
    if len(a) >= n:
        return a[:n].astype(float)
    out = np.zeros(n, dtype=float)
    if len(a) == 0:
        return out
    out[:len(a)] = a
    yoy = [(a[i] / a[i - 1] - 1.0) for i in range(1, len(a)) if a[i - 1] > 0]
    g = float(np.mean(yoy)) if yoy else 0.0
    for t in range(len(a), n):
        out[t] = out[t - 1] * (1.0 + g)
    return out


def build_context(inputs: ModelInputs) -> dict:
    p = inputs.period
    c = inputs.constants
    years = np.arange(p.model_start_year, p.forecast_end_year + 1)
    n = len(years)
    bi = int(p.baseline_year - p.model_start_year)             # baseline index
    end_asis_year = p.as_is_forecast_start + p.as_is_forecast_length - 1  # G20 (e.g. 2026+2-1=2027)
    perf_start_year = end_asis_year + 1                        # G21 (e.g. 2028)

    # J7 (forecast years) and J8 (performance-improvement years) flags
    forecast_flag = (years > p.baseline_year).astype(float)
    perf_flag = (years >= perf_start_year).astype(float)

    # Households per year, IN MILLIONS (the model carries HH and money both in millions, with
    # per-HH costs in actual currency, so: HH-millions × cost = money-millions — matching the Excel).
    # ACTUALS run only through baseline-1; the BASELINE YEAR ITSELF IS A PROJECTION in the sheet
    # (I!92 baseline = prior×(1+G93)), so households/population are projected from the actuals at mean
    # historical growth from the baseline year onward. Supplied baseline/forecast values are ignored.
    total_hh = _project_hh(inputs.population.hh_ts[:bi], n)
    # Population (I!89, millions) projected at mean historical pop growth (G90); household SIZE (I!95)
    # is DERIVED for display only = population / households (both millions -> people per HH). Not used in 4a-4d.
    population = _project_hh(inputs.population.pop_ts[:bi], n)
    with np.errstate(divide='ignore', invalid='ignore'):
        hh_size = np.where(total_hh > 0, population / total_hh, 0.0)

    # Inflation index (base = real_price_year -> 100), used to deflate nominal GDP to real terms.
    # Inflation = hard years (historical + forecast with data) then the fixed ONGOING rate for the tail.
    infl_local = _series_with_ongoing(inputs.macro.inflation_local, n, inputs.macro.inflation_local_ongoing)
    rpy = int(np.clip(p.real_price_year - p.model_start_year, 0, n - 1))
    idx = np.zeros(n)
    idx[rpy] = 100.0
    for t in range(rpy - 1, -1, -1):
        idx[t] = idx[t + 1] / (1.0 + infl_local[t + 1])
    for t in range(rpy + 1, n):
        idx[t] = idx[t - 1] * (1.0 + infl_local[t])

    # Nominal GDP in local currency (millions). GDP-USD = hard years (historical + forecast with data),
    # ZERO-padded; a 0 marks a forecast year with no data, projected at the fixed real growth rate.
    gdp_usd = _zero_pad(inputs.macro.gdp_nominal_usd, n)        # USD billion
    g_fcst = inputs.macro.gdp_growth_forecast   # fixed real growth for forecast (post-USD-data) years
    us_infl = _series_with_ongoing(inputs.macro.inflation_us, n, inputs.macro.inflation_us_ongoing)
    # FX: actuals through baseline-1; baseline year onward DERIVED from the inflation differential
    # (I!81 = prior×(1+local)/(1+US)). Supplied baseline/forecast FX is ignored so that editing
    # inflation flows into FX (and cancels in real GDP) exactly as the sheet does.
    fx = _project_fx(inputs.macro.exchange_rate[:bi], infl_local, us_infl, n)  # local per 1 USD
    gdp_nom = np.zeros(n)
    for t in range(n):
        if gdp_usd[t] > 0:
            gdp_nom[t] = gdp_usd[t] * c.thousand * fx[t]        # USD bn*1000 = USD mn; *fx = local mn
        elif t > 0:
            # past the USD/GDP data: real GDP grows at the fixed forecast rate (row 60), so the
            # nominal series compounds at (1+forecast growth)(1+inflation) — equivalently real[t]=real[t-1]*(1+g).
            gdp_nom[t] = gdp_nom[t - 1] * (1.0 + g_fcst) * (1.0 + infl_local[t])
    gdp_real = np.where(idx > 0, gdp_nom * 100.0 / idx, 0.0)    # real, base = real_price_year
    # Projected nominal GDP in USD billions (back out from local nominal ÷ FX) so the forecast years
    # of the "Nominal GDP ($B)" input row can show the engine's projection instead of a blank marker.
    with np.errstate(divide='ignore', invalid='ignore'):
        gdp_usd_proj = np.where((fx > 0), gdp_nom / (c.thousand * fx), 0.0)

    return {
        'years': years, 'n': n, 'bi': bi,
        'end_asis_year': int(end_asis_year), 'perf_start_year': int(perf_start_year),
        'forecast_flag': forecast_flag, 'perf_flag': perf_flag,
        'total_hh': total_hh, 'population': population, 'hh_size': hh_size,
        'gdp_nominal_local': gdp_nom, 'gdp_real_local': gdp_real,
        'gdp_nominal_usd': gdp_usd_proj, 'exchange_rate': fx,
        'inflation_local': infl_local, 'inflation_us': us_infl,
        'inflation_index': idx,
    }


def _ui_aliases(sec):
    """Add the output keys the demo frontend / exporters expect, aliased to the engine's names.
    Keeps the UI and CSV/XLSX/PPTX exports working without a frontend rebuild."""
    sec['bau_hh_serv'] = sec['bau_hh']                 # [rung][year]; [0] = Safely managed
    sec['target_hh_serv'] = sec['target_hh']
    sec['service_gap'] = sec['household_gap']          # target SM - BAU SM (per year, floored at 0)
    sec['investment_need'] = sec['total_investment_need']
    sec['bau_investment'] = sec['bau_available']
    # 'financing_gap' already matches; 'adjusted_financing_gap' (post-intervention) not yet modelled
    return sec


def calculate(inputs: ModelInputs) -> dict:
    ctx = build_context(inputs)
    return {
        'years': ctx['years'].tolist(),
        'end_asis_year': ctx['end_asis_year'],
        'total_hh': ctx['total_hh'].tolist(),
        'population': ctx['population'].tolist(),
        'hh_size': ctx['hh_size'].tolist(),
        # Projected macro series (historical + forecast) so the input table can show the engine's
        # computed forecast-year values instead of placeholder markers.
        'gdp_nominal_usd': ctx['gdp_nominal_usd'].tolist(),
        'gdp_nominal_local': ctx['gdp_nominal_local'].tolist(),
        'gdp_real_local': ctx['gdp_real_local'].tolist(),
        'exchange_rate': ctx['exchange_rate'].tolist(),
        'inflation_local': ctx['inflation_local'].tolist(),
        'inflation_us': ctx['inflation_us'].tolist(),
        'water_supply': _ui_aliases(calculate_water_supply(inputs, ctx)),
        'sanitation': _ui_aliases(calculate_sanitation(inputs, ctx)),
    }
