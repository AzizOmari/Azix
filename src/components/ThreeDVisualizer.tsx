/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from "react";
import { StationMeasurement } from "../types";
import { Rotate3d, ZoomIn, ZoomOut, Compass, Eye, Server, RefreshCw } from "lucide-react";

interface ThreeDVisualizerProps {
  stations: StationMeasurement[];
  baseCircleDiameter: number;
}

export const ThreeDVisualizer: React.FC<ThreeDVisualizerProps> = ({
  stations,
  baseCircleDiameter
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotX, setRotX] = useState<number>(-0.6); // radians
  const [rotY, setRotY] = useState<number>(0.7);  // radians
  const [zoom, setZoom] = useState<number>(0.55);
  const [renderMode, setRenderMode] = useState<"solid" | "wireframe" | "velocity">("solid");
  const [showImpeller, setShowImpeller] = useState<boolean>(true);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  
  const isDragging = useRef<boolean>(false);
  const previousMousePosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Auto-spin option
  const [autoSpin, setAutoSpin] = useState<boolean>(false);

  useEffect(() => {
    let animationFrameId: number;
    if (autoSpin) {
      const tick = () => {
        setRotY(prev => (prev + 0.005) % (Math.PI * 2));
        animationFrameId = requestAnimationFrame(tick);
      };
      animationFrameId = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [autoSpin]);

  // Redraw canvas whenever points or settings change
  useEffect(() => {
    draw3D();
  }, [stations, rotX, rotY, zoom, renderMode, showImpeller, baseCircleDiameter]);

  const draw3D = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Smooth scaling for high-DPI displays
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const cx = width / 2;
    const cy = height / 2;

    // Clear background with an elegant dark engineering blueprint grid
    ctx.fillStyle = "#0c1017"; // Slate dark
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = "rgba(43, 85, 133, 0.08)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Circular ticks representing radial scales
    ctx.strokeStyle = "rgba(43, 85, 133, 0.15)";
    ctx.lineWidth = 1;
    [100, 200, 300, 400].forEach(r => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * zoom, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 3D Engine Projection helper
    const project = (x: number, y: number, z: number) => {
      // Rotate around Y-axis
      let x1 = x * Math.cos(rotY) - z * Math.sin(rotY);
      let z1 = x * Math.sin(rotY) + z * Math.cos(rotY);

      // Rotate around X-axis
      let y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
      let z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);

      // Simple orthographic projection
      return {
        x: cx + x1 * zoom,
        y: cy - y2 * zoom,
        zDepth: z2 // for sorting
      };
    };

    // Calculate 3D polygons of the volute spiral
    // The volute will be divided into finer angular segments for rendering
    const segments: {
      vertices: { x: number; y: number; z: number }[];
      color: string;
      outlineColor: string;
      avgZ: number;
      type: "volute" | "impeller" | "axis" | "velocity";
      meta?: any;
    }[] = [];

    // Base circle (Impeller outer shroud)
    const d3_radius = baseCircleDiameter / 2;
    const r2_radius = d3_radius - 7.5; // Impeller radius

    // 1. Generate Impeller 3D disc representation if enabled
    if (showImpeller) {
      const impSegments = 24;
      const b2 = 38; // Width
      const verticesImpTop: { x: number; y: number; z: number }[] = [];
      const verticesImpBot: { x: number; y: number; z: number }[] = [];

      for (let i = 0; i <= impSegments; i++) {
        const phi = (i / impSegments) * Math.PI * 2;
        const xT = r2_radius * Math.cos(phi);
        const yT = r2_radius * Math.sin(phi);
        verticesImpTop.push({ x: xT, y: yT, z: b2 / 2 });
        verticesImpBot.push({ x: xT, y: yT, z: -b2 / 2 });
      }

      // Add Impeller hub top face
      segments.push({
        vertices: verticesImpTop,
        color: "rgba(224, 130, 68, 0.25)", // Copper tint
        outlineColor: "rgba(224, 130, 68, 0.5)",
        avgZ: verticesImpTop.reduce((sum, v) => sum + v.z, 0) / verticesImpTop.length,
        type: "impeller"
      });

      // Add impeller blades inside (simple radial lines to give volumetric visual cue)
      for (let i = 0; i < 6; i++) {
        const phi = (i / 6) * Math.PI * 2;
        segments.push({
          vertices: [
            { x: 0, y: 0, z: b2 / 2 },
            { x: r2_radius * Math.cos(phi), y: r2_radius * Math.sin(phi), z: b2 / 2 },
            { x: r2_radius * Math.cos(phi + 0.3), y: r2_radius * Math.sin(phi + 0.3), z: -b2 / 2 },
            { x: 0, y: 0, z: -b2 / 2 }
          ],
          color: "rgba(224, 130, 68, 0.15)",
          outlineColor: "rgba(224, 130, 68, 0.4)",
          avgZ: 0,
          type: "impeller"
        });
      }
    }

    // 2. Build Volute Spiral polygons
    // To construct the continuous volute mesh, we interpolate between measured stations (0, 45, 90, ... 360)
    const numSteps = 40;
    const interpolatedPoints: {
      angle: number;
      actualRadius: number;
      nominalRadius: number;
      actualWidth: number;
      nominalWidth: number;
      thickness: number;
    }[] = [];

    for (let i = 0; i <= numSteps; i++) {
      const ang = (i / numSteps) * 360;
      // Find bounding stations
      let sStart = stations[0];
      let sEnd = stations[stations.length - 1];
      for (let j = 0; j < stations.length - 1; j++) {
        if (ang >= stations[j].angle && ang <= stations[j + 1].angle) {
          sStart = stations[j];
          sEnd = stations[j + 1];
          break;
        }
      }

      const t = (ang - sStart.angle) / (sEnd.angle - sStart.angle || 1);
      
      const r_actual = sStart.actualRadius + (sEnd.actualRadius - sStart.actualRadius) * t;
      const r_nominal = sStart.nominalRadius + (sEnd.nominalRadius - sStart.nominalRadius) * t;
      const w_actual = sStart.actualWidth + (sEnd.actualWidth - sStart.actualWidth) * t;
      const w_nominal = sStart.nominalWidth + (sEnd.nominalWidth - sStart.nominalWidth) * t;
      const thickness = sStart.actualThickness + (sEnd.actualThickness - sStart.actualThickness) * t;

      interpolatedPoints.push({
        angle: ang,
        actualRadius: r_actual,
        nominalRadius: r_nominal,
        actualWidth: w_actual,
        nominalWidth: w_nominal,
        thickness
      });
    }

    // Loop through interpolated points to build faces
    for (let i = 0; i < interpolatedPoints.length - 1; i++) {
      const p1 = interpolatedPoints[i];
      const p2 = interpolatedPoints[i + 1];

      const rad1 = (p1.angle * Math.PI) / 180;
      const rad2 = (p2.angle * Math.PI) / 180;

      // Outer wall coordinates
      const x1_out = p1.actualRadius * Math.cos(rad1);
      const y1_out = p1.actualRadius * Math.sin(rad1);
      const x2_out = p2.actualRadius * Math.cos(rad2);
      const y2_out = p2.actualRadius * Math.sin(rad2);

      // Inner wall coordinates (base circle d3)
      const x1_in = d3_radius * Math.cos(rad1);
      const y1_in = d3_radius * Math.sin(rad1);
      const x2_in = d3_radius * Math.cos(rad2);
      const y2_in = d3_radius * Math.sin(rad2);

      // Calculate localized thickness color indicating erosion levels
      // Nominal casing thickness is 18. Severe wear thins it toward 10.
      const thickRatio = p1.thickness / 18;
      let color = "rgba(16, 185, 129, 0.5)"; // Green (Good)
      let outlineColor = "rgba(16, 185, 129, 0.8)";
      
      if (thickRatio < 0.70) {
        // Red (Under 12.6mm - CRITICAL DANGER ZONE)
        color = "rgba(239, 68, 68, 0.6)"; 
        outlineColor = "rgba(239, 68, 68, 0.9)";
      } else if (thickRatio < 0.85) {
        // Yellow/Orange Warning (12.6 - 15.3mm)
        color = "rgba(245, 158, 11, 0.55)"; 
        outlineColor = "rgba(245, 158, 11, 0.85)";
      }

      // If velocity model, color corresponds to fluid velocity magnitude
      // Lower area = Higher velocity. Highly distorted narrow channels show high velocity separation risks
      if (renderMode === "velocity") {
        const areaRatio = p1.actualWidth * p1.actualRadius / (p1.nominalWidth * p1.nominalRadius);
        if (areaRatio < 0.85) {
          color = "rgba(239, 68, 68, 0.6)"; // Red, high-vorticity localized velocity choke
          outlineColor = "rgba(239, 68, 68, 0.9)";
        } else if (areaRatio > 1.15) {
          color = "rgba(59, 130, 246, 0.55)"; // Blue, localized flow separation / stagnant recirculation
          outlineColor = "rgba(59, 130, 246, 0.85)";
        } else {
          color = "rgba(16, 185, 129, 0.5)"; // Emerald green, stable uniform fluid channel velocity
          outlineColor = "rgba(16, 185, 129, 0.8)";
        }
      }

      const halfW1 = p1.actualWidth / 2;
      const halfW2 = p2.actualWidth / 2;

      // Outer wrapper boundary faces (Top curve, bottom curve, and front curves)
      // Face A: Front outer wall (Positive Z)
      segments.push({
        vertices: [
          { x: x1_out, y: y1_out, z: halfW1 },
          { x: x2_out, y: y2_out, z: halfW2 },
          { x: x2_out, y: y2_out, z: -halfW2 },
          { x: x1_out, y: y1_out, z: -halfW1 }
        ],
        color,
        outlineColor,
        avgZ: (project(x1_out, y1_out, halfW1).zDepth + project(x2_out, y2_out, -halfW2).zDepth) / 2,
        type: "volute"
      });

      // Face B: Outer spiral flat top (positive width side)
      segments.push({
        vertices: [
          { x: x1_in, y: y1_in, z: halfW1 },
          { x: x2_in, y: y2_in, z: halfW2 },
          { x: x2_out, y: y2_out, z: halfW2 },
          { x: x1_out, y: y1_out, z: halfW1 }
        ],
        color: renderMode === "wireframe" ? "transparent" : "rgba(30, 58, 138, 0.22)",
        outlineColor: outlineColor,
        avgZ: (project(x1_in, y1_in, halfW1).zDepth + project(x2_out, y2_out, halfW2).zDepth) / 2,
        type: "volute"
      });

      // Face C: Outer spiral flat bottom (negative width side)
      segments.push({
        vertices: [
          { x: x1_in, y: y1_in, z: -halfW1 },
          { x: x2_in, y: y2_in, z: -halfW2 },
          { x: x2_out, y: y2_out, z: -halfW2 },
          { x: x1_out, y: y1_out, z: -halfW1 }
        ],
        color: renderMode === "wireframe" ? "transparent" : "rgba(30, 58, 138, 0.22)",
        outlineColor: outlineColor,
        avgZ: (project(x1_in, y1_in, -halfW1).zDepth + project(x2_out, y2_out, -halfW2).zDepth) / 2,
        type: "volute"
      });

      // Flow direction arrows for Velocity mode
      if (renderMode === "velocity" && i % 4 === 0) {
        // Unit vectors for drawing arrows
        const midAng = ((p1.angle + p2.angle) / 2) * Math.PI / 180;
        const arrowR = (p1.actualRadius + d3_radius) / 2;
        // Tangent unit vector
        const tx = -Math.sin(midAng);
        const ty = Math.cos(midAng);

        segments.push({
          vertices: [
            { x: arrowR * Math.cos(midAng), y: arrowR * Math.sin(midAng), z: 0 },
            { x: arrowR * Math.cos(midAng) + tx * 35, y: arrowR * Math.sin(midAng) + ty * 35, z: 0 }
          ],
          color: "rgba(251, 146, 60, 0.95)", // vivid neon orange arrow
          outlineColor: "rgba(251, 146, 60, 0.95)",
          avgZ: 9999, // Render on top
          type: "velocity"
        });
      }
    }

    // 3. Add global XYZ Axes indicator inside the CAD block
    const axesLen = 80;
    segments.push({
      vertices: [{ x: 0, y: 0, z: 0 }, { x: axesLen, y: 0, z: 0 }],
      color: "#ef4444", // X (Red)
      outlineColor: "#ef4444",
      avgZ: 10000,
      type: "axis",
      meta: "X (Radial)"
    });
    segments.push({
      vertices: [{ x: 0, y: 0, z: 0 }, { x: 0, y: axesLen, z: 0 }],
      color: "#10b981", // Y (Green)
      outlineColor: "#10b981",
      avgZ: 10000,
      type: "axis",
      meta: "Y (Vertical)"
    });
    segments.push({
      vertices: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: axesLen }],
      color: "#3b82f6", // Z (Blue)
      outlineColor: "#3b82f6",
      avgZ: 10000,
      type: "axis",
      meta: "Z (Width)"
    });

    // Sort segments back-to-front (Painters Algorithm for core 3D realism)
    segments.sort((a, b) => b.avgZ - a.avgZ);

    // Draw all elements
    segments.forEach(seg => {
      if (seg.type === "axis") {
        const start = project(seg.vertices[0].x, seg.vertices[0].y, seg.vertices[0].z);
        const end = project(seg.vertices[1].x, seg.vertices[1].y, seg.vertices[1].z);
        ctx.beginPath();
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = 3;
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Draw variable label
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = seg.color;
        ctx.fillText(seg.meta, end.x + 4, end.y + 4);
        return;
      }

      if (seg.type === "velocity") {
        const start = project(seg.vertices[0].x, seg.vertices[0].y, seg.vertices[0].z);
        const end = project(seg.vertices[1].x, seg.vertices[1].y, seg.vertices[1].z);
        
        ctx.beginPath();
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = 2.5;
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        ctx.beginPath();
        ctx.fillStyle = seg.color;
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - 7 * Math.cos(angle - Math.PI/6), end.y - 7 * Math.sin(angle - Math.PI/6));
        ctx.lineTo(end.x - 7 * Math.cos(angle + Math.PI/6), end.y - 7 * Math.sin(angle + Math.PI/6));
        ctx.closePath();
        ctx.fill();
        return;
      }

      // Standard polygons projection
      ctx.beginPath();
      const first = project(seg.vertices[0].x, seg.vertices[0].y, seg.vertices[0].z);
      ctx.moveTo(first.x, first.y);
      for (let j = 1; j < seg.vertices.length; j++) {
        const p = project(seg.vertices[j].x, seg.vertices[j].y, seg.vertices[j].z);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      // Color Filling
      if (renderMode === "solid" || renderMode === "velocity") {
        ctx.fillStyle = seg.color;
        ctx.fill();
      } else if (renderMode === "wireframe") {
        ctx.fillStyle = "rgba(12, 16, 23, 0.4)";
        ctx.fill();
      }

      // Border lines
      ctx.strokeStyle = seg.outlineColor;
      ctx.lineWidth = renderMode === "wireframe" ? 1.0 : 0.6;
      ctx.stroke();
    });

    // Overlay technical statistics inside canvas
    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillText("Model Projection Isometric - Patterson 12X8MAA", 15, 25);
    ctx.fillText(`RotX: ${(rotX * 180 / Math.PI).toFixed(0)}°  RotY: ${(rotY * 180 / Math.PI).toFixed(0)}°`, 15, 42);
    ctx.fillText(`Isometric Scale: ${(zoom * 100).toFixed(0)}%`, 15, 59);

    // Dynamic legend
    const legX = width - 120;
    const legY = height - 90;
    ctx.fillStyle = "rgba(12, 16, 23, 0.8)";
    ctx.strokeStyle = "rgba(43, 85, 133, 0.3)";
    ctx.lineWidth = 1;
    ctx.fillRect(legX - 10, legY - 15, 120, 85);
    ctx.strokeRect(legX - 10, legY - 15, 120, 85);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText(renderMode === "velocity" ? "Velocity Choke" : "Wall Integrity", legX, legY);

    // Key bars
    const colors = renderMode === "velocity" 
      ? ["#ef4444", "#10b981", "#3b82f6"] // High, Normal, Recirc
      : ["#10b981", "#f59e0b", "#ef4444"]; // Good, Warning, Danger
    
    const labels = renderMode === "velocity"
      ? ["High (>13 m/s)", "Nominal (9 m/s)", "Low (<4 m/s)"]
      : ["18mm (Factory)", "14mm (Wear)", "<12.5mm (Alert)"];

    colors.forEach((col, idx) => {
      ctx.fillStyle = col;
      ctx.fillRect(legX, legY + 12 + idx * 18, 12, 10);
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.font = "8px ui-monospace, monospace; font-medium";
      ctx.fillText(labels[idx], legX + 18, legY + 20 + idx * 18);
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
    setIsRotating(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    setRotY(prevY => (prevY + deltaX * 0.007) % (Math.PI * 2));
    setRotX(prevX => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, prevX + deltaY * 0.007)));

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
    setIsRotating(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0c1017] border border-[#1e293b] rounded-xl overflow-hidden shadow-2xl">
      {/* Control overlay */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-[#111827] border-b border-[#1e293b]">
        <div className="flex items-center space-x-2">
          <Rotate3d className="w-5 h-5 text-emerald-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Spiral Casing 3D Render
          </h4>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setRenderMode("solid")}
            className={`px-2.5 py-1 text-[10px] font-mono rounded uppercase tracking-wider border transition-all ${
              renderMode === "solid"
                ? "bg-emerald-555/20 border-emerald-500 text-emerald-400 font-bold"
                : "border-[#1e293b] text-slate-400 hover:text-slate-200"
            }`}
            title="Color matches metal wall thickness"
          >
            Material Integrity
          </button>
          <button
            onClick={() => setRenderMode("wireframe")}
            className={`px-2.5 py-1 text-[10px] font-mono rounded uppercase tracking-wider border transition-all ${
              renderMode === "wireframe"
                ? "bg-emerald-555/20 border-emerald-500 text-emerald-400 font-bold"
                : "border-[#1e293b] text-slate-400 hover:text-slate-200"
            }`}
          >
            CAD Wireframe
          </button>
          <button
            onClick={() => setRenderMode("velocity")}
            className={`px-2.5 py-1 text-[10px] font-mono rounded uppercase tracking-wider border transition-all ${
              renderMode === "velocity"
                ? "bg-emerald-555/20 border-emerald-500 text-emerald-400 font-bold"
                : "border-[#1e293b] text-slate-400 hover:text-slate-200"
            }`}
            title="Colors match CFD modeling velocities"
          >
            Flow Velocities
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[400px]">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* Quick Zoom/Rotation buttons inside view */}
        <div className="absolute bottom-4 left-4 flex flex-col space-y-2">
          <button
            onClick={() => setZoom(prev => Math.min(1.2, prev + 0.05))}
            className="p-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-white rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.2, prev - 0.05))}
            className="p-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-white rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setRotX(-0.6);
              setRotY(0.7);
              setZoom(0.55);
            }}
            className="p-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-white rounded transition-colors"
            title="Reset View"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>

        {/* Controls block (Bottom right inside view) */}
        <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-[#0f172a]/95 border border-[#334155] px-3 py-1.5 rounded-lg text-slate-300 text-[10px] font-mono">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showImpeller}
              onChange={(e) => setShowImpeller(e.target.checked)}
              className="accent-emerald-500 rounded border-slate-700 bg-slate-800 focus:ring-emerald-500"
            />
            <span className="select-none font-semibold">Render Impeller Shroud</span>
          </label>
          <div className="w-[1px] h-3 bg-slate-700 mx-1" />
          <button
            onClick={() => setAutoSpin(!autoSpin)}
            className={`flex items-center space-x-1 px-1.5 py-0.5 rounded transition ${
              autoSpin ? "text-emerald-400 font-bold bg-[#1e293b]" : "text-slate-400 hover:text-white"
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${autoSpin ? "animate-spin" : ""}`} />
            <span>Auto Spin</span>
          </button>
        </div>

        {isRotating && (
          <div className="absolute top-4 right-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-mono animate-pulse">
            ORBIT ROTATION ACTIVE
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 bg-[#0b0f19] border-t border-[#1e293b] text-[10px] text-slate-400 flex justify-between items-center select-none">
        <span>🖱️ Drag to rotate  |  Scroll context to zoom</span>
        <span className="text-slate-500">Patterson 12X8MAA Volute Mesh</span>
      </div>
    </div>
  );
};
