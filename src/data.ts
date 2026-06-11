/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PumpParameters, StationMeasurement, SimulationResult } from "./types";

// Design specifications for Patterson 12X8MAA
export const PATTERSON_12X8MAA_DEFAULTS: PumpParameters = {
  model: "Patterson 12X8MAA",
  speedRpm: 1750,
  ratedFlow: 800, // m³/h
  impellerDiameter: 470, // mm
  impellerWidth: 38, // b2, mm
  casingMaterial: "Cast Iron Grade 30",
  liquidMedia: "Water (Industrial Waste)",
  fluidDensity: 1000, // kg/m³
  viscosityCst: 1.0, // cSt
  baseCircleDiameter: 485, // d3, mm (gives ~ radical clearance of 7.5mm to 470mm impeller)
  tongueAngle: 45, // starting angle of cutwater in degrees
  dischargeDiameter: 203, // 8" nominal, mm
  suctionDiameter: 305, // 12" nominal, mm
};

// Initial blueprint station coordinates for Patterson 12X8MAA
// Angular stations around 360 degrees
export const INITIAL_BLUEPRINT_STATIONS: StationMeasurement[] = [
  { angle: 0, nominalRadius: 245.0, actualRadius: 245.0, nominalWidth: 54.0, actualWidth: 54.0, nominalThickness: 18.0, actualThickness: 18.0 },
  { angle: 45, nominalRadius: 251.5, actualRadius: 251.5, nominalWidth: 54.0, actualWidth: 54.0, nominalThickness: 18.0, actualThickness: 18.0 },
  { angle: 90, nominalRadius: 260.0, actualRadius: 260.0, nominalWidth: 56.5, actualWidth: 56.5, nominalThickness: 18.0, actualThickness: 18.0 },
  { angle: 135, nominalRadius: 271.0, actualRadius: 271.0, nominalWidth: 60.0, actualWidth: 60.0, nominalThickness: 18.0, actualThickness: 18.0 },
  { angle: 180, nominalRadius: 284.0, actualRadius: 284.0, nominalWidth: 65.0, actualWidth: 65.0, nominalThickness: 18.0, actualThickness: 18.0 },
  { angle: 225, nominalRadius: 299.5, actualRadius: 299.5, nominalWidth: 71.5, actualWidth: 71.5, nominalThickness: 18.0, actualThickness: 18.0 },
  { angle: 270, nominalRadius: 317.0, actualRadius: 317.0, nominalWidth: 79.0, actualWidth: 79.0, nominalThickness: 18.0, actualThickness: 18.0 },
  { angle: 315, nominalRadius: 337.0, actualRadius: 337.0, nominalWidth: 88.0, actualWidth: 88.0, nominalThickness: 18.0, actualThickness: 18.0 },
  { angle: 360, nominalRadius: 360.0, actualRadius: 360.0, nominalWidth: 98.0, actualWidth: 98.0, nominalThickness: 18.0, actualThickness: 18.0 },
];

