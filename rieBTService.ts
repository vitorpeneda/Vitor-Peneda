
import { Circuit, DimensioningResult, PhaseType, InsulationType, MaterialType } from './types';
import { 
  STANDARD_SECTIONS, CIRCUIT_BREAKERS, IZ_BASE_3PHASE_PVC_CU, TABLE_REFERENCES, CONDUCTIVITY, TUBE_DIAMETERS_803C 
} from './constants';

export const calculateCircuit = (c: Circuit): DimensioningResult => {
  const is3Ph = c.phase === PhaseType.THREE;
  const sTotal = c.apparentPowerKVA * c.simultaneityFactor;
  
  // 1. Corrente de Serviço IB - Usando a tensão selecionada
  const ib = is3Ph 
    ? (sTotal * 1000) / (Math.sqrt(3) * c.voltage)
    : (sTotal * 1000) / (c.voltage);

  // 2. Fator de Correção - Utiliza o valor definido pelo utilizador diretamente
  const fc = c.manualFC;

  // 3. Pesquisa na Tabela Iz
  const tableId = TABLE_REFERENCES[c.method];
  const lookupTable = IZ_BASE_3PHASE_PVC_CU[tableId] || IZ_BASE_3PHASE_PVC_CU["52-C3"];

  const insulKey = c.insulation.includes('PVC') ? 'PVC' : 'XLPE';
  let section = 1.5;
  let izBase = 0;
  
  for (const s of STANDARD_SECTIONS) {
    let currentCapacity = lookupTable[s] || 0;
    // Fator para Alumínio (Quadro 52-C1)
    if (c.material === MaterialType.ALUMINUM) currentCapacity *= 0.77;
    // Fator para XLPE (vs PVC base da tabela)
    if (insulKey === 'XLPE') currentCapacity *= 1.28;
    // Fator para 2 condutores carregados (Monofásico) vs 3 (Trifásico)
    if (!is3Ph) currentCapacity *= 1.15;

    if (currentCapacity * fc >= ib) {
      section = s;
      izBase = currentCapacity;
      break;
    }
  }

  // 4. Proteção In (Ib <= In <= Iz * Fc)
  const izCorrected = izBase * fc;
  const in_prot = CIRCUIT_BREAKERS.find(val => val >= ib && val <= izCorrected) || 
                  CIRCUIT_BREAKERS.find(val => val >= ib) || ib;

  // 5. Fórmula completa de Queda de Tensão (RTIEBT Quadro 52O - Nota)
  // u = b * (rho1 * (L/S) * cos(phi) + lambda * L * sen(phi)) * Ib
  const rho1 = c.material === MaterialType.COPPER ? 0.0225 : 0.036;
  const lambda = 0.00008; // 0.08 mOhm/m
  const b = is3Ph ? 1 : 2;
  const senPhi = Math.sqrt(1 - Math.pow(c.powerFactor, 2));

  let dv_v = b * ( (rho1 * (c.length / section) * c.powerFactor) + (lambda * c.length * senPhi) ) * ib;
  let dv_p = (dv_v / (is3Ph ? (c.voltage / Math.sqrt(3)) : c.voltage)) * 100;

  // Ajuste automático se exceder o limite regulamentar (5% padrão)
  const MAX_LIMIT = 5;
  if (dv_p > MAX_LIMIT) {
      for (const s of STANDARD_SECTIONS.slice(STANDARD_SECTIONS.indexOf(section))) {
          const check_dv_v = b * ( (rho1 * (c.length / s) * c.powerFactor) + (lambda * c.length * senPhi) ) * ib;
          const check_dv_p = (check_dv_v / (is3Ph ? (c.voltage / Math.sqrt(3)) : c.voltage)) * 100;
          if (check_dv_p <= MAX_LIMIT) {
              section = s;
              dv_v = check_dv_v;
              dv_p = check_dv_p;
              break;
          }
      }
  }

  // 6. Neutro e Diâmetro de Tubo
  let scNeutro = section;
  if (is3Ph && section > 16) {
      if (section === 25) scNeutro = 16;
      else if (section === 35) scNeutro = 16;
      else if (section === 50) scNeutro = 25;
      else if (section > 50) scNeutro = section / 2;
  }
  scNeutro = STANDARD_SECTIONS.find(s => s >= scNeutro) || scNeutro;

  const numCond = is3Ph ? 5 : 3; 
  const tubeDiam = TUBE_DIAMETERS_803C[section]?.[numCond] || TUBE_DIAMETERS_803C[section]?.[5] || 0;

  // Labels
  const cablePrefix = insulKey === 'XLPE' ? 'XV' : 'H07V';
  const cableMat = c.material === MaterialType.COPPER ? '-R' : '-AL';
  
  return {
    ib,
    fc,
    cableLabel: `${cablePrefix}${cableMat} ${is3Ph ? 'Trifásico' : 'Monofásico'}`,
    scFase: section,
    scNeutro: scNeutro,
    izFase: izBase,
    izNeutro: izBase,
    izCorrected: izCorrected,
    i2CheckValue: 1.45 * izCorrected,
    critPhase: `${ib.toFixed(2)} <= In >= ${izCorrected.toFixed(1)}`,
    critNeutro: `${ib.toFixed(2)} <= In >= ${izCorrected.toFixed(1)}`,
    protectionIn: Math.round(Number(in_prot)),
    voltageDropV: dv_v,
    voltageDropP: dv_p,
    tubeDiameter: tubeDiam,
    tableRef: tableId
  };
};
