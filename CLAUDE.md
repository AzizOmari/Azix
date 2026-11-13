# CLAUDE.md

## Project

Pump Volute Geometry Distortion Analysis: an engineering web app for a **Patterson 12X8MAA** centrifugal pump
(1750 RPM, 800 m³/h rated flow, 470 mm impeller, Cast Iron Grade 30 casing, industrial waste water).

It compares the volute casing's design geometry against measured (worn) geometry, predicts the hydraulic
losses and the head, efficiency and power penalty, and guides a lining repair (Belzona 1321 composite).

Originally generated with Google AI Studio.

## Stack

React 19 + TypeScript + Vite 6 + Tailwind 4, with `lucide-react` icons and `motion`.
`@google/genai` and `express` are listed as dependencies, but `src/` doesn't use them yet.

- `npm run dev`: dev server on port 3000
- `npm run build`: production build
- `npm run lint`: type check (`tsc --noEmit`)

## Code map

- `src/types.ts`: `StationMeasurement` (nominal vs actual radius, width and wall thickness per angle),
  `PumpParameters`, `SimulationResult` (head/eff/power for nominal, distorted and repaired cases, plus a
  loss breakdown: friction, shock, disk friction, leakage, mixing).
- `src/data.ts`: pump defaults, blueprint stations every 45° from the tongue (0°–360°), distortion presets
  (as-built, tongue cavitation, slurry erosion, acid corrosion), `simulatePumpPerformance()`, and
  `REPAIR_PROCEDURE_STEPS`.
- `src/App.tsx`: main UI with tabs: casing CAD, 3D mesh, performance curves, repair guide, CMM table.
- `src/components/`: `CasingCrossSectionCAD`, `ThreeDVisualizer`, `PumpPerformanceCurves`.

## Conventions

- Units: mm for geometry, m³/h for flow, m for head, kW for power, % for efficiency, degrees for angles
  (0° = tongue/cutwater).
- The performance model is a simplified loss model, not CFD. Treat its outputs as estimates.

## Decisions

Use the `llm-council` skill ("council this") for decisions with real trade-offs, such as repair method or
material, model accuracy versus simplicity, or which feature to build next.
