'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Search, Loader2, User, CreditCard, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react'
import { formatCOP } from '@/lib/calculadora'

export default function SupervisorBuscarPage() {
  const [query,      setQuery]      = useState('')
  const [resultados, setResultados] = useState(null)
  const [isPending,  startTransition] = useTransition()
  const [buscado,    setBuscado]    = useState(false)

  async function buscar(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    startTransition(async () => {
      setBuscado(true)
      const res = await fetch(`/api/supervisor/buscar?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResultados(data.resultados ?? [])
    })
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">Buscador Global</h1>
        <p className="text-slate-400 mt-1">Busca por nombre, cédula, celular, email o número de crédito.</p>
      </header>

      {/* Formulario de búsqueda */}
      <form onSubmit={buscar} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ej: Pedro García · 1020300001 · 3200000001 · pedro@email.com"
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
          />
        </div>
        <button type="submit" disabled={isPending || !query.trim()}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-6 py-3.5 rounded-xl transition-all text-sm">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </button>
      </form>

      {/* Sugerencias de búsqueda */}
      {!buscado && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Por nombre',   ejemplo: 'Pedro García',    icon: User        },
            { label: 'Por cédula',   ejemplo: '1020300001',      icon: CreditCard  },
            { label: 'Por celular',  ejemplo: '3200000001',      icon: Search      },
            { label: 'Por crédito',  ejemplo: 'ID del crédito',  icon: CreditCard  },
          ].map(({ label, ejemplo, icon: Icon }) => (
            <button key={label} onClick={() => setQuery(ejemplo)}
              className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-left hover:border-indigo-500/50 transition-colors">
              <Icon className="w-5 h-5 text-indigo-400 mb-2" />
              <p className="text-slate-300 text-xs font-semibold">{label}</p>
              <p className="text-slate-500 text-xs mt-0.5">{ejemplo}</p>
            </button>
          ))}
        </div>
      )}

      {/* Resultados */}
      {isPending && (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          Buscando…
        </div>
      )}

      {!isPending && buscado && resultados !== null && (
        <>
          <p className="text-slate-400 text-sm">
            {resultados.length === 0
              ? `Sin resultados para "${query}"`
              : `${resultados.length} resultado${resultados.length !== 1 ? 's' : ''} para "${query}"`
            }
          </p>

          {resultados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="w-12 h-12 text-slate-600 mb-4" />
              <p className="text-slate-400">No encontramos coincidencias.</p>
              <p className="text-slate-500 text-sm mt-1">Intenta con otro término de búsqueda.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {resultados.map((r) => {
                const creditoActivo = r.creditos?.find(c => ['ACTIVO','EN_MORA'].includes(c.estado_credito))
                const enMora = creditoActivo?.estado_credito === 'EN_MORA'
                return (
                  <div key={r.id_cliente}
                    className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 ${
                        enMora ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'
                      }`}>
                        {r.nombre_completo?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-200">{r.nombre_completo}</p>
                        <p className="text-slate-500 text-xs">CC {r.dni} · {r.telefono}</p>
                        <p className="text-slate-500 text-xs">{r.email}</p>
                        {creditoActivo && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              enMora ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {enMora ? `${creditoActivo.dias_mora_maximo}d mora` : 'Al día'}
                            </span>
                            <span className="text-slate-500 text-xs">Saldo: {formatCOP(creditoActivo.saldo_pendiente)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-slate-400 text-xs">Score</p>
                        <p className={`font-bold text-sm ${
                          (r.score_credito || 0) >= 700 ? 'text-emerald-400' :
                          (r.score_credito || 0) >= 500 ? 'text-yellow-400' : 'text-red-400'
                        }`}>{r.score_credito || 0}</p>
                      </div>
                      <Link href={`/admin/clientes/${r.id_cliente}`}
                        className="inline-flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold px-3 py-2 rounded-xl transition-all border border-indigo-500/20">
                        Ver ficha <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
