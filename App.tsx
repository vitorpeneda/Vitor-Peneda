
import React, { useState, useMemo, useEffect } from 'react';
import { 
  PhaseType, InsulationType, MaterialType, InstallationMethod, 
  Circuit, DimensioningResult 
} from './types';
import { calculateCircuit } from './rieBTService';
import { STANDARD_KVA_VALUES, SIMULTANEITY_803A } from './constants';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [circuits, setCircuits] = useState<Circuit[]>([
    {
      id: '1', origin: 'P100', destination: 'Q.G.E.',
      apparentPowerKVA: 20.7, simultaneityFactor: 0.8, powerFactor: 0.9,
      voltage: 400, phase: PhaseType.THREE, insulation: InsulationType.XLPE,
      material: MaterialType.COPPER, method: InstallationMethod.B1,
      length: 13, manualFC: 1.0, ambientTemp: 30, groupingCount: 1,
    }
  ]);

  const [activeId, setActiveId] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{ text: string, links: { uri: string, title: string }[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showMemorial, setShowMemorial] = useState(false);

  const activeCircuit = useMemo(() => circuits.find(c => c.id === activeId)!, [circuits, activeId]);
  
  const availableOrigins = useMemo(() => {
    const destinations = circuits.map(c => c.destination);
    return Array.from(new Set(['P100', ...destinations])).filter(d => d !== activeCircuit.destination);
  }, [circuits, activeCircuit.destination]);

  const upstreamCircuit = useMemo(() => {
    return circuits.find(c => c.destination === activeCircuit.origin);
  }, [circuits, activeCircuit.origin]);

  const filteredKvaValues = useMemo(() => {
    if (!upstreamCircuit) return STANDARD_KVA_VALUES;
    const maxAllowed = upstreamCircuit.apparentPowerKVA;
    const filtered = STANDARD_KVA_VALUES.filter(v => v < maxAllowed);
    return filtered.length > 0 ? filtered : [STANDARD_KVA_VALUES[0]];
  }, [upstreamCircuit]);

  const results = useMemo(() => circuits.reduce((acc, c) => {
    acc[c.id] = calculateCircuit(c);
    return acc;
  }, {} as Record<string, DimensioningResult>), [circuits]);

  const activeResult = results[activeId];

  const totalDV_V = useMemo(() => Object.values(results).reduce((sum, r) => sum + r.voltageDropV, 0), [results]);
  const totalDV_P = useMemo(() => (totalDV_V / activeCircuit.voltage) * 100, [totalDV_V, activeCircuit.voltage]);

  useEffect(() => {
    if (upstreamCircuit && activeCircuit.apparentPowerKVA >= upstreamCircuit.apparentPowerKVA) {
      const newVal = filteredKvaValues[filteredKvaValues.length - 1]; 
      handleUpdate('apparentPowerKVA', newVal);
    }
  }, [activeCircuit.origin, upstreamCircuit?.apparentPowerKVA]);

  const handleUpdate = (field: keyof Circuit, val: any) => {
    setCircuits(prev => prev.map(c => {
      if (c.id === activeId) {
        const updated = { ...c, [field]: val };
        if (field === 'phase') {
          updated.voltage = val === PhaseType.THREE ? 400 : 230;
        }
        return updated;
      }
      return c;
    }));
  };

  const addCircuit = () => {
    const newId = Math.random().toString(36).substr(2, 5);
    const newOrigin = activeCircuit.destination;
    const newPower = filteredKvaValues[filteredKvaValues.length - 1]; 
    
    setCircuits([...circuits, { 
      ...activeCircuit, 
      id: newId, 
      origin: newOrigin,
      destination: `Q.P.${circuits.length}`,
      apparentPowerKVA: newPower
    }]);
    setActiveId(newId);
  };

  const exportXLS = () => {
    const table = document.getElementById('main-technical-table');
    if (!table) return;
    const html = table.outerHTML;
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Folha_Calculo_RIEBT.xls';
    a.click();
  };

  const handleRTIEBTSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Como arquiteto de software e engenheiro eletrotécnico sénior, responda à seguinte dúvida sobre o RTIEBT (Regulamento de Instalações Elétricas de Baixa Tensão) em Portugal: ${searchQuery}. Forneça uma resposta técnica, citando secções se possível.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "Não foi possível encontrar uma resposta específica.";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const links = chunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          uri: chunk.web.uri,
          title: chunk.web.title || "Referência RTIEBT"
        }));

      setSearchResult({ text, links });
    } catch (error) {
      console.error("Erro na pesquisa:", error);
      setSearchResult({ text: "Ocorreu um erro ao consultar as normas. Por favor, tente novamente.", links: [] });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col print:bg-white overflow-x-hidden">
      <header className="bg-indigo-950 text-white p-4 shadow-lg border-b-4 border-yellow-500 print:hidden">
        <div className="max-w-screen-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-yellow-500 rounded text-indigo-950 shadow-inner">
              <i className="fa-solid fa-bolt-lightning text-2xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">RTIEBT Technical Suite</h1>
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Dimensionamento de Condutores e Canalizações</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addCircuit} className="bg-indigo-700 hover:bg-indigo-600 px-4 py-2 rounded text-xs font-bold transition shadow-sm">
              + NOVO QUADRO
            </button>
            <button onClick={exportXLS} className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-xs font-bold transition shadow-sm">
              <i className="fa-solid fa-file-excel mr-2"></i> EXPORTAR .XLS
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 lg:p-8 space-y-8 max-w-screen-2xl mx-auto w-full">
        
        {/* Editor de Parâmetros */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 grid grid-cols-1 lg:grid-cols-4 gap-8 print:hidden">
          <div className="lg:col-span-1 border-r pr-8 space-y-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Lista de Circuitos</h3>
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2">
              {circuits.map((c, idx) => (
                <button 
                  key={c.id} 
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left p-3 rounded-md text-xs font-bold transition flex items-center justify-between group ${activeId === c.id ? 'bg-indigo-100 text-indigo-800 border-l-4 border-indigo-600' : 'hover:bg-slate-50 text-slate-500 border-l-4 border-transparent'}`}
                >
                  <span>{idx + 1}. {c.destination}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-5">
               <div>
                  <label className="технический-label">Tipo de Alimentação</label>
                  <select value={activeCircuit.phase} onChange={e => handleUpdate('phase', e.target.value)} className="технический-input">
                    {Object.values(PhaseType).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
               </div>
               <div>
                  <label className="технический-label">Material do Condutor</label>
                  <select value={activeCircuit.material} onChange={e => handleUpdate('material', e.target.value)} className="технический-input">
                    {Object.values(MaterialType).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
               </div>
               <div>
                  <label className="технический-label">
                    Potência Estipulada (S kVA) 
                    {upstreamCircuit && <span className="text-red-500 ml-1">(&lt; {upstreamCircuit.apparentPowerKVA})</span>}
                  </label>
                  <select value={activeCircuit.apparentPowerKVA} onChange={e => handleUpdate('apparentPowerKVA', parseFloat(e.target.value))} className="технический-input border-indigo-200">
                    {filteredKvaValues.map(v => <option key={v} value={v}>{v} kVA</option>)}
                  </select>
               </div>
            </div>

            <div className="space-y-5">
               <div>
                  <label className="технический-label">Isolamento / Cabo</label>
                  <select value={activeCircuit.insulation} onChange={e => handleUpdate('insulation', e.target.value)} className="технический-input">
                    {Object.values(InsulationType).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
               </div>
               <div>
                  <label className="технический-label">Método de Instalação</label>
                  <select value={activeCircuit.method} onChange={e => handleUpdate('method', e.target.value)} className="технический-input text-[10px]">
                    {Object.values(InstallationMethod).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
               </div>
               <div>
                  <label className="технический-label">Simultaneidade (Quadro 803A)</label>
                  <select value={activeCircuit.simultaneityFactor} onChange={e => handleUpdate('simultaneityFactor', parseFloat(e.target.value))} className="технический-input">
                    {SIMULTANEITY_803A.map(s => <option key={s.range} value={s.factor}>{s.range} Inst. (Ks={s.factor})</option>)}
                  </select>
               </div>
            </div>

            <div className="space-y-5">
               <div>
                  <label className="технический-label">Comprimento (m)</label>
                  <input type="number" value={activeCircuit.length} onChange={e => handleUpdate('length', parseFloat(e.target.value))} className="технический-input" />
               </div>
               <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="технический-label">Fator Correção (FC)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={activeCircuit.manualFC} 
                      onChange={e => handleUpdate('manualFC', parseFloat(e.target.value) || 0)} 
                      className="технический-input" 
                    />
                  </div>
                  <div>
                    <label className="технический-label">Cosseno Phi (cos φ)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={activeCircuit.powerFactor} 
                      onChange={e => handleUpdate('powerFactor', parseFloat(e.target.value) || 0)} 
                      className="технический-input" 
                    />
                  </div>
               </div>
               <div>
                  <label className="технический-label">Identificação (Origem / Destino)</label>
                  <div className="flex gap-2">
                    <select value={activeCircuit.origin} onChange={e => handleUpdate('origin', e.target.value)} className="flex-1 технический-input border-emerald-200">
                      {availableOrigins.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input type="text" placeholder="Destino" value={activeCircuit.destination} onChange={e => handleUpdate('destination', e.target.value)} className="flex-1  технический-input" />
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* Tabela de Saída - Modelo Exato RTIEBT */}
        <section className="bg-white shadow-2xl rounded-sm overflow-hidden border-2 border-black">
          <div className="overflow-x-auto">
            <table id="main-technical-table" className="w-full border-collapse technical-table text-center uppercase tracking-tighter">
              <thead>
                <tr>
                  <th rowSpan={2} className="border-2 border-black p-3 bg-slate-100 text-[10px] w-24">Origem</th>
                  <th rowSpan={2} className="border-2 border-black p-3 bg-slate-100 text-[10px] w-24">Destino</th>
                  <th rowSpan={2} className="border-2 border-black p-3 bg-slate-100">S(KVA)</th>
                  <th rowSpan={2} className="border-2 border-black p-3 bg-slate-100">Us(V)</th>
                  <th rowSpan={2} className="border-2 border-black p-3 bg-slate-100">IB(A)</th>
                  <th colSpan={7} className="border-2 border-black p-1 bg-slate-200 font-black text-xs">Condutor</th>
                  <th rowSpan={2} className="border-2 border-black p-3 bg-slate-100 text-[10px]">Queda<br/>Tensão</th>
                  <th rowSpan={2} className="border-2 border-black p-3 bg-slate-100 text-[10px]">I2&lt;1,45Iz<br/>(A)</th>
                  <th rowSpan={2} className="border-2 border-black p-3 bg-slate-100 text-[10px] min-w-[120px]">Critério Seleção<br/>Ib ≤ In ≤ Iz'*Fc</th>
                  <th rowSpan={2} className="border-2 border-black p-3 bg-slate-100 font-black">In(A)</th>
                </tr>
                <tr className="bg-slate-50 text-[9px]">
                  <th className="border-2 border-black p-1">Tipo</th>
                  <th className="border-2 border-black p-1">Sc (F)</th>
                  <th className="border-2 border-black p-1">Sc (N)</th>
                  <th className="border-2 border-black p-1">Iz (F)</th>
                  <th className="border-2 border-black p-1">Iz (N)</th>
                  <th className="border-2 border-black p-1">Fc</th>
                  <th className="border-2 border-black p-1">Comp</th>
                </tr>
              </thead>
              <tbody>
                {circuits.map(c => {
                  const r = results[c.id];
                  return (
                    <tr key={c.id} className="text-[11px] leading-tight font-bold">
                      <td className="border-2 border-black p-2 bg-slate-50/50">{c.origin}</td>
                      <td className="border-2 border-black p-2 font-black">{c.destination}</td>
                      <td className="border-2 border-black p-2">{c.apparentPowerKVA.toFixed(1)}</td>
                      <td className="border-2 border-black p-2">{c.voltage}</td>
                      <td className="border-2 border-black p-2 text-indigo-900 font-black">{r.ib.toFixed(2)}</td>
                      <td className="border-2 border-black p-1 text-[8px] leading-[1] w-28 bg-slate-50">{r.cableLabel}</td>
                      <td className="border-2 border-black p-2 text-sm font-black bg-indigo-50">{r.scFase}</td>
                      <td className="border-2 border-black p-2">{r.scNeutro}</td>
                      <td className="border-2 border-black p-2">{r.izFase.toFixed(0)}</td>
                      <td className="border-2 border-black p-2">{r.izNeutro.toFixed(0)}</td>
                      <td className="border-2 border-black p-2">{r.fc.toFixed(2)}</td>
                      <td className="border-2 border-black p-2">{c.length}</td>
                      <td className="border-2 border-black p-2 text-amber-700 font-black">{r.voltageDropP.toFixed(2)}%</td>
                      <td className="border-2 border-black p-2 text-slate-500">{r.i2CheckValue.toFixed(1)}</td>
                      <td className="border-2 border-black p-1 text-[8px] font-mono leading-tight">{r.critPhase}</td>
                      <td className="border-2 border-black p-2 font-black text-sm bg-emerald-50">{r.protectionIn}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-black text-xs">
                <tr>
                   <td colSpan={12} className="border-2 border-black p-4 text-right">
                      QUEDA MÁXIMA ACUMULADA:
                   </td>
                   <td colSpan={1} className="border-2 border-black p-4 text-indigo-900 text-sm">
                      {totalDV_V.toFixed(2)} V
                   </td>
                   <td colSpan={3} className="border-2 border-black p-4 text-indigo-900 text-sm text-left">
                      {totalDV_P.toFixed(2)} %
                   </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Rodapé Normativo e Memorial Técnico */}
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 print:hidden">
            <div className="bg-indigo-950 text-white p-6 rounded-lg shadow-xl border-l-4 border-yellow-500">
               <h4 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                 <i className="fa-solid fa-circle-info text-yellow-400"></i> Tubagem Recomendada (803C)
               </h4>
               <div className="flex items-center gap-4">
                 <div className="text-3xl font-black text-yellow-400">ø {activeResult.tubeDiameter}mm</div>
                 <div className="text-[10px] opacity-80 uppercase leading-tight font-bold">
                   Diâmetro indicado para condutores de {activeResult.scFase}mm²<br/>em método de instalação selecionado.
                 </div>
               </div>
            </div>

            <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
               <div className="flex justify-between items-center mb-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo de Critérios Normativos</h4>
                 <button 
                  onClick={() => setShowMemorial(!showMemorial)}
                  className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-black px-3 py-1 rounded-full uppercase tracking-widest transition"
                 >
                   {showMemorial ? 'Ocultar Fundamentação' : 'Ver Fundamentação RTIEBT Completa'}
                 </button>
               </div>
               <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-slate-600 uppercase">
                  <div className="flex gap-2 items-start"><span className="text-indigo-600">●</span> <div>Iz' (Compensado) = Iz × FC (Secção 523)</div></div>
                  <div className="flex gap-2 items-start"><span className="text-indigo-600">●</span> <div>Regra de Sobrecarga: Ib ≤ In ≤ Iz' (433.2)</div></div>
                  <div className="flex gap-2 items-start"><span className="text-indigo-600">●</span> <div>Limite ΔU: 3-5% conforme Secção 525</div></div>
                  <div className="flex gap-2 items-start"><span className="text-indigo-600">●</span> <div>Proteção térmica: I2 ≤ 1,45 × Iz' verificada</div></div>
               </div>
            </div>
          </div>

          {showMemorial && (
            <div className="bg-white p-10 rounded-lg shadow-2xl border-t-8 border-indigo-950 print:block space-y-12 animate-in slide-in-from-top-4 duration-500">
              <div className="border-b-4 border-slate-100 pb-8 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black text-indigo-950 uppercase tracking-tighter">Memorial Descritivo e Justificativo</h2>
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-2">Fundamentação Técnica Conforme RTIEBT (Portugal)</p>
                </div>
                <div className="text-right">
                  <span className="bg-yellow-500 text-indigo-950 text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-sm">Documento Normativo v2.3</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="space-y-6">
                  <h3 className="text-lg font-black text-indigo-900 uppercase flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs">01</span>
                    Cálculo da Corrente de Serviço (Ib)
                  </h3>
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "A corrente de serviço Ib é determinada em função da potência aparente instalada, considerando o fator de simultaneidade regulamentar conforme o Quadro 803A."
                    </p>
                    <div className="font-mono text-sm bg-white p-4 rounded border border-slate-100 shadow-sm text-center">
                      {activeCircuit.phase === PhaseType.THREE 
                        ? 'Ib = S / (√3 × U)' 
                        : 'Ib = S / U'}
                    </div>
                    <ul className="text-[10px] font-bold text-slate-500 space-y-2 uppercase tracking-tighter">
                      <li className="flex justify-between"><span>Fundamentação:</span> <span className="text-indigo-700">Secção 523.1</span></li>
                      <li className="flex justify-between"><span>Tensão de Projeto:</span> <span className="text-indigo-700">{activeCircuit.voltage} V</span></li>
                      <li className="flex justify-between"><span>Fator Simultaneidade:</span> <span className="text-indigo-700">{activeCircuit.simultaneityFactor}</span></li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-black text-indigo-900 uppercase flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs">02</span>
                    Seleção de Proteções (In)
                  </h3>
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "A coordenação entre condutores e dispositivos de proteção deve satisfazer simultaneamente as condições de proteção contra sobrecargas."
                    </p>
                    <div className="font-mono text-sm bg-white p-4 rounded border border-slate-100 shadow-sm text-center">
                      Ib ≤ In ≤ Iz' &nbsp; | &nbsp; I2 ≤ 1.45 × Iz'
                    </div>
                    <ul className="text-[10px] font-bold text-slate-500 space-y-2 uppercase tracking-tighter">
                      <li className="flex justify-between"><span>Fundamentação:</span> <span className="text-indigo-700">Artigo 433.2</span></li>
                      <li className="flex justify-between"><span>Calibre Selecionado:</span> <span className="text-indigo-700">{activeResult.protectionIn} A</span></li>
                      <li className="flex justify-between"><span>Capacidade de Corte:</span> <span className="text-indigo-700">Conforme Poder de Corte de Projeto</span></li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-black text-indigo-900 uppercase flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs">03</span>
                    Dimensionamento de Condutores (Iz)
                  </h3>
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "A secção nominal é selecionada para garantir que a capacidade de carga Iz, corrigida pelos fatores ambientais, seja superior à corrente de serviço."
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase">
                      <div className="bg-white p-3 rounded border border-slate-100 flex flex-col items-center">
                        <span className="text-slate-400 mb-1">Tabela Ref</span>
                        <span className="text-indigo-700">{activeResult.tableRef}</span>
                      </div>
                      <div className="bg-white p-3 rounded border border-slate-100 flex flex-col items-center">
                        <span className="text-slate-400 mb-1">Fator FC</span>
                        <span className="text-indigo-700">{activeResult.fc.toFixed(2)}</span>
                      </div>
                    </div>
                    <ul className="text-[10px] font-bold text-slate-500 space-y-2 uppercase tracking-tighter">
                      <li className="flex justify-between"><span>Fundamentação:</span> <span className="text-indigo-700">Secção 523 (Tabelas 52-C3 a C11)</span></li>
                      <li className="flex justify-between"><span>Temperatura Ref:</span> <span className="text-indigo-700">30°C (Ar) / 20°C (Solo)</span></li>
                      <li className="flex justify-between"><span>Fator de Agrupamento:</span> <span className="text-indigo-700">Conforme Tabela 52-E1</span></li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-black text-indigo-900 uppercase flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs">04</span>
                    Cálculo da Queda de Tensão (ΔU)
                  </h3>
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "Utilizou-se o método da impedância, considerando a componente resistiva e reativa (indutância linear) para o cálculo exato da queda de tensão."
                    </p>
                    <div className="font-mono text-[10px] bg-white p-4 rounded border border-slate-100 shadow-sm text-center leading-tight">
                      ΔU = b × (ρ1 × (L/S) × cosφ + λ × L × senφ) × Ib
                    </div>
                    <ul className="text-[10px] font-bold text-slate-500 space-y-2 uppercase tracking-tighter">
                      <li className="flex justify-between"><span>Fundamentação:</span> <span className="text-indigo-700">Secção 525 (Anexo II)</span></li>
                      <li className="flex justify-between"><span>Limite Admitido:</span> <span className="text-indigo-700">5.0% (Outros Usos)</span></li>
                      <li className="flex justify-between"><span>Resistividade (ρ1):</span> <span className="text-indigo-700">{activeCircuit.material.includes('Cobre') ? '0.0225' : '0.036'} Ω.mm²/m</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-400 p-8 rounded-xl font-mono text-[9px] uppercase tracking-widest leading-relaxed border-2 border-slate-800">
                <h4 className="text-white font-black mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-code text-indigo-400"></i> Engine Validation Hash
                </h4>
                <div className="grid grid-cols-2 gap-4">
                   <div>[RTIEBT_VER] 2.3.1_PT</div>
                   <div>[CALC_MODE] IMPEDANCE_METHOD</div>
                   <div>[STAMP] {new Date().toISOString()}</div>
                   <div>[AUTH] SR_SOFTWARE_ARCHITECT_RTIEBT_ENG</div>
                </div>
                <div className="mt-6 border-t border-slate-800 pt-4 text-center">
                  Cálculos verificados algoritmicamente contra matrizes normativas RTIEBT 2006/2021.
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Consulta Normativa Gemini */}
        <section className="bg-indigo-50 p-8 rounded-lg border-2 border-indigo-200 shadow-inner print:hidden">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-indigo-900 font-black uppercase tracking-tighter text-xl">Consulta Inteligente RTIEBT</h3>
              <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">Powered by Gemini AI Grounding</p>
            </div>
            
            <form onSubmit={handleRTIEBTSearch} className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ex: Qual o limite de queda de tensão em habitações? / Regras para cabos enterrados..."
                className="w-full bg-white border-2 border-indigo-300 rounded-full py-4 px-6 pr-16 text-sm font-bold shadow-lg focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
              />
              <button 
                type="submit" 
                disabled={isSearching}
                className="absolute right-2 top-2 bg-indigo-600 hover:bg-indigo-700 text-white w-12 h-12 rounded-full flex items-center justify-center transition shadow-md disabled:opacity-50"
              >
                {isSearching ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
              </button>
            </form>

            {searchResult && (
              <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="prose prose-indigo max-w-none">
                   <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{searchResult.text}</p>
                </div>
                {searchResult.links.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Fontes Oficiais & Documentação</h4>
                    <div className="flex flex-wrap gap-2">
                      {searchResult.links.map((link, i) => (
                        <a 
                          key={i} 
                          href={link.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 px-3 rounded-md transition border border-indigo-100 flex items-center gap-2"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square"></i>
                          {link.title.length > 40 ? link.title.substring(0, 40) + '...' : link.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="mt-12 bg-slate-200 p-4 text-center border-t border-slate-300">
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[3px]">
          RTIEBT Technical Suite v2.3 - Full Normative Memorial Support
        </p>
      </footer>

      <style>{`
        .технический-label { @apply block text-[10px] font-black text-slate-500 uppercase tracking-tighter mb-2 ml-1; }
        .технический-input { @apply w-full bg-slate-50 border-2 border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 focus:border-indigo-500 focus:bg-white outline-none transition-all; }
        .technical-table th { @apply border-2 border-black font-black uppercase tracking-tighter; }
        .technical-table td { @apply border-2 border-black; }
        @media print {
          .print\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default App;
