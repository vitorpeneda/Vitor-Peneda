
import { Circuit, DimensioningResult, PhaseType, InsulationType, MaterialType, UsageType } from './types';
import { 
  STANDARD_SECTIONS, CIRCUIT_BREAKERS, IZ_BASE_3PHASE_PVC_CU, TABLE_REFERENCES, TUBE_DIAMETERS_803C,
  TEMP_FACTORS, GROUPING_FACTORS
} from './constants';

export const calculateCircuit = (c: Circuit): DimensioningResult => {
  const is3Ph = c.phase === PhaseType.THREE;
  const sTotal = c.apparentPowerKVA * c.simultaneityFactor;
  
  // 1. Corrente de Serviço IB (Secção 523)
  const ib = is3Ph 
    ? (sTotal * 1000) / (Math.sqrt(3) * c.voltage)
    : (sTotal * 1000) / (c.voltage);

  // 2. Fatores de Correção (RTIEBT Secção 523)
  const insulKey = c.insulation.includes('PVC') ? 'PVC' : 'XLPE';
  
  // K1: Temperatura (Quadro 52-D1/D2)
  const k1 = TEMP_FACTORS[insulKey][c.ambientTemp] || 1.0;
  
  // K2: Agrupamento (Quadro 52-E1)
  const k2 = GROUPING_FACTORS[c.groupingCount] || 1.0;
  
  // Kh: Harmónicos (Secção 523.5.3)
  const kh = c.hasHarmonics ? 0.86 : 1.0;
  
  const fc = k1 * k2 * kh;

  // 3. Pesquisa na Tabela Iz (PVC/Cu como base e fatores de conversão)
  const tableId = TABLE_REFERENCES[c.method];
  const lookupTable = IZ_BASE_3PHASE_PVC_CU[tableId] || IZ_BASE_3PHASE_PVC_CU["52-C3"];

  let section = 1.5;
  let izBase = 0;
  
  for (const s of STANDARD_SECTIONS) {
    let currentCapacity = lookupTable[s] || 0;
    
    // Fatores de Material e Isolamento (RTIEBT)
    if (c.material === MaterialType.ALUMINUM) currentCapacity *= 0.77;
    if (insulKey === 'XLPE') currentCapacity *= 1.28;
    if (!is3Ph) currentCapacity *= 1.15; // Ajuste para 2 condutores carregados

    if (currentCapacity * fc >= ib) {
      section = s;
      izBase = currentCapacity;
      break;
    }
  }

  // 4. Proteção In (Artigo 433.2)
  const izCorrected = izBase * fc;
  const in_prot = CIRCUIT_BREAKERS.find(val => val >= ib && val <= izCorrected) || 
                  CIRCUIT_BREAKERS.find(val => val >= ib) || ib;

  // 5. Queda de Tensão (Secção 525 / Anexo II)
  const rho1 = c.material === MaterialType.COPPER ? 0.0225 : 0.036;
  const lambda = 0.00008; // Indutância standard
  const b = is3Ph ? 1 : 2;
  const senPhi = Math.sqrt(1 - Math.pow(c.powerFactor, 2));
  const maxDeltaU = c.usage === UsageType.LIGHTING ? 3 : 5;

  let dv_v = b * ( (rho1 * (c.length / section) * c.powerFactor) + (lambda * c.length * senPhi) ) * ib;
  let dv_p = (dv_v / (is3Ph ? (c.voltage / Math.sqrt(3)) : c.voltage)) * 100;

  // Re-dimensionamento por Queda de Tensão
  if (dv_p > maxDeltaU) {
      for (const s of STANDARD_SECTIONS.slice(STANDARD_SECTIONS.indexOf(section))) {
          const check_dv_v = b * ( (rho1 * (c.length / s) * c.powerFactor) + (lambda * c.length * senPhi) ) * ib;
          const check_dv_p = (check_dv_v / (is3Ph ? (c.voltage / Math.sqrt(3)) : c.voltage)) * 100;
          if (check_dv_p <= maxDeltaU) {
              section = s;
              dv_v = check_dv_v;
              dv_p = check_dv_p;
              break;
          }
      }
  }

  // 6. Neutro e Terra (PE) (Secção 54)
  let scNeutro = section;
  if (is3Ph && section > 16 && !c.hasHarmonics) {
      if (section === 25 || section === 35) scNeutro = 16;
      else if (section === 50) scNeutro = 25;
      else scNeutro = section / 2;
  }
  scNeutro = STANDARD_SECTIONS.find(s => s >= scNeutro) || scNeutro;

  let scTerra = section;
  if (section > 16) {
      if (section <= 35) scTerra = 16;
      else scTerra = section / 2;
  }
  scTerra = STANDARD_SECTIONS.find(s => s >= scTerra) || scTerra;

  // 7. Tubagem (Quadro 803C)
  const numCond = is3Ph ? 5 : 3; 
  const tubeDiam = TUBE_DIAMETERS_803C[section]?.[numCond] || TUBE_DIAMETERS_803C[section]?.[5] || 0;

  const cablePrefix = insulKey === 'XLPE' ? 'XV' : 'H07V';
  const cableMat = c.material === MaterialType.COPPER ? '-R' : '-AL';
  
  return {
    ib,
    fc,
    cableLabel: `${cablePrefix}${cableMat} (${c.material})`,
    scFase: section,
    scNeutro: scNeutro,
    scTerra: scTerra,
    izFase: izBase,
    izCorrected: izCorrected,
    i2CheckValue: 1.45 * izCorrected,
    critPhase: `${ib.toFixed(2)}A ≤ In(${Math.round(Number(in_prot))}A) ≤ ${izCorrected.toFixed(1)}A`,
    protectionIn: Math.round(Number(in_prot)),
    voltageDropV: dv_v,
    voltageDropP: dv_p,
    maxDeltaU: maxDeltaU,
    tubeDiameter: tubeDiam,
    tableRef: tableId
  };
};
