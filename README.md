# Is an EV More Sustainable for You?

A web-based tool that helps you compare the lifetime carbon footprint of **keeping your current gas/diesel/hybrid car** versus **switching to an electric vehicle**.

## How It Works

1. **Enter your current car details** — fuel type, model year, vehicle size, fuel economy (MPG), and annual mileage.
2. **Pick the EV you're considering** — choose from 40+ popular models with pre-loaded battery and range specs.
3. **Select your electricity grid** — carbon intensity varies significantly by region.
4. **Get your results** — see a side-by-side comparison with cumulative emissions charts and a clear verdict.

## What's Included in the Calculation

| Factor | Keep Current Car | Switch to EV |
|--------|-----------------|--------------|
| Manufacturing | Already sunk (not counted) | Full vehicle + battery production |
| Fuel / Energy | Gasoline/diesel combustion + upstream extraction & refining | Electricity from your regional grid |
| Maintenance | Tires, fluids, parts | Tires, parts (fewer moving parts) |

### Key Data Sources

- **Fuel CO2**: EPA — 8.887 kg CO2/gallon gasoline, 10.18 kg/gallon diesel
- **Upstream emissions**: ~25% adder for well-to-tank (extraction, refining, transport)
- **EV manufacturing**: Argonne GREET model estimates — 65–175 kg CO2 per kWh of battery capacity
- **Grid intensity**: IEA and EPA eGRID regional averages
- **Vehicle LCA**: Peer-reviewed lifecycle assessment studies

## Running Locally

No build step or server required. Just open `index.html` in a browser:

```bash
open index.html
# or
python3 -m http.server 8000
```

## File Structure

```
index.html   — Main page (two-step form + results)
style.css    — Responsive design with CSS custom properties
data.js      — Vehicle database, emissions factors, grid intensities
calc.js      — Carbon comparison calculation engine
chart.js     — Lightweight canvas-based charting (no dependencies)
app.js       — Form handling, validation, and result rendering
```

## No External Dependencies

The entire site runs as static HTML/CSS/JS with zero dependencies — no npm, no build tools, no frameworks. Charts are drawn with the native Canvas API.
