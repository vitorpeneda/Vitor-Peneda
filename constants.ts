
import { InstallationMethod } from './types';

export const STANDARD_KVA_VALUES = [1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7, 27.6, 34.5, 41.4];
export const STANDARD_SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];
export const CIRCUIT_BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];

export const CONDUCTIVITY = { COPPER: 56, ALUMINUM: 35 };

export const TEMP_FACTORS: Record<string, Record<number, number>> = {
  PVC: { 10: 1.22, 15: 1.17, 20: 1.12, 25: 1.06, 30: 1.00, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61, 60: 0.50 },
  XLPE: { 10: 1.15, 15: 1.12, 20: 1.08, 25: 1.04, 30: 1.00, 35: 0.96, 40: 0.91, 45: 0.87, 50: 0.82, 55: 0.76, 60: 0.71, 65: 0.65, 70: 0.58, 75: 0.50, 80: 0.41 }
};

export const GROUPING_LIST = [
  { count: 1, factor: 1.00, label: '1 Circuito (K2=1.00)' },
  { count: 2, factor: 0.80, label: '2 Circuitos (K2=0.80)' },
  { count: 3, factor: 0.70, label: '3 Circuitos (K2=0.70)' },
  { count: 4, factor: 0.65, label: '4 Circuitos (K2=0.65)' },
  { count: 5, factor: 0.60, label: '5 Circuitos (K2=0.60)' },
  { count: 6, factor: 0.57, label: '6 Circuitos (K2=0.57)' },
  { count: 7, factor: 0.54, label: '7 Circuitos (K2=0.54)' },
  { count: 8, factor: 0.52, label: '8 Circuitos (K2=0.52)' },
  { count: 9, factor: 0.50, label: '9 Circuitos (K2=0.50)' },
  { count: 12, factor: 0.45, label: '12 Circuitos (K2=0.45)' },
  { count: 16, factor: 0.41, label: '16 Circuitos (K2=0.41)' },
];

export const GROUPING_FACTORS: Record<number, number> = GROUPING_LIST.reduce((acc, item) => {
  acc[item.count] = item.factor;
  return acc;
}, {} as Record<number, number>);

export const SIMULTANEITY_803A = [
  { range: '1 Inst.', factor: 1.00 },
  { range: '2 a 4 Inst.', factor: 1.00 },
  { range: '5 a 9 Inst.', factor: 0.75 },
  { range: '10 a 14 Inst.', factor: 0.56 },
  { range: '15 a 19 Inst.', factor: 0.48 },
  { range: '20 a 24 Inst.', factor: 0.43 },
  { range: '25 a 29 Inst.', factor: 0.40 },
  { range: '30 a 34 Inst.', factor: 0.38 },
  { range: '35 a 39 Inst.', factor: 0.37 },
  { range: '40 a 49 Inst.', factor: 0.36 },
  { range: '≥ 50 Inst.', factor: 0.34 },
];

export const TABLE_REFERENCES: Record<string, string> = {
  [InstallationMethod.A1]: "52-C3", [InstallationMethod.A2]: "52-C3",
  [InstallationMethod.B1]: "52-C3", [InstallationMethod.B2]: "52-C3",
  [InstallationMethod.C]: "52-C3",  [InstallationMethod.D]: "52-C4",
  [InstallationMethod.E]: "52-C10", [InstallationMethod.F]: "52-C11",
};

export const TUBE_DIAMETERS_803C: Record<number, Record<number, number>> = {
  1.5:  { 3: 16, 5: 20 },
  2.5:  { 3: 20, 5: 25 },
  4:    { 3: 25, 5: 32 },
  6:    { 3: 25, 5: 32 },
  10:   { 3: 32, 5: 40 },
  16:   { 3: 40, 5: 50 },
  25:   { 3: 50, 5: 63 },
  35:   { 3: 50, 5: 63 },
  50:   { 3: 63, 5: 75 },
  70:   { 3: 75, 5: 90 },
  95:   { 3: 90, 5: 110 },
  120:  { 3: 90, 5: 110 },
  150:  { 3: 110, 5: 125 },
  185:  { 3: 110, 5: 125 },
  240:  { 3: 125, 5: 140 },
  300:  { 3: 140, 5: 160 }
};

export const IZ_BASE_3PHASE_PVC_CU: Record<string, Record<number, number>> = {
  "52-C3": { 1.5: 13, 2.5: 17.5, 4: 23, 6: 29, 10: 39, 16: 52, 25: 68, 35: 83, 50: 99, 70: 125, 95: 150, 120: 172, 150: 196, 185: 223, 240: 261, 300: 298 },
  "52-C4": { 1.5: 22, 2.5: 29, 4: 38, 6: 47, 10: 63, 16: 82, 25: 104, 35: 125, 50: 150, 70: 188, 95: 226, 120: 258, 150: 292, 185: 330, 240: 383, 300: 435 }
};