// Presets representing real-world industrial asset degradation states:
export const DISTORTION_PRESETS = [
  {
    name: "Nominal Blueprint (As-Built)",
    description: "Factory original condition. Maximum pressure recovery, minimized friction loss, designed 18mm wall integrity.",
    modify: (stations: StationMeasurement[]): StationMeasurement[] => {
      return stations.map(s => ({
        ...s,
        actualRadius: s.nominalRadius,
        actualWidth: s.nominalWidth,
        actualThickness: s.nominalThickness
      }));
    }
  },
  {
    name: "Localized Cavitation (Tongue & Throat)",
    description: "High-velocity collapse pitting localized near the Cutwater Cut-off (0° - 45°) and Diffuser Inlet. Wall structural loss of 35% with pitting depth up to 6mm.",
    modify: (stations: StationMeasurement[]): StationMeasurement[] => {
      return stations.map(s => {
        if (s.angle <= 45 || s.angle >= 315) {
          const distortionFactor = s.angle === 0 ? 1.05 : 1.03;
          return {
            ...s,
            actualRadius: Math.round(s.nominalRadius * distortionFactor * 10) / 10,
            actualWidth: Math.round(s.nominalWidth * distortionFactor * 10) / 10,
            actualThickness: Math.round(s.nominalThickness * 0.65 * 10) / 10
          };
        }
        return { ...s, actualRadius: s.nominalRadius, actualWidth: s.nominalWidth, actualThickness: s.nominalThickness };
      });
    }
  },
  {
    name: "Abrasive Slurry Erosion (Severe Outer Wall)",
    description: "Silt erosion centered on path-of-maximum centrifugal impact (135° to 270°). Channel widened by 8-10%, wall thinned critically down to 10.5mm.",
    modify: (stations: StationMeasurement[]): StationMeasurement[] => {
      return stations.map(s => {
        if (s.angle >= 90 && s.angle <= 270) {
          const mult = s.angle === 180 ? 1.08 : 1.05;
          return {
            ...s,
            actualRadius: Math.round(s.nominalRadius * mult * 10) / 10,
            actualWidth: Math.round(s.nominalWidth * mult * 10) / 10,
            actualThickness: Math.round(s.nominalThickness * 0.58 * 10) / 10
          };
        }
        return { ...s, actualRadius: s.nominalRadius, actualWidth: s.nominalWidth, actualThickness: s.nominalThickness };
      });
    }
  },
  {
    name: "Acid Corrosion (Uniform High-Roughness Decay)",
    description: "Uniform wall depletion from corrosive slurry chemistry. Decreases casing wall average to 13mm while escalating surface roughness by 300% (causing high friction losses).",
    modify: (stations: StationMeasurement[]): StationMeasurement[] => {
      return stations.map(s => {
        return {
          ...s,
          actualRadius: Math.round((s.nominalRadius + 4.5) * 10) / 10,
          actualWidth: Math.round((s.nominalWidth + 4.5) * 10) / 10,
          actualThickness: Math.round(s.nominalThickness * 0.72 * 10) / 10
        };
      });
    }
  }
];

