import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Plus, Trash2, Edit3, Save, X, DollarSign, Wallet, Target, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const STORAGE_KEY = 'santiago_portfolio_v1';

// Categorías de activos con metadata
const CATEGORIES = {
  liquidez: { label: 'Liquidez ARS', color: '#8B7355', emoji: '◐' },
  renta_fija_ars: { label: 'Renta Fija ARS', color: '#5C8374', emoji: '◑' },
  cedears: { label: 'CEDEARs (USD)', color: '#1F4E5F', emoji: '◒' },
  cripto: { label: 'Cripto', color: '#C46B5C', emoji: '◓' },
  on_hd: { label: 'ON Hard Dollar', color: '#9B7B5A', emoji: '◔' },
  otros: { label: 'Otros', color: '#6B6B6B', emoji: '◕' },
};

const DEFAULT_DATA = {
  ccl: 1489,
  mep: 1437,
  inflacion_proy: 31.8,
  objetivo_usd: 12000,
  assets: [
    { id: 1, nombre: 'Cuenta a la vista', plataforma: 'Banco', categoria: 'liquidez', moneda: 'ARS', cantidad: 1000000, tna: 22.5, notas: '' },
    { id: 2, nombre: 'Plazo Fijo 30d', plataforma: 'Banco', categoria: 'renta_fija_ars', moneda: 'ARS', cantidad: 1000000, tna: 26.5, notas: 'Mover a LECAP al vencimiento' },
    { id: 3, nombre: 'USDT', plataforma: 'Binance', categoria: 'cripto', moneda: 'USD', cantidad: 257, tna: 0, notas: 'Mover a Lemon Earn' },
    { id: 4, nombre: 'ETH', plataforma: 'Lemon', categoria: 'cripto', moneda: 'USD', cantidad: 100, tna: 0, notas: 'Posición testimonial' },
  ],
  history: [],
  ultima_actualizacion: new Date().toISOString(),
};

// Helpers
const formatARS = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const formatUSD = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0);
const formatPct = (n) => `${(n || 0).toFixed(1)}%`;

