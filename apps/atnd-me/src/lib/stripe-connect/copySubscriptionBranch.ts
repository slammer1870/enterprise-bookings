type BranchInvoice = {
  id: string
  metadata?: Record<string, string> | null
  parent?: {
    subscription_details?: {
      metadata?: Record<string, string> | null
    } | null
  } | null
}

export async function copySubscriptionBranchOntoInvoice(params: {
  stripeAccount: string | undefined
  stripe: {
    invoices: {
      update: (
        id: string,
        data: { metadata: { branchName: string; branchSlug: string } },
        options: { stripeAccount?: string },
      ) => Promise<unknown>
    }
  }
  invoice: BranchInvoice
}): Promise<'updated' | 'skipped'> {
  const source = params.invoice.parent?.subscription_details?.metadata
  const branchName = source?.branchName
  const branchSlug = source?.branchSlug
  if (!branchName || !branchSlug) return 'skipped'

  const current = params.invoice.metadata
  if (current?.branchName === branchName && current?.branchSlug === branchSlug) {
    return 'skipped'
  }

  await params.stripe.invoices.update(
    params.invoice.id,
    { metadata: { branchName, branchSlug } },
    { stripeAccount: params.stripeAccount },
  )
  return 'updated'
}

type InvoicePayments = {
  data?: Array<{
    status?: string
    payment?: {
      type?: string
      payment_intent?: string | null
    } | null
  }>
} | null

type PaidInvoice = {
  id?: string
  metadata?: Record<string, string> | null
  payments?: InvoicePayments
}

function paidPaymentIntentId(payments: InvoicePayments | undefined): string | undefined {
  const id = payments?.data?.find(
    (entry) => entry.status === 'paid' && entry.payment?.type === 'payment_intent',
  )?.payment?.payment_intent
  return id || undefined
}

export async function copyInvoiceBranchOntoCharge(params: {
  stripeAccount: string | undefined
  stripe: {
    invoices?: {
      retrieve: (
        id: string,
        data: { expand: ['payments'] },
        options: { stripeAccount?: string },
      ) => Promise<unknown>
    }
    paymentIntents: {
      retrieve: (
        id: string,
        data: { expand: ['latest_charge'] },
        options: { stripeAccount?: string },
      ) => Promise<{
        latest_charge?:
          | string
          | { id: string; metadata?: Record<string, string> | null }
          | null
      }>
    }
    charges: {
      update: (
        id: string,
        data: { metadata: { branchName: string; branchSlug: string } },
        options: { stripeAccount?: string },
      ) => Promise<unknown>
    }
  }
  invoice: PaidInvoice
}): Promise<'updated' | 'skipped'> {
  const branchName = params.invoice.metadata?.branchName
  const branchSlug = params.invoice.metadata?.branchSlug
  if (!branchName || !branchSlug) return 'skipped'

  let paymentIntentId = paidPaymentIntentId(params.invoice.payments)
  if (!paymentIntentId && params.invoice.id && params.stripe.invoices) {
    const retrieved = (await params.stripe.invoices.retrieve(
      params.invoice.id,
      { expand: ['payments'] },
      { stripeAccount: params.stripeAccount },
    )) as { payments?: InvoicePayments }
    paymentIntentId = paidPaymentIntentId(retrieved.payments)
  }
  if (!paymentIntentId) return 'skipped'

  const paymentIntent = await params.stripe.paymentIntents.retrieve(
    paymentIntentId,
    { expand: ['latest_charge'] },
    { stripeAccount: params.stripeAccount },
  )
  const latestCharge = paymentIntent.latest_charge
  const chargeId = typeof latestCharge === 'string' ? latestCharge : latestCharge?.id
  const chargeMetadata = typeof latestCharge === 'string' ? undefined : latestCharge?.metadata
  if (!chargeId) return 'skipped'
  if (
    chargeMetadata?.branchName === branchName &&
    chargeMetadata?.branchSlug === branchSlug
  ) {
    return 'skipped'
  }

  await params.stripe.charges.update(
    chargeId,
    { metadata: { branchName, branchSlug } },
    { stripeAccount: params.stripeAccount },
  )
  return 'updated'
}
