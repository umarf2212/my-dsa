import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dsa-field-guide.wtblogger25.chatgpt.site"),
  title: "DSA Field Guide",
  description: "A calm, searchable study workspace for your DSA roadmap.",
  openGraph: {
    title: "DSA Field Guide",
    description: "Build the instinct behind the answer.",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "DSA Field Guide" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DSA Field Guide",
    description: "Build the instinct behind the answer.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
