/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { StationMeasurement } from "../types";
import { Layers, Crosshair, HelpCircle, ShieldAlert, Cpu } from "lucide-react";

interface CasingCrossSectionCADProps {
  stations: StationMeasurement[];
  baseCircleDiameter: number;
  selectedStationIndex: number;
  setSelectedStationIndex: (idx: number) => void;
  onUpdateStation: (idx: number, updated: StationMeasurement) => void;
}

export const CasingCrossSectionCAD: React.FC<CasingCrossSectionCADProps> = ({
  stations,
  baseCircleDiameter,
  selectedStationIndex,
  setSelectedStationIndex,
  onUpdateStation
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    label: string;
    nominalVal: number;
    actualVal: number;
    deviation: number;
    wallThickness: number;
  } | null>(null);

  const activeStation = stations[selectedStationIndex];
  
  // Outer casing wall nominal & actual
  const R_nom = activeStation.nominalRadius;
  const R_act = activeStation.actualRadius;
  const W_nom = activeStation.nominalWidth;
  const W_act = activeStation.actualWidth;
  const T_nom = activeStation.nominalThickness;
  const T_act = activeStation.actualThickness;

  const R_base = baseCircleDiameter / 2; // d3/2
  const R_impeller = R_base - 7.5; // d2/2

  // Quality grading
  const wearPercent = Math.round((1 - T_act / T_nom) * 100);
  let wearRating = "Nominal Quality Standard";
  let wearColor = "text-cyan-400";
  let wearBg = "bg-cyan-950/20";
  let wearBorder = "border-cyan-500/30";

  if (wearPercent > 35) {
    wearRating = "CRITICAL STRUCTURAL WARNING: Wall Breach Risk";
    wearColor = "text-red-400";
    wearBg = "bg-red-500/10";
    wearBorder = "border-red-500/30";
  } else if (wearPercent > 15) {
    wearRating = "Moderate Hydromechanical Degradation";
    wearColor = "text-amber-400";
    wearBg = "bg-amber-500/10";
    wearBorder = "border-amber-500/30";
  }

  // Handle slide adjustment on actual parameters
  const handleRadiusChange = (val: number) => {
    onUpdateStation(selectedStationIndex, {
      ...activeStation,
      actualRadius: val
    });
  };

  const handleWidthChange = (val: number) => {
    onUpdateStation(selectedStationIndex, {
      ...activeStation,
      actualWidth: val
    });
  };

  const handleThicknessChange = (val: number) => {
    onUpdateStation(selectedStationIndex, {
      ...activeStation,
      actualThickness: val
    });
  };

  // Convert mm to SVG coordinate pixels
  // Center is at (250, 250)
  const cx = 240;
  const cy = 250;
  const scale = 0.52; // mm to pixel scale factor to fit drawing perfectly in 480x480 box

  // Helper to generate SVG points for the trapezoidal rounded fluid channel cross-section profile
  const makeChannelPath = (radius: number, width: number, isNominal: boolean) => {
    const halfW = width / 2;
    // Radial offset from base circle
    const channelHeight = Math.max(10, radius - R_base);
    
    // Draw fluid pocket stretching from base diameter outwards
    // Center of shaft is at absolute center (cx). Radial direction goes UP.
    // Shaft centerline at cy. Inlet is at base radius R_base.
    // Width represents horizontal Z-dimension in 3D, here rendered horizontally.
    
    // Coordinates relative to cx, cy:
    // Left bottom (inlet corner on impeller shroud): x = -halfW, y = base radial distance
    const lb_x = cx - halfW * scale;
    const lb_y = cy - R_base * scale;

    // Right bottom (inlet corner): x = +halfW, y = base radial distance
    const rb_x = cx + halfW * scale;
    const rb_y = cy - R_base * scale;

    // Outer spiral tip is at "radius" radial distance
    // We create a nice curved top profile representing circular or curved volute walls
    const top_y = cy - radius * scale;
    const top_mid_left_x = cx - (halfW * 0.7) * scale;
    const top_mid_right_x = cx + (halfW * 0.7) * scale;
    const top_h_y = cy - (R_base + channelHeight * 0.85) * scale;

    // Return closed SVG path
    return `M ${lb_x} ${lb_y} 
            C ${lb_x - 5} ${lb_y - 20}, ${top_mid_left_x} ${top_h_y}, ${cx} ${top_y} 
            C ${top_mid_right_x} ${top_h_y}, ${rb_x + 5} ${lb_y - 20}, ${rb_x} ${rb_y} 
            Z`;
  };

  // Make metal outer casing wall path (offsetting the channel path wall thickness)
  const makeCasingOuterPath = (radius: number, width: number, thickness: number) => {
    const halfW = (width / 2) + thickness;
    const outerR = radius + thickness;
    const innerR_base = R_base; // wall goes down to flange connection
    
    const lb_x = cx - halfW * scale;
    const lb_y = cy - innerR_base * scale;

    const rb_x = cx + halfW * scale;
    const rb_y = cy - innerR_base * scale;

    const top_y = cy - outerR * scale;
    const top_mid_left_x = cx - (halfW * 0.7) * scale;
    const top_mid_right_x = cx + (halfW * 0.7) * scale;
    const top_h_y = cy - (innerR_base + (outerR - innerR_base) * 0.85) * scale;

    return `M ${lb_x} ${lb_y} 
            C ${lb_x - 6} ${lb_y - 25}, ${top_mid_left_x} ${top_h_y}, ${cx} ${top_y} 
            C ${top_mid_right_x} ${top_h_y}, ${rb_x + 6} ${lb_y - 25}, ${rb_x} ${rb_y} 
            Z`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900 p-6 rounded border border-slate-800">
      
      {/* LEFT COLUMN: SVG CAD Blueprint (7-Cols) */}
      <div className="lg:col-span-7 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-cyan-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Station {activeStation.angle}° Casing Sectional CAD Profile
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-550 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            BLUEPRINT RATIO 1:1.9
          </span>
        </div>

        {/* Dynamic feedback on hover caliper */}
        <div className="min-h-[30px] px-3 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-slate-350 flex items-center justify-between mb-3">
          {hoveredPoint ? (
            <>
              <span className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>Element: <strong className="text-white">{hoveredPoint.label}</strong></span>
              </span>
              <span>Nom: <strong className="text-cyan-400">{hoveredPoint.nominalVal}mm</strong></span>
              <span>Act: <strong className="text-red-400">{hoveredPoint.actualVal}mm</strong></span>
              <span>Wear: <strong className="text-amber-400">-{hoveredPoint.deviation}mm</strong></span>
              <span>Residual Casing Wall: <strong className="text-rose-400">{hoveredPoint.wallThickness}mm</strong></span>
            </>
          ) : (
            <span className="text-slate-500 flex items-center gap-1.5 font-sans">
              <HelpCircle className="w-4 h-4 text-slate-600" />
              Hover cursor over colored drawing boundaries to deploy dynamic digital slide caliper measurement.
            </span>
          )}
        </div>

        {/* Blueprint Viewer Stage */}
        <div className="relative bg-slate-950 border border-slate-800 rounded overflow-hidden aspect-square flex items-center justify-center p-2 shadow-inner">
          
          <svg
            className="w-full h-full max-w-[480px] max-h-[480px]"
            viewBox="0 0 480 480"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Defs for blueprint styling */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(34, 211, 238, 0.05)" strokeWidth="0.5" />
              </pattern>
              
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
              </marker>
 
              <marker id="danger-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f87171" />
              </marker>
            </defs>
 
            {/* Pattern grid */}
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Reference Coordinate Shaft Centerline (Vertical & Horizontal) */}
            <line x1={cx} y1="30" x2={cx} y2="450" stroke="#1e293b" strokeWidth="1" strokeDasharray="5,5" />
            <line x1="30" y1={cy} x2="450" y2={cy} stroke="#1e293b" strokeWidth="1" strokeDasharray="5,5" />

            {/* Axis Labels */}
            <text x={cx + 5} y="40" className="text-[10px] font-mono fill-slate-500">CL SHAFT</text>
            <text x="400" y={cy - 5} className="text-[10px] font-mono fill-slate-500 text-right">Z - WIDTH</text>

            <g transform="translate(0, 0)">
              {/* === STATIC REFERENCE 1: Impeller Outermost Diameter (R2) === */}
              <circle
                cx={cx}
                cy={cy}
                r={R_impeller * scale}
                stroke="#d97706"
                strokeWidth="1.2"
                strokeDasharray="4,2"
                className="opacity-60"
              />
              <path
                d={`M ${cx - R_impeller * scale} ${cy} A ${R_impeller * scale} ${R_impeller * scale} 0 0 1 ${cx + R_impeller * scale} ${cy}`}
                fill="rgba(217, 119, 6, 0.04)"
              />
              
              {/* === STATIC REFERENCE 2: Volute Base Circle Diameter (d3) === */}
              <circle
                cx={cx}
                cy={cy}
                r={R_base * scale}
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeDasharray="3,3"
                className="opacity-70"
              />

              {/* === CASING CASTING SOLID BODY MESH (Gray Iron Background) === */}
              {/* Nominal Casing limits vs Distorted internal limits. Outer diameter is defined by (Radius + nominal Thickness). */}
              <path
                d={makeCasingOuterPath(R_nom, W_nom, T_nom)}
                fill="rgba(51, 65, 85, 0.2)"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="1,2"
              />

              {/* CURRENT ACTUAL THICKNESS WALL ENVELOPE (Pitted Casing wall) */}
              <path
                d={makeCasingOuterPath(R_nom, W_nom, T_nom)}
                className="transition-all duration-300"
              />

              {/* Erosion / Cavitation Loss Overlay (Red Zone between nominal wall and actual eroded wall) */}
              <path
                d={makeChannelPath(R_act, W_act, false)}
                fill="none"
                stroke="#f87171"
                strokeWidth="3"
                className="opacity-80 transition-all duration-300"
                onMouseEnter={() => setHoveredPoint({
                  label: "Erosion Wear Face Segment",
                  x: cx, y: cy - R_act*scale,
                  nominalVal: R_nom,
                  actualVal: R_act,
                  deviation: Math.round((R_act - R_nom)*10)/10,
                  wallThickness: T_act
                })}
                onMouseLeave={() => setHoveredPoint(null)}
              />

              {/* REPAIRED RESTORED PROFILE LAYER (Lining material layer, representing original factory sizing) */}
              <path
                d={makeChannelPath(R_nom, W_nom, true)}
                fill="rgba(34, 211, 238, 0.08)"
                stroke="#22d3ee"
                strokeWidth="1.5"
                strokeDasharray="8,4"
                className="transition-all duration-300"
                onMouseEnter={() => setHoveredPoint({
                  label: "Ceramic Polymer Alignment Standard",
                  x: cx, y: cy - R_nom*scale,
                  nominalVal: R_nom,
                  actualVal: R_nom,
                  deviation: 0,
                  wallThickness: T_nom
                })}
                onMouseLeave={() => setHoveredPoint(null)}
              />

              {/* Distorted Internal flow area cavity */}
              <path
                d={makeChannelPath(R_act, W_act, false)}
                fill="rgba(239, 68, 68, 0.04)"
                stroke="#ef4444"
                strokeWidth="1.5"
                onMouseEnter={() => setHoveredPoint({
                  label: "Eroded Water-Channel Envelope",
                  x: cx, y: cy - R_act*scale,
                  nominalVal: R_nom,
                  actualVal: R_act,
                  deviation: Math.round((R_act - R_nom) * 10) / 10,
                  wallThickness: T_act
                })}
                onMouseLeave={() => setHoveredPoint(null)}
              />

              {/* Blueprint Caliper Dimension Indicators/Lines */}
              {/* Radial dimension to base circle (485mm) */}
              <line x1={cx} y1={cy} x2={cx - 100 * scale} y2={cy + 80 * scale} stroke="#64748b" strokeWidth="1" />
              <line x1={cx} y1={cy} x2={cx + R_base * scale * 0.707} y2={cy - R_base * scale * 0.707} stroke="#38bdf8" strokeWidth="0.85" markerEnd="url(#arrow)" />
              <text x={cx + R_base * scale * 0.35} y={cy - R_base * scale * 0.35 - 5} className="text-[9px] font-mono fill-sky-400 font-bold">
                d₃/2 = {R_base}mm
              </text>

              {/* Impeller radius reference */}
              <line x1={cx} y1={cy} x2={cx - R_impeller * scale * 0.7} y2={cy - R_impeller * scale * 0.7} stroke="#d97706" strokeWidth="0.85" markerEnd="url(#arrow)" />
              <text x={cx - R_impeller * scale * 0.5} y={cy - R_impeller * scale * 0.5 + 12} className="text-[9px] font-mono fill-amber-500">
                R_imp = {R_impeller}mm
              </text>

              {/* Wall Thickness Caliper Arrows */}
              {/* Outer Casing Dimension line */}
              <g transform={`translate(${cx + (W_nom / 2) * scale}, ${cy - R_nom * scale})`}>
                <line x1="0" y1="0" x2="45" y2="-10" stroke="#64748b" strokeWidth="1" />
                <circle cx="0" cy="0" r="3" fill="#22d3ee" />
                <text x="50" y="-8" className="text-[10px] font-bold font-mono fill-cyan-400">Nominal Wall Interface ({R_nom}mm)</text>
              </g>

              {/* Errant damaged wall indicators */}
              <g transform={`translate(${cx + (W_act / 2) * scale}, ${cy - R_act * scale})`}>
                <line x1="0" y1="0" x2="45" y2="20" stroke="#f87171" strokeWidth="1" />
                <circle cx="0" cy="0" r="3.5" fill="#f87171" />
                <text x="50" y="24" className="text-[10px] font-bold font-mono fill-rose-400">Eroded Wall Node ({R_act}mm)</text>
              </g>

              {/* Total nominal width caliper */}
              <line x1={cx - (W_nom/2)*scale} y1={cy - (R_base + 35)*scale} x2={cx + (W_nom/2)*scale} y2={cy - (R_base + 35)*scale} stroke="#475569" strokeWidth="1" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
              <text x={cx} y={cy - (R_base + 35)*scale - 6} textAnchor="middle" className="text-[9px] font-mono fill-slate-400">
                W_nominal = {W_nom}mm
              </text>

              {/* Casing wall thickness visualization markers */}
              {/* Draw a caliper indicator for the remaining wall thickness */}
              <g transform={`translate(${cx}, ${cy - (R_nom + T_nom) * scale})`}>
                <line x1="-30" y1="0" x2="-30" y2={T_act * scale} stroke="#f87171" strokeWidth="1.5" markerStart="url(#danger-arrow)" markerEnd="url(#danger-arrow)" />
                <text x="-40" y={(T_act * scale) / 2 + 3} textAnchor="end" className="text-[9px] font-mono font-bold fill-red-400">T_act = {T_act}mm</text>
                
                <line x1="30" y1="0" x2="30" y2={T_nom * scale} stroke="#22d3ee" strokeWidth="1.5" />
                <text x="40" y={(T_nom * scale) / 2 + 3} textAnchor="start" className="text-[9px] font-mono font-bold fill-cyan-400">T_nom = {T_nom}mm</text>
              </g>

            </g>
          </svg>

          {/* Quick indicators */}
          <div className="absolute top-4 left-4 flex flex-col space-y-1 bg-slate-950/90 p-2.5 rounded border border-slate-800 text-[10px] font-mono text-slate-300">
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Impeller Exit Ring (d2 = 470mm)
            </span>
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-2.5 h-1.5 rounded bg-sky-400" />
              Base Circle Diameter (d3 = 485mm)
            </span>
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-3 h-0.5 border-t border-dashed border-cyan-455 stroke-cyan-400" />
              Designed Blueprint Profile Path
            </span>
            <span className="flex items-center gap-1.5 font-sans">
              <span className="w-3 h-1 rounded bg-[#f87171]" />
              Eroded Internal Casing Profile
            </span>
          </div>

          <div className="absolute bottom-4 right-4 bg-slate-950/95 p-3 rounded border border-slate-800 text-[10px] font-mono text-right max-w-[150px]">
            <p className="text-slate-500 uppercase text-[9px] font-sans">Epoxy Build-up</p>
            <p className="text-cyan-400 font-bold text-xs mt-1">{(R_act - R_nom).toFixed(1)} mm</p>
            <p className="text-slate-400 mt-1 font-sans">Recommended coating layer at {activeStation.angle}°</p>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: station selectors & interactive sliders (5-Cols) */}
      <div className="lg:col-span-5 flex flex-col justify-between">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5 font-sans">
            <Cpu className="w-4 h-4 text-cyan-500" />
            Select Volute Station Angle
          </h4>

          {/* Grid of station buttons (0 to 360) */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {stations.map((s, idx) => {
              const wear = Math.round((1 - s.actualThickness / s.nominalThickness) * 100);
              let btnColor = "border-slate-800 text-slate-300 bg-slate-950/50 hover:bg-slate-800/80";
              if (idx === selectedStationIndex) {
                btnColor = "border-cyan-500 text-white bg-cyan-950/20 font-bold shadow-[0_0_6px_rgba(34,211,238,0.25)]";
              } else if (wear > 35) {
                btnColor = "border-red-900 text-red-400 bg-red-950/20 hover:bg-red-950/35";
              } else if (wear > 15) {
                btnColor = "border-amber-900 text-amber-400 bg-amber-950/15 hover:bg-amber-950/30";
              }

              return (
                <button
                  key={s.angle}
                  onClick={() => setSelectedStationIndex(idx)}
                  className={`px-2 py-2.5 rounded border text-xs font-mono transition-all flex flex-col items-center ${btnColor}`}
                  id={`station-selector-${s.angle}`}
                >
                  <span className="text-[11px]">{s.angle}°</span>
                  <span className="text-[8px] text-slate-500 mt-0.5 font-sans">
                    {wear > 0 ? `-${wear}%` : "100% Ok"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="bg-slate-950 rounded p-4 border border-slate-800 mb-4">
            <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-1 font-sans">
              <span className="w-1.5 h-3 bg-cyan-500 rounded-sm inline-block" />
              Active Station Calibration Sliders
            </h4>

            {/* Radius Slider */}
            <div className="mb-4">
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span className="text-slate-400 font-sans">Inner Radius (R_actual)</span>
                <span className="text-white font-bold">{R_act.toFixed(1)} mm <span className="text-slate-550 font-normal">/ {R_nom}mm</span></span>
              </div>
              <input
                type="range"
                min={R_nom}
                max={R_nom + 25}
                step={0.5}
                value={R_act}
                onChange={(e) => handleRadiusChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded accent-cyan-400 cursor-pointer"
                id="radius-calibration-slider"
              />
              <p className="text-[8.5px] font-mono text-slate-500 mt-0.5">
                Increase representing erosion material loss. Cavitation eats outwards.
              </p>
            </div>

            {/* Width Slider */}
            <div className="mb-4">
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span className="text-slate-400 font-sans">Flow Width (W_actual)</span>
                <span className="text-white font-bold">{W_act.toFixed(1)} mm <span className="text-slate-550 font-normal">/ {W_nom}mm</span></span>
              </div>
              <input
                type="range"
                min={W_nom}
                max={W_nom + 20}
                step={0.5}
                value={W_act}
                onChange={(e) => handleWidthChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded accent-cyan-400 cursor-pointer"
                id="width-calibration-slider"
              />
              <p className="text-[8.5px] font-mono text-slate-500 mt-0.5">
                Widening caused by cross-flow swirling cavitation.
              </p>
            </div>

            {/* Thickness Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span className="text-slate-400 font-sans">Wall Thickness (T_actual)</span>
                <span className="text-white font-bold">{T_act.toFixed(1)} mm <span className="text-slate-550 font-normal">/ {T_nom}mm</span></span>
              </div>
              <input
                type="range"
                min={8}
                max={T_nom}
                step={0.2}
                value={T_act}
                onChange={(e) => handleThicknessChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded accent-cyan-400 cursor-pointer"
                id="thickness-calibration-slider"
              />
              <p className="text-[8.5px] font-mono text-slate-500 mt-0.5">
                Current structural wall. Reaches unsafe pressure yield fatigue limit under 12.0mm.
              </p>
            </div>
          </div>
        </div>

        {/* Structural Assessment Card */}
        <div className={`p-4 rounded border ${wearBorder} ${wearBg} flex items-start gap-3`}>
          <ShieldAlert className={`w-5 h-5 flex-shrink-0 mt-0.5 ${wearColor}`} />
          <div className="text-xs font-mono">
            <h5 className={`font-bold ${wearColor} uppercase tracking-wide font-sans`}>
              Casing Structural Assessment
            </h5>
            <p className="text-slate-300 mt-1 font-sans">
              At Station <strong className="text-white">{activeStation.angle}°</strong>, localized wear has thinned the casing wall from <strong className="text-white">{T_nom}mm</strong> to <strong className="text-white">{T_act}mm</strong>.
            </p>
            <p className="text-slate-400 mt-1 text-[11px] font-sans">
              {wearPercent > 0 
                ? `This corresponds to a ${wearPercent}% structural loss. ${wearRating}`
                : "No wall loss detected. Maintaining structural class Grey Iron 30 factor of safety of 4.5."}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
