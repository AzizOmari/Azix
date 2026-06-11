/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { SimulationResult } from "../types";
import { Activity, Percent, Zap, Trash2, ShieldCheck, TrendingUp, AlertTriangle } from "lucide-react";

interface PumpPerformanceCurvesProps {
  simulationData: SimulationResult[];
  ratedFlow: number;
}

type ChartTab = "head" | "efficiency" | "power" | "losses";

export const PumpPerformanceCurves: React.FC<PumpPerformanceCurvesProps> = ({
  simulationData,
  ratedFlow
}) => {
  const [activeTab, setActiveTab] = useState<ChartTab>("head");
  const [hoveredData, setHoveredData] = useState<{
    flow: number;
    nom: number;
    dist: number;
    rep: number;
    x: number;
    yNom: number;
    yDist: number;
    yRep: number;
  } | null>(null);

  // SVG Dimension Constants
  const width = 600;
  const height = 300;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // X range is Flow (0 to 1400)
  const minFlow = 0;
  const maxFlow = 1400;

  // Y range depends on selected channel
  let minY = 0;
  let maxY = 100;
  let yUnit = "";
  let chartTitle = "";

  if (activeTab === "head") {
    maxY = 120; // 0m to 120m
    yUnit = "m";
    chartTitle = "Differential Pressure Head (H-Q Curve)";
  } else if (activeTab === "efficiency") {
    maxY = 100; // 0% to 100%
    yUnit = "%";
    chartTitle = "Overall Pump Efficiency (η-Q Curve)";
  } else if (activeTab === "power") {
    maxY = 280; // 0 kW to 280 kW
    yUnit = "kW";
    chartTitle = "Brake Shaft Power (P-Q Curve)";
  } else {
    maxY = 35; // 0 to 35m head of losses
    yUnit = "m";
    chartTitle = "1D Volute Hydraulic Loss Breakdown (Stacked)";
  }

  // Linear scaling utilities
  const getX = (flow: number) => {
    return paddingLeft + ((flow - minFlow) / (maxFlow - minFlow)) * plotWidth;
  };

  const getY = (val: number) => {
    return paddingTop + plotHeight - ((val - minY) / (maxY - minY)) * plotHeight;
  };

  // Convert SVG coordinate back to Flow
  const getFlowFromX = (xCoord: number) => {
    const rawX = (xCoord - paddingLeft) / plotWidth;
    const flow = minFlow + rawX * (maxFlow - minFlow);
    return Math.max(minFlow, Math.min(maxFlow, flow));
  };

  // Generate SVG paths lines
  const generateLinePath = (field: "Nominal" | "Distorted" | "Repaired") => {
    let pointsStr = "";
    simulationData.forEach((pt, idx) => {
      let val = 0;
      if (activeTab === "head") {
        val = field === "Nominal" ? pt.headNominal : field === "Distorted" ? pt.headDistorted : pt.headRepaired;
      } else if (activeTab === "efficiency") {
        val = field === "Nominal" ? pt.effNominal : field === "Distorted" ? pt.effDistorted : pt.effRepaired;
      } else if (activeTab === "power") {
        val = field === "Nominal" ? pt.powerNominal : field === "Distorted" ? pt.powerDistorted : pt.powerRepaired;
      }

      const x = getX(pt.flow);
      const y = getY(val);
      if (idx === 0) {
        pointsStr += `M ${x} ${y}`;
      } else {
        pointsStr += ` L ${x} ${y}`;
      }
    });
    return pointsStr;
  };

  // Stacked Loss Area Path generation
  // We stack: Friction (bottom) + Shock (middle) + Other/Recirculation (top)
  const getStackedLossPaths = () => {
    // We render the "Distorted" state losses to highlight the dynamic degradation
    const frictionPoints: string[] = [];
    const shockPoints: string[] = [];
    const otherPoints: string[] = [];

    simulationData.forEach((pt) => {
      const x = getX(pt.flow);
      
      const frictionVal = pt.lossesDistorted.friction;
      const shockVal = frictionVal + pt.lossesDistorted.shock;
      const totalVal = shockVal + pt.lossesDistorted.diskFriction; // diskFriction acts as recirc here

      frictionPoints.push(`${x},${getY(frictionVal)}`);
      shockPoints.push(`${x},${getY(shockVal)}`);
      otherPoints.push(`${x},${getY(totalVal)}`);
    });

    // Create solid closed areas for SVG filling
    const startX = getX(minFlow);
    const endX = getX(maxFlow);
    const bottomY = getY(0);

    const pathFriction = `M ${startX} ${bottomY} L ${frictionPoints.join(" L ")} L ${endX} ${bottomY} Z`;
    
    // Shock connects to friction top line
    const pathShockBack = [...frictionPoints].reverse();
    const pathShock = `M ${startX} ${getY(simulationData[0].lossesDistorted.friction)} L ${shockPoints.join(" L ")} L ${endX} ${getY(simulationData[simulationData.length-1].lossesDistorted.friction)} L ${pathShockBack.join(" L ")} Z`;

    // Recirc connects to shock top line
    const pathShockBack2 = [...shockPoints].reverse();
    const pathRecirc = `M ${startX} ${getY(simulationData[0].lossesDistorted.friction + simulationData[0].lossesDistorted.shock)} L ${otherPoints.join(" L ")} L ${endX} ${getY(simulationData[simulationData.length-1].lossesDistorted.friction + simulationData[simulationData.length - 1].lossesDistorted.shock)} L ${pathShockBack2.join(" L ")} Z`;

    return { pathFriction, pathShock, pathRecirc };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    if (cursorX < paddingLeft || cursorX > width - paddingRight) {
      setHoveredData(null);
      return;
    }

    const flow = getFlowFromX(cursorX);
    
    // Find closest data index from simulationData (binary or linear search)
    let closestPt = simulationData[0];
    let minDiff = Infinity;
    simulationData.forEach(pt => {
      const diff = Math.abs(pt.flow - flow);
      if (diff < minDiff) {
        minDiff = diff;
        closestPt = pt;
      }
    });

    let valNom = 0, valDist = 0, valRep = 0;
    if (activeTab === "head") {
      valNom = closestPt.headNominal;
      valDist = closestPt.headDistorted;
      valRep = closestPt.headRepaired;
    } else if (activeTab === "efficiency") {
      valNom = closestPt.effNominal;
      valDist = closestPt.effDistorted;
      valRep = closestPt.effRepaired;
    } else if (activeTab === "power") {
      valNom = closestPt.powerNominal;
      valDist = closestPt.powerDistorted;
      valRep = closestPt.powerRepaired;
    } else {
      // Losses total
      valNom = closestPt.lossesNominal.friction + closestPt.lossesNominal.shock;
      valDist = closestPt.lossesDistorted.friction + closestPt.lossesDistorted.shock + closestPt.lossesDistorted.diskFriction;
      valRep = closestPt.lossesNominal.friction * 1.15; // approximate repaired losses
    }

    setHoveredData({
      flow: closestPt.flow,
      nom: valNom,
      dist: valDist,
      rep: valRep,
      x: getX(closestPt.flow),
      yNom: getY(valNom),
      yDist: getY(valDist),
      yRep: getY(valRep)
    });
  };

  const handleMouseLeave = () => {
    setHoveredData(null);
  };

  // Calculate the average loss penalty around Best Efficiency Point (BEP = 800 m3/h)
  const bepData = simulationData.find(pt => pt.flow === ratedFlow);
  const headLossKw = bepData ? Math.round((bepData.powerDistorted - bepData.powerNominal) * 10) / 10 : 0;
  const effDropPercent = bepData ? Math.round((bepData.effNominal - bepData.effDistorted) * 10) / 10 : 0;

  // Grid tick markers
  const xTicks = [0, 200, 400, 600, 800, 1000, 1200, 1400];
  const yTicks = activeTab === "head" 
    ? [0, 20, 40, 60, 80, 100, 120] 
    : activeTab === "efficiency" 
    ? [0, 20, 40, 60, 80, 100] 
    : activeTab === "power" 
    ? [0, 50, 100, 150, 200, 250]
    : [0, 5, 10, 15, 20, 25, 30, 35];

  const stackedPaths = activeTab === "losses" ? getStackedLossPaths() : null;

  return (
    <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-full">
      {/* HEADER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Hydraulic Simulation Curves
          </h3>
        </div>

        {/* Dynamic Selector Tabs */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("head")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono tracking-wider transition-all ${
              activeTab === "head" ? "bg-indigo-650 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Head H-Q</span>
          </button>
          <button
            onClick={() => setActiveTab("efficiency")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono tracking-wider transition-all ${
              activeTab === "efficiency" ? "bg-indigo-650 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Eff η-Q</span>
          </button>
          <button
            onClick={() => setActiveTab("power")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono tracking-wider transition-all ${
              activeTab === "power" ? "bg-indigo-650 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Power P-Q</span>
          </button>
          <button
            onClick={() => setActiveTab("losses")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono tracking-wider transition-all ${
              activeTab === "losses" ? "bg-indigo-650 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>1D Losses</span>
          </button>
        </div>
      </div>

      <div className="text-[11px] font-mono text-slate-400 mb-3 bg-slate-900/40 border border-slate-800/60 p-2 rounded-lg flex items-center justify-between">
        <span>Casing Condition: <strong className="text-red-400">Distorted (Eroded Pattern)</strong> vs <strong className="text-emerald-400">Original Blueprint</strong></span>
        <span className="text-sky-400 font-bold uppercase text-[10px]">Patterson 12X8MAA @ 1750 RPM</span>
      </div>

      {/* PLOT AREA */}
      <div className="relative flex-1 bg-slate-950/80 rounded-xl border border-slate-800 p-1 flex items-center justify-center min-h-[220px]">
        <svg
          className="w-full h-full min-h-[220px]"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Chart Grid Lines */}
          {xTicks.map((x) => (
            <g key={`x-grid-${x}`}>
              <line
                x1={getX(x)}
                y1={paddingTop}
                x2={getX(x)}
                y2={paddingTop + plotHeight}
                stroke="rgba(148, 163, 184, 0.08)"
                strokeDasharray="2,2"
              />
              <text
                x={getX(x)}
                y={paddingTop + plotHeight + 15}
                textAnchor="middle"
                className="text-[9px] font-mono fill-slate-500"
              >
                {x}
              </text>
            </g>
          ))}

          {yTicks.map((y) => (
            <g key={`y-grid-${y}`}>
              <line
                x1={paddingLeft}
                y1={getY(y)}
                x2={width - paddingRight}
                y2={getY(y)}
                stroke="rgba(148, 163, 184, 0.08)"
                strokeDasharray="2,2"
              />
              <text
                x={paddingLeft - 10}
                y={getY(y) + 3}
                textAnchor="end"
                className="text-[9px] font-mono fill-slate-500"
              >
                {y}
              </text>
            </g>
          ))}

          {/* Rated flow boundary marker line (800 m3/h BEP) */}
          <line
            x1={getX(ratedFlow)}
            y1={paddingTop}
            x2={getX(ratedFlow)}
            y2={paddingTop + plotHeight}
            stroke="rgba(99, 102, 241, 0.35)"
            strokeWidth="1.2"
            strokeDasharray="5,3"
          />
          <text
            x={getX(ratedFlow) + 5}
            y={paddingTop + 14}
            className="text-[8px] font-bold font-mono fill-indigo-400"
          >
            BEP POINT (800 m³/h)
          </text>

          {/* RENDERING PLOTS BASED ON TAB */}
          {activeTab !== "losses" ? (
            <>
              {/* NOMINAL CURVE (GREEN) */}
              <path
                d={generateLinePath("Nominal")}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
              {/* REPAIRED CURVE (CYAN) */}
              <path
                d={generateLinePath("Repaired")}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="4,2"
                className="transition-all duration-300"
              />
              {/* DISTORTED CURVE (RED) */}
              <path
                d={generateLinePath("Distorted")}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="3.0"
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </>
          ) : (
            // Losses area stacks
            stackedPaths && (
              <g className="opacity-80 transition-all duration-500">
                {/* 1. Friction loss section (yellow) */}
                <path d={stackedPaths.pathFriction} fill="rgba(245, 158, 11, 0.35)" stroke="#f59e0b" strokeWidth="0.8" />
                {/* 2. Shock mixing loss section (red) */}
                <path d={stackedPaths.pathShock} fill="rgba(244, 63, 94, 0.3)" stroke="#f43f5e" strokeWidth="0.8" />
                {/* 3. Recirculation loss segment (purple) */}
                <path d={stackedPaths.pathRecirc} fill="rgba(139, 92, 246, 0.25)" stroke="#8b5cf6" strokeWidth="0.8" />
              </g>
            )
          )}

          {/* CROSSHAIR HOVER CURSOR TRACKER */}
          {hoveredData && (
            <g>
              <line
                x1={hoveredData.x}
                y1={paddingTop}
                x2={hoveredData.x}
                y2={paddingTop + plotHeight}
                stroke="rgba(255, 255, 255, 0.35)"
                strokeWidth="1"
                strokeDasharray="1,1"
              />
              
              {activeTab !== "losses" ? (
                <>
                  {/* Point circles over curves */}
                  <circle cx={hoveredData.x} cy={hoveredData.yNom} r="4" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
                  <circle cx={hoveredData.x} cy={hoveredData.yDist} r="5" fill="#f43f5e" stroke="#0f172a" strokeWidth="1.5" />
                  <circle cx={hoveredData.x} cy={hoveredData.yRep} r="4" fill="#06b6d4" stroke="#0f172a" strokeWidth="1.5" />
                </>
              ) : (
                <circle cx={hoveredData.x} cy={hoveredData.yDist} r="5" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.5" />
              )}
            </g>
          )}

          {/* Border lines around plot box */}
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + plotHeight} stroke="rgba(148, 163, 184, 0.3)" strokeWidth="1" />
          <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={width - paddingRight} y2={paddingTop + plotHeight} stroke="rgba(148, 163, 184, 0.3)" strokeWidth="1" />
        </svg>

        {/* Hover Crosshair detail values window */}
        {hoveredData && (
          <div className="absolute top-4 left-4 bg-slate-900/95 border border-slate-700 px-3 py-2 rounded-lg text-[10px] font-mono text-slate-200 shadow-md">
            <p className="border-b border-slate-800 pb-1 mb-1 font-bold text-slate-300">Capacity: {hoveredData.flow} m³/h</p>
            {activeTab !== "losses" ? (
              <div className="space-y-0.5">
                <p className="flex justify-between gap-4">
                  <span className="text-emerald-400">Blueprint Nom:</span>
                  <strong>{hoveredData.nom.toFixed(1)} {yUnit}</strong>
                </p>
                <p className="flex justify-between gap-4">
                  <span className="text-rose-400">Distorted Actual:</span>
                  <strong>{hoveredData.dist.toFixed(1)} {yUnit}</strong>
                </p>
                <p className="flex justify-between gap-4">
                  <span className="text-cyan-400">Lined Repaired:</span>
                  <strong>{hoveredData.rep.toFixed(1)} {yUnit}</strong>
                </p>
                <p className="text-rose-400 border-t border-slate-850 mt-1 pt-1 font-semibold">
                  Degradation: -{Math.abs(hoveredData.nom - hoveredData.dist).toFixed(1)} {yUnit}
                </p>
              </div>
            ) : (
              <div>
                <p className="flex justify-between gap-4 text-amber-400">
                  <span>Volute Losses:</span>
                  <strong>{hoveredData.dist.toFixed(1)} {yUnit}</strong>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER METRICS AND LEGEND */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-800/80 pt-4">
        
        {/* Dynamic Legend */}
        <div className="flex flex-col space-y-2 justify-center bg-slate-950 p-3 rounded-xl border border-slate-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Legend Keys</span>
          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-1.5 bg-emerald-500 rounded" />
              <span className="text-[10.5px] text-slate-300 font-mono">Blueprint</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-1.5 bg-rose-500 rounded" />
              <span className="text-[10.5px] text-slate-300 font-mono">Distorted</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-1.5 border-t-2 border-dashed border-cyan-400" />
              <span className="text-[10.5px] text-slate-300 font-mono">Repaired</span>
            </div>
          </div>
        </div>

        {/* BEP Performance drop alert */}
        <div className="md:col-span-2 flex items-center justify-between p-3 bg-[#111625] rounded-xl border border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-rose-500/15 rounded border border-rose-500/30 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-xs font-mono">
              <h4 className="font-bold text-slate-200">Best Efficiency Point Loss</h4>
              <p className="text-rose-400 font-semibold mt-0.5">
                Efficiency down by {effDropPercent}%  | Excess power: +{headLossKw} kW
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block text-[10px] font-mono text-slate-500">
            Based on 1D pump hydraulics<br />and Patterson 12X8MAA data
          </div>
        </div>

      </div>
    </div>
  );
};
