import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{children}</body>
    </html>
  )
}
