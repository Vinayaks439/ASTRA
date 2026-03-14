export interface AgentRationaleOutput {
  decisionType: 'exception_ticket' | 'autonomous'
  explanation: string
}

interface AgentRationaleInput {
  skuName: string
  actionType: string
  proposedActionDetails: string
  isException: boolean
  exceptionReason?: string
  compositeRiskScore: number
  priceGapRiskScore: number
  stockCoverageRiskScore: number
  demandTrendRiskScore: number
  marginProximityRiskScore: number
}

export async function getAgentRationaleAndExplanation(
  input: AgentRationaleInput
): Promise<AgentRationaleOutput> {
  const res = await fetch('/api/v1/agent/rationale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to fetch agent rationale')
  return res.json()
}
