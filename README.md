# Option Strategy Greek Surface Trainer

一个纯前端的期权策略 Greek 直觉训练器。它使用 European BSM / Black-Scholes 假设，在连续股息率和常数利率下，展示多腿期权策略的价格、P&L 与 Greeks 曲面。波动率支持 flat IV、教学级 linear skew、以及 skew + smile；非 flat 模式使用 ATM IV 作为曲面锚点，并按每条腿的 strike / forward 重新生成 leg IV。

## What It Does

- 按 option / underlying legs 定义策略，并对价格与 Greeks 线性加总。
- 支持 `Time` 与 `IV` 两种曲面视角，时间轴使用 `DTE Remaining`。
- 横轴支持 `Spot` 与 `ln(K/F)` 两种显示模式。
- 同步展示 3D surface、2D heatmap / zero contour、当前横截面 slice。
- 支持手动选择 slice 的 DTE、days forward 或 ATM IV 水平，并可重置回当前市场状态。
- 在 skew / smile 模式下显示每条 option leg 的 model-driven IV。
- 使用 practical Greek convention：
  - `Theta`: 每天价值变化
  - `Vega`: 每 1 vol point IV 变化的价值变化
  - `Charm`: 每天 delta 变化
  - `Vanna`: 每 1 vol point IV 变化导致的 delta 变化
  - `Volga`: 每 1 vol point IV 变化导致的 vega 变化

## Local Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run test
npm run build
```

## Deployment Direction

This app is designed as a static Vite build. The intended deployment path is:

1. Push the repo to GitHub.
2. Connect it to Cloudflare Pages via Git integration.
3. Use `npm run build` and publish the `dist` directory.

The app does not use real-time market data, marketdata.app, FRED, backend APIs, American exercise, or market-calibrated volatility surfaces.
