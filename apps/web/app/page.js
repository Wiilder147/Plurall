import Link from "next/link";
import Image from "next/image";
import { User, ChevronRight, Shield, Clock, Smartphone, TrendingUp, CheckCircle2, ArrowRight, Star } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-navy-900 overflow-x-hidden font-sans">

      {/* ── NAVEGACIÓN ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-12 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-navy-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-extrabold text-lg">P</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-navy-900 hidden sm:block">PLURALL</span>
          </Link>

          {/* Enlaces centrales */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#beneficios" className="text-slate-500 hover:text-navy-900 font-medium text-sm transition-colors">Beneficios</Link>
            <Link href="#como-funciona" className="text-slate-500 hover:text-navy-900 font-medium text-sm transition-colors">Cómo funciona</Link>
            <Link href="#" className="text-slate-500 hover:text-navy-900 font-medium text-sm transition-colors">Productos</Link>
            <Link href="#" className="text-slate-500 hover:text-navy-900 font-medium text-sm transition-colors">Recursos</Link>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-slate-600 hover:text-navy-900 font-semibold text-sm transition-colors hidden sm:block">
              Iniciar Sesión
            </Link>
            <Link href="/login" className="bg-accent-500 hover:bg-accent-600 text-white font-bold py-2.5 px-6 rounded-full text-sm transition-all hover:scale-105 shadow-md shadow-accent-500/20">
              INGRESA
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-orange-50/30"></div>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-navy-900/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            
            {/* Columna Izquierda: Texto */}
            <div className="w-full lg:w-1/2 flex flex-col items-center text-center lg:items-start lg:text-left animate-fade-in">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-accent-50 border border-accent-200 text-accent-700 px-4 py-1.5 rounded-full text-xs font-semibold mb-6">
                <Star className="w-3.5 h-3.5 fill-accent-500 text-accent-500" />
                Financiamiento digital para comerciantes colombianos
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-navy-900 leading-[1.1] tracking-tight">
                Donde tus planes
                <span className="block text-accent-500">comienzan a rodar</span>
              </h1>
              
              <p className="mt-6 text-lg sm:text-xl text-slate-500 leading-relaxed max-w-lg">
                Créditos digitales rápidos, transparentes y sin papeleos. 
                Todo desde tu celular, aprobación en minutos.
              </p>
              
              <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
                <Link href="/login" className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-bold text-lg px-8 py-4 rounded-full transition-all hover:scale-105 shadow-xl shadow-accent-500/25">
                  Simula tu Préstamo
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 text-navy-900 hover:text-accent-600 font-semibold text-sm transition-colors">
                  Ya tengo cuenta
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Trust badges */}
              <div className="mt-10 flex items-center gap-6 text-xs text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>100% seguro</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span>Aprobación rápida</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-accent-500" />
                  <span>100% digital</span>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Imagen Hero */}
            <div className="w-full lg:w-1/2 animate-slide-in" style={{ animationDelay: '0.2s' }}>
              <div className="relative">
                {/* Decorative frame */}
                <div className="absolute -inset-4 bg-gradient-to-br from-accent-500/20 to-navy-900/10 rounded-3xl blur-2xl"></div>
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-navy-900/15 border-2 border-white">
                  <div className="aspect-[4/3] relative">
                    <Image 
                      src="/hero.png" 
                      alt="Comerciante colombiana exitosa en su negocio" 
                      fill
                      priority
                      className="object-cover object-center"
                    />
                  </div>
                </div>
                {/* Floating card */}
                <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 animate-fade-in hidden sm:flex items-center gap-3" style={{ animationDelay: '0.6s' }}>
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Desembolsos este mes</p>
                    <p className="font-bold text-navy-900">$847.000.000 COP</p>
                  </div>
                </div>
                {/* Floating card 2 */}
                <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 animate-fade-in hidden sm:flex items-center gap-3" style={{ animationDelay: '0.8s' }}>
                  <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-accent-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Tasa aprobación</p>
                    <p className="font-bold text-navy-900">94.7%</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── BENEFICIOS ── */}
      <section id="beneficios" className="bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <div className="text-center mb-16">
            <span className="text-accent-500 font-bold text-sm uppercase tracking-wider">¿POR QUÉ PLURALL?</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-900 mt-3 tracking-tight">
              Crédito pensado para ti
            </h2>
            <p className="text-slate-500 mt-4 max-w-2xl mx-auto text-lg">
              Entendemos las necesidades de los comerciantes colombianos. Sin burocracia, sin letra pequeña.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                icon: Clock, 
                title: 'Aprobación Express', 
                desc: 'Respuesta en menos de 24 horas. Sin filas, sin citas, sin desplazamientos.',
                color: 'bg-blue-50 text-blue-600'
              },
              { 
                icon: Shield, 
                title: '100% Seguro', 
                desc: 'Tu información está protegida con cifrado bancario y cumplimiento SARLAFT.',
                color: 'bg-emerald-50 text-emerald-600'
              },
              { 
                icon: Smartphone, 
                title: 'Todo Digital', 
                desc: 'Solicita, firma y paga desde tu celular. Sin papeles, sin sucursales físicas.',
                color: 'bg-accent-50 text-accent-600'
              },
              { 
                icon: TrendingUp, 
                title: 'Tasas Competitivas', 
                desc: 'Tasas desde el 2% mensual. Transparencia total sin costos ocultos.',
                color: 'bg-purple-50 text-purple-600'
              },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-2xl p-7 border border-slate-200/60 shadow-sm hover:shadow-lg hover:border-accent-200 transition-all group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${item.color} group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-navy-900 text-lg mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section id="como-funciona" className="bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-28">
          <div className="text-center mb-16">
            <span className="text-accent-500 font-bold text-sm uppercase tracking-wider">PROCESO SIMPLE</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-900 mt-3 tracking-tight">
              Tu crédito en 3 pasos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Línea conectora */}
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-accent-200 via-accent-400 to-accent-200"></div>

            {[
              { step: '01', title: 'Simula', desc: 'Elige el monto y plazo que mejor se adapte a tu negocio con nuestra calculadora en línea.' },
              { step: '02', title: 'Aplica', desc: 'Sube tu cédula y datos básicos. Nuestro motor de riesgo evalúa tu solicitud al instante.' },
              { step: '03', title: 'Recibe', desc: 'Aprobación en minutos. El dinero llega directo a tu cuenta bancaria el mismo día.' },
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 w-16 h-16 bg-accent-500 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-accent-500/30 mb-6">
                  {item.step}
                </div>
                <h3 className="font-bold text-navy-900 text-xl mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <Link href="/login" className="inline-flex items-center gap-2 bg-navy-900 hover:bg-navy-800 text-white font-bold px-8 py-4 rounded-full transition-all hover:scale-105 shadow-lg text-lg">
              Comienza ahora
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="bg-gradient-to-br from-navy-900 to-navy-950 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-4xl mx-auto px-6 lg:px-12 py-20 lg:py-28 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            ¿Listo para impulsar <br/>
            <span className="text-accent-400">tu negocio?</span>
          </h2>
          <p className="text-navy-300 mt-6 text-lg max-w-xl mx-auto">
            Únete a miles de comerciantes colombianos que ya confían en Plurall para crecer.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/registro" className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-white font-bold text-lg px-10 py-4 rounded-full transition-all hover:scale-105 shadow-xl shadow-accent-500/30">
              Solicitar Crédito
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 text-white/70 hover:text-white font-semibold transition-colors">
              Ya tengo cuenta
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-navy-950 text-navy-300 border-t border-navy-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
                  <span className="text-navy-900 font-extrabold text-lg">P</span>
                </div>
                <span className="text-2xl font-bold tracking-tight text-white">PLURALL</span>
              </div>
              <p className="text-sm text-navy-400 max-w-sm leading-relaxed">
                Impulsando el crecimiento de los comerciantes colombianos con soluciones financieras digitales, rápidas y 100% seguras.
              </p>
            </div>
            
            {/* Links */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm tracking-wide">Plataforma</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/login" className="hover:text-accent-400 transition">Iniciar Sesión</Link></li>
                <li><Link href="/registro" className="hover:text-accent-400 transition">Solicitar Crédito</Link></li>
                <li><Link href="#" className="hover:text-accent-400 transition">Simulador de Cuotas</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 text-sm tracking-wide">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="#" className="hover:text-accent-400 transition">Términos y Condiciones</Link></li>
                <li><Link href="#" className="hover:text-accent-400 transition">Política de Privacidad</Link></li>
                <li><Link href="#" className="hover:text-accent-400 transition">Habeas Data (Ley 1581)</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-navy-800 text-xs text-navy-500 flex flex-col md:flex-row justify-between items-center gap-2">
            <p>© 2025 Plurall Colombia S.A.S. Todos los derechos reservados.</p>
            <p className="font-medium text-navy-400">Proyecto Formativo SENA · Tecnólogo ADSO</p>
          </div>
        </div>
      </footer>

    </main>
  );
}
