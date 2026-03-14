interface WhatsappActionSummaryInput {
  actionType: string
  skuName: string
  details: string
}

interface WhatsappActionSummaryOutput {
  message: string
}

export async function whatsappActionSummary(
  input: WhatsappActionSummaryInput
): Promise<WhatsappActionSummaryOutput> {
  const res = await fetch('/api/v1/notifications/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to send WhatsApp summary')
  return res.json()
}
