import { useMemo, useState } from 'react'
import PlotModule from 'react-plotly.js'
import { Plus, Trash2 } from 'lucide-react'
import type { Data } from 'plotly.js'
import './App.css'
import {
  axisLabel,
  clippedZ,
  displayModeLabels,
  formatAxisValue,
  metricLabels,
  nearestIndex,
} from './charts/chartData'
import { buildSurfaceGrid } from './domain/grid'
import { allStrategies } from './domain/strategies'
import { evaluateStrategy, summarizeStrategy } from './domain/strategy'
import type {
  AxisMode,
  ClippingMode,
  DisplayMode,
  GreekMetric,
  MarketParams,
  OptionLeg,
  Side,
  StrategyLeg,
} from './domain/types'

const Plot = (
  (PlotModule as unknown as { default?: typeof PlotModule }).default ?? PlotModule
) as typeof PlotModule

const metricOptions: GreekMetric[] = [
  'price',
  'pnl',
  'delta',
  'gamma',
  'theta',
  'vega',
  'vanna',
  'charm',
  'volga',
]

const overviewMetrics: GreekMetric[] = [
  'pnl',
  'delta',
  'gamma',
  'theta',
  'vega',
  'vanna',
  'charm',
  'volga',
]

const axisOptions: { value: AxisMode; label: string }[] = [
  { value: 'spot-time', label: 'Spot x Time' },
  { value: 'spot-iv', label: 'Spot x IV' },
]

const displayOptions: DisplayMode[] = ['practical', 'raw', 'pnl-contribution']

const initialMarket: MarketParams = {
  spot: 100,
  dteDays: 30,
  iv: 0.2,
  rate: 0.05,
  dividendYield: 0,
}

const defaultStrategyId = 'iron-condor'
const defaultStrategy =
  allStrategies.find((strategy) => strategy.id === defaultStrategyId) ?? allStrategies[0]
const initialBuilder = defaultStrategy.defaults

const initialCustomLegs: StrategyLeg[] = [
  {
    kind: 'option',
    type: 'call',
    side: 'long',
    quantity: 1,
    strike: 100,
    dteDays: 30,
    iv: 0.2,
    multiplier: 100,
  },
  {
    kind: 'option',
    type: 'put',
    side: 'long',
    quantity: 1,
    strike: 100,
    dteDays: 30,
    iv: 0.2,
    multiplier: 100,
  },
]

const initialTemplateLegs = defaultStrategy.buildLegs({
  ...initialMarket,
  ...initialBuilder,
})

const financialColorscale: [number, string][] = [
  [0, '#7f1d1d'],
  [0.28, '#b45309'],
  [0.48, '#334155'],
  [0.52, '#475569'],
  [0.72, '#0f766e'],
  [1, '#38bdf8'],
]

const plotFont = { color: '#cbd5e1', family: 'Inter, system-ui, sans-serif' }
const axisStyle = {
  gridcolor: '#263244',
  zerolinecolor: '#d6b45f',
  linecolor: '#3b485c',
  tickfont: { color: '#aeb8c8' },
  titlefont: { color: '#cbd5e1' },
}

