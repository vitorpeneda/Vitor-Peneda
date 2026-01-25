
export enum PhaseType {
  SINGLE = 'Monofásico (230V)',
  THREE = 'Trifásico (400V)'
}

export enum InsulationType {
  PVC = 'PVC (70°C)',
  XLPE = 'XLPE/EPR (90°C)'
}

export enum MaterialType {
  COPPER = 'Cobre (Cu)',
  ALUMINUM = 'Alumínio (Al)'
}

export enum InstallationMethod {
  A1 = 'A1 - Condutores isolados em tubos em parede isolante',
  A2 = 'A2 - Cabo multicondutor em tubo em parede isolante',
  B1 = 'B1 - Condutores isolados em tubo à vista ou em alvenaria',
  B2 = 'B2 - Cabo multicondutor em tubo à vista ou em alvenaria',
  C = 'C - Cabos fixados diretamente em paredes',
  D = 'D - Cabos em condutas enterradas',
  E = 'E - Cabo multicondutor ao ar livre',
  F = 'F - Cabos monocondutores ao ar livre'
}

export interface Circuit {
  id: string;
  origin: string;
  destination: string;
  apparentPowerKVA: number;
  simultaneityFactor: number;
  powerFactor: number; // Cosseno de Phi
  voltage: number; // 230 ou 400
  phase: PhaseType;
  insulation: InsulationType;
  material: MaterialType;
  method: InstallationMethod;
  length: number;
  manualFC: number; // Fator de Correção definido pelo utilizador
  ambientTemp: number; // Mantido para referência interna
  groupingCount: number; // Mantido para referência interna
}

export interface DimensioningResult {
  ib: number;
  cableLabel: string;
  scFase: number;
  scNeutro: number;
  izFase: number;
  izNeutro: number;
  izCorrected: number;
  fc: number;
  i2CheckValue: number;
  critPhase: string;
  critNeutro: string;
  protectionIn: number;
  voltageDropV: number;
  voltageDropP: number;
  tubeDiameter: number; 
  tableRef: string;
}
