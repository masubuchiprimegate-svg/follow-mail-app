import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "展示会フォローメール下書き作成",
  description: "展示会営業後のフォローメールをAIで作成し、Outlookの下書きに保存するMVP"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
