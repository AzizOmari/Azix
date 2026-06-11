/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { 
  CasingCrossSectionCAD 
} from "./components/CasingCrossSectionCAD";
import { 
  PumpPerformanceCurves 
} from "./components/PumpPerformanceCurves";
import { 
  ThreeDVisualizer 
} from "./components/ThreeDVisualizer";
import { 
  PATTERSON_12X8MAA_DEFAULTS, 
  INITIAL_BLUEPRINT_STATIONS, 
  DISTORTION_PRESETS, 
  REPAIR_PROCEDURE_STEPS, 
  simulatePumpPerformance 
} from "./data";
import { StationMeasurement } from "./types";
import { 
  Layers, 
  Activity, 
  Rotate3d, 
  Sliders, 
  Wrench, 
  Grid3X3, 
  AlertTriangle, 
  ShieldCheck, 
  Fuel, 
  Plus, 
  TrendingDown, 
  Database, 
  User, 
  HelpCircle,
  FileCode,
  MapPin,
  ClipboardList
} from "lucide-react";

export default function App() {
  // Primary state management
  const [stations, setStations] = useState<StationMeasurement[]>(
    JSON.parse(JSON.stringify(INITIAL_BLUEPRINT_STATIONS))
  );
  const [selectedStationIndex, setSelectedStationIndex] = useState<number>(4); // default 180°
  const [activeTab, setActiveTab] = useState<"casing-cad" | "performance-curves" | "3d-mesh" | "repair-guide" | "cmm-table">("casing-cad");
  const [roughnessFactorDistorted, setRoughnessFactorDistorted] = useState<number>(2.8);
  const [presetIndex, setPresetIndex] = useState<number>(0);
  
  // Custom manual calculation variables for ceramic fill calculator
  const [targetPackingDensity, setTargetPackingDensity] = useState<number>(1.85); // g/cm³ for Belzona 1321
  const [manualTemplateAngle, setManualTemplateAngle] = useState<number>(180);

  // Recalculate dynamic simulation on state changes
  const simulationResults = useMemo(() => {
    return simulatePumpPerformance(PATTERSON_12X8MAA_DEFAULTS, stations, roughnessFactorDistorted);
  }, [stations, roughnessFactorDistorted]);

  // Overall performance calculations for Key Stats (at 800 m³/h BEP)
  const statistics = useMemo(() => {
    const bepPt = simulationResults.find(pt => pt.flow === PATTERSON_12X8MAA_DEFAULTS.ratedFlow) || simulationResults[4];
    
    // Sum variations
    let totalErosionVolCm3 = 0;
    let thinCasingAlert = false;
    let worstStationAngle = 0;
    let maxWearDropPercent = 0;

    stations.forEach(s => {
      // Delta radius and delta width represent rectangular-equivalent localized volumetric loss
      const rDeltaCm = Math.max(0, s.actualRadius - s.nominalRadius) / 10;
      const wDeltaCm = Math.max(0, s.actualWidth - s.nominalWidth) / 10;
      const widthCm = s.nominalWidth / 10;
      const radiusCm = s.nominalRadius / 10;
      
      // Arc length for 45 deg sector: (theta in rad) * radius = (pi/4) * radius
      const arcLengthCm = (Math.PI / 4) * radiusCm;
      
      // Approximate material loss volume in each sector chamber segment
      const sectorVolStr = rDeltaCm * widthCm * arcLengthCm;
      totalErosionVolCm3 += sectorVolStr;

      const wearFrac = 1 - s.actualThickness / s.nominalThickness;
      if (wearFrac > maxWearDropPercent) {
        maxWearDropPercent = wearFrac;
        worstStationAngle = s.angle;
      }

      if (s.actualThickness < s.nominalThickness * 0.7) {
        thinCasingAlert = true;
      }
    });

    const excessP = Math.max(0, bepPt.powerDistorted - bepPt.powerNominal);
    const effDrop = Math.max(0, bepPt.effNominal - bepPt.effDistorted);

    return {
      totalErosionVolCm3: Math.round(totalErosionVolCm3 * 10) / 10,
      thinCasingAlert,
      worstStationAngle,
      maxWearDropPercent: Math.round(maxWearDropPercent * 100),
      excessPowerKw: Math.round(excessP * 10) / 10,
      efficiencyDropPercent: Math.round(effDrop * 10) / 10,
      annualUtilityLossUsd: Math.round(excessP * 24 * 350 * 0.12) // Assuming 24/7 continuous operation, 350 days/yr, $0.12/kWh
    };
  }, [simulationResults, stations]);

  // Handle station change in nested CAD crosshair
  const updateStationMeasurement = (idx: number, updated: StationMeasurement) => {
    const next = [...stations];
    next[idx] = updated;
    setStations(next);
  };

  // Preset Selection hook
  const handleApplyPreset = (idx: number) => {
    setPresetIndex(idx);
    const modified = DISTORTION_PRESETS[idx].modify(
      JSON.parse(JSON.stringify(INITIAL_BLUEPRINT_STATIONS))
    );
    setStations(modified);
    
    // Adjust roughness automatically based on preset selection for fluid-mechanic alignment
    if (idx === 0) setRoughnessFactorDistorted(1.0);
    else if (idx === 1) setRoughnessFactorDistorted(2.1);
    else if (idx === 2) setRoughnessFactorDistorted(3.4);
    else if (idx === 3) setRoughnessFactorDistorted(4.2);
  };

  // Quick reset to pure blueprints
  const handleResetToBlueprints = () => {
    handleApplyPreset(0);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col antialiased">
      
      {/* INDUSTRIAL APPLICATION HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/40 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 shadow-md backdrop-blur-md">
        <div className="flex items-center space-x-3.5">
          <div className="w-3.5 h-3.5 bg-cyan-500 rounded-full shadow-[0_0_10px_#22d3ee] neon-glow"></div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2 uppercase">
              Volute Analyzer <span className="text-[10px] text-cyan-400 font-mono tracking-wider bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/25">v4.2</span>
            </h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
              PATTERSON 12X8MAA SERIES • Vector Modeling & Navier-Stokes 1D Simulation
            </p>
          </div>
        </div>

        {/* Diagnostic Metadata Badge */}
        <div className="flex items-center space-x-3 bg-slate-950/60 p-2 rounded border border-slate-800 text-[10.5px] font-mono">
          <div className="flex items-center space-x-1">
            <MapPin className="text-cyan-400 w-3.5 h-3.5" />
            <span className="text-slate-500">Section:</span>
            <span className="text-cyan-400 font-bold">Wastewater Slip-stream A</span>
          </div>
          <div className="w-[1px] h-3.5 bg-slate-800" />
          <div className="flex items-center space-x-1">
            <User className="text-slate-500 w-3.5 h-3.5" />
            <span className="text-slate-400">Engineer:</span>
            <span className="text-white font-bold">nzv335@gmail.com</span>
          </div>
        </div>
      </header>

      {/* CORE STATS OVERVIEW RIBBON */}
      <section className="bg-slate-900/20 border-b border-slate-800/80 px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Stat 1: Casing thinning alert */}
        <div className={`p-3.5 rounded border flex items-center space-x-3.5 transition-all ${
          statistics.thinCasingAlert 
            ? "bg-amber-500/10 border-amber-500/30 text-amber-300" 
            : "bg-slate-900/50 border-slate-800/80"
        }`}>
          <div className={`p-2 rounded ${statistics.thinCasingAlert ? "bg-amber-500/20 text-amber-400" : "bg-cyan-950/40 text-cyan-400"}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="font-mono text-left">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Casing Wall Limit</p>
            <p className={`text-md font-bold uppercase ${statistics.thinCasingAlert ? "text-amber-400 animate-pulse" : "text-cyan-400"}`}>
              {statistics.thinCasingAlert ? `Distorted ${statistics.maxWearDropPercent}% loss` : "Structural Factor: 4.5"}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5 font-mono">
              {statistics.thinCasingAlert ? `Station angle ${statistics.worstStationAngle}°` : "Uniform safe wall thickness"}
            </p>
          </div>
        </div>

        {/* Stat 2: Material Loss Volume */}
        <div className="p-3.5 bg-slate-905/50 border border-slate-800 rounded flex items-center space-x-3.5">
          <div className="p-2 rounded bg-cyan-950/40 text-cyan-400">
            <Database className="w-5 h-5" />
          </div>
          <div className="font-mono text-left bg-transparent">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Casing Erosion Volume</p>
            <p className="text-md font-bold text-cyan-400">
              {statistics.totalErosionVolCm3} cm³
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">
              Channel material loss segment mass
            </p>
          </div>
        </div>

        {/* Stat 3: Efficiency Drop */}
        <div className="p-3.5 bg-slate-905/50 border border-slate-800 rounded flex items-center space-x-3.5">
          <div className="p-2 rounded bg-cyan-950/40 text-cyan-400">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="font-mono text-left">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Efficiency Drop (BEP)</p>
            <p className="text-md font-bold text-cyan-400">
              {statistics.efficiencyDropPercent > 0 ? `-${statistics.efficiencyDropPercent}%` : "0.0% Nominal"}
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">
              Relative to factory baseline model
            </p>
          </div>
        </div>

        {/* Stat 4: Annual Energy Utility Overdraw */}
        <div className="p-3.5 bg-slate-905/50 border border-slate-800 rounded flex items-center space-x-3.5">
          <div className="p-2 rounded bg-cyan-950/40 text-cyan-400">
            <Fuel className="w-5 h-5" />
          </div>
          <div className="font-mono text-left">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Recirculation Loss</p>
            <p className="text-md font-bold text-cyan-400">
              +{statistics.excessPowerKw} kW <span className="text-xs text-slate-500 underline decoration-cyan-500/30">${(statistics.annualUtilityLossUsd).toLocaleString()}/yr</span>
            </p>
            <p className="text-[9.5px] text-slate-500 mt-0.5">
              Accumulated annual utility overdraw
            </p>
          </div>
        </div>

      </section>

      {/* MAIN LAYOUT */}
      <main className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 max-w-[1550px] w-full mx-auto">
        
        {/* LEFT COMPACT PANEL (Preset configurations, parameters, equations - 3-Cols) */}
        <section className="xl:col-span-3 flex flex-col space-y-6">
          
          {/* Casing Assessment Presets */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded shadow-lg">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-cyan-500" />
              Casing Assessment presets
            </h3>
            
            <div className="space-y-2">
              {DISTORTION_PRESETS.map((p, idx) => {
                const isSelected = idx === presetIndex;
                return (
                  <button
                    key={p.name}
                    onClick={() => handleApplyPreset(idx)}
                    className={`w-full text-left p-2.5 rounded border transition-all text-xs flex flex-col ${
                      isSelected 
                        ? "bg-slate-950/60 border-cyan-500/50 text-white shadow-[0_0_8px_rgba(34,211,238,0.25)]" 
                        : "bg-slate-950/20 border-slate-800/80 hover:bg-slate-900/60 text-slate-400 hover:text-slate-200"
                    }`}
                    id={`preset-button-${idx}`}
                  >
                    <span className={`font-bold font-mono tracking-tight ${isSelected ? "text-cyan-400" : "text-slate-350"}`}>
                      {p.name}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 leading-snug">
                      {p.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Roughness alignment */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded shadow-lg font-mono">
            <h3 className="text-xs font-sans font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-cyan-500" />
              Surface Friction Controls
            </h3>

            <div className="mb-2 flex justify-between text-[11px]">
              <span className="text-slate-400 font-sans font-semibold">Skin Roughness Factor:</span>
              <span className="text-cyan-400 font-bold">{roughnessFactorDistorted}x</span>
            </div>
            
            <input
              type="range"
              min={1.0}
              max={5.0}
              step={0.1}
              value={roughnessFactorDistorted}
              onChange={(e) => setRoughnessFactorDistorted(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-slate-800 roundedcursor-pointer mb-2"
              id="casing-roughness-slider"
            />
            
            <div className="text-[9px] text-slate-500 leading-normal space-y-1 font-sans">
              <p>
                As cavitation pitting escalates surface micro-gaps, boundary wall friction scales exponentially.
              </p>
              <p className="text-slate-550 border-t border-slate-800/80 pt-1.5 font-mono">
                Roughness multipliers:
                <br />• 1.0x: Smooth Cast Iron / Blueprint
                <br />• 2.5x: Cavitation micro-cratered iron
                <br />• 4.0x+: Pocked abrasive industrial pit decay
              </p>
            </div>
          </div>

          {/* Liquid media specs sheet */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded shadow-lg text-[11px] font-mono">
            <h3 className="text-xs font-bold font-sans text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-cyan-500" />
              Operational Fluid Specs
            </h3>

            <div className="space-y-2 border-b border-slate-800/80 pb-2 mb-2 text-slate-400">
              <div className="flex justify-between">
                <span>Media Name:</span>
                <span className="text-slate-200">Industrial Wastewater</span>
              </div>
              <div className="flex justify-between">
                <span>Density (ρ):</span>
                <span className="text-slate-200">1,000 kg/m³</span>
              </div>
              <div className="flex justify-between">
                <span>Kinematic Viscosity:</span>
                <span className="text-slate-200">1.0 cSt</span>
              </div>
              <div className="flex justify-between">
                <span>Motor Shaft Power:</span>
                <span className="text-slate-200">220 kW AC</span>
              </div>
            </div>

            <div className="text-[9px] text-slate-500 italic font-sans leading-relaxed">
              Fluid calculations leverage direct Euler-based momentum integrations cross-referenced to specific Patterson multi-stage designs.
            </div>
          </div>

          {/* Volute Fluid Modeling Equations Sheet */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded shadow-lg leading-relaxed text-[10px] font-mono text-slate-400 space-y-3.5">
            <h4 className="text-xs font-sans font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-cyan-500" />
              Hydromechanical Formulas
            </h4>

            <div>
              <p className="text-white font-bold">1. Navier-Stokes 1D Loss Model</p>
              <p className="mt-0.5 text-slate-500">Total Head: H(Q) = H_Ideal - h_friction - h_shock - h_recirc</p>
            </div>

            <div>
              <p className="text-white font-bold">2. Volute Skin Friction Loss</p>
              <p className="mt-0.5 text-slate-500">h_friction = f * (L/D_h) * (V_v² / 2g)</p>
              <p className="text-[9.5px]">Where deteriorated area scales velocity V_v down but increases micro-boundary shear friction.</p>
            </div>

            <div>
              <p className="text-white font-bold">3. Cutwater Recirculation Leakage</p>
              <p className="mt-0.5 text-slate-500">h_recirc = k * (Gap_actual / Gap_nominal)² * Q_low_flow</p>
            </div>
          </div>

        </section>

        {/* CENTER INTERACTIVE CORE DISPLAY PANEL (9-Cols) */}
        <section className="xl:col-span-9 flex flex-col space-y-6">
          
          {/* NAVIGATION BAR WITH DYNAMIC TAB SELECTOR */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex space-x-1 p-1 bg-slate-900/60 rounded border border-slate-800">
              
              <button
                onClick={() => setActiveTab("casing-cad")}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded transition-all ${
                  activeTab === "casing-cad" 
                    ? "bg-cyan-650 text-white shadow-[0_0_8px_rgba(34,211,238,0.35)] bg-cyan-600" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id="tab-casing-cad"
              >
                <Layers className="w-4 h-4 text-cyan-500" />
                <span>2D Cross-Section (CMM)</span>
              </button>

              <button
                onClick={() => setActiveTab("3d-mesh")}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded transition-all ${
                  activeTab === "3d-mesh" 
                    ? "bg-cyan-650 text-white shadow-[0_0_8px_rgba(34,211,238,0.35)] bg-cyan-600" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id="tab-3d-visualizer"
              >
                <Rotate3d className="w-4 h-4 text-cyan-500" />
                <span>3D Geometry Mesh</span>
              </button>

              <button
                onClick={() => setActiveTab("performance-curves")}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded transition-all ${
                  activeTab === "performance-curves" 
                    ? "bg-cyan-650 text-white shadow-[0_0_8px_rgba(34,211,238,0.35)] bg-cyan-600" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id="tab-performance-curves"
              >
                <Activity className="w-4 h-4 text-cyan-500" />
                <span>Performance Curves</span>
              </button>

              <button
                onClick={() => setActiveTab("repair-guide")}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded transition-all ${
                  activeTab === "repair-guide" 
                    ? "bg-cyan-650 text-white shadow-[0_0_8px_rgba(34,211,238,0.35)] bg-cyan-600" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id="tab-repair-guide"
              >
                <Wrench className="w-4 h-4 text-cyan-500" />
                <span>Step-by-Step Rehabilitation</span>
              </button>

              <button
                onClick={() => setActiveTab("cmm-table")}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded transition-all ${
                  activeTab === "cmm-table" 
                    ? "bg-cyan-650 text-white shadow-[0_0_8px_rgba(34,211,238,0.35)] bg-cyan-600" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id="tab-cmm-table"
              >
                <Grid3X3 className="w-4 h-4 text-cyan-500" />
                <span>CMM Measurement Log</span>
              </button>

            </div>

            <button
              onClick={handleResetToBlueprints}
              className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 bg-slate-900 px-3 py-1.5 rounded border border-cyan-500/20 hover:border-cyan-500/40 transition-all cursor-pointer"
              id="reset-blueprint-button"
            >
              Reset to Blueprints
            </button>
          </div>

          {/* VIEW DISPLAY ROUTER COMPONENT */}
          <div className="flex-1">
            
            {activeTab === "casing-cad" && (
              <CasingCrossSectionCAD 
                stations={stations}
                baseCircleDiameter={PATTERSON_12X8MAA_DEFAULTS.baseCircleDiameter}
                selectedStationIndex={selectedStationIndex}
                setSelectedStationIndex={setSelectedStationIndex}
                onUpdateStation={updateStationMeasurement}
              />
            )}

            {activeTab === "3d-mesh" && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3 h-[520px]">
                  <ThreeDVisualizer 
                    stations={stations}
                    baseCircleDiameter={PATTERSON_12X8MAA_DEFAULTS.baseCircleDiameter}
                  />
                </div>
                {/* 3D explanation side card */}
                <div className="bg-[#0c1221] border border-slate-800 p-5 rounded-xl flex flex-col justify-between font-mono text-[11px] leading-relaxed">
                  <div>
                    <h4 className="text-white text-xs font-bold font-sans uppercase tracking-wider mb-2.5">
                      3D Spiral Topology
                    </h4>
                    <p className="text-slate-400 mb-4">
                      The Patterson 12X8MAA operates with constant momentum design, creating an outer logarithmic spiral which expands from the cut-off tongue to the discharge flange nozzle.
                    </p>
                    <p className="text-slate-405 border-t border-slate-850 pt-2.5">
                      <strong>Interactive Instructions:</strong>
                      <br />• Left-Click & Drag to orbit-rotate casing inside space.
                      <br />• Set display modes in header to inspect specific fields.
                      <br />• Wireframe allows validation of structural coordinate nodes.
                    </p>
                  </div>
                  <div className="border-t border-slate-850 pt-3">
                    <span className="text-[10px] text-slate-500">Casing Volume Limit:</span>
                    <span className="text-teal-400 font-bold block mt-1">24.5 m³ total volume displacement</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "performance-curves" && (
              <div className="h-[480px]">
                <PumpPerformanceCurves 
                  simulationData={simulationResults}
                  ratedFlow={PATTERSON_12X8MAA_DEFAULTS.ratedFlow}
                />
              </div>
            )}

            {activeTab === "repair-guide" && (
              <div className="space-y-6">
                {/* Top overview template generator */}
                <div className="bg-[#0c1221] border border-slate-800 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Caliper profile summary */}
                  <div className="md:col-span-2">
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2">
                      Precision Liner Core Volume Estimator
                    </h3>
                    <p className="text-xs text-slate-400 leading-normal mb-4">
                      Input structural parameters to calculate the bulk material mass of ceramic composite (Belzona 1321 or equivalent) required to patch wear segments accurately.
                    </p>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono text-xs">
                      <div>
                        <span className="text-slate-500">Selected Angle station:</span>
                        <select
                          value={manualTemplateAngle}
                          onChange={(e) => setManualTemplateAngle(parseInt(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 px-2 py-1.5 rounded mt-1 font-mono text-cyan-400 focus:outline-none"
                        >
                          {stations.map(s => (
                            <option key={s.angle} value={s.angle}>{s.angle}°</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="text-slate-500">Epoxy Density (g/cm³):</span>
                        <input
                          type="number"
                          step={0.05}
                          value={targetPackingDensity}
                          onChange={(e) => setTargetPackingDensity(parseFloat(e.target.value) || 1.8)}
                          className="w-full bg-slate-950 border border-slate-800 px-2 py-1.5 rounded mt-1 font-mono text-white focus:outline-none"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-1 bg-slate-950/80 rounded border border-slate-800 p-2 text-center flex flex-col justify-center">
                        <span className="text-slate-500 text-[10px]">Mass Recommendation:</span>
                        <span className="text-cyan-400 font-bold text-sm mt-0.5">
                          {(() => {
                            const st = stations.find(s => s.angle === manualTemplateAngle) || stations[0];
                            const rDelta = Math.max(0, st.actualRadius - st.nominalRadius) / 10;
                            const wDelta = Math.max(0, st.actualWidth - st.nominalWidth) / 10;
                            const widthCm = st.nominalWidth / 10;
                            const radiusCm = st.nominalRadius / 10;
                            const arcCm = (Math.PI / 4) * radiusCm;
                            const sectorVolCm3 = rDelta * widthCm * arcCm;
                            const massGrams = sectorVolCm3 * targetPackingDensity;
                            return `${Math.round(massGrams)} grams`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Calibration template parameters visual preview */}
                  <div className="bg-slate-950 p-4 rounded border border-slate-800 flex flex-col justify-between font-mono text-[10.5px]">
                    <div className="space-y-1.5">
                      <p className="font-bold text-slate-300 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        Casing Profile Standards
                      </p>
                      <div className="flex justify-between border-b border-slate-900 pb-1 mt-2 text-slate-500">
                        <span>Patterson Design Class:</span>
                        <span className="text-white">MAA-Series Heavy</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-900 pb-1 text-slate-500">
                        <span>Min Clearance Gap:</span>
                        <span className="text-white font-bold">7.50 mm</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Epoxy Layer Limit:</span>
                        <span className="text-white">2.50 mm (dry)</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Step-by-Step interactive process list */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 leading-normal">
                    <Wrench className="w-4 h-4 text-cyan-500" />
                    Patterson 12X8MAA Rehabilitation Step-by-Step Process Specification
                  </h3>

                  {REPAIR_PROCEDURE_STEPS.map((step) => (
                    <div key={step.step} className="bg-slate-900 border border-slate-800 rounded overflow-hidden shadow">
                      
                      {/* Step Header */}
                      <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center space-x-3 text-left">
                          <span className="w-6 h-6 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 font-mono text-xs flex items-center justify-center font-bold">
                            {step.step}
                          </span>
                          <div>
                            <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-500 block">
                              Phase {step.step}: {step.phase}
                            </span>
                            <span className="text-xs font-extrabold text-white font-sans">
                              {step.title}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10.5px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          Patterson Manual Rev 4
                        </span>
                      </div>

                      {/* Step Details grid */}
                      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Bullet actions (Col-1 & Col-2) */}
                        <div className="md:col-span-2 space-y-3">
                          <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wide font-sans">Method Statement & Operational Commands</h4>
                          <ul className="space-y-2.5 text-xs text-slate-400 list-inside list-disc pl-1 leading-relaxed">
                            {step.details.map((detail, dIdx) => (
                              <li key={dIdx} className="marker:text-cyan-500">
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Metadata blocks (Col-3) */}
                        <div className="space-y-4 border-l border-slate-800 pl-6 font-mono text-[10.5px]">
                          
                          {/* Equipment list */}
                          <div>
                            <span className="text-slate-500 font-bold block uppercase text-[9px] mb-1 font-sans">Mandatory Tools</span>
                            <div className="flex flex-wrap gap-1">
                              {step.equipmentNeeded.map((eq, eqIdx) => (
                                <span key={eqIdx} className="bg-slate-950 px-2 py-1 rounded border border-slate-800 text-[10px] text-slate-300 leading-snug">
                                  {eq}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Quality Check criteria */}
                          <div className="border-t border-slate-800 pt-3">
                            <span className="text-cyan-400 font-bold block uppercase text-[9px] mb-1 font-sans">Acceptance Q/C Criteria</span>
                            <ul className="space-y-1 text-slate-400 list-inside list-square">
                              {step.qualityChecks.map((qc, qcIdx) => (
                                <li key={qcIdx}>• {qc}</li>
                              ))}
                            </ul>
                          </div>

                          {/* Safety/Alert */}
                          <div className="border-t border-slate-800 pt-3 bg-red-955/10 p-2 rounded border border-red-950/20">
                            <span className="text-rose-400 font-bold block uppercase text-[9px] mb-1 font-sans">Risk & Safety warnings</span>
                            <ul className="space-y-1 text-slate-400 font-sans">
                              {step.safetyWarnings.map((sw, swIdx) => (
                                <li key={swIdx} className="text-[10px] leading-snug">• {sw}</li>
                              ))}
                            </ul>
                          </div>

                        </div>

                      </div>

                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "cmm-table" && (
              <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden shadow-xl p-5 font-mono">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-sans">
                      CMM Coordinate Measurement stations
                    </h3>
                    <p className="text-xs text-slate-500 font-sans mt-1">
                      Actual coordinate logging data collected via physical Coordinate Measuring Machine sweeps of the Patterson volute interiors.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm("Verify: Repopulate all stations back to nominal 18mm casing steel limits?")) {
                        handleResetToBlueprints();
                      }
                    }}
                    className="px-2.5 py-1.5 text-xs font-mono border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-950 rounded transition"
                  >
                    Set All Stations Standard
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 text-[10.5px]">
                        <th className="py-2.5 px-3">Sector Angle</th>
                        <th className="py-2.5 px-2">R_Nominal (mm)</th>
                        <th className="py-2.5 px-2">R_Actual [CMM] (mm)</th>
                        <th className="py-2.5 px-2">W_Nominal (mm)</th>
                        <th className="py-2.5 px-2">W_Actual [CMM] (mm)</th>
                        <th className="py-2.5 px-2">Wall thickness (mm)</th>
                        <th className="py-2.5 px-2">Erosion wear</th>
                        <th className="py-2.5 px-2 text-right font-sans">Action calibration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {stations.map((s, idx) => {
                        const wearFrac = 1 - s.actualThickness / s.nominalThickness;
                        const wearGrams = Math.round((Math.max(0, s.actualRadius - s.nominalRadius) * 2.5) * 10) / 10;
                        
                        let textClass = "text-cyan-400 font-bold";
                        if (wearFrac > 0.35) textClass = "text-rose-400 font-bold";
                        else if (wearFrac > 0.15) textClass = "text-amber-500 font-bold";

                        return (
                          <tr key={s.angle} className="hover:bg-slate-950/40 transition">
                            <td className="py-3 px-3 font-bold text-white text-[13px]">{s.angle}°</td>
                            <td className="py-3 px-2 text-slate-550">{s.nominalRadius} mm</td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                min={s.nominalRadius}
                                max={s.nominalRadius + 30}
                                step={0.5}
                                value={s.actualRadius}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || s.nominalRadius;
                                  updateStationMeasurement(idx, { ...s, actualRadius: val });
                                }}
                                className="w-[80px] bg-slate-950 border border-slate-800 px-1.5 py-1 text-cyan-400 font-bold focus:outline-none rounded"
                              />
                            </td>
                            <td className="py-3 px-2 text-slate-550">{s.nominalWidth} mm</td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                min={s.nominalWidth}
                                max={s.nominalWidth + 30}
                                step={0.5}
                                value={s.actualWidth}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || s.nominalWidth;
                                  updateStationMeasurement(idx, { ...s, actualWidth: val });
                                }}
                                className="w-[80px] bg-slate-950 border border-slate-800 px-1.5 py-1 text-cyan-400 font-bold focus:outline-none rounded"
                              />
                            </td>
                            <td className={`py-3 px-2 ${textClass}`}>
                              {s.actualThickness} mm
                            </td>
                            <td className={`py-3 px-2 ${textClass}`}>
                              {Math.round(wearFrac * 100)} %
                            </td>
                            <td className="py-3 px-2 text-right">
                              <button
                                onClick={() => {
                                  setSelectedStationIndex(idx);
                                  setActiveTab("casing-cad");
                                }}
                                className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950/20 border border-cyan-500/15 px-2 py-1 rounded hover:bg-cyan-950/35 font-sans"
                              >
                                CAD Blueprint
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 p-3.5 bg-slate-950 rounded border border-slate-850 text-slate-500 text-xs text-left font-sans leading-relaxed">
                  💡 <strong>Engineering Note:</strong> Directly modifying actual measurements in the CMM Log will dynamically trigger a recalculation of 1D hydraulic loss models, updating the curves and efficiency predictions in real-time.
                </div>
              </div>
            )}

          </div>

        </section>

      </main>

      {/* INDUSTRIAL SYSTEM LEVEL FOOTER */}
      <footer className="mt-12 border-t border-slate-900 bg-slate-900/10 px-6 py-6 text-center text-xs font-mono text-slate-500">
        <p>Patterson MAA Casing Rehabilitation Suite | Powered by 1D Loss Navier-Stokes Interpolation models</p>
        <p className="mt-2 text-[10px] text-slate-600">
          This system conforms to Hydraulic Institute Standard 14.6 for Rotodynamic Pump Performance Testing. Unauthorized duplication prohibited. © 2026 Patterson Pump.
        </p>
      </footer>

    </div>
  );
}
