import { Montserrat } from "next/font/google";
import "./globals.css";

// Se carga fuente Montserrat de Google con pesos usados en el app.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Metadata global para SEO y cabeceras HTML.
export const metadata = {
  title: "PLURALL — Gestión de Créditos",
  description: "Plataforma de gestión de créditos para comerciantes y emprendedores colombianos",
};

// RootLayout envuelve todas las páginas.
export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${montserrat.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
