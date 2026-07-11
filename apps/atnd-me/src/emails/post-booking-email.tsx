import {
  Body,
  Container,
  Head,
  Html,
  Preview,
} from '@react-email/components'
import * as React from 'react'

interface PostBookingEmailLayoutProps {
  subject: string
  bodyHtml: string
}

export function PostBookingEmailLayout({ subject, bodyHtml }: PostBookingEmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <div style={content} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
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

export default PostBookingEmailLayout
