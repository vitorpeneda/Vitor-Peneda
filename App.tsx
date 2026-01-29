
import React, { useState, useMemo } from 'react';
import { 
  PhaseType, InsulationType, MaterialType, InstallationMethod, UsageType,
  Circuit, DimensioningResult 
} from './types';
import { calculateCircuit } from './rieBTService';
import { STANDARD_KVA_VALUES, SIMULTANEITY_803A, GROUPING_LIST } from './constants';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [circuits, setCircuits] = useState<Circuit[]>([
    {
      id: '1', origin: 'P100', destination: 'Q.G.E.',
      apparentPowerKVA: 27.6, 
      simultaneityFactor: 1.0,
      powerFactor: 0.9,
      voltage: 400, phase: PhaseType.THREE, insulation: InsulationType.XLPE,
      material: MaterialType.COPPER, method: InstallationMethod.B1,
      usage: UsageType.POWER,
      length: 13, ambientTemp: 30, groupingCount: 1, hasHarmonics: false
    }
  ]);

  const [activeId, setActiveId] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{ text: string, links: { uri: string, title: string }[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showMemorial, setShowMemorial] = useState(true);

  const activeCircuit = useMemo(() => circuits.find(c => c.id === activeId) || circuits[0], [circuits, activeId]);
  
  // Lógica de limitação de potência: Encontrar o circuito a montante
  const upstreamCircuit = useMemo(() => {
    return circuits.find(c => c.destination === activeCircuit.origin);
  }, [circuits, activeCircuit.origin]);

  const availableKvaValues = useMemo(() => {
    if (!upstreamCircuit) return STANDARD_KVA_VALUES;
    const maxS = upstreamCircuit.apparentPowerKVA;
    return STANDARD_KVA_VALUES.filter(v => v <= maxS);
  }, [upstreamCircuit]);

  const results = useMemo(() => circuits.reduce((acc, c) => {
    acc[c.id] = calculateCircuit(c);
    return acc;
  }, {} as Record<string, DimensioningResult>), [circuits]);

  const activeResult = results[activeCircuit.id];

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
    const parentS = activeCircuit.apparentPowerKVA;
    const initialS = STANDARD_KVA_VALUES.filter(v => v <= parentS).pop() || STANDARD_KVA_VALUES[0];

    setCircuits([...circuits, { 
      ...activeCircuit, 
      id: newId, 
      destination: `Q.P.${circuits.length + 1}`, 
      origin: activeCircuit.destination,
      apparentPowerKVA: initialS,
      length: 10
    }]);
    setActiveId(newId);
  };

  const removeCircuit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (circuits.length <= 1) return;
    const newCircuits = circuits.filter(c => c.id !== id);
    setCircuits(newCircuits);
    if (activeId === id) setActiveId(newCircuits[0].id);
  };

  const exportXLS = () => {
    const reportContainer = document.getElementById('full-report-container');
    if (!reportContainer) return;
    const clone = reportContainer.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-export').forEach(el => el.remove());

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; border: 1pt solid black; }
          th { background-color: #f3f4f6; border: 1pt solid black; font-family: Calibri; font-size: 9pt; font-weight: bold; text-align: center; }
          td { border: 1pt solid black; padding: 4px; font-family: Calibri; font-size: 8pt; text-align: center; }
        </style>
      </head>
      <body>${clone.innerHTML}</body>
      </html>
    `;
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Report_RTIEBT_Professional_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
  };

  const handleRTIEBTSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analise regulamentar RTIEBT (Portugal) para: ${searchQuery}. Cite secções e quadros.`,
        config: { tools: [{ googleSearch: {} }] },
      });
      setSearchResult({ 
        text: response.text || "Sem resposta.", 
        links: (response.candidates?.[0]?.groundingMetadata?.groundingChunks || []).filter((c: any) => c.web).map((c: any) => ({ uri: c.web.uri, title: c.web.title })) 
      });
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col print:bg-white overflow-x-hidden">
      <header className="bg-indigo-950 text-white p-5 shadow-lg border-b-4 border-yellow-500 print:hidden">
        <div className="max-w-screen-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-yellow-500 rounded text-indigo-950 shadow-inner flex items-center justify-center">
              <i className="fa-solid fa-bolt-lightning text-3xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">RTIEBT Technical Suite</h1>
              <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-[0.2em] mt-1">Dimensionamento Elétrico Profissional</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={addCircuit} className="bg-indigo-700 hover:bg-indigo-600 px-5 py-2.5 rounded text-xs font-black uppercase transition-all shadow-md active:scale-95">+ ADICIONAR QUADRO</button>
            <button onClick={exportXLS} className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded text-xs font-black uppercase transition-all shadow-md active:scale-95">
              <i className="fa-solid fa-file-excel mr-2"></i> EXPORTAR XLS
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 lg:p-8 space-y-8 max-w-screen-2xl mx-auto w-full">
        {/* Painel de Configuração v3.0 */}
        <section className="bg-white p-8 rounded-xl shadow-xl border border-slate-200 grid grid-cols-1 lg:grid-cols-4 gap-10 print:hidden">
          <div className="lg:col-span-1 border-r border-slate-100 pr-8 space-y-5">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Painel de Controlo</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
              {circuits.map((c, idx) => (
                <button 
                  key={c.id} 
                  onClick={() => setActiveId(c.id)} 
                  className={`w-full text-left p-4 rounded-lg text-xs font-bold transition-all flex items-center justify-between group relative border ${activeId === c.id ? 'bg-indigo-50 text-indigo-900 border-indigo-200 shadow-sm' : 'hover:bg-slate-50 text-slate-500 border-transparent'}`}
                >
                  <span className="truncate pr-6 uppercase">{idx + 1}. {c.destination}</span>
                  {circuits.length > 1 && <i onClick={(e) => removeCircuit(e, c.id)} className="fa-solid fa-trash-can absolute right-4 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-1"></i>}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-6">
               <h4 className="text-[11px] font-black text-indigo-900 uppercase border-b border-indigo-100 pb-2 flex items-center gap-2">Alimentação</h4>
               <div>
                  <label className="технический-label">Potência S (kVA) {upstreamCircuit && <span className="text-red-600 font-black ml-1">Max: {upstreamCircuit.apparentPowerKVA}</span>}</label>
                  <select value={activeCircuit.apparentPowerKVA} onChange={e => handleUpdate('apparentPowerKVA', parseFloat(e.target.value))} className="технический-input border-indigo-300">
                    {availableKvaValues.map(v => <option key={v} value={v}>{v} kVA</option>)}
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="технический-label">Condutor</label>
                    <select value={activeCircuit.material} onChange={e => handleUpdate('material', e.target.value)} className="технический-input">
                      {Object.values(MaterialType).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="технический-label">Fases</label>
                    <select value={activeCircuit.phase} onChange={e => handleUpdate('phase', e.target.value)} className="технический-input">
                      {Object.values(PhaseType).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
               </div>
               <div>
                  <label className="технический-label">Ks (Simultaneidade)</label>
                  <select value={activeCircuit.simultaneityFactor} onChange={e => handleUpdate('simultaneityFactor', parseFloat(e.target.value))} className="технический-input">
                    {SIMULTANEITY_803A.map(s => <option key={s.factor} value={s.factor}>{s.range} (Ks={s.factor})</option>)}
                  </select>
               </div>
            </div>

            <div className="space-y-6">
               <h4 className="text-[11px] font-black text-indigo-900 uppercase border-b border-indigo-100 pb-2 flex items-center gap-2">Meio Envolvente</h4>
               <div>
                  <label className="технический-label">Agrupamento K2</label>
                  <select value={activeCircuit.groupingCount} onChange={e => handleUpdate('groupingCount', parseInt(e.target.value))} className="технический-input">
                    {GROUPING_LIST.map(g => <option key={g.count} value={g.count}>{g.label}</option>)}
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="технический-label">Temp. Amb. (°C)</label>
                    <input type="number" value={activeCircuit.ambientTemp} onChange={e => handleUpdate('ambientTemp', parseInt(e.target.value))} className="технический-input" />
                  </div>
                  <div>
                    <label className="технический-label">cos φ</label>
                    <input type="number" step="0.01" min="0" max="1" value={activeCircuit.powerFactor} onChange={e => handleUpdate('powerFactor', parseFloat(e.target.value))} className="технический-input" />
                  </div>
               </div>
               <div className="flex items-center gap-3 mt-4 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                  <input type="checkbox" id="harmonics" checked={activeCircuit.hasHarmonics} onChange={e => handleUpdate('hasHarmonics', e.target.checked)} className="w-5 h-5 accent-indigo-600 rounded" />
                  <label htmlFor="harmonics" className="text-[10px] font-black text-indigo-900 uppercase leading-none cursor-pointer">Harmónicos (THD &gt; 15%)</label>
               </div>
            </div>

            <div className="space-y-6">
               <h4 className="text-[11px] font-black text-indigo-900 uppercase border-b border-indigo-100 pb-2 flex items-center gap-2">Instalação</h4>
               <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="технический-label">Utilização & Limite ΔU</label>
                    <select value={activeCircuit.usage} onChange={e => handleUpdate('usage', e.target.value)} className="технический-input">
                      {Object.values(UsageType).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="технический-label">Método de Instalação</label>
                    <select value={activeCircuit.method} onChange={e => handleUpdate('method', e.target.value)} className="технический-input text-[10px]">
                      {Object.values(InstallationMethod).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="технический-label">L (m)</label>
                    <input type="number" value={activeCircuit.length} onChange={e => handleUpdate('length', parseFloat(e.target.value))} className="технический-input" />
                  </div>
                  <div>
                    <label className="технический-label">Destino</label>
                    <input type="text" value={activeCircuit.destination} onChange={e => handleUpdate('destination', e.target.value)} className="технический-input" />
                  </div>
               </div>
            </div>
          </div>
        </section>

        <div id="full-report-container" className="space-y-4">
          {/* Tabela de Saída com o NOVO LAYOUT de 3 NÍVEIS */}
          <section className="bg-white shadow-2xl rounded-sm overflow-hidden border-2 border-black">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse technical-table text-center uppercase text-[10px] leading-tight font-sans">
                <thead>
                  {/* Nível 1 */}
                  <tr className="bg-slate-100">
                    <th rowSpan={3} className="border-2 border-black p-2 font-bold w-20">Origem</th>
                    <th rowSpan={3} className="border-2 border-black p-2 font-bold w-32">Destino</th>
                    <th rowSpan={3} className="border-2 border-black p-2 font-bold w-16">S(KVA)</th>
                    <th rowSpan={3} className="border-2 border-black p-2 font-bold w-16">Us(V)</th>
                    <th rowSpan={3} className="border-2 border-black p-2 font-bold w-16">IB(A)</th>
                    <th colSpan={7} className="border-2 border-black p-1 font-bold bg-slate-200">Condutor</th>
                    <th rowSpan={3} className="border-2 border-black p-2 font-bold w-16">Queda<br/>Tensão</th>
                    <th rowSpan={3} className="border-2 border-black p-2 font-bold w-20">I2&lt;1,45Iz<br/>(A)</th>
                    <th rowSpan={3} className="border-2 border-black p-2 font-bold min-w-[140px]">
                      Is ≤ In ≤ Iz(F)*Fc<br/><br/>
                      Is ≤ In ≤ Iz(N)*Fc
                    </th>
                    <th rowSpan={3} className="border-2 border-black p-2 font-black text-xs bg-slate-100">In(A)</th>
                  </tr>
                  {/* Nível 2 */}
                  <tr className="bg-slate-50">
                    <th rowSpan={2} className="border-2 border-black p-1 font-bold">Tipo</th>
                    <th colSpan={2} className="border-2 border-black p-1 font-bold">Sc (mm2)</th>
                    <th colSpan={2} className="border-2 border-black p-1 font-bold">Iz(A)</th>
                    <th rowSpan={2} className="border-2 border-black p-1 font-bold w-10">Fc</th>
                    <th rowSpan={2} className="border-2 border-black p-1 font-bold w-10">Comp</th>
                  </tr>
                  {/* Nível 3 */}
                  <tr className="bg-slate-50">
                    <th className="border-2 border-black p-1 font-bold w-10">Fase</th>
                    <th className="border-2 border-black p-1 font-bold w-10">Neutro</th>
                    <th className="border-2 border-black p-1 font-bold w-10">Fase</th>
                    <th className="border-2 border-black p-1 font-bold w-10">Neutro</th>
                  </tr>
                </thead>
                <tbody>
                  {circuits.map(c => {
                    const r = results[c.id];
                    const isTrif = c.phase === PhaseType.THREE;
                    const izVal = r.izFase; 
                    const limit = (r.izCorrected).toFixed(1);

                    return (
                      <tr key={c.id} className="border-b border-black font-bold text-black bg-white">
                        <td className="border-2 border-black p-2">{c.origin}</td>
                        <td className="border-2 border-black p-2 text-left">{c.destination}</td>
                        <td className="border-2 border-black p-2">{c.apparentPowerKVA.toFixed(1)}</td>
                        <td className="border-2 border-black p-2">230</td>
                        <td className="border-2 border-black p-2 text-indigo-800">{r.ib.toFixed(2)}</td>
                        {/* Condutor */}
                        <td className="border-2 border-black p-1 text-[8px] italic leading-tight">
                          {r.cableLabel}<br/>{isTrif ? 'Trifásico' : 'Monofásico'}
                        </td>
                        <td className="border-2 border-black p-2 text-base font-black bg-indigo-50">{r.scFase}</td>
                        <td className="border-2 border-black p-2">{r.scNeutro}</td>
                        <td className="border-2 border-black p-2">{izVal.toFixed(0)}</td>
                        <td className="border-2 border-black p-2">{izVal.toFixed(0)}</td>
                        <td className="border-2 border-black p-2">{r.fc.toFixed(2)}</td>
                        <td className="border-2 border-black p-2">{c.length}</td>
                        
                        <td className={`border-2 border-black p-2 ${r.voltageDropP > r.maxDeltaU ? 'text-red-600' : 'text-amber-700'}`}>{r.voltageDropP.toFixed(2)}</td>
                        <td className="border-2 border-black p-2">{r.i2CheckValue.toFixed(2)}</td>
                        <td className="border-2 border-black p-1 text-[9px] font-mono leading-relaxed bg-slate-50">
                          {r.ib.toFixed(2)} ≤ In ≤ {limit}<br/><br/>
                          {r.ib.toFixed(2)} ≤ In ≤ {limit}
                        </td>
                        <td className="border-2 border-black p-2 font-black text-sm bg-indigo-950 text-white">{r.protectionIn}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Memorial Técnico Profissional (Fundamentação Detalhada) */}
          {showMemorial && activeResult && (
            <div className="bg-white p-12 rounded-xl shadow-2xl border-t-8 border-indigo-950 space-y-12 animate-in slide-in-from-bottom-5 duration-700">
              <div className="border-b-4 border-slate-200 pb-10 flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-black text-indigo-950 uppercase tracking-tighter">Memorial de Cálculo</h2>
                  <p className="text-sm text-slate-500 font-bold uppercase tracking-[0.3em] mt-3">Fundamentação Normativa RTIEBT - PORTUGAL</p>
                </div>
                <div className="text-right">
                  <div className="bg-yellow-500 text-indigo-950 text-[10px] font-black px-5 py-2 rounded-full uppercase tracking-widest inline-block shadow-sm">Relatório Técnico v3.5</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="space-y-6">
                  <h3 className="text-xl font-black text-indigo-900 uppercase flex items-center gap-3 border-l-4 border-indigo-600 pl-4">01. Corrente de Projeto (Ib)</h3>
                  <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 space-y-6 shadow-inner">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center">
                      <div className="font-serif italic text-sm text-slate-800">
                        Ib = (S × Ks) / (V_fator × U) = {activeResult.ib.toFixed(2)} A
                      </div>
                    </div>
                    <ul className="text-[10px] font-bold space-y-2 uppercase text-slate-500">
                      <li>• Potência Aparente Corrigida: {(activeCircuit.apparentPowerKVA * activeCircuit.simultaneityFactor).toFixed(2)} kVA</li>
                      <li>• Ref. Normativa: RTIEBT Secção 523 / Quadro 803A</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-black text-indigo-900 uppercase flex items-center gap-3 border-l-4 border-indigo-600 pl-4">02. Fatores Ambientais</h3>
                  <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 space-y-6 shadow-inner">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-white rounded border border-slate-200">
                        <span className="text-[10px] font-black uppercase text-slate-500">K1 (Temp @ {activeCircuit.ambientTemp}ºC):</span>
                        <span className="font-mono font-bold text-indigo-700">Ref. Q. 52-D1/D2</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-white rounded border border-slate-200">
                        <span className="text-[10px] font-black uppercase text-slate-500">K2 (Agrup. @ {activeCircuit.groupingCount} circ.):</span>
                        <span className="font-mono font-bold text-indigo-700">Ref. Q. 52-E1</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-indigo-950 rounded shadow-lg">
                        <span className="text-[11px] font-black uppercase text-indigo-200">FC Total:</span>
                        <span className="text-xl font-black text-yellow-500">{activeResult.fc.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-black text-indigo-900 uppercase flex items-center gap-3 border-l-4 border-indigo-600 pl-4">03. Queda de Tensão</h3>
                  <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 space-y-6 shadow-inner">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 font-mono text-[11px] text-center">
                      ΔU = b × (ρ1 × (L/S) × cosφ + λ × L × senφ) × Ib <br/>
                      <span className="text-indigo-800 font-bold block mt-3">Verificado: {activeResult.voltageDropP.toFixed(2)}% (Limite: {activeResult.maxDeltaU}%)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-black text-indigo-900 uppercase flex items-center gap-3 border-l-4 border-indigo-600 pl-4">04. Coordenação</h3>
                  <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 space-y-6 shadow-inner">
                    <div className="flex items-center justify-center p-5 bg-white rounded-xl border border-slate-200 text-center font-bold text-xs">
                      {activeResult.ib.toFixed(2)}A ≤ In({activeResult.protectionIn}A) ≤ {activeResult.izCorrected.toFixed(1)}A
                    </div>
                    <p className="text-[9px] font-black uppercase text-emerald-600 text-center tracking-widest"><i className="fa-solid fa-circle-check"></i> Condição 433.2 Satisfeita</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Gemini Integration */}
        <section className="bg-indigo-950 p-10 rounded-2xl border-4 border-indigo-900 shadow-2xl print:hidden no-export relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-10"><i className="fa-solid fa-microchip text-9xl text-white"></i></div>
          <div className="max-w-4xl mx-auto space-y-8 relative z-10">
            <div className="text-center space-y-2">
              <h3 className="text-white font-black uppercase text-2xl tracking-tighter flex items-center justify-center gap-3">
                <i className="fa-solid fa-brain text-yellow-400"></i> Consulta RTIEBT AI
              </h3>
            </div>
            <form onSubmit={handleRTIEBTSearch} className="relative">
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Dúvidas sobre o RTIEBT? Pergunte aqui..." 
                className="w-full bg-indigo-900/50 border-2 border-indigo-700/50 text-white rounded-full py-5 px-8 pr-20 text-sm font-bold shadow-2xl outline-none focus:border-yellow-500 transition-all placeholder:text-indigo-400" 
              />
              <button 
                type="submit" 
                className="absolute right-3 top-3 bg-yellow-500 text-indigo-950 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:bg-yellow-400 transition-all disabled:opacity-50" 
                disabled={isSearching}
              >
                {isSearching ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
              </button>
            </form>
            {searchResult && (
              <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6">
                <div className="prose prose-invert prose-sm max-w-none text-indigo-100 leading-relaxed font-medium whitespace-pre-wrap">
                  {searchResult.text}
                </div>
                {searchResult.links.map((l, i) => (
                  <a key={i} href={l.uri} target="_blank" className="text-[10px] bg-indigo-500/20 text-indigo-300 px-4 py-2 rounded-full font-black uppercase hover:bg-indigo-500/40 transition-all inline-flex items-center gap-2 mr-2">
                    <i className="fa-solid fa-link"></i> {l.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="mt-12 bg-indigo-950 text-indigo-500 p-8 text-center border-t border-indigo-900 no-export">
        <p className="text-[10px] font-black uppercase tracking-[0.5em]">RTIEBT Technical Suite | Professional v3.5</p>
      </footer>

      <style>{`
        .технический-label { @apply block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1 tracking-widest; }
        .технический-input { @apply w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:border-indigo-600 focus:bg-white outline-none transition-all shadow-sm; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .technical-table th, .technical-table td { @apply border-2 border-black; }
        @media print { .print\:hidden { display: none !important; } }
        .export-only { display: none; }
      `}</style>
    </div>
  );
};

export default App;
