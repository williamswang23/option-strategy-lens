import { useMemo, useRef, useState, useEffect } from 'react'
import PlotModule from 'react-plotly.js'
import { Copy, Download, ExternalLink, Plus, Trash2 } from 'lucide-react'
import type { Data, PlotlyHTMLElement } from 'plotly.js'
import './App.css'
import {
  axisLabel,
  clippedZ,
  displayModeLabels,
  formatAxisValue,
  metricLabels,
  nearestIndex,
  surfaceLabel,
  type ZScaleResult,
  xAxisLabel,
} from './charts/chartData'
import { buildDifferenceGrid, buildSurfaceGrid } from './domain/grid'
import type { AppShareState } from './domain/shareState'
import { decodeShareState, encodeShareState } from './domain/shareState'
import { allStrategies } from './domain/strategies'
import { evaluateStrategy, summarizeStrategy } from './domain/strategy'
import {
  DEFAULT_VOL_MODEL,
  hasMultipleExpiries,
  maxDteDays,
  resolveLegIv,
} from './domain/volatility'
import type {
  AxisMode,
  ClippingMode,
  CompareView,
  DisplayMode,
  GreekMetric,
  MarketParams,
  OptionLeg,
  ResolutionMode,
  ScenarioKey,
  Side,
  StrategyDefaults,
  StrategyLeg,
  VolModel,
  XAxisMode,
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
  { value: 'spot-time', label: 'Time' },
  { value: 'spot-iv', label: 'IV' },
]

const xAxisOptions: { value: XAxisMode; label: string }[] = [
  { value: 'spot', label: 'Spot' },
  { value: 'log-moneyness', label: 'ln(K/F)' },
]

const displayOptions: DisplayMode[] = ['practical', 'raw', 'pnl-contribution']

const resolutionOptions: { value: ResolutionMode; label: string }[] = [
  { value: 'fast', label: 'Fast' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High' },
]

const resolutionSettings: Record<ResolutionMode, { spotPoints: number; yPoints: number }> = {
  fast: { spotPoints: 61, yPoints: 31 },
  standard: { spotPoints: 101, yPoints: 61 },
  high: { spotPoints: 151, yPoints: 91 },
}

const volModelOptions: { value: VolModel['kind']; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'linear-skew', label: 'Linear Skew' },
  { value: 'skew-smile', label: 'Skew + Smile' },
]

const scenarioOptions: { value: ScenarioKey; label: string }[] = [
  { value: 'a', label: 'Scenario A' },
  { value: 'b', label: 'Scenario B' },
]

const compareViewOptions: { value: CompareView; label: string }[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'diff', label: 'A - B' },
]

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

const defaultCompareStrategyId = 'long-straddle'
const defaultCompareStrategy =
  allStrategies.find((strategy) => strategy.id === defaultCompareStrategyId) ?? allStrategies[0]
const initialCompareBuilder = defaultCompareStrategy.defaults
const initialCompareLegs = defaultCompareStrategy.buildLegs({
  ...initialMarket,
  ...initialCompareBuilder,
})

