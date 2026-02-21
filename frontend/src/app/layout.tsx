import type { Metadata } from "next";
import "./globals.css";
import { Inter, Playfair_Display } from "next/font/google";



export const metadata: Metadata = {
  title: "Golden Valley Market Research",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.className} ${playfair.className}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});
