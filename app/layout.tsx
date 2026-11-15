import type { Metadata } from 'next'
import { Providers } from './providers'
import '../src/index.css'

export const metadata: Metadata = {
  title: 'Disbux Admin Portal',
  description: 'Administrative portal for Disbux.',
  robots: { index: false, follow: false },
  icons: { icon: '/images/favicon.png' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning><Providers>{children}</Providers></body>
    </html>
  )
}