// Calculations based on 1D pump hydraulics and fluid dynamics
export function simulatePumpPerformance(
  params: PumpParameters,
  stations: StationMeasurement[],
  roughnessFactorDistorted: number = 2.8 // Multiplier on standard friction factor for worn surface roughness
): SimulationResult[] {
  const points: SimulationResult[] = [];
  const Q_steps = [0, 200, 400, 600, 800, 1000, 1200, 1400]; // m³/h steps

  // Speed constants
  const RPM = params.speedRpm;
  const D2 = params.impellerDiameter / 1000; // m
  const omega = (RPM * 2 * Math.PI) / 60; // rad/s
  const U2 = omega * (D2 / 2); // m/s tip speed

  const g = 9.81;

  // Euler Head calculation parameters (Head at 0 flow & curve slope)
  const H_euler_shutoff = 108.0; // Shutoff head (m)
  const Euler_slope_factor = 0.018; // Linear slope of Euler head vs capacity

  // Calculate geometric variations from stations
  let meanDeviation = 0;
  let maxDeviation = 0;
  let localFrictionAmp = 1.0;
  let wallThicknessAlert = false;

  stations.forEach(s => {
    const devR = s.actualRadius - s.nominalRadius;
    const devW = s.actualWidth - s.nominalWidth;
    const dev = (devR + devW) / 2;
    meanDeviation += dev;
    if (Math.abs(dev) > maxDeviation) maxDeviation = Math.abs(dev);
    if (s.actualThickness < s.nominalThickness * 0.7) {
      wallThicknessAlert = true;
    }
  });
  meanDeviation = meanDeviation / stations.length;

  // Recirculation loss constant at the Tongue/Cutwater is determined by cutwater clearance:
  // nominal clear: R_nominal(0°) - D3/2 = 245 - 242.5 = 2.5 mm
  // actual clear: R_actual(0°) - D3/2
  const d3_radius = params.baseCircleDiameter / 2;
  const nominalClearance = stations[0].nominalRadius - d3_radius;
  const actualClearance = Math.max(0.5, stations[0].actualRadius - d3_radius);
  const tongueRatio = actualClearance / nominalClearance;

  for (const Q of Q_steps) {
    const Q_m3s = Q / 3600;

    // Standard Euler/ideal Head (theoretical flow momentum transfer)
    const H_euler = Math.max(30, H_euler_shutoff - Euler_slope_factor * Q);

    // Friction losses proportional to Volute Velocity V_v^2
    // V_v = Q / A_throat
    // Area nominal throat = 98.0 * 360.0 (using simplistic equivalent area)
    // We compute accurate area representation based on Q and the station values.
    const averageAreaNominal = (0.025); // m²
    const averageAreaDistorted = averageAreaNominal * (1 + (meanDeviation / 150)); 

    const V_v_nom = Q_m3s / averageAreaNominal;
    const V_v_dist = Q_m3s / averageAreaDistorted;

    // 1. Friction loss
    const frictionFactorNom = 0.021;
    const frictionFactorDist = frictionFactorNom * roughnessFactorDistorted;

    const h_f_nom = frictionFactorNom * 12.5 * (Math.pow(V_v_nom, 2) / (2 * g));
    const h_f_dist = frictionFactorDist * 12.5 * (Math.pow(V_v_dist, 2) / (2 * g));
    // Repaired restores surface roughness to pristine 1.1x nominal but keeps geometric corrections
    const roughnessFactorRepaired = 1.15;
    const h_f_rep = frictionFactorNom * roughnessFactorRepaired * 12.5 * (Math.pow(V_v_nom, 2) / (2 * g));

    // 2. Shock/Shockless Flow Loss (mixing loss at off-design flow)
    // Minimum mixing occurs at rated flow (800 m³/h)
    const shock_coeff = 0.12;
    const h_shock_nom = shock_coeff * Math.pow((Q - params.ratedFlow) / 100, 2);
    // Distorted casing creates asymmetric mixing flow separation
    const h_shock_dist = h_shock_nom * (1 + 0.15 * maxDeviation) + (maxDeviation * 0.45);
    const h_shock_rep = h_shock_nom * 1.05; // almost fully restored

    // 3. Recirculation Loss (leakage back through cutwater)
    // Strongly dependent on tongue wear at low flows
    const h_recirc_nom = 4.5 * Math.pow(Math.max(0, 1 - Q / params.ratedFlow), 2.5);
    const h_recirc_dist = h_recirc_nom * Math.pow(tongueRatio, 1.8);
    const h_recirc_rep = h_recirc_nom * 1.05;

    // 4. Disk friction & Mechanical leakage equivalent losses (m)
    const h_other_nom = 2.0;
    const h_other_dist = 2.0 * (1 + actualClearance * 0.04);
    const h_other_rep = 2.1;

    // Aggregate heads
    const headNominal = Math.round(Math.max(0, H_euler - (h_f_nom + h_shock_nom + h_recirc_nom + h_other_nom)) * 10) / 10;
    
    // Distorted suffers severe friction & localized geometric separation
    const totalLossesDistort = h_f_dist + h_shock_dist + h_recirc_dist + h_other_dist;
    const headDistorted = Math.round(Math.max(0, H_euler - totalLossesDistort) * 10) / 10;

    // Repaired is restored via lining & contour machining
    const totalLossesRep = h_f_rep + h_shock_rep + h_recirc_rep + h_other_rep;
    const headRepaired = Math.round(Math.max(0, H_euler - totalLossesRep) * 10) / 10;

    // --- Efficiency Models ---
    // Peak efficiency is designed at 84% at rated capacity
    const x_flow = Q / params.ratedFlow;
    const eff_curve_base = 84.0 * (2.0 * x_flow - Math.pow(x_flow, 1.9));
    
    // Low flow cap
    const effNominal = Math.max(0, Math.round((Q === 0 ? 0 : Math.max(5, eff_curve_base)) * 10) / 10);
    
    // Distorted state efficiency suffering from higher turbulent loss
    const eff_distortion_penalty = Math.min(18, (h_f_dist - h_f_nom) * 0.8 + (h_shock_dist - h_shock_nom) * 1.2 + (tongueRatio - 1) * 2.5);
    const effDistorted = Math.max(0, Q === 0 ? 0 : Math.round(Math.max(5, effNominal - eff_distortion_penalty) * 10) / 10);
    
    // Repaired restores smooth finish & dimensions
    const effRepaired = Math.max(0, Q === 0 ? 0 : Math.round(Math.max(5, effNominal - 1.2) * 10) / 10);

    // --- Power Draw (kW) ---
    // P = (rho * g * Q * H) / (3600 * 1000 * eff)
    const powerCalcNom = Q === 0 ? 55.0 : Math.round(((params.fluidDensity * g * Q_m3s * headNominal) / (effNominal / 100)) / 1000 * 10) / 10;
    // Shaft/windage loss at zero-flow
    const powerNominal = Q === 0 ? 55.0 : powerCalcNom;

    const powerCalcDist = Q === 0 ? 64.0 : Math.round(((params.fluidDensity * g * Q_m3s * headDistorted) / (effDistorted / 100)) / 1000 * 10) / 10;
    const powerDistorted = Q === 0 ? 64.0 : powerCalcDist;

    const powerCalcRep = Q === 0 ? 56.5 : Math.round(((params.fluidDensity * g * Q_m3s * headRepaired) / (effRepaired / 100)) / 1000 * 10) / 10;
    const powerRepaired = Q === 0 ? 56.5 : powerCalcRep;

    points.push({
      flow: Q,
      headNominal,
      headDistorted,
      headRepaired,
      effNominal,
      effDistorted,
      effRepaired,
      powerNominal,
      powerDistorted,
      powerRepaired,
      lossesNominal: {
        friction: Math.round(h_f_nom * 100) / 100,
        shock: Math.round(h_shock_nom * 100) / 100,
        diskFriction: Math.round(h_recirc_nom * 100) / 100,
        leakage: 0.8,
        mixing: 1.2
      },
      lossesDistorted: {
        friction: Math.round(h_f_dist * 100) / 100,
        shock: Math.round(h_shock_dist * 100) / 100,
        diskFriction: Math.round(h_recirc_dist * 100) / 100,
        leakage: Math.round(0.8 * tongueRatio * 100) / 100,
        mixing: Math.round((1.2 + maxDeviation * 0.45) * 100) / 100
      }
    });
  }

  return points;
}

