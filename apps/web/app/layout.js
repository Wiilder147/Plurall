/* ==========================================================================
 * ARCHIVO: layout.js
 * RUTA: apps/web/app/layout.js
 * DESCRIPCIÓN: Archivo principal de la aplicación frontend.
 * FUNCIONALIDAD: Este archivo define la lógica y estructura para su respectivo módulo.
 * ========================================================================== */
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "PLURALL — Gestión de Créditos",
  description: "Plataforma de gestión de créditos para comerciantes y emprendedores colombianos",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${montserrat.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
