import type { Metadata } from "next";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Me - Rohit Prasad",
  description: "Interactive Digital Twin AI Portfolio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Theme
          appearance="dark"
          accentColor="indigo"
          grayColor="slate"
          radius="large"
          scaling="95%"
        >
          {children}
        </Theme>
      </body>
    </html>
  );
}
