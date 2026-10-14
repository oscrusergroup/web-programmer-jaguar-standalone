import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";
export const metadata: Metadata = {
  title: "Jaguar Reader · Web Programmer",
  description: "Install the latest Jaguar cartridge reader firmware on your Arduino Mega 2560 directly from your browser.",
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}/></head><body>{children}</body></html>;
}
