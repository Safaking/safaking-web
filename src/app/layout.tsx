import type { Metadata, Viewport } from "next";
import { Playfair_Display, Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { MobileTabBar } from "@/components/landing/MobileTabBar";
import { NativeChrome } from "@/components/landing/NativeChrome";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.safaking.in"),
  title: {
    default: "SafaKing — Royal Safas, Expert Artists & Turban House",
    template: "%s · SafaKing",
  },
  description:
    "Premium royal safas and groom turbans. Book master safa artists, register as a supplier, or join our artist training academy.",
  keywords: [
    "safa", "pagdi", "turban", "groom safa", "wedding safa", "safa artist",
    "safa on rent", "Jodhpuri safa", "Rajasthani pagdi", "Jaipur",
  ],
  // Without these a WhatsApp or Instagram share — how most of this audience
  // actually arrives — shows a bare link instead of the brand.
  openGraph: {
    type: "website",
    siteName: "SafaKing",
    locale: "en_IN",
    url: "https://www.safaking.in",
    title: "SafaKing — Royal Safas, Expert Artists & Turban House",
    description:
      "Book a master safa artist for your wedding, rent royal safas, or buy from our collection.",
    images: [{ url: "/logo.png", width: 480, height: 480, alt: "SafaKing" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SafaKing — Royal Safas, Expert Artists & Turban House",
    description:
      "Book a master safa artist for your wedding, rent royal safas, or buy from our collection.",
    images: ["/logo.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#4A0E1A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${playfair.variable} ${cormorant.variable} ${dmSans.variable} antialiased font-sans pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0`}
      >
        <AuthProvider>
          <CartProvider>
            <NativeChrome />
            {children}
            <MobileTabBar />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

