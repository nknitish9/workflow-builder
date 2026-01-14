import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import { TRPCProvider } from '@/components/providers/TrpcProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Workflow Builder - LLM Workflows',
  description: 'Build and execute LLM workflows with visual programming',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className} suppressHydrationWarning>
          <TRPCProvider>{children}</TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}