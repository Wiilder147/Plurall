'use client'

import { useEffect, useState } from 'react'
import StaffPageShell from '@/components/dashboard/StaffPageShell'
import { Gauge, Save, Loader2 } from 'lucide-react'

export default function AdminScoringPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/scoring').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  async function saveModelo() {
    setSaving(true)
    await fetch('/api/admin/scoring', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'modelo',
        id: data.modelo.id_modelo_score,
        puntaje_minimo: data.modelo.puntaje_minimo,
        puntaje_maximo: data.modelo.puntaje_maximo,
      }),
    })
    setMsg('Umbrales actualizados')
    setSaving(false)
  }

  async function saveOpcion(id, valor) {
    await fetch('/api/admin/scoring', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'opcion', id, valor_puntos: Number(valor) }),
    })
    setMsg('Puntos actualizados')
  }

  if (loading) return <div className="text-slate-400 p-8">Cargando configuración…</div>

  return (
    <StaffPageShell
      accent="orange"
      badge="Motor de scoring"
      title="Configuración de scoring"
      subtitle="Ajuste umbrales y ponderación de respuestas del cuestionario crediticio."
    >
      {msg && <p className="text-emerald-400 text-sm">{msg}</p>}

      {data?.modelo && (
        <div className="dash-panel bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-orange-400" /> Modelo activo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Puntaje mínimo (aprobación)</label>
              <input type="number" value={data.modelo.puntaje_minimo}
                onChange={e => setData(d => ({ ...d, modelo: { ...d.modelo, puntaje_minimo: Number(e.target.value) } }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Puntaje máximo</label>
              <input type="number" value={data.modelo.puntaje_maximo}
                onChange={e => setData(d => ({ ...d, modelo: { ...d.modelo, puntaje_maximo: Number(e.target.value) } }))}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2" />
            </div>
          </div>
          <p className="text-slate-500 text-xs mb-4">
            ≥ mínimo → pre-aprobación · ≥ 67% del mínimo → revisión manual · resto → rechazo
          </p>
          <button onClick={saveModelo} disabled={saving}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar umbrales
          </button>
        </div>
      )}

      <div className="dash-panel bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-white">Preguntas y puntajes</h2>
        </div>
        <div className="divide-y divide-slate-700/50">
          {(data?.preguntas ?? []).map(p => (
            <div key={p.id_pregunta} className="p-5">
              <p className="text-slate-200 font-medium text-sm mb-3">{p.enunciado}</p>
              <div className="flex flex-col gap-2">
                {(p.opcion_pregunta ?? []).map(op => (
                  <div key={op.id_opcion} className="flex items-center gap-3 text-sm">
                    <span className="text-slate-400 flex-1">{op.texto_opcion}</span>
                    <input type="number" defaultValue={op.valor_puntos}
                      onBlur={e => saveOpcion(op.id_opcion, e.target.value)}
                      className="w-20 bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1 text-center" />
                    <span className="text-slate-500 text-xs">pts</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </StaffPageShell>
  )
}