function App() {
  const [strategyId, setStrategyId] = useState(defaultStrategyId)
  const selectedStrategy = useMemo(
    () => allStrategies.find((strategy) => strategy.id === strategyId) ?? allStrategies[0],
    [strategyId],
  )
  const [market, setMarket] = useState<MarketParams>(initialMarket)
  const [builder, setBuilder] = useState(initialBuilder)
  const [axisMode, setAxisMode] = useState<AxisMode>('spot-time')
  const [metric, setMetric] = useState<GreekMetric>('gamma')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('practical')
  const [clippingMode, setClippingMode] = useState<ClippingMode>('percentile')
  const [legs, setLegs] = useState<StrategyLeg[]>(initialTemplateLegs)

  const grid = useMemo(
    () =>
      buildSurfaceGrid(legs, market, {
        axisMode,
        metric,
        displayMode,
      }),
    [axisMode, displayMode, legs, market, metric],
  )

  const overviewItems = useMemo(
    () =>
      overviewMetrics.map((overviewMetric) => ({
        metric: overviewMetric,
        grid: buildSurfaceGrid(legs, market, {
          axisMode,
          metric: overviewMetric,
          displayMode: 'practical',
          spotPoints: 45,
          yPoints: 31,
        }),
      })),
    [axisMode, legs, market],
  )

  const clipped = useMemo(
    () => clippedZ(grid, clippingMode),
    [clippingMode, grid],
  )
  const summary = useMemo(() => summarizeStrategy(legs, market), [legs, market])
  const currentEvaluation = useMemo(
    () => evaluateStrategy(legs, market),
    [legs, market],
  )
  const chartY = useMemo(
    () => (axisMode === 'spot-iv' ? grid.y.map((value) => value * 100) : grid.y),
    [axisMode, grid.y],
  )
  const sliceTarget = axisMode === 'spot-iv' ? market.iv : 0
  const sliceIndex = nearestIndex(grid.y, sliceTarget)
  const sliceLabel = formatAxisValue(axisMode, grid.y[sliceIndex])

  const surfaceData = useMemo(() => {
    const zeroPlane = grid.z.map((row) => row.map(() => 0))
    return [
      {
        type: 'surface',
        x: grid.x,
        y: chartY,
        z: clipped.z,
        colorscale: financialColorscale,
        zmid: 0,
        colorbar: { title: { text: metricLabels[metric] } },
        contours: {
          z: { show: true, usecolormap: true, highlightcolor: '#d6b45f' },
        },
      },
      {
        type: 'surface',
        x: grid.x,
        y: chartY,
        z: zeroPlane,
        showscale: false,
        opacity: 0.22,
        colorscale: [
          [0, '#d6b45f'],
          [1, '#d6b45f'],
        ],
      },
    ] as Data[]
  }, [chartY, clipped.z, grid.x, grid.z, metric])

  const heatmapData = useMemo(
    () => [
      {
        type: 'heatmap',
        x: grid.x,
        y: chartY,
        z: clipped.z,
        colorscale: financialColorscale,
        zmid: 0,
        colorbar: { title: { text: metricLabels[metric] } },
      },
      {
        type: 'contour',
        x: grid.x,
        y: chartY,
        z: grid.rawZ,
        contours: { coloring: 'none', start: 0, end: 0, size: 1 },
        line: { color: '#d6b45f', width: 2 },
        showscale: false,
        hoverinfo: 'skip',
      },
    ] as Data[],
    [chartY, clipped.z, grid.rawZ, grid.x, metric],
  )

  const sliceData = useMemo(
    () => [
      {
        type: 'scatter',
        mode: 'lines',
        x: grid.x,
        y: grid.z[sliceIndex],
        line: { color: '#38bdf8', width: 3 },
        fill: 'tozeroy',
        fillcolor: 'rgba(56, 189, 248, 0.13)',
      },
      {
        type: 'scatter',
        mode: 'lines',
        x: [grid.x[0], grid.x[grid.x.length - 1]],
        y: [0, 0],
        line: { color: '#d6b45f', width: 1, dash: 'dot' },
        hoverinfo: 'skip',
      },
    ] as Data[],
    [grid.x, grid.z, sliceIndex],
  )

  function templateLegsFor(
    strategyIdValue: string,
    marketValue: MarketParams,
    builderValue: typeof builder,
  ): StrategyLeg[] {
    const strategy =
      allStrategies.find((item) => item.id === strategyIdValue) ?? allStrategies[0]
    if (strategy.id === 'custom') return initialCustomLegs
    return strategy.buildLegs({ ...marketValue, ...builderValue })
  }

  function updateMarket(
    patch: Partial<MarketParams>,
    syncLegDefaults: 'none' | 'dte' | 'iv' = 'none',
  ) {
    const nextMarket = { ...market, ...patch }
    setMarket(nextMarket)

    if (syncLegDefaults === 'dte') {
      setLegs((currentLegs) =>
        currentLegs.map((leg) =>
          leg.kind === 'option' ? { ...leg, dteDays: nextMarket.dteDays } : leg,
        ),
      )
    }
    if (syncLegDefaults === 'iv') {
      setLegs((currentLegs) =>
        currentLegs.map((leg) =>
          leg.kind === 'option' ? { ...leg, iv: nextMarket.iv } : leg,
        ),
      )
    }
  }

  function updateBuilder(patch: Partial<typeof builder>) {
    const nextBuilder = { ...builder, ...patch }
    setBuilder(nextBuilder)
    if (strategyId !== 'custom') {
      setLegs(templateLegsFor(strategyId, market, nextBuilder))
    }
  }

  function resetLegsFromTemplate() {
    setLegs(templateLegsFor(strategyId, market, builder))
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img
            className="brand-logo"
            src="/brand/wwr-logo.png"
            alt="Williams Wang Research"
          />
          <div>
            <p className="eyebrow">BSM Risk Surface Terminal</p>
            <h1>Option Strategy Greek Surface Trainer</h1>
            <p className="copyright-mark">© 2026 williamswang</p>
          </div>
        </div>
        <div className="topbar-metrics">
          <MetricPill label="Net Premium" value={formatMoney(summary.netPremium)} />
          <MetricPill label="Gamma" value={summary.gammaBias} />
          <MetricPill label="Vega" value={summary.vegaBias} />
        </div>
      </header>

      <section className="workspace">
        <aside className="control-panel" aria-label="Parameter controls">
          <PanelTitle title="Strategy Parameters" />
          <label className="field">
            <span>Strategy</span>
            <select
              value={strategyId}
              onChange={(event) => {
                const nextStrategy =
                  allStrategies.find((strategy) => strategy.id === event.target.value) ??
                  allStrategies[0]
                setStrategyId(nextStrategy.id)
                setBuilder(nextStrategy.defaults)
                setMetric(nextStrategy.recommendedGreeks[0] ?? 'gamma')
                setLegs(
                  nextStrategy.id === 'custom'
                    ? initialCustomLegs
                    : nextStrategy.buildLegs({ ...market, ...nextStrategy.defaults }),
                )
              }}
            >
              {allStrategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </label>
          <p className="strategy-note">{selectedStrategy.description}</p>

          <div className="field-grid two">
            <NumberField
              label="Spot S0"
              value={market.spot}
              min={1}
              step={1}
              onChange={(spot) => updateMarket({ spot })}
            />
            <NumberField
              label="DTE"
              value={market.dteDays}
              min={0.25}
              step={1}
              onChange={(dteDays) => updateMarket({ dteDays }, 'dte')}
            />
            <NumberField
              label="IV %"
              value={market.iv * 100}
              min={1}
              max={300}
              step={1}
              onChange={(ivPct) => updateMarket({ iv: ivPct / 100 }, 'iv')}
            />
            <NumberField
              label="Rate %"
              value={market.rate * 100}
              min={-10}
              max={30}
              step={0.25}
              onChange={(ratePct) => updateMarket({ rate: ratePct / 100 })}
            />
            <NumberField
              label="Div Yield %"
              value={market.dividendYield * 100}
              min={0}
              max={30}
              step={0.25}
              onChange={(yieldPct) => updateMarket({ dividendYield: yieldPct / 100 })}
            />
            <NumberField
              label="Multiplier"
              value={builder.multiplier}
              min={1}
              step={1}
              onChange={(multiplier) => {
                if (strategyId === 'custom') {
                  setBuilder((prev) => ({ ...prev, multiplier }))
                  setLegs((currentLegs) =>
                    currentLegs.map((leg) => ({ ...leg, multiplier })),
                  )
                  return
                }
                updateBuilder({ multiplier })
              }}
            />
          </div>

          {strategyId !== 'custom' ? (
            <div className="field-grid two">
              <NumberField
                label="Strike"
                value={builder.strike}
                min={1}
                step={1}
                onChange={(strike) => updateBuilder({ strike })}
              />
              <NumberField
                label="Wing Width"
                value={builder.wingWidth}
                min={1}
                step={1}
                onChange={(wingWidth) => updateBuilder({ wingWidth })}
              />
              <NumberField
                label="Quantity"
                value={builder.quantity}
                min={0.1}
                step={1}
                onChange={(quantity) => updateBuilder({ quantity })}
              />
            </div>
          ) : null}

          <PanelTitle title="Leg Editor" />
          <LegEditor legs={legs} setLegs={setLegs} />
          {strategyId !== 'custom' ? (
            <button type="button" className="reset-legs" onClick={resetLegsFromTemplate}>
              Reset legs from template
            </button>
          ) : null}

          <PanelTitle title="Visualization" />
          <SegmentedControl
            options={axisOptions}
            value={axisMode}
            onChange={setAxisMode}
          />
          <label className="field">
            <span>Metric</span>
            <select value={metric} onChange={(event) => setMetric(event.target.value as GreekMetric)}>
              {metricOptions.map((option) => (
                <option key={option} value={option}>
                  {metricLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <SegmentedControl
            options={displayOptions.map((value) => ({
              value,
              label: displayModeLabels[value],
            }))}
            value={displayMode}
            onChange={setDisplayMode}
          />
          <SegmentedControl
            options={[
              { value: 'percentile', label: '2-98% Clip' },
              { value: 'raw', label: 'Raw Scale' },
            ]}
            value={clippingMode}
            onChange={setClippingMode}
          />
        </aside>

        <section className="chart-panel" aria-label="Chart area">
          <div className="chart-header">
            <div>
              <h2>{metricLabels[metric]}</h2>
              <p>
                {axisOptions.find((option) => option.value === axisMode)?.label} ·{' '}
                {displayModeLabels[displayMode]} · Slice {sliceLabel}
              </p>
            </div>
            <div className="scale-readout">
              Z scale {formatCompact(clipped.min)} to {formatCompact(clipped.max)}
            </div>
          </div>
          <div className="chart-grid">
            <div className="plot-frame large">
              <Plot
                data={surfaceData}
                layout={{
                  autosize: true,
                  margin: { l: 0, r: 0, t: 8, b: 0 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  font: plotFont,
                  scene: {
                    xaxis: { ...axisStyle, title: { text: 'Spot' } },
                    yaxis: { ...axisStyle, title: { text: axisLabel(axisMode) } },
                    zaxis: { ...axisStyle, title: { text: metricLabels[metric] } },
                    camera: { eye: { x: 1.45, y: -1.45, z: 0.95 } },
                    bgcolor: 'rgba(7,12,20,0)',
                  },
                  showlegend: false,
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                className="plot"
              />
            </div>
            <div className="plot-frame">
              <Plot
                data={heatmapData}
                layout={{
                  autosize: true,
                  margin: { l: 52, r: 12, t: 8, b: 42 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  font: plotFont,
                  xaxis: { ...axisStyle, title: { text: 'Spot' } },
                  yaxis: { ...axisStyle, title: { text: axisLabel(axisMode) } },
                  showlegend: false,
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                className="plot"
              />
            </div>
            <div className="plot-frame">
              <Plot
                data={sliceData}
                layout={{
                  autosize: true,
                  margin: { l: 58, r: 16, t: 8, b: 42 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  font: plotFont,
                  xaxis: { ...axisStyle, title: { text: 'Spot' } },
                  yaxis: { ...axisStyle, title: { text: metricLabels[metric] } },
                  showlegend: false,
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                className="plot"
              />
            </div>
          </div>
          <section className="overview-section" aria-label="Greek overview board">
            <div className="overview-heading">
              <div>
                <h2>Greek Overview</h2>
                <p>Small-multiple 2D risk maps with zero contours and current-state markers.</p>
              </div>
              <span>{axisOptions.find((option) => option.value === axisMode)?.label}</span>
            </div>
            <div className="overview-grid">
              {overviewItems.map((item) => (
                <GreekOverviewCard
                  key={item.metric}
                  axisMode={axisMode}
                  currentIv={market.iv}
                  currentSpot={market.spot}
                  grid={item.grid}
                  isActive={item.metric === metric}
                  metric={item.metric}
                  readout={formatMetricReadout(item.metric, currentEvaluation)}
                  onSelect={() => setMetric(item.metric)}
                />
              ))}
            </div>
          </section>
        </section>

        <aside className="summary-panel" aria-label="Strategy summary">
          <PanelTitle title="Strategy Summary" />
          <div className="summary-list">
            <SummaryRow label="Net Premium" value={formatMoney(summary.netPremium)} />
            <SummaryRow label="Max Profit" value={formatBound(summary.maxProfit)} />
            <SummaryRow label="Max Loss" value={formatBound(summary.maxLoss)} />
            <SummaryRow
              label="Breakeven"
              value={summary.breakevens.length > 0 ? summary.breakevens.join(', ') : 'None'}
            />
            <SummaryRow label="Sensitive Spot" value={summary.sensitiveSpot.toFixed(2)} />
          </div>
          <PanelTitle title="Current Greeks" />
          <div className="summary-list">
            <SummaryRow label="Delta" value={formatCompact(currentEvaluation.practical.delta)} />
            <SummaryRow label="Gamma" value={formatCompact(currentEvaluation.practical.gamma)} />
            <SummaryRow label="Theta / day" value={formatMoney(currentEvaluation.practical.theta)} />
            <SummaryRow label="Vega / 1 vol" value={formatMoney(currentEvaluation.practical.vega)} />
            <SummaryRow label="Vanna / 1 vol" value={formatCompact(currentEvaluation.practical.vanna)} />
            <SummaryRow label="Charm / day" value={formatCompact(currentEvaluation.practical.charm)} />
            <SummaryRow label="Volga / 1 vol" value={formatMoney(currentEvaluation.practical.volga)} />
          </div>
          <PanelTitle title="Legs" />
          <div className="legs-list">
            {legs.map((leg, index) => (
              <div className="leg-line" key={`${leg.kind}-${index}`}>
                <strong>{leg.side}</strong>
                {leg.kind === 'option' ? (
                  <span>
                    {leg.quantity} {leg.type.toUpperCase()} K {leg.strike}
                  </span>
                ) : (
                  <span>{leg.quantity} Underlying</span>
                )}
              </div>
            ))}
          </div>
        </aside>
      </section>
      <footer className="copyright">
        <span>© 2026 williamswang.</span>
        <span>Educational visualization only. Not investment advice.</span>
      </footer>
    </main>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}

function NumberField({ label, value, min, max, step = 1, onChange }: NumberFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const parsed = Number(event.target.value)
          if (!Number.isFinite(parsed)) return
          const lower = min ?? -Infinity
          const upper = max ?? Infinity
          onChange(Math.min(Math.max(parsed, lower), upper))
        }}
      />
    </label>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? 'active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function LegEditor({
  legs,
  setLegs,
}: {
  legs: StrategyLeg[]
  setLegs: (legs: StrategyLeg[]) => void
}) {
  function updateLeg(index: number, leg: StrategyLeg) {
    setLegs(legs.map((item, itemIndex) => (itemIndex === index ? leg : item)))
  }

  return (
    <div className="custom-editor">
      {legs.map((leg, index) => (
        <div className="custom-row" key={`${leg.kind}-${index}`}>
          <div className="custom-row-top">
            <select
              value={leg.kind}
              onChange={(event) => {
                if (event.target.value === 'underlying') {
                  updateLeg(index, {
                    kind: 'underlying',
                    side: leg.side,
                    quantity: leg.quantity,
                    multiplier: leg.multiplier,
                  })
                  return
                }
                updateLeg(index, {
                  kind: 'option',
                  type: 'call',
                  side: leg.side,
                  quantity: leg.quantity,
                  strike: 100,
                  dteDays: 30,
                  iv: 0.2,
                  multiplier: leg.multiplier,
                })
              }}
            >
              <option value="option">Option</option>
              <option value="underlying">Underlying</option>
            </select>
            <select
              value={leg.side}
              onChange={(event) =>
                updateLeg(index, { ...leg, side: event.target.value as Side })
              }
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
            <button
              type="button"
              className="icon-button danger"
              title="Remove leg"
              aria-label="Remove leg"
              onClick={() => setLegs(legs.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 size={16} />
            </button>
          </div>
          {leg.kind === 'option' ? (
            <OptionLegFields leg={leg} onChange={(updated) => updateLeg(index, updated)} />
          ) : (
            <div className="field-grid two">
              <NumberField
                label="Qty"
                value={leg.quantity}
                min={0.1}
                step={1}
                onChange={(quantity) => updateLeg(index, { ...leg, quantity })}
              />
              <NumberField
                label="Multiplier"
                value={leg.multiplier}
                min={1}
                step={1}
                onChange={(multiplier) => updateLeg(index, { ...leg, multiplier })}
              />
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        className="add-leg"
        onClick={() =>
          setLegs([
            ...legs,
            {
              kind: 'option',
              type: 'call',
              side: 'long',
              quantity: 1,
              strike: 100,
              dteDays: 30,
              iv: 0.2,
              multiplier: 100,
            },
          ])
        }
      >
        <Plus size={16} />
        Add leg
      </button>
    </div>
  )
}

function OptionLegFields({
  leg,
  onChange,
}: {
  leg: OptionLeg
  onChange: (leg: OptionLeg) => void
}) {
  return (
    <div className="field-grid two">
      <label className="field">
        <span>Type</span>
        <select value={leg.type} onChange={(event) => onChange({ ...leg, type: event.target.value as OptionLeg['type'] })}>
          <option value="call">Call</option>
          <option value="put">Put</option>
        </select>
      </label>
      <NumberField
        label="Strike"
        value={leg.strike}
        min={1}
        step={1}
        onChange={(strike) => onChange({ ...leg, strike })}
      />
      <NumberField
        label="Qty"
        value={leg.quantity}
        min={0.1}
        step={1}
        onChange={(quantity) => onChange({ ...leg, quantity })}
      />
      <NumberField
        label="DTE"
        value={leg.dteDays}
        min={0.25}
        step={1}
        onChange={(dteDays) => onChange({ ...leg, dteDays })}
      />
      <NumberField
        label="IV %"
        value={leg.iv * 100}
        min={1}
        max={300}
        step={1}
        onChange={(ivPct) => onChange({ ...leg, iv: ivPct / 100 })}
      />
      <NumberField
        label="Multiplier"
        value={leg.multiplier}
        min={1}
        step={1}
        onChange={(multiplier) => onChange({ ...leg, multiplier })}
      />
    </div>
  )
}

function GreekOverviewCard({
  axisMode,
  currentIv,
  currentSpot,
  grid,
  isActive,
  metric,
  onSelect,
  readout,
}: {
  axisMode: AxisMode
  currentIv: number
  currentSpot: number
  grid: ReturnType<typeof buildSurfaceGrid>
  isActive: boolean
  metric: GreekMetric
  onSelect: () => void
  readout: string
}) {
  const overviewY = axisMode === 'spot-iv' ? grid.y.map((value) => value * 100) : grid.y
  const markerY = axisMode === 'spot-iv' ? currentIv * 100 : 0
  const overviewClipped = clippedZ(grid, 'percentile')
  const data = [
    {
      type: 'heatmap',
      x: grid.x,
      y: overviewY,
      z: overviewClipped.z,
      colorscale: financialColorscale,
      zmid: 0,
      showscale: false,
      hovertemplate: 'Spot %{x:.2f}<br>Y %{y:.2f}<br>Value %{z:.4f}<extra></extra>',
    },
    {
      type: 'contour',
      x: grid.x,
      y: overviewY,
      z: grid.rawZ,
      contours: { coloring: 'none', start: 0, end: 0, size: 1 },
      line: { color: '#d6b45f', width: 1.4 },
      showscale: false,
      hoverinfo: 'skip',
    },
    {
      type: 'scatter',
      mode: 'markers',
      x: [currentSpot],
      y: [markerY],
      marker: {
        color: '#f8fafc',
        line: { color: '#38bdf8', width: 1.5 },
        size: 7,
        symbol: 'circle',
      },
      hoverinfo: 'skip',
      showlegend: false,
    },
  ] as Data[]

  return (
    <button
      type="button"
      className={`overview-card ${isActive ? 'active' : ''}`}
      onClick={onSelect}
    >
      <span className="overview-card-head">
        <strong>{metricLabels[metric]}</strong>
        <span>{readout}</span>
      </span>
      <Plot
        data={data}
        layout={{
          autosize: true,
          margin: { l: 32, r: 8, t: 4, b: 28 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          font: { ...plotFont, size: 9 },
          xaxis: {
            ...axisStyle,
            title: { text: 'Spot' },
            fixedrange: true,
            tickfont: { color: '#91a1b8', size: 9 },
          },
          yaxis: {
            ...axisStyle,
            title: { text: axisMode === 'spot-iv' ? 'IV' : 'Elapsed' },
            fixedrange: true,
            tickfont: { color: '#91a1b8', size: 9 },
          },
          showlegend: false,
        }}
        config={{ displayModeBar: false, responsive: true, staticPlot: true }}
        useResizeHandler
        className="overview-plot"
      />
    </button>
  )
}

function PanelTitle({ title }: { title: string }) {
  return <h2 className="panel-title">{title}</h2>
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return 'n/a'
  if (Math.abs(value) >= 1000) return value.toExponential(2)
  if (Math.abs(value) >= 10) return value.toFixed(2)
  if (Math.abs(value) >= 1) return value.toFixed(3)
  return value.toFixed(5)
}

function formatBound(value: number | 'Unlimited'): string {
  if (value === 'Unlimited') return value
  return formatMoney(value)
}

function formatMetricReadout(
  metric: GreekMetric,
  evaluation: ReturnType<typeof evaluateStrategy>,
): string {
  if (metric === 'pnl') return formatMoney(0)
  if (metric === 'price' || metric === 'theta' || metric === 'vega' || metric === 'volga') {
    return formatMoney(evaluation.practical[metric])
  }
  return formatCompact(evaluation.practical[metric])
}

export default App