// Complete list of steps for the Patterson Volute Rehabilitation Procedure
export interface RepairStep {
  step: number;
  phase: string;
  title: string;
  subTitle: string;
  details: string[];
  equipmentNeeded: string[];
  safetyWarnings: string[];
  qualityChecks: string[];
}

export const REPAIR_PROCEDURE_STEPS: RepairStep[] = [
  {
    step: 1,
    phase: "Surface Preparation & Decontamination",
    title: "Abrasive Grit Blasting (SSPC-SP10 / Sa 2½)",
    subTitle: "Restoring the absolute clean profile to raw metallic iron",
    details: [
      "Completely isolate the Patterson 12X8MAA pump. Drain and clean casing internal voids using high-pressure steam cleaning to strip organic particulates.",
      "Execute high-voltage dry-spark testing over old linings (if present) to evaluate underlying structural delamination.",
      "Blasting operations must utilize pure fine-grade Alumina/Grit at 7 bar (100 psi) to yield an angular profile of 75-100 microns (3.0 to 4.0 mils).",
      "Vacuum all spent abrasive dust from the spiral casing internals. Wipe surface with Solvents (MEK or Acetone) immediately to block flash rust."
    ],
    equipmentNeeded: [
      "Rigid angular grit blaster (Aluminum Oxide grit)",
      "Digital Elcometer Surface Profile Gauge",
      "Nitrogen-blanketed dry steam vapor cleaner",
      "MEK chemical grade solvent wipes"
    ],
    safetyWarnings: [
      "High concentration airborne silica/dust hazard. Mandatory dual-cartridge PAPR respirator hood.",
      "Static electricity buildup on blast nozzles. Ground the casing firmly to structural steel chassis."
    ],
    qualityChecks: [
      "Visual Inspection: Verify uniform frosted-gray color with zero sheen, satisfying NACE No. 2 standard.",
      "Salt Contamination Check: Ensure soluble chlorides stay below 20 mg/m² using standard Bresle patch test."
    ]
  },
  {
    step: 2,
    phase: "Structural Metal Rebuilding & Cladding",
    title: "Cavitation Crater Overlay Welding & Cold Alloy Rebuilding",
    subTitle: "Repairing deep erosion craters (>5mm depth) at the Cutwater Tongue",
    details: [
      "Identify high-stress corrosion-wear zones (especially around the 45° tongue segment, and bottom wall of volute).",
      "If the localized depth wear exceeds 35% of the original nominal wall (less than 12.5mm casing thickness), apply metallic welding overlays using low-temperature, high-nickel alloy stick rods (AWS A5.15 ENiFe-CI).",
      "Preheat high-wear nodes to approximately 180°C to limit crack initiation across old brittle grey cast iron grains.",
      "For cavitation areas under 5mm, apply heavy-duty metallic fluid-compound (e.g., steel-reinforced polymer alloy like epoxy metallic paste) and paddle flush using contour trowels.",
      "Scribe local gauge lines using a wood or plastic compass calibrated from the reference impeller lock shaft."
    ],
    equipmentNeeded: [
      "Low-temp welding machine & High Ni-Content rods (ENiFe-CI)",
      "Thermal infrared pre-heat monitoring camera",
      "Cold steel-alloy epoxy compound package (e.g. titanium-filled metal rebuilders)",
      "Custom radius scraper blades"
    ],
    safetyWarnings: [
      "Cast Iron off-gassing under heat is highly toxic. Ensure active exhausting ventilation is configured inside the volute throat.",
      "High voltage welder exposure around grounded heavy metal frameworks."
    ],
    qualityChecks: [
      "Dye-Penetrant Testing: Inspect welded overlays for surface fissures or hairline interface micro-cracking.",
      "Base Circle Radial Alignment Check: Ensure Tongue starting radius is restored to 245mm ±0.5mm."
    ]
  },
  {
    step: 3,
    phase: "High-Performance Fluid-Flow Coating",
    title: "Erosion-Resistant Ceramic-Epoxy Coating Application",
    subTitle: "Applying the barrier layer to rebuild hydraulic paths and prevent friction loss",
    details: [
      "Apply high-build ceramic polymer matrix coating (e.g., Belzona 1321, Devcon Brushable Ceramic, or Loctite PC 7333).",
      "First Coat (Base Color - Blue/Grey): Apply with hard nylon bristles at a targeting thickness of 400 microns. Brush inside the intricate flow paths in a smooth direction matching the impeller radial flow path (clockwise from the tongue).",
      "Let the base dry to a firm tack-state (typically 4-6 hours at 20°C).",
      "Second Coat (Contrast Color - Red/Green): Apply another 400-micron coat. Contrast colors guarantee that any future cavitation wear stands out during regular pump maintenance inspection."
    ],
    equipmentNeeded: [
      "Spatulas and custom flex-brushes for small narrow areas",
      "Non-destructing Wet Film Thickness (WFT) comb gauge",
      "Dual-component solventless ceramic-filled epoxy paint system",
      "Forced-air drying ventilator fans"
    ],
    safetyWarnings: [
      "Epoxy amines represent strong dermal irritants and skin sensitizers; full chemical body suits are mandatory.",
      "Explosion-proof lights must be utilized when inspecting inside the closed flow chambers."
    ],
    qualityChecks: [
      "Wet Film Thickness Monitoring: Check continuously at all station arcs to maintain overall lining thickness around 800 - 1000 microns.",
      "Absence of run/sag lines: Excess epoxy pools will perturb hydraulic spiral symmetry."
    ]
  },
  {
    step: 4,
    phase: "Final Profile Contour Grinding & Machining",
    title: "Precision Grinding Using Stationary Station Templates",
    subTitle: "Truing the absolute inner hydraulic spiral curves back to factory specifications",
    details: [
      "After curing for 24 hours, compare the inner volute surface with design curves.",
      "Fabricate stiff acrylic or wood contour gages for each station angle (0°, 45°, 90°, 135°, up to 360°). Gages must reference the shaft centerline axis.",
      "Execute manual micro-grinding across any raised epoxy nodes or overlap lumps with flexible pneumatic detail grinders (P120 grade aluminum oxide disks).",
      "Ensure the critical Clearance at the Cutwater Cut-off (Tongue) reads exactly 245mm to 247.5mm, maintaining a 7.5mm minimum clearance from tip circle to cutwater nozzle inlet."
    ],
    equipmentNeeded: [
      "Pneumatic micro angle grinder with fine-contour disc arrays",
      "Laser-cut station contour profile acrylic templates (0 to 360)",
      "Internal dial-bore calipers calibrated to 0.05mm precision",
      "P80 & P120 flap grinding wheels"
    ],
    safetyWarnings: [
      "Polymer grid dust is static-charged and hazardous. Utilize explosive-safe industrial HEPA floor vacs.",
      "Eye safety: Protective full-coverage goggles due to high speed grinding sparks."
    ],
    qualityChecks: [
      "Template Fit Tolerance: Verify light-tight fit of stationary profile templates against grinding surfaces (tolerance <0.3mm).",
      "Surface finish check: Ensure surface roughness is silky-smooth, matching Rz < 10 microns."
    ]
  },
  {
    step: 5,
    phase: "Quality Assurance Testing & Commissioning",
    title: "Holiday Testing, Hardness Trials, and Diagnostic Check",
    subTitle: "Final checks before placing the Patterson 12X8MAA back into critical waste water service",
    details: [
      "Expose the fully cured dry coating to high-voltage Spark Testing (ASTM D5162, set to 3.0 kV to match lining thickness of 0.8mm). Any visual bright blue arc or high buzz tone indicates a localized micro-pore ('holiday') that must be brush-filled.",
      "Perform Barcol or Shore D Durometer hardness tests across multiple segments to verify the polymer is fully bound.",
      "Assemble and balance the Patterson impeller inside the casing with new wear rings. Hand-rotate the shaft and secure the coupling bolts.",
      "Re-commission the pump, capturing pressure diagnostics at shutoff and nominal 800 m³/h service flow."
    ],
    equipmentNeeded: [
      "High Voltage Holiday Detector (Elcometer or equivalent Spark tester)",
      "Shore D Durometer Testing Gauge",
      "Dynamic multi-channel vibration analyzer (to verify no dynamic impeller rub)",
      "Suction & Discharge calibrated pressure gauges (0-15 Bar)"
    ],
    safetyWarnings: [
      "A 3 kV spark tester shock represents high current leakage potentials if used on wet substrates.",
      "Confined-space pump lock-out and tag-out (LOTO) verification must be checked by the shifts leader before startup."
    ],
    qualityChecks: [
      "Zero Holidays: Zero alarms, cracks, or pinholes across 100% of internal casing areas.",
      "Shore D Hardness: Must read greater than 82 Shore D (for solid structural protection).",
      "Startup Vibration: Inspect bearing housing; overall vibration velocity must stay under 2.8 mm/s RMS."
    ]
  }
];
