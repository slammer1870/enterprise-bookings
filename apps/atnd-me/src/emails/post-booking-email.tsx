import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface PostBookingEmailLayoutProps {
  subject: string
  bodyHtml: string
  tenantName?: string | null
  logoUrl?: string | null
}

export function PostBookingEmailLayout({
  subject,
  bodyHtml,
  tenantName,
  logoUrl,
}: PostBookingEmailLayoutProps) {
  const name = typeof tenantName === 'string' && tenantName.trim() ? tenantName.trim() : null
  const logo = typeof logoUrl === 'string' && logoUrl.trim() ? logoUrl.trim() : null

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <div style={content}>
            {(name || logo) && (
              <div style={header}>
                {logo ? (
                  <Img
                    src={logo}
                    alt={name || 'Logo'}
                    width={160}
                    style={logoStyle}
                  />
                ) : null}
                {name ? <Text style={brandName}>{name}</Text> : null}
              </div>
            )}
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </div>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f5f5f5',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '20px 0',
  maxWidth: '600px',
}

const content = {
  backgroundColor: '#ffffff',
  padding: '30px',
  borderRadius: '4px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
}

const header = {
  paddingBottom: '18px',
  marginBottom: '18px',
  borderBottom: '1px solid #eaeaea',
  textAlign: 'center' as const,
}

const logoStyle = {
  display: 'block',
  margin: '0 auto 12px',
  maxHeight: '48px',
  width: 'auto',
  height: 'auto',
  border: '0',
  outline: 'none',
  textDecoration: 'none',
}

const brandName = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#000',
  margin: '0',
  textAlign: 'center' as const,
}

export default PostBookingEmailLayout