export default function PortfolioDashboard() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [showRates, setShowRates] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');

  // Cargar data persistida
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result && result.value) {
          setData(JSON.parse(result.value));
        }
      } catch (e) {
        // Sin data previa, usamos default
      }
      setLoaded(true);
    })();
  }, []);

  // Guardar data
  const saveData = async (newData) => {
    setData(newData);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(newData));
    } catch (e) {
      console.error('Error guardando', e);
    }
  };

  // Cálculos derivados
  const calculations = useMemo(() => {
    const ccl = data.ccl || 1489;
    
    const enriched = data.assets.map(a => {
      const valor_ars = a.moneda === 'ARS' ? a.cantidad : a.cantidad * ccl;
      const valor_usd = a.moneda === 'USD' ? a.cantidad : a.cantidad / ccl;
      return { ...a, valor_ars, valor_usd };
    });

    const total_ars = enriched.reduce((s, a) => s + a.valor_ars, 0);
    const total_usd = enriched.reduce((s, a) => s + a.valor_usd, 0);

    // Por categoría
    const por_categoria = {};
    Object.keys(CATEGORIES).forEach(cat => {
      por_categoria[cat] = enriched
        .filter(a => a.categoria === cat)
        .reduce((s, a) => s + a.valor_usd, 0);
    });

    // Por moneda (exposición real)
    const exp_ars = enriched.filter(a => a.moneda === 'ARS').reduce((s, a) => s + a.valor_usd, 0);
    const exp_usd = enriched.filter(a => a.moneda === 'USD').reduce((s, a) => s + a.valor_usd, 0);

    const progreso = (total_usd / data.objetivo_usd) * 100;

    return { enriched, total_ars, total_usd, por_categoria, exp_ars, exp_usd, progreso };
  }, [data]);

  // Datos para charts
  const pieData = useMemo(() => {
    return Object.entries(calculations.por_categoria)
      .filter(([, v]) => v > 0)
      .map(([cat, val]) => ({
        name: CATEGORIES[cat].label,
        value: val,
        color: CATEGORIES[cat].color,
      }));
  }, [calculations]);

  const monedaData = useMemo(() => [
    { name: 'Pesos', value: calculations.exp_ars, color: '#C46B5C' },
    { name: 'Dólares', value: calculations.exp_usd, color: '#1F4E5F' },
  ].filter(d => d.value > 0), [calculations]);

  // Snapshot histórico
  const takeSnapshot = async () => {
    const snapshot = {
      fecha: new Date().toISOString().split('T')[0],
      total_usd: calculations.total_usd,
      total_ars: calculations.total_ars,
      ccl: data.ccl,
    };
    const newHistory = [...(data.history || []), snapshot];
    // Dedupe por fecha (último gana)
    const dedup = Object.values(newHistory.reduce((acc, s) => ({ ...acc, [s.fecha]: s }), {}));
    await saveData({ ...data, history: dedup, ultima_actualizacion: new Date().toISOString() });
  };

  const historyChart = useMemo(() => {
    return (data.history || []).slice(-30).map(h => ({
      fecha: h.fecha.slice(5),
      USD: Math.round(h.total_usd),
    }));
  }, [data.history]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F4EFE6' }}>
        <div className="font-mono text-sm" style={{ color: '#1F4E5F' }}>Cargando portafolio…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ 
      backgroundColor: '#F4EFE6',
      backgroundImage: 'radial-gradient(circle at 20% 0%, rgba(31, 78, 95, 0.04) 0%, transparent 50%), radial-gradient(circle at 80% 100%, rgba(196, 107, 92, 0.04) 0%, transparent 50%)',
      fontFamily: 'Georgia, "Times New Roman", serif'
    }}>
      {/* HEADER */}
      <header className="border-b-2 px-6 py-5" style={{ borderColor: '#1F4E5F', backgroundColor: '#F4EFE6' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase font-mono mb-1" style={{ color: '#8B7355' }}>
              Portfolio Tracker · Rosario / Ramona
            </div>
            <h1 className="text-2xl md:text-3xl tracking-tight" style={{ color: '#1F4E5F', fontWeight: 700 }}>
              Estado de Cartera <span style={{ color: '#C46B5C', fontStyle: 'italic' }}>—</span> Santiago R.
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setHideAmounts(!hideAmounts)} className="p-2 rounded-full transition hover:bg-stone-200" title={hideAmounts ? 'Mostrar' : 'Ocultar'}>
              {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button onClick={takeSnapshot} className="px-3 py-2 rounded-sm text-xs font-mono uppercase tracking-wider transition flex items-center gap-2"
              style={{ backgroundColor: '#1F4E5F', color: '#F4EFE6' }}>
              <RefreshCw size={12} /> Snapshot
            </button>
          </div>
        </div>
      </header>

      {/* RESUMEN ALTO NIVEL */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* USD Total */}
          <div className="p-6 border" style={{ borderColor: '#1F4E5F', backgroundColor: 'rgba(255, 253, 247, 0.7)' }}>
            <div className="text-[10px] tracking-[0.2em] uppercase font-mono mb-2" style={{ color: '#8B7355' }}>Patrimonio en USD CCL</div>
            <div className="text-4xl tracking-tight" style={{ color: '#1F4E5F', fontWeight: 700, fontFamily: 'Georgia, serif' }}>
              {hideAmounts ? '••••••' : formatUSD(calculations.total_usd)}
            </div>
            <div className="text-xs mt-2 font-mono" style={{ color: '#8B7355' }}>
              al CCL ${data.ccl.toLocaleString('es-AR')}
            </div>
          </div>

          {/* ARS Total */}
          <div className="p-6 border" style={{ borderColor: '#C46B5C', backgroundColor: 'rgba(255, 253, 247, 0.7)' }}>
            <div className="text-[10px] tracking-[0.2em] uppercase font-mono mb-2" style={{ color: '#8B7355' }}>Equivalente en pesos</div>
            <div className="text-4xl tracking-tight" style={{ color: '#C46B5C', fontWeight: 700, fontFamily: 'Georgia, serif' }}>
              {hideAmounts ? '••••••' : formatARS(calculations.total_ars)}
            </div>
            <div className="text-xs mt-2 font-mono" style={{ color: '#8B7355' }}>
              {data.assets.length} posiciones activas
            </div>
          </div>

          {/* Objetivo */}
          <div className="p-6 border" style={{ borderColor: '#5C8374', backgroundColor: 'rgba(255, 253, 247, 0.7)' }}>
            <div className="text-[10px] tracking-[0.2em] uppercase font-mono mb-2" style={{ color: '#8B7355' }}>
              Progreso objetivo {formatUSD(data.objetivo_usd)}
            </div>
            <div className="text-4xl tracking-tight mb-2" style={{ color: '#5C8374', fontWeight: 700, fontFamily: 'Georgia, serif' }}>
              {formatPct(calculations.progreso)}
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#E5DCC9' }}>
              <div className="h-full transition-all" style={{ 
                width: `${Math.min(100, calculations.progreso)}%`, 
                backgroundColor: '#5C8374' 
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* TABS */}
      <nav className="max-w-6xl mx-auto px-6">
        <div className="flex gap-1 border-b" style={{ borderColor: '#D4C8B2' }}>
          {['resumen', 'activos', 'historico', 'config'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-xs uppercase tracking-widest font-mono transition relative"
              style={{
                color: activeTab === tab ? '#1F4E5F' : '#8B7355',
                fontWeight: activeTab === tab ? 700 : 400,
              }}
            >
              {tab === 'resumen' && 'Resumen'}
              {tab === 'activos' && 'Activos'}
              {tab === 'historico' && 'Histórico'}
              {tab === 'config' && 'Config'}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: '#C46B5C' }} />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* TAB CONTENT */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        
        {/* TAB: RESUMEN */}
        {activeTab === 'resumen' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie por categoría */}
              <div className="p-6 border bg-white/40" style={{ borderColor: '#D4C8B2' }}>
                <div className="text-[10px] tracking-[0.2em] uppercase font-mono mb-4" style={{ color: '#8B7355' }}>
                  Distribución por categoría
                </div>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" stroke="#F4EFE6" strokeWidth={2}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip 
                        formatter={(v) => formatUSD(v)}
                        contentStyle={{ backgroundColor: '#1F4E5F', border: 'none', color: '#F4EFE6', fontFamily: 'monospace', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-sm py-12" style={{ color: '#8B7355' }}>Sin datos</div>
                )}
                <div className="space-y-1 mt-4">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
                        <span style={{ color: '#1F4E5F' }}>{d.name}</span>
                      </div>
                      <div style={{ color: '#8B7355' }}>
                        {hideAmounts ? '•••' : formatUSD(d.value)} · {((d.value / calculations.total_usd) * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exposición moneda */}
              <div className="p-6 border bg-white/40" style={{ borderColor: '#D4C8B2' }}>
                <div className="text-[10px] tracking-[0.2em] uppercase font-mono mb-4" style={{ color: '#8B7355' }}>
                  Exposición por moneda
                </div>
                {monedaData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={monedaData} cx="50%" cy="50%" outerRadius={90} dataKey="value" stroke="#F4EFE6" strokeWidth={2}>
                        {monedaData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip 
                        formatter={(v) => formatUSD(v)}
                        contentStyle={{ backgroundColor: '#1F4E5F', border: 'none', color: '#F4EFE6', fontFamily: 'monospace', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : null}
                <div className="space-y-2 mt-4 font-mono text-xs">
                  <div className="flex justify-between p-2 border-l-2" style={{ borderColor: '#C46B5C' }}>
                    <span style={{ color: '#1F4E5F' }}>Riesgo Argentina (ARS)</span>
                    <span style={{ color: '#C46B5C', fontWeight: 700 }}>
                      {((calculations.exp_ars / calculations.total_usd) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between p-2 border-l-2" style={{ borderColor: '#1F4E5F' }}>
                    <span style={{ color: '#1F4E5F' }}>Dolarizado (USD)</span>
                    <span style={{ color: '#1F4E5F', fontWeight: 700 }}>
                      {((calculations.exp_usd / calculations.total_usd) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                {(calculations.exp_ars / calculations.total_usd) > 0.5 && (
                  <div className="mt-3 p-2 text-[11px] font-mono italic" style={{ backgroundColor: '#FBE9E5', color: '#8B3A2D' }}>
                    ▲ Exposición a pesos &gt; 50%. Considerá dolarizar más.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: ACTIVOS */}
        {activeTab === 'activos' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-xs font-mono uppercase tracking-widest" style={{ color: '#8B7355' }}>
                {data.assets.length} posiciones
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="px-3 py-2 rounded-sm text-xs font-mono uppercase tracking-wider flex items-center gap-2 transition"
                style={{ backgroundColor: '#5C8374', color: '#F4EFE6' }}
              >
                <Plus size={14} /> Agregar
              </button>
            </div>

            {showAddForm && (
              <AssetForm
                onSave={async (asset) => {
                  const newAsset = { ...asset, id: Date.now() };
                  await saveData({ ...data, assets: [...data.assets, newAsset] });
                  setShowAddForm(false);
                }}
                onCancel={() => setShowAddForm(false)}
              />
            )}

            <div className="space-y-2">
              {calculations.enriched.map(a => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  isEditing={editingAsset === a.id}
                  hideAmounts={hideAmounts}
                  onEdit={() => setEditingAsset(a.id)}
                  onCancelEdit={() => setEditingAsset(null)}
                  onSave={async (updated) => {
                    const newAssets = data.assets.map(x => x.id === updated.id ? updated : x);
                    await saveData({ ...data, assets: newAssets });
                    setEditingAsset(null);
                  }}
                  onDelete={async () => {
                    if (window.confirm(`¿Eliminar "${a.nombre}"?`)) {
                      await saveData({ ...data, assets: data.assets.filter(x => x.id !== a.id) });
                    }
                  }}
                />
              ))}
            </div>

            {data.assets.length === 0 && (
              <div className="text-center py-12 text-sm font-mono" style={{ color: '#8B7355' }}>
                Sin activos. Agregá tu primera posición.
              </div>
            )}
          </div>
        )}

        {/* TAB: HISTÓRICO */}
        {activeTab === 'historico' && (
          <div className="space-y-6">
            <div className="p-6 border bg-white/40" style={{ borderColor: '#D4C8B2' }}>
              <div className="text-[10px] tracking-[0.2em] uppercase font-mono mb-4" style={{ color: '#8B7355' }}>
                Evolución del patrimonio (USD CCL)
              </div>
              {historyChart.length > 1 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={historyChart}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#D4C8B2" />
                    <XAxis dataKey="fecha" tick={{ fontFamily: 'monospace', fontSize: 11, fill: '#8B7355' }} stroke="#8B7355" />
                    <YAxis tick={{ fontFamily: 'monospace', fontSize: 11, fill: '#8B7355' }} stroke="#8B7355" />
                    <Tooltip 
                      formatter={(v) => formatUSD(v)}
                      contentStyle={{ backgroundColor: '#1F4E5F', border: 'none', color: '#F4EFE6', fontFamily: 'monospace', fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="USD" stroke="#1F4E5F" strokeWidth={2} dot={{ fill: '#C46B5C', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-sm font-mono" style={{ color: '#8B7355' }}>
                  Necesitás al menos 2 snapshots. Tocá el botón "Snapshot" en el header.
                </div>
              )}
            </div>

            {data.history && data.history.length > 0 && (
              <div className="p-6 border bg-white/40" style={{ borderColor: '#D4C8B2' }}>
                <div className="text-[10px] tracking-[0.2em] uppercase font-mono mb-4" style={{ color: '#8B7355' }}>
                  Snapshots registrados
                </div>
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b" style={{ borderColor: '#D4C8B2', color: '#8B7355' }}>
                      <th className="text-left py-2">Fecha</th>
                      <th className="text-right py-2">USD</th>
                      <th className="text-right py-2">ARS</th>
                      <th className="text-right py-2">CCL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.history].reverse().slice(0, 15).map((s, i) => (
                      <tr key={i} className="border-b" style={{ borderColor: '#E5DCC9', color: '#1F4E5F' }}>
                        <td className="py-2">{s.fecha}</td>
                        <td className="text-right py-2">{hideAmounts ? '•••' : formatUSD(s.total_usd)}</td>
                        <td className="text-right py-2">{hideAmounts ? '•••' : formatARS(s.total_ars)}</td>
                        <td className="text-right py-2" style={{ color: '#8B7355' }}>${s.ccl?.toLocaleString('es-AR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: CONFIG */}
        {activeTab === 'config' && (
          <div className="space-y-4">
            <div className="p-6 border bg-white/40" style={{ borderColor: '#D4C8B2' }}>
              <div className="text-[10px] tracking-[0.2em] uppercase font-mono mb-4" style={{ color: '#8B7355' }}>Cotizaciones de referencia</div>
              <div className="grid grid-cols-2 gap-4">
                <ConfigInput label="Dólar CCL" value={data.ccl} onChange={(v) => saveData({ ...data, ccl: v })} prefix="$" />
                <ConfigInput label="Dólar MEP" value={data.mep} onChange={(v) => saveData({ ...data, mep: v })} prefix="$" />
                <ConfigInput label="Inflación proy. (%)" value={data.inflacion_proy} onChange={(v) => saveData({ ...data, inflacion_proy: v })} suffix="%" />
                <ConfigInput label="Objetivo (USD)" value={data.objetivo_usd} onChange={(v) => saveData({ ...data, objetivo_usd: v })} prefix="USD " />
              </div>
            </div>

            <div className="p-6 border bg-white/40" style={{ borderColor: '#D4C8B2' }}>
              <div className="text-[10px] tracking-[0.2em] uppercase font-mono mb-4" style={{ color: '#8B7355' }}>Datos</div>
              <div className="space-y-2 text-xs font-mono">
                <div style={{ color: '#1F4E5F' }}>
                  Última actualización: <span style={{ color: '#8B7355' }}>{new Date(data.ultima_actualizacion).toLocaleString('es-AR')}</span>
                </div>
                <div style={{ color: '#1F4E5F' }}>
                  Snapshots guardados: <span style={{ color: '#8B7355' }}>{(data.history || []).length}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    const json = JSON.stringify(data, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `portfolio_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                  }}
                  className="px-3 py-2 rounded-sm text-xs font-mono uppercase tracking-wider"
                  style={{ backgroundColor: '#1F4E5F', color: '#F4EFE6' }}
                >
                  Exportar JSON
                </button>
                <button
                  onClick={async () => {
                    if (window.confirm('¿Resetear todo? Se perderán los datos.')) {
                      await saveData(DEFAULT_DATA);
                    }
                  }}
                  className="px-3 py-2 rounded-sm text-xs font-mono uppercase tracking-wider border"
                  style={{ borderColor: '#C46B5C', color: '#C46B5C' }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="p-6 border bg-white/40" style={{ borderColor: '#D4C8B2' }}>
              <div className="text-[10px] tracking-[0.2em] uppercase font-mono mb-2" style={{ color: '#8B7355' }}>Recordatorio</div>
              <p className="text-sm leading-relaxed" style={{ color: '#1F4E5F', fontStyle: 'italic' }}>
                "Lo que mide el éxito no es tu saldo en pesos — eso siempre crece — sino cuántos dólares CCL tenés."
              </p>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER FIJO */}
      <footer className="fixed bottom-0 left-0 right-0 border-t-2 px-4 py-2" style={{ borderColor: '#1F4E5F', backgroundColor: '#F4EFE6' }}>
        <div className="max-w-6xl mx-auto flex justify-between items-center text-[10px] font-mono uppercase tracking-widest" style={{ color: '#8B7355' }}>
          <span>CCL ${data.ccl.toLocaleString('es-AR')} · MEP ${data.mep.toLocaleString('es-AR')}</span>
          <span>Inflación proy. {data.inflacion_proy}%</span>
        </div>
      </footer>
    </div>
  );
}

// ============= COMPONENTES =============

function AssetRow({ asset, isEditing, hideAmounts, onEdit, onSave, onCancelEdit, onDelete }) {
  if (isEditing) {
    return <AssetForm initial={asset} onSave={onSave} onCancel={onCancelEdit} />;
  }

  const cat = CATEGORIES[asset.categoria];
  return (
    <div className="p-4 border bg-white/60 hover:bg-white/80 transition" style={{ borderColor: '#D4C8B2', borderLeftWidth: 4, borderLeftColor: cat?.color || '#8B7355' }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: cat?.color + '20', color: cat?.color }}>
              {cat?.label || asset.categoria}
            </span>
            <span className="text-[10px] font-mono uppercase" style={{ color: '#8B7355' }}>· {asset.plataforma}</span>
          </div>
          <div className="text-base" style={{ color: '#1F4E5F', fontWeight: 700 }}>{asset.nombre}</div>
          {asset.notas && (
            <div className="text-xs italic mt-1" style={{ color: '#8B7355' }}>{asset.notas}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-mono" style={{ color: '#1F4E5F', fontWeight: 700 }}>
            {hideAmounts ? '••••' : (asset.moneda === 'USD' ? formatUSD(asset.cantidad) : formatARS(asset.cantidad))}
          </div>
          <div className="text-[11px] font-mono" style={{ color: '#8B7355' }}>
            ≈ {hideAmounts ? '••••' : formatUSD(asset.valor_usd)}
          </div>
          {asset.tna > 0 && (
            <div className="text-[11px] font-mono mt-1" style={{ color: '#5C8374' }}>
              TNA {asset.tna}%
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-stone-200 transition" title="Editar">
            <Edit3 size={13} style={{ color: '#1F4E5F' }} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-100 transition" title="Eliminar">
            <Trash2 size={13} style={{ color: '#C46B5C' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    nombre: '', plataforma: '', categoria: 'liquidez', moneda: 'ARS', cantidad: 0, tna: 0, notas: ''
  });

  const update = (k, v) => setForm({ ...form, [k]: v });

  const handleSave = () => {
    if (!form.nombre.trim()) return alert('Falta el nombre');
    onSave({ ...form, cantidad: parseFloat(form.cantidad) || 0, tna: parseFloat(form.tna) || 0 });
  };

  return (
    <div className="p-4 border-2 bg-white/80" style={{ borderColor: '#1F4E5F' }}>
      <div className="text-[10px] tracking-[0.2em] uppercase font-mono mb-3" style={{ color: '#1F4E5F', fontWeight: 700 }}>
        {initial ? 'Editando posición' : 'Nueva posición'}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <FormField label="Nombre" value={form.nombre} onChange={(v) => update('nombre', v)} placeholder="Ej. LECAP S30A6" />
        <FormField label="Plataforma" value={form.plataforma} onChange={(v) => update('plataforma', v)} placeholder="Cocos / Lemon / Banco" />
        <FormSelect label="Categoría" value={form.categoria} onChange={(v) => update('categoria', v)}
          options={Object.entries(CATEGORIES).map(([k, v]) => ({ value: k, label: v.label }))} />
        <FormSelect label="Moneda" value={form.moneda} onChange={(v) => update('moneda', v)}
          options={[{ value: 'ARS', label: 'Pesos (ARS)' }, { value: 'USD', label: 'Dólares (USD)' }]} />
        <FormField label={`Cantidad (${form.moneda})`} type="number" value={form.cantidad} onChange={(v) => update('cantidad', v)} />
        <FormField label="TNA % (opcional)" type="number" value={form.tna} onChange={(v) => update('tna', v)} />
      </div>
      <div className="mt-3">
        <FormField label="Notas (opcional)" value={form.notas} onChange={(v) => update('notas', v)} placeholder="Recordatorios, vencimientos..." />
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={handleSave}
          className="px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-wider flex items-center gap-2"
          style={{ backgroundColor: '#1F4E5F', color: '#F4EFE6' }}>
          <Save size={13} /> Guardar
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-wider border flex items-center gap-2"
          style={{ borderColor: '#8B7355', color: '#8B7355' }}>
          <X size={13} /> Cancelar
        </button>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="block">
      <div className="text-[10px] tracking-[0.15em] uppercase font-mono mb-1" style={{ color: '#8B7355' }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border bg-white text-sm font-mono"
        style={{ borderColor: '#D4C8B2', color: '#1F4E5F' }}
      />
    </label>
  );
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="text-[10px] tracking-[0.15em] uppercase font-mono mb-1" style={{ color: '#8B7355' }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border bg-white text-sm font-mono"
        style={{ borderColor: '#D4C8B2', color: '#1F4E5F' }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function ConfigInput({ label, value, onChange, prefix = '', suffix = '' }) {
  return (
    <label className="block">
      <div className="text-[10px] tracking-[0.15em] uppercase font-mono mb-1" style={{ color: '#8B7355' }}>{label}</div>
      <div className="flex items-center border bg-white" style={{ borderColor: '#D4C8B2' }}>
        {prefix && <span className="px-2 text-xs font-mono" style={{ color: '#8B7355' }}>{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 px-2 py-2 text-sm font-mono bg-transparent outline-none"
          style={{ color: '#1F4E5F' }}
        />
        {suffix && <span className="px-2 text-xs font-mono" style={{ color: '#8B7355' }}>{suffix}</span>}
      </div>
    </label>
  );
}