const initialSharedState = getInitialShareState()

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
  const surfacePlotRef = useRef<PlotlyHTMLElement | null>(null)
  const [strategyId, setStrategyId] = useState(
    initialSharedState?.strategyId ?? defaultStrategyId,
  )
  const selectedStrategy = useMemo(
    () => allStrategies.find((strategy) => strategy.id === strategyId) ?? allStrategies[0],
    [strategyId],
  )
  const [market, setMarket] = useState<MarketParams>(
    initialSharedState?.market ?? initialMarket,
  )
  const [builder, setBuilder] = useState<StrategyDefaults>(
    initialSharedState?.builder ?? initialBuilder,
  )
  const [axisMode, setAxisMode] = useState<AxisMode>(
    initialSharedState?.axisMode ?? 'spot-time',
  )
  const [xAxisMode, setXAxisMode] = useState<XAxisMode>(
    initialSharedState?.xAxisMode ?? 'spot',
  )
  const [manualSliceY, setManualSliceY] = useState<number | null>(
    initialSharedState?.sliceValue ?? null,
  )
  const [metric, setMetric] = useState<GreekMetric>(
    initialSharedState?.metric ?? 'gamma',
  )
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    initialSharedState?.displayMode ?? 'practical',
  )
  const [clippingMode, setClippingMode] = useState<ClippingMode>(
    initialSharedState?.clippingMode ?? 'compressed',
  )
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>(
    initialSharedState?.resolution ?? 'standard',
  )
  const [volModel, setVolModel] = useState<VolModel>(
    initialSharedState?.volModel ?? DEFAULT_VOL_MODEL,
  )
  const [legs, setLegs] = useState<StrategyLeg[]>(
    initialSharedState?.legs ?? initialTemplateLegs,
  )
  const [compareEnabled, setCompareEnabled] = useState(
    initialSharedState?.compareState?.enabled ?? false,
  )
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>(
    initialSharedState?.compareState?.activeScenario ?? 'a',
  )
  const [compareView, setCompareView] = useState<CompareView>(
    initialSharedState?.compareState?.view ?? 'diff',
  )
  const [compareStrategyId, setCompareStrategyId] = useState(
    initialSharedState?.compareState?.scenarioB?.strategyId ?? defaultCompareStrategyId,
  )
  const selectedCompareStrategy = useMemo(
    () =>
      allStrategies.find((strategy) => strategy.id === compareStrategyId) ??
      defaultCompareStrategy,
    [compareStrategyId],
  )
  const [compareBuilder, setCompareBuilder] = useState<StrategyDefaults>(
    initialSharedState?.compareState?.scenarioB?.builder ?? initialCompareBuilder,
  )
  const [compareLegs, setCompareLegs] = useState<StrategyLeg[]>(
    initialSharedState?.compareState?.scenarioB?.legs ?? initialCompareLegs,
  )
  const [shareStatus, setShareStatus] = useState('')
  const resolution = resolutionSettings[resolutionMode]
  const calcInput = useMemo(
    () => ({
      axisMode,
      compareLegs,
      displayMode,
      legs,
      market,
      metric,
      resolutionMode,
      volModel,
      xAxisMode,
    }),
    [
      axisMode,
      compareLegs,
      displayMode,
      legs,
      market,
      metric,
      resolutionMode,
      volModel,
      xAxisMode,
    ],
  )
  const debouncedCalc = useDebouncedValue(calcInput, 160)
  const debouncedResolution = resolutionSettings[debouncedCalc.resolutionMode]
  const sharedTimeAxisKind =
    compareEnabled &&
    (hasMultipleExpiries(debouncedCalc.legs) ||
      hasMultipleExpiries(debouncedCalc.compareLegs))
      ? 'days-forward'
      : undefined
  const sharedTimeMaxDays = compareEnabled
    ? Math.max(
        maxDteDays(debouncedCalc.legs, debouncedCalc.market),
        maxDteDays(debouncedCalc.compareLegs, debouncedCalc.market),
      )
    : undefined

  const gridA = useMemo(
    () =>
      buildSurfaceGrid(debouncedCalc.legs, debouncedCalc.market, {
        axisMode: debouncedCalc.axisMode,
        xAxisMode: debouncedCalc.xAxisMode,
        metric: debouncedCalc.metric,
        displayMode: debouncedCalc.displayMode,
        volModel: debouncedCalc.volModel,
        timeAxisKind: sharedTimeAxisKind,
        timeMaxDays: sharedTimeMaxDays,
        spotPoints: debouncedResolution.spotPoints,
        yPoints: debouncedResolution.yPoints,
      }),
    [
      debouncedCalc,
      debouncedResolution.spotPoints,
      debouncedResolution.yPoints,
      sharedTimeAxisKind,
      sharedTimeMaxDays,
    ],
  )
  const gridB = useMemo(
    () =>
      buildSurfaceGrid(debouncedCalc.compareLegs, debouncedCalc.market, {
        axisMode: debouncedCalc.axisMode,
        xAxisMode: debouncedCalc.xAxisMode,
        metric: debouncedCalc.metric,
        displayMode: debouncedCalc.displayMode,
        volModel: debouncedCalc.volModel,
        timeAxisKind: sharedTimeAxisKind,
        timeMaxDays: sharedTimeMaxDays,
        spotPoints: debouncedResolution.spotPoints,
        yPoints: debouncedResolution.yPoints,
      }),
    [
      debouncedCalc,
      debouncedResolution.spotPoints,
      debouncedResolution.yPoints,
      sharedTimeAxisKind,
      sharedTimeMaxDays,
    ],
  )
  const diffGrid = useMemo(() => buildDifferenceGrid(gridA, gridB), [gridA, gridB])
  const activeGrid = compareEnabled && activeScenario === 'b' ? gridB : gridA
  const analysisGrid =
    compareEnabled && compareView === 'b'
      ? gridB
      : compareEnabled && compareView === 'diff'
        ? diffGrid
        : gridA

  const activeLegs =
    compareEnabled && activeScenario === 'b' ? compareLegs : legs
  const debouncedActiveLegs =
    compareEnabled && activeScenario === 'b'
      ? debouncedCalc.compareLegs
      : debouncedCalc.legs

  const grid = activeGrid

  const overviewItems = useMemo(
    () =>
      overviewMetrics.map((overviewMetric) => ({
        metric: overviewMetric,
        grid: buildSurfaceGrid(debouncedActiveLegs, debouncedCalc.market, {
          axisMode: debouncedCalc.axisMode,
          xAxisMode: debouncedCalc.xAxisMode,
          metric: overviewMetric,
          displayMode: 'practical',
          volModel: debouncedCalc.volModel,
          timeAxisKind: sharedTimeAxisKind,
          timeMaxDays: sharedTimeMaxDays,
          spotPoints: 45,
          yPoints: 31,
        }),
      })),
    [
      debouncedActiveLegs,
      debouncedCalc.axisMode,
      debouncedCalc.market,
      debouncedCalc.volModel,
      debouncedCalc.xAxisMode,
      sharedTimeAxisKind,
      sharedTimeMaxDays,
    ],
  )

  const clipped = useMemo(
    () => clippedZ(grid, clippingMode),
    [clippingMode, grid],
  )
  const clippedAnalysis = useMemo(
    () => clippedZ(analysisGrid, clippingMode),
    [analysisGrid, clippingMode],
  )
  const summary = useMemo(
    () => summarizeStrategy(debouncedActiveLegs, debouncedCalc.market, {
      volModel: debouncedCalc.volModel,
    }),
    [debouncedActiveLegs, debouncedCalc.market, debouncedCalc.volModel],
  )
  const currentEvaluation = useMemo(
    () =>
      evaluateStrategy(debouncedActiveLegs, debouncedCalc.market, {
        volModel: debouncedCalc.volModel,
      }),
    [debouncedActiveLegs, debouncedCalc.market, debouncedCalc.volModel],
  )
  const comparisonEvaluations = useMemo(
    () => {
      const left = evaluateStrategy(debouncedCalc.legs, debouncedCalc.market, {
        volModel: debouncedCalc.volModel,
      })
      const right = evaluateStrategy(debouncedCalc.compareLegs, debouncedCalc.market, {
        volModel: debouncedCalc.volModel,
      })
      return { left, right }
    },
    [
      debouncedCalc.compareLegs,
      debouncedCalc.legs,
      debouncedCalc.market,
      debouncedCalc.volModel,
    ],
  )
  const chartY = useMemo(
    () => (grid.axisMode === 'spot-iv' ? grid.y.map((value) => value * 100) : grid.y),
    [grid.axisMode, grid.y],
  )
  const analysisChartY = useMemo(
    () =>
      analysisGrid.axisMode === 'spot-iv'
        ? analysisGrid.y.map((value) => value * 100)
        : analysisGrid.y,
    [analysisGrid.axisMode, analysisGrid.y],
  )
  const sliceTarget = clampToGridRange(
    manualSliceY ?? analysisGrid.currentY,
    analysisGrid.y,
  )
  const sliceIndex = nearestIndex(analysisGrid.y, sliceTarget)
  const activeSliceY = analysisGrid.y[sliceIndex]
  const sliceLabel = formatAxisValue(analysisGrid, activeSliceY)
  const sliceSliderValue =
    analysisGrid.axisMode === 'spot-iv' ? activeSliceY * 100 : activeSliceY
  const sliceSliderMin =
    analysisGrid.axisMode === 'spot-iv'
      ? analysisGrid.y[0] * 100
      : analysisGrid.y[0]
  const sliceSliderMax =
    analysisGrid.axisMode === 'spot-iv'
      ? analysisGrid.y[analysisGrid.y.length - 1] * 100
      : analysisGrid.y[analysisGrid.y.length - 1]
  const sliceSliderStep = analysisGrid.axisMode === 'spot-iv' ? 1 : 0.25
  const zScaleTitle =
    clippingMode === 'compressed'
      ? `${metricLabels[metric]} (compressed)`
      : metricLabels[metric]
  const zScaleReadout = formatZScaleReadout(clippingMode, clipped)

  const surfaceData = useMemo(() => {
    const zeroPlane = grid.z.map((row) => row.map(() => 0))
    return [
      {
        type: 'surface',
        x: grid.x,
        y: chartY,
        z: clipped.z,
        customdata: grid.z,
        colorscale: financialColorscale,
        zmid: 0,
        colorbar: buildScaleColorbar(zScaleTitle, clipped),
        contours: {
          z: { show: true, usecolormap: true, highlightcolor: '#d6b45f' },
        },
        hovertemplate: `${xAxisLabel(grid.xAxisMode)} %{x:.3f}<br>${axisLabel(
          grid,
        )} %{y:.2f}<br>${metricLabels[metric]} %{customdata:.4f}<extra></extra>`,
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
  }, [chartY, clipped, grid, metric, zScaleTitle])

  const heatmapData = useMemo(
    () => [
      {
        type: 'heatmap',
        x: analysisGrid.x,
        y: analysisChartY,
        z: clippedAnalysis.z,
        customdata: analysisGrid.z,
        colorscale: financialColorscale,
        zmid: 0,
        colorbar: buildScaleColorbar(zScaleTitle, clippedAnalysis),
        hovertemplate: `${xAxisLabel(analysisGrid.xAxisMode)} %{x:.3f}<br>${axisLabel(
          analysisGrid,
        )} %{y:.2f}<br>${metricLabels[metric]} %{customdata:.4f}<extra></extra>`,
      },
      {
        type: 'contour',
        x: analysisGrid.x,
        y: analysisChartY,
        z: analysisGrid.rawZ,
        contours: { coloring: 'none', start: 0, end: 0, size: 1 },
        line: { color: '#d6b45f', width: 2 },
        showscale: false,
        hoverinfo: 'skip',
      },
    ] as Data[],
    [analysisChartY, analysisGrid, clippedAnalysis, metric, zScaleTitle],
  )

  const sliceData = useMemo(
    () => [
      {
        type: 'scatter',
        mode: 'lines',
        x: analysisGrid.x,
        y: analysisGrid.z[sliceIndex],
        line: { color: '#38bdf8', width: 3 },
        fill: 'tozeroy',
        fillcolor: 'rgba(56, 189, 248, 0.13)',
      },
      {
        type: 'scatter',
        mode: 'lines',
        x: [analysisGrid.x[0], analysisGrid.x[analysisGrid.x.length - 1]],
        y: [0, 0],
        line: { color: '#d6b45f', width: 1, dash: 'dot' },
        hoverinfo: 'skip',
      },
    ] as Data[],
    [analysisGrid.x, analysisGrid.z, sliceIndex],
  )

  useEffect(() => {
    if (!shareStatus) return undefined
    const timeout = window.setTimeout(() => setShareStatus(''), 2400)
    return () => window.clearTimeout(timeout)
  }, [shareStatus])

  function templateLegsFor(
    strategyIdValue: string,
    marketValue: MarketParams,
    builderValue: StrategyDefaults,
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
      if (strategyId === 'custom') {
        setLegs((currentLegs) =>
          currentLegs.map((leg) =>
            leg.kind === 'option' ? { ...leg, dteDays: nextMarket.dteDays } : leg,
          ),
        )
      } else {
        setLegs(templateLegsFor(strategyId, nextMarket, builder))
      }
      if (compareStrategyId === 'custom') {
        setCompareLegs((currentLegs) =>
          currentLegs.map((leg) =>
            leg.kind === 'option' ? { ...leg, dteDays: nextMarket.dteDays } : leg,
          ),
        )
      } else {
        setCompareLegs(templateLegsFor(compareStrategyId, nextMarket, compareBuilder))
      }
    }
    if (syncLegDefaults === 'iv') {
      if (strategyId === 'custom') {
        setLegs((currentLegs) =>
          currentLegs.map((leg) =>
            leg.kind === 'option' ? { ...leg, iv: nextMarket.iv } : leg,
          ),
        )
      } else {
        setLegs(templateLegsFor(strategyId, nextMarket, builder))
      }
      if (compareStrategyId === 'custom') {
        setCompareLegs((currentLegs) =>
          currentLegs.map((leg) =>
            leg.kind === 'option' ? { ...leg, iv: nextMarket.iv } : leg,
          ),
        )
      } else {
        setCompareLegs(templateLegsFor(compareStrategyId, nextMarket, compareBuilder))
      }
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

  function updateCompareBuilder(patch: Partial<StrategyDefaults>) {
    const nextBuilder = { ...compareBuilder, ...patch }
    setCompareBuilder(nextBuilder)
    if (compareStrategyId !== 'custom') {
      setCompareLegs(templateLegsFor(compareStrategyId, market, nextBuilder))
    }
  }

  function resetCompareLegsFromTemplate() {
    setCompareLegs(templateLegsFor(compareStrategyId, market, compareBuilder))
  }

  function buildShareState(): AppShareState {
    return {
      version: 1,
      strategyId,
      market,
      builder,
      legs,
      axisMode,
      xAxisMode,
      metric,
      displayMode,
      clippingMode,
      sliceValue: manualSliceY,
      resolution: resolutionMode,
      volModel,
      compareState: {
        enabled: compareEnabled,
        activeScenario,
        view: compareView,
        scenarioB: {
          strategyId: compareStrategyId,
          builder: compareBuilder,
          legs: compareLegs,
        },
      },
    }
  }

  async function copyShareLink() {
    const encoded = encodeShareState(buildShareState())
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('state', encoded)
    await navigator.clipboard.writeText(url.toString())
    setShareStatus('Share link copied')
  }

  async function exportCurrentPng() {
    if (!surfacePlotRef.current) return
    const plotly = await import('plotly.js/dist/plotly-gl3d')
    const toImage = (plotly as unknown as {
      toImage: (
        graphDiv: PlotlyHTMLElement,
        options: { format: 'png'; width: number; height: number },
      ) => Promise<string>
    }).toImage
    const imageUrl = await toImage(surfacePlotRef.current, {
      format: 'png',
      width: 1400,
      height: 900,
    })
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `greek-surface-${metric}.png`
    link.click()
    setShareStatus('PNG exported')
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
            <div className="brand-actions">
              <p className="copyright-mark">© 2026 williamswang</p>
              <a
                className="header-social-link"
                href="https://x.com/williamswjt"
                target="_blank"
                rel="noreferrer"
                aria-label="Follow williamswjt on X"
              >
                Follow @williamswjt on X
                <ExternalLink size={13} />
              </a>
            </div>
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
          <p className="control-label">Scenario A</p>
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
                setManualSliceY(null)
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
          <SegmentedControl
            options={[
              { value: 'off', label: 'Compare Off' },
              { value: 'on', label: 'Compare On' },
            ]}
            value={compareEnabled ? 'on' : 'off'}
            onChange={(value) => {
              setCompareEnabled(value === 'on')
              if (value === 'on') setCompareView('diff')
            }}
          />

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
              help={volModel.kind === 'flat' ? 'Default leg IV' : 'Surface anchor'}
              label={volModel.kind === 'flat' ? 'IV %' : 'ATM IV %'}
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
          <LegEditor
            ivModelDriven={volModel.kind !== 'flat'}
            legs={legs}
            market={market}
            setLegs={setLegs}
            volModel={volModel}
          />
          {strategyId !== 'custom' ? (
            <button type="button" className="reset-legs" onClick={resetLegsFromTemplate}>
              Reset legs from template
            </button>
          ) : null}

          {compareEnabled ? (
            <>
              <PanelTitle title="Compare Scenario B" />
              <label className="field">
                <span>Strategy</span>
                <select
                  value={compareStrategyId}
                  onChange={(event) => {
                    const nextStrategy =
                      allStrategies.find(
                        (strategy) => strategy.id === event.target.value,
                      ) ?? defaultCompareStrategy
                    setCompareStrategyId(nextStrategy.id)
                    setCompareBuilder(nextStrategy.defaults)
                    setManualSliceY(null)
                    setCompareLegs(
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
              <p className="strategy-note">{selectedCompareStrategy.description}</p>
              {compareStrategyId !== 'custom' ? (
                <div className="field-grid two">
                  <NumberField
                    label="Strike"
                    value={compareBuilder.strike}
                    min={1}
                    step={1}
                    onChange={(strike) => updateCompareBuilder({ strike })}
                  />
                  <NumberField
                    label="Wing Width"
                    value={compareBuilder.wingWidth}
                    min={1}
                    step={1}
                    onChange={(wingWidth) => updateCompareBuilder({ wingWidth })}
                  />
                  <NumberField
                    label="Quantity"
                    value={compareBuilder.quantity}
                    min={0.1}
                    step={1}
                    onChange={(quantity) => updateCompareBuilder({ quantity })}
                  />
                </div>
              ) : null}
              <LegEditor
                ivModelDriven={volModel.kind !== 'flat'}
                legs={compareLegs}
                market={market}
                setLegs={setCompareLegs}
                volModel={volModel}
              />
              {compareStrategyId !== 'custom' ? (
                <button
                  type="button"
                  className="reset-legs"
                  onClick={resetCompareLegsFromTemplate}
                >
                  Reset scenario B legs
                </button>
              ) : null}
            </>
          ) : null}

          <PanelTitle title="Vol Model" />
          <SegmentedControl
            options={volModelOptions}
            value={volModel.kind}
            onChange={(kind) => setVolModel((current) => ({ ...current, kind }))}
          />
          {volModel.kind === 'flat' ? (
            <p className="model-note">
              Flat uses each leg IV; the top IV field sets template and reset defaults.
            </p>
          ) : null}
          {volModel.kind !== 'flat' ? (
            <>
              <div className="field-grid two">
                <NumberField
                  label="Skew"
                  value={volModel.skew}
                  min={-5}
                  max={5}
                  step={0.05}
                  onChange={(skew) => setVolModel((current) => ({ ...current, skew }))}
                />
                {volModel.kind === 'skew-smile' ? (
                  <NumberField
                    label="Curvature"
                    value={volModel.curvature}
                    min={0}
                    max={10}
                    step={0.05}
                    onChange={(curvature) =>
                      setVolModel((current) => ({ ...current, curvature }))
                    }
                  />
                ) : null}
              </div>
              <p className="model-note">
                Teaching surface only: ATM IV anchors the curve, while each option
                leg receives a model IV from ln(K/F), skew, and smile curvature.
              </p>
            </>
          ) : null}

          <PanelTitle title="Visualization" />
          <p className="control-label">Y Axis</p>
          <SegmentedControl
            options={axisOptions}
            value={axisMode}
            onChange={(value) => {
              setAxisMode(value)
              setManualSliceY(null)
            }}
          />
          <p className="control-label">X Axis</p>
          <SegmentedControl
            options={xAxisOptions}
            value={xAxisMode}
            onChange={setXAxisMode}
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
              { value: 'compressed', label: 'Compressed' },
              { value: 'percentile', label: '2-98% Clip' },
              { value: 'raw', label: 'Raw Scale' },
            ]}
            value={clippingMode}
            onChange={setClippingMode}
          />
          <p className="control-label">Resolution</p>
          <SegmentedControl
            options={resolutionOptions}
            value={resolutionMode}
            onChange={setResolutionMode}
          />
          {compareEnabled ? (
            <>
              <p className="control-label">Main 3D Surface</p>
              <SegmentedControl
                options={scenarioOptions}
                value={activeScenario}
                onChange={setActiveScenario}
              />
              <p className="control-label">2D / Slice View</p>
              <SegmentedControl
                options={compareViewOptions}
                value={compareView}
                onChange={setCompareView}
              />
            </>
          ) : null}

          <PanelTitle title="Share / Export" />
          <div className="action-grid">
            <button type="button" className="action-button" onClick={copyShareLink}>
              <Copy size={16} />
              Copy Share Link
            </button>
            <button type="button" className="action-button" onClick={exportCurrentPng}>
              <Download size={16} />
              Export PNG
            </button>
          </div>
          {shareStatus ? <p className="status-note">{shareStatus}</p> : null}
        </aside>

        <section className="chart-panel" aria-label="Chart area">
          <div className="chart-header">
            <div>
              <h2>{metricLabels[metric]}</h2>
              <p>
                {surfaceLabel(grid)} ·{' '}
                {displayModeLabels[displayMode]} · {resolution.spotPoints} x{' '}
                {resolution.yPoints} · Slice {sliceLabel}
                {compareEnabled ? ` · 2D ${compareView.toUpperCase()}` : ''}
              </p>
            </div>
            <div className="scale-readout">
              Z scale {zScaleReadout}
            </div>
          </div>
          <div className="slice-control">
            <div className="slice-control-head">
              <span>Slice</span>
              <strong>{sliceLabel}</strong>
            </div>
            <input
              aria-label={`Slice ${axisLabel(analysisGrid)}`}
              max={sliceSliderMax}
              min={sliceSliderMin}
              step={sliceSliderStep}
              type="range"
              value={sliceSliderValue}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (!Number.isFinite(value)) return
                setManualSliceY(analysisGrid.axisMode === 'spot-iv' ? value / 100 : value)
              }}
            />
            <button
              type="button"
              disabled={manualSliceY === null}
              onClick={() => setManualSliceY(null)}
            >
              Reset to Current
            </button>
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
                    xaxis: { ...axisStyle, title: { text: xAxisLabel(grid.xAxisMode) } },
                    yaxis: { ...axisStyle, title: { text: axisLabel(grid) } },
                    zaxis: {
                      ...axisStyle,
                      title: { text: zScaleTitle },
                      ...buildCompressedAxisTicks(clipped),
                    },
                    camera: { eye: { x: 1.45, y: -1.45, z: 0.95 } },
                    bgcolor: 'rgba(7,12,20,0)',
                  },
                  showlegend: false,
                }}
                config={{ displayModeBar: false, responsive: true }}
                useResizeHandler
                className="plot"
                onInitialized={(_, graphDiv) => {
                  surfacePlotRef.current = graphDiv as unknown as PlotlyHTMLElement
                }}
                onUpdate={(_, graphDiv) => {
                  surfacePlotRef.current = graphDiv as unknown as PlotlyHTMLElement
                }}
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
                  xaxis: { ...axisStyle, title: { text: xAxisLabel(analysisGrid.xAxisMode) } },
                  yaxis: { ...axisStyle, title: { text: axisLabel(analysisGrid) } },
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
                  xaxis: { ...axisStyle, title: { text: xAxisLabel(analysisGrid.xAxisMode) } },
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
              <span>{surfaceLabel(grid)}</span>
            </div>
            <div className="overview-grid">
              {overviewItems.map((item) => (
                <GreekOverviewCard
                  key={item.metric}
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
          {compareEnabled ? (
            <>
              <PanelTitle title="Compare Greeks" />
              <div className="compare-table">
                <div className="compare-row head">
                  <span>Metric</span>
                  <span>A</span>
                  <span>B</span>
                  <span>A - B</span>
                </div>
                {(['delta', 'gamma', 'theta', 'vega'] as const).map((item) => (
                  <div className="compare-row" key={item}>
                    <span>{metricLabels[item]}</span>
                    <strong>
                      {formatGreekValue(item, comparisonEvaluations.left.practical[item])}
                    </strong>
                    <strong>
                      {formatGreekValue(item, comparisonEvaluations.right.practical[item])}
                    </strong>
                    <strong>
                      {formatGreekValue(
                        item,
                        comparisonEvaluations.left.practical[item] -
                          comparisonEvaluations.right.practical[item],
                      )}
                    </strong>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          <PanelTitle title="Legs" />
          <div className="legs-list">
            {activeLegs.map((leg, index) => (
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
        <a
          className="social-link"
          href="https://x.com/williamswjt"
          target="_blank"
          rel="noreferrer"
          aria-label="Follow williamswjt on X"
        >
          Follow @williamswjt on X
          <ExternalLink size={13} />
        </a>
        <span>Educational visualization only. Not investment advice.</span>
      </footer>
    </main>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  disabled?: boolean
  help?: string
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}

function NumberField({
  disabled = false,
  help,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: NumberFieldProps) {
  return (
    <label className="field">
      <span>
        {label}
        {help ? <em>{help}</em> : null}
      </span>
      <input
        type="number"
        disabled={disabled}
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
  ivModelDriven,
  legs,
  market,
  setLegs,
  volModel,
}: {
  ivModelDriven: boolean
  legs: StrategyLeg[]
  market: MarketParams
  setLegs: (legs: StrategyLeg[]) => void
  volModel: VolModel
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
            <OptionLegFields
              ivModelDriven={ivModelDriven}
              leg={leg}
              market={market}
              onChange={(updated) => updateLeg(index, updated)}
              volModel={volModel}
            />
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
  ivModelDriven,
  leg,
  market,
  onChange,
  volModel,
}: {
  ivModelDriven: boolean
  leg: OptionLeg
  market: MarketParams
  onChange: (leg: OptionLeg) => void
  volModel: VolModel
}) {
  const resolvedModelIv = ivModelDriven
    ? resolveLegIv({
        leg,
        market,
        spot: market.spot,
        dteDays: leg.dteDays,
        atmIv: market.iv,
        volModel,
      })
    : null

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
        disabled={ivModelDriven}
        help={ivModelDriven ? 'Model-driven' : undefined}
        label={ivModelDriven ? 'Manual IV %' : 'IV %'}
        value={leg.iv * 100}
        min={1}
        max={300}
        step={1}
        onChange={(ivPct) => onChange({ ...leg, iv: ivPct / 100 })}
      />
      {resolvedModelIv !== null ? (
        <div className="model-iv-readout">
          <span>Model IV</span>
          <strong>{formatPercent(resolvedModelIv)}</strong>
          <small>ATM IV + skew/smile at this leg strike</small>
        </div>
      ) : null}
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
  grid,
  isActive,
  metric,
  onSelect,
  readout,
}: {
  grid: ReturnType<typeof buildSurfaceGrid>
  isActive: boolean
  metric: GreekMetric
  onSelect: () => void
  readout: string
}) {
  const overviewY = grid.axisMode === 'spot-iv' ? grid.y.map((value) => value * 100) : grid.y
  const markerY = grid.axisMode === 'spot-iv' ? grid.currentY * 100 : grid.currentY
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
      hovertemplate: `${xAxisLabel(grid.xAxisMode)} %{x:.3f}<br>Y %{y:.2f}<br>Value %{z:.4f}<extra></extra>`,
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
      x: [grid.currentX],
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
            title: { text: xAxisLabel(grid.xAxisMode) },
            fixedrange: true,
            tickfont: { color: '#91a1b8', size: 9 },
          },
          yaxis: {
            ...axisStyle,
            title: { text: axisLabel(grid) },
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

function buildScaleColorbar(title: string, scale: ZScaleResult): Record<string, unknown> {
  return {
    title: { text: title },
    ...buildCompressedAxisTicks(scale),
  }
}

function buildCompressedAxisTicks(scale: ZScaleResult): Record<string, unknown> {
  if (!scale.tickvals || !scale.ticktext) return {}
  return {
    tickmode: 'array',
    tickvals: scale.tickvals,
    ticktext: scale.ticktext,
  }
}

function formatZScaleReadout(mode: ClippingMode, scale: ZScaleResult): string {
  if (mode === 'compressed') {
    return `Compressed · raw ${formatCompact(scale.rawMin)} to ${formatCompact(scale.rawMax)}`
  }
  if (mode === 'percentile') {
    return `2-98% clip ${formatCompact(scale.displayMin)} to ${formatCompact(scale.displayMax)}`
  }
  return `Raw ${formatCompact(scale.rawMin)} to ${formatCompact(scale.rawMax)}`
}

function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return 'n/a'
  if (Math.abs(value) >= 1000) return value.toExponential(2)
  if (Math.abs(value) >= 10) return value.toFixed(2)
  if (Math.abs(value) >= 1) return value.toFixed(3)
  return value.toFixed(5)
}

function clampToGridRange(value: number, range: number[]): number {
  const min = range[0]
  const max = range[range.length - 1]
  return Math.min(Math.max(value, min), max)
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

function formatGreekValue(metric: GreekMetric, value: number): string {
  if (metric === 'theta' || metric === 'vega' || metric === 'volga') {
    return formatMoney(value)
  }
  return formatCompact(value)
}

function getInitialShareState(): AppShareState | null {
  if (typeof window === 'undefined') return null
  const encoded = new URLSearchParams(window.location.search).get('state')
  if (!encoded) return null
  return decodeShareState(encoded)
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timeout)
  }, [delayMs, value])

  return debounced
}

export default App
