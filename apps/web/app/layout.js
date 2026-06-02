/* ==========================================================================
 * ARCHIVO: layout.js
 * RUTA: apps/web/app/layout.js
 * DESCRIPCIÓN: Layout RAÍZ de toda la aplicación Next.js.
 * FUNCIONALIDAD: Define la fuente global (Montserrat), los metadatos del sitio
 *                y envuelve toda la app con el ThemeProvider (modo claro/oscuro).
 * ========================================================================== */
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

// FUENTE GLOBAL — Montserrat de Google Fonts
// variable: "--font-montserrat" (nombre de la variable CSS)
// subsets: ["latin"] — incluye solo caracteres latinos (para optimizar el tamaño)
// weight: pesos disponibles. Para agregar más grueso: agrega "900" a la lista
// Para cambiar la fuente: reemplaza Montserrat por Inter, Poppins, Roboto, etc.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// METADATOS DEL SITIO (aparecen en el título de la pestaña del navegador y SEO)
// Para cambiar: modifica title y description
export const metadata = {
  title: "PLURALL — Gestión de Créditos",
  description: "Plataforma de gestión de créditos para comerciantes y emprendedores colombianos",
};

export default function RootLayout({ children }) {
  return (
    // ELEMENTO HTML RAÍZ
    // lang="es" — idioma español (para accesibilidad y SEO)
    // montserrat.variable — aplica la fuente Montserrat como variable CSS global
    // h-full — altura 100% (necesario para que el body llene la pantalla)
    // suppressHydrationWarning — evita advertencias del ThemeProvider al cambiar tema
    <html lang="es" className={`${montserrat.variable} h-full`} suppressHydrationWarning>
      {/* ELEMENTO BODY
          min-h-full — al menos 100% de la pantalla de alto
          flex flex-col — columna flexible (para footer pegado al fondo si se necesita)
          antialiased — suaviza el renderizado de la fuente (mejor calidad visual)
          Para cambiar el FONDO GLOBAL DE TODA LA APP: agrega aquí bg-gray-100, bg-white, etc. */}
      <body className="min-h-full flex flex-col antialiased">
        {/* THEME PROVIDER — maneja el modo claro/oscuro de toda la aplicación
            Definido en components/ThemeProvider.js */}
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
