import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Poppins, Ubuntu } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const ubuntu = Ubuntu({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-ubuntu",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cuentas Claras — Dashboard",
  description: "Panel de métricas interno",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${poppins.variable} ${ubuntu.variable}`}>
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
