import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCOP } from '@/lib/calculadora'
import EditarPerfilForm from '@/components/EditarPerfilForm'
import {
  User,
  Phone,
  Mail,
  Hash,
  CheckCircle2,
  MapPin,
  Building2,
  Store,
  Calendar,
  Shield,
  CreditCard,
  TrendingUp,
  Wallet,
  Landmark,
  Users,
  GraduationCap,
  Heart,
  Home,
  Award,
  BarChart3,
  AlertCircle,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPerfil() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  // ── Datos del auth ──
  const { nombre_completo: authNombre, email_real } = user.user_metadata || {}

  // ── Cliente desde la BD ──
  const { data: cliente } = await supabase
    .from('cliente')
    .select('*')
    .eq('id_usuario_cuenta', user.id)
    .single()

  // ── Detalle financiero ──
  const { data: detalle } = await supabase
    .from('detalle_cliente')
    .select('*')
    .eq('id_cliente', cliente?.id_cliente)
    .single()

  // ── Resumen crediticio ──
  let totalCreditos = 0
  let creditosActivos = 0
  let creditosPagados = 0
  let totalDesembolsado = 0

  if (cliente) {
    const { data: creds } = await supabase
      .from('credito')
      .select('monto_desembolsado, estado_credito')
      .eq('id_cliente', cliente.id_cliente)

    if (creds) {
      totalCreditos = creds.length
      creditosActivos = creds.filter(c => ['ACTIVO', 'EN_MORA'].includes(c.estado_credito)).length
      creditosPagados = creds.filter(c => c.estado_credito === 'PAGADO').length
      totalDesembolsado = creds.reduce((acc, c) => acc + c.monto_desembolsado, 0)
    }
  }

  const nombre = cliente?.nombre_completo || authNombre || 'Usuario'
  const miembroDesde = cliente?.created_at
    ? new Date(cliente.created_at).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    : new Date(user.created_at).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  // Mapa de vivienda
  const viviendaLabels = { PROPIA: 'Propia', ARRENDADA: 'Arrendada', FAMILIAR: 'Familiar' }

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mi Perfil</h1>
        <p className="text-slate-500 mt-2">
          Consulta tu información personal, financiera y tu historial crediticio con Plurall.
        </p>
      </header>

      {/* ── CABECERA DEL PERFIL ── */}
      <section className="bg-white border border-slate-200/80 shadow-sm rounded-3xl overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-48 h-48 bg-orange-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="absolute left-0 bottom-0 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4"></div>

          <div className="relative z-10 w-20 h-20 bg-orange-500 text-white rounded-2xl flex items-center justify-center border-4 border-white/20 shadow-lg shrink-0">
            <span className="text-3xl font-black">{nombre.charAt(0).toUpperCase()}</span>
          </div>
          <div className="relative z-10 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-white">{nombre}</h2>
            <p className="text-white/60 text-sm mt-0.5">Miembro desde {miembroDesde}</p>
            <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" /> Cuenta Activa
              </span>
              {cliente?.score_credito > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300">
                  <Shield className="w-3.5 h-3.5" /> Score: {cliente.score_credito}/1000
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── RESUMEN CREDITICIO ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
          <div className="p-5 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Créditos totales</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalCreditos}</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Activos</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">{creditosActivos}</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Pagados</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{creditosPagados}</p>
          </div>
          <div className="p-5 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">Total desembolsado</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{formatCOP(totalDesembolsado)}</p>
          </div>
        </div>
      </section>

      {/* ── DATOS PERSONALES + CONTACTO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Tarjeta: Información Personal */}
        <section className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-6">
          <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2 text-sm uppercase tracking-wide">
            <User className="w-4 h-4 text-orange-500" /> Información Personal
          </h3>
          <div className="space-y-4">
            <InfoField icon={Hash} label="Número de Documento (CC)" value={cliente?.dni} />
            <InfoField icon={Phone} label="Número de Celular" value={cliente?.telefono} />
            <InfoField icon={Mail} label="Correo Electrónico" value={email_real || user.email} />
            <InfoField icon={MapPin} label="Dirección" value={cliente?.direccion} />
            <div className="grid grid-cols-2 gap-4">
              <InfoField icon={Building2} label="Ciudad" value={cliente?.ciudad} />
              <InfoField icon={MapPin} label="Departamento" value={cliente?.departamento} />
            </div>
          </div>
        </section>

        {/* Tarjeta: Datos del Negocio */}
        <section className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-6">
          <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2 text-sm uppercase tracking-wide">
            <Store className="w-4 h-4 text-orange-500" /> Información del Negocio
          </h3>
          <div className="space-y-4">
            <InfoField icon={Store} label="Nombre del Negocio" value={cliente?.nombre_negocio} />
            <InfoField icon={BarChart3} label="Descripción del Negocio" value={cliente?.descripcion_negocio} />
            <InfoField 
              icon={Calendar} 
              label="Antigüedad del Negocio" 
              value={cliente?.antiguedad_negocio_meses
                ? `${Math.floor(cliente.antiguedad_negocio_meses / 12)} años y ${cliente.antiguedad_negocio_meses % 12} meses`
                : null
              } 
            />
          </div>
        </section>
      </div>

      {/* ── INFORMACIÓN FINANCIERA ── */}
      {detalle && (
        <section className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-6">
          <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2 text-sm uppercase tracking-wide">
            <Wallet className="w-4 h-4 text-orange-500" /> Información Financiera
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoField icon={TrendingUp} label="Ingresos Mensuales" value={detalle.ingresos_mensuales ? formatCOP(detalle.ingresos_mensuales) : null} />
            <InfoField icon={AlertCircle} label="Egresos Mensuales" value={detalle.egresos_mensuales ? formatCOP(detalle.egresos_mensuales) : null} />
            <InfoField icon={Award} label="Patrimonio Estimado" value={detalle.patrimonio_estimado ? formatCOP(detalle.patrimonio_estimado) : null} />
            <InfoField icon={CreditCard} label="Otras Obligaciones" value={detalle.otras_obligaciones ? formatCOP(detalle.otras_obligaciones) : null} />
            <InfoField icon={Landmark} label="Banco Preferido" value={detalle.banco_preferido} />
            <InfoField icon={CreditCard} label="Tipo de Cuenta" value={detalle.tipo_cuenta_bancaria} />
          </div>
        </section>
      )}

      {/* ── DATOS SOCIOECONÓMICOS ── */}
      {detalle && (
        <section className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-6">
          <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2 text-sm uppercase tracking-wide">
            <Users className="w-4 h-4 text-orange-500" /> Datos Socioeconómicos
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoField icon={Home} label="Tipo de Vivienda" value={viviendaLabels[detalle.tipo_vivienda] || detalle.tipo_vivienda} />
            <InfoField icon={BarChart3} label="Estrato" value={detalle.estrato} />
            <InfoField icon={GraduationCap} label="Nivel Educativo" value={detalle.nivel_educativo} />
            <InfoField icon={Heart} label="Estado Civil" value={detalle.estado_civil} />
            <InfoField icon={Users} label="Personas a Cargo" value={detalle.personas_cargo} />
          </div>
        </section>
      )}

      {/* ── SEGURIDAD DE LA CUENTA ── */}
      <section className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-6">
        <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2 text-sm uppercase tracking-wide">
          <Shield className="w-4 h-4 text-orange-500" /> Seguridad de la Cuenta
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoField icon={Mail} label="Email de Acceso" value={user.email} />
          <InfoField icon={Calendar} label="Cuenta Creada" value={new Date(user.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })} />
          <InfoField icon={Shield} label="Último Acceso" value={user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Primera sesión'} />
        </div>
      </section>

      {/* ── FORMULARIO DE EDICIÓN ── */}
      <EditarPerfilForm cliente={cliente} />
    </div>
  )
}

// ── Componente reutilizable para campos de información ──
function InfoField({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 uppercase tracking-wide">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <div className="font-semibold text-slate-900 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 text-sm">
        {value || <span className="text-slate-300 font-normal">No registrado</span>}
      </div>
    </div>
  )
}
