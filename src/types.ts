/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StationMeasurement {
  angle: number;       // Angle in degrees (0 = Tongue / Cutwater starting point, matching rotation)
  nominalRadius: number; // Design radius from center in mm
  actualRadius: number;  // Measured radius from center in mm (due to wear/cavitation/erosion)
  nominalWidth: number;  // Design width in mm
  actualWidth: number;   // Measured width in mm
  nominalThickness: number; // Design casing wall thickness in mm
  actualThickness: number;  // Measured casing wall thickness in mm
}

export interface PumpParameters {
  model: string;                // "Patterson 12x8MAA"
  speedRpm: number;             // Rated speed (e.g., 1750 RPM)
  ratedFlow: number;            // Rated flow in m³/h (e.g., 800)
  impellerDiameter: number;     // Diameter in mm (e.g., 470)
  impellerWidth: number;        // b2 in mm (e.g., 38)
  casingMaterial: string;       // e.g., "Cast Iron Grade 30"
  liquidMedia: string;          // e.g., "Water"
  fluidDensity: number;         // kg/m³
  viscosityCst: number;         // Kinematic viscosity in cSt
  baseCircleDiameter: number;   // d3 in mm (e.g., 485)
  tongueAngle: number;          // degrees (e.g., 45)
  dischargeDiameter: number;    // mm (8" ~ 203.2mm)
  suctionDiameter: number;      // mm (12" ~ 304.8mm)
}

export interface SimulationResult {
  flow: number;                 // m³/h
  headNominal: number;          // m
  headDistorted: number;        // m
  headRepaired: number;         // m
  effNominal: number;           // %
  effDistorted: number;         // %
  effRepaired: number;          // %
  powerNominal: number;         // kW
  powerDistorted: number;       // kW
  powerRepaired: number;        // kW
  // Losses breakdown for detailed charting
  lossesNominal: {
    friction: number;
    shock: number;
    diskFriction: number;
    leakage: number;
    mixing: number;
  };
  lossesDistorted: {
    friction: number;
    shock: number;
    diskFriction: number;
    leakage: number;
    mixing: number;
  };
}
