'use client'

/**
 * Admin UI: Resend email sending domain DNS records + Check status for tenants.domain.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

type DnsRecord = {
  record?: string
  name?: string
  type?: string
  ttl?: string
  status?: string
  value?: string
  priority?: number
}

type StatusPayload = {
  domain: string | null
  status: string
  resendDomainId: string | null
  records: DnsRecord[]
  verifiedAt?: string | null
  error?: string
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: string; color: string; label: string }> = {
    verified: { icon: '✓', color: '#16a34a', label: 'Verified' },
    pending: { icon: '◷', color: '#ca8a04', label: 'Pending' },
    not_started: { icon: '◌', color: '#6b7280', label: 'Not started' },
    failed: { icon: '✕', color: '#dc2626', label: 'Failed' },
    not_configured: { icon: '—', color: '#6b7280', label: 'Not configured' },
  }
  const entry = map[status] ?? map.not_configured!
  return (
    <span style={{ color: entry.color, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
      {entry.icon} {entry.label}
    </span>
  )
}

function RecordStatusBadge({ status }: { status?: string }) {
  const s = (status || 'not_started').toLowerCase()
  const color =
    s === 'verified' ? '#16a34a' : s === 'pending' ? '#ca8a04' : s === 'failed' ? '#dc2626' : '#6b7280'
  return <span style={{ color, fontSize: 12 }}>{s}</span>
}

export const EmailDomainDnsInstructions: React.FC = () => {
  const { id } = useDocumentInfo()
  const domainField = useFormFields(([fields]) => fields.domain)
  const domainValue =
    typeof domainField?.value === 'string' && domainField.value.trim()
      ? domainField.value.trim()
      : null

  const [data, setData] = useState<StatusPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tenantId = id != null ? String(id) : null

  const loadStatus = useCallback(async () => {
    if (!tenantId || !domainValue) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/resend/domain/status?tenantId=${encodeURIComponent(tenantId)}`,
        { credentials: 'include' },
      )
      const json = (await res.json()) as StatusPayload
      if (!res.ok) {
        setError(json.error || 'Failed to load email domain status')
        setData(null)
        return
      }
      setData(json)
    } catch {
      setError('Failed to load email domain status')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [tenantId, domainValue])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const onCheckStatus = async () => {
    if (!tenantId) return
    setChecking(true)
    setError(null)
    try {
      const res = await fetch('/api/resend/domain/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: Number(tenantId) }),
      })
      const json = (await res.json()) as StatusPayload
      if (!res.ok) {
        setError(json.error || 'Verification check failed')
        return
      }
      setData(json)
    } catch {
      setError('Verification check failed')
    } finally {
      setChecking(false)
    }
  }

  if (!domainValue) return null

  const records = data?.records || []
  const status = data?.status || 'not_configured'
  const isVerified = status === 'verified'

  return (
    <div style={{ padding: '12px 0' }} data-testid="email-domain-dns-instructions">
      <h4 style={{ marginBottom: 8 }}>Email sending domain (Resend)</h4>
      <p style={{ marginBottom: 12, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
        Separate from the website CNAME above. Add these DNS records so we can send mail as{' '}
        <strong>auth@{domainValue}</strong>.
      </p>

      {isVerified ? (
        <p style={{ marginBottom: 12, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
          ✓ {domainValue} is verified for email sending.
        </p>
      ) : (
        <p style={{ marginBottom: 12, color: 'var(--theme-elevation-500)', fontSize: 13 }}>
          Overall status: <StatusBadge status={status} />
          {loading ? ' (loading…)' : null}
        </p>
      )}

      {error ? (
        <p style={{ marginBottom: 12, color: '#dc2626', fontSize: 12 }} role="alert">
          {error}
        </p>
      ) : null}

      {records.length > 0 ? (
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              {['Type', 'Host / Name', 'Value', 'Priority', 'Status'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '4px 8px',
                    borderBottom: '1px solid var(--theme-elevation-150)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={`${r.type}-${r.name}-${i}`}>
                <td style={{ padding: '4px 8px', verticalAlign: 'top' }}>{r.type || '—'}</td>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace', verticalAlign: 'top' }}>
                  {r.name || '—'}
                </td>
                <td
                  style={{
                    padding: '4px 8px',
                    fontFamily: 'monospace',
                    verticalAlign: 'top',
                    wordBreak: 'break-all',
                  }}
                >
                  {r.value || '—'}
                </td>
                <td style={{ padding: '4px 8px', verticalAlign: 'top' }}>
                  {r.priority != null ? r.priority : '—'}
                </td>
                <td style={{ padding: '4px 8px', verticalAlign: 'top' }}>
                  <RecordStatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        !loading && (
          <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>
            No DNS records yet. Save the tenant with a custom domain, then refresh — or click Check
            status to provision the Resend domain.
          </p>
        )
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => void onCheckStatus()}
          disabled={checking || !tenantId}
          data-testid="email-domain-check-status"
          style={{
            padding: '6px 12px',
            fontSize: 13,
            cursor: checking ? 'wait' : 'pointer',
          }}
        >
          {checking ? 'Checking…' : 'Check status'}
        </button>
        <button
          type="button"
          onClick={() => void loadStatus()}
          disabled={loading}
          style={{ padding: '6px 12px', fontSize: 13 }}
        >
          Refresh
        </button>
      </div>
    </div>
  )
}

export default EmailDomainDnsInstructions
