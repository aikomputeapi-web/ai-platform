import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI API Platform — Developer Portal",
  description: "Access powerful AI models through a single API. Sign up, get your API key, and start building.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
