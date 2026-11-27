import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Outfit } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";
import { APP_NAME } from "@/lib/brand";
import { ServiceWorker } from "@/components/pwa";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export function generateMetadata(): Metadata {
  return {
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: "Training, quizzes and progress tracking.",
    applicationName: APP_NAME,
    appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6d4aff" },
    { media: "(prefers-color-scheme: dark)", color: "#140d33" },
  ],
};

// Applies the saved theme before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning className={`${jakarta.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <div className="aurora" aria-hidden />
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <Toaster richColors position="top-right" />
        <ServiceWorker />
      </body>
    </html>
  );
}
