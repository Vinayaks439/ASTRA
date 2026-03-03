'use client'

import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '../ui/button'
import { Sku } from '@/lib/types'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Separator } from '../ui/separator'
import {
  getAgentRationaleAndExplanation,
  type AgentRationaleOutput,
} from '@/ai/flows/agent-rationale-and-exception-explanation'
import { Skeleton } from '../ui/skeleton'
import { Badge } from '../ui/badge'
import { toast } from '@/hooks/use-toast'
import { whatsappActionSummary } from '@/ai/flows/whatsapp-action-summary'
import RiskIndicator from './risk-indicator'
import { AlertCircle, CheckCircle } from 'lucide-react'

interface ActionDrawerProps {
  isOpen: boolean
  onClose: () => void
  sku: Sku | null
}

const settings = {
  // Mock settings for demo
  riskThresholds: {
    priceGap: 24,
    stockCoverage: 24,
    demandTrend: 16,
    marginProximity: 16,
  },
}

export default function ActionDrawer({
  isOpen,
  onClose,
  sku,
}: ActionDrawerProps) {
  const [rationale, setRationale] = React.useState<AgentRationaleOutput | null>(
    null
  )
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    if (sku && isOpen) {
      const fetchRationale = async () => {
        setIsLoading(true)
        setRationale(null)

        const isException =
          sku.priceGapRisk.score > settings.riskThresholds.priceGap ||
          sku.stockCoverageRisk.score > settings.riskThresholds.stockCoverage ||
          sku.demandTrendRisk.score > settings.riskThresholds.demandTrend ||
          sku.marginProximityRisk.score >
            settings.riskThresholds.marginProximity

        let exceptionReason: string | undefined = undefined
        if (isException && sku.compositeRiskScore.topDriver !== 'None') {
          const topDriver = sku.compositeRiskScore.topDriver
          const driverKey = (topDriver.charAt(0).toLowerCase() +
            topDriver.slice(1).replace(' ', '') +
            'Risk') as keyof Sku
          const riskObject = sku[driverKey] as { score: number } | undefined

          if (riskObject) {
            exceptionReason = `${topDriver} risk score of ${riskObject.score} exceeded threshold.`
          }
        }

        const input = {
          skuName: sku.name,
          actionType: 'price_change' as const, // Mock for demo
          proposedActionDetails: 'Decrease price by 5%', // Mock for demo
          isException: isException,
          exceptionReason: exceptionReason,
          compositeRiskScore: sku.compositeRiskScore.score,
          priceGapRiskScore: sku.priceGapRisk.score,
          stockCoverageRiskScore: sku.stockCoverageRisk.score,
          demandTrendRiskScore: sku.demandTrendRisk.score,
          marginProximityRiskScore: sku.marginProximityRisk.score,
        }

        try {
          const result = await getAgentRationaleAndExplanation(input)
          setRationale(result)
        } catch (error) {
          console.error('Failed to get agent rationale:', error)
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not load AI rationale.',
          })
        } finally {
          setIsLoading(false)
        }
      }
      fetchRationale()
    }
  }, [sku, isOpen])

  const handleApprove = async () => {
    toast({
      title: 'Action Approved',
      description: `${sku?.name}: Price change has been executed.`,
    })
    const result = await whatsappActionSummary({
      actionType: 'Autonomous Price Change',
      skuName: sku?.name || 'N/A',
      details: 'Price changed from $100 to $95', // Mock data
    })
    toast({
      title: 'WhatsApp Sent (Simulated)',
      description: result.message,
    })
    onClose()
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Agent Recommendation</SheetTitle>
          {sku && (
            <div className="flex items-center gap-3 pt-2">
              <Avatar className="h-12 w-12 rounded-md">
                <AvatarImage
                  src={sku.imageUrl}
                  alt={sku.name}
                  className="rounded-md"
                />
                <AvatarFallback className="rounded-md">
                  {sku.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetDescription>SKU</SheetDescription>
                <p className="font-semibold text-foreground">{sku.name}</p>
              </div>
            </div>
          )}
        </SheetHeader>
        <Separator className="my-4" />

        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Risk Profile</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <RiskIndicator
              score={sku?.compositeRiskScore.score ?? 0}
              maxScore={100}
            />
            <p className="text-muted-foreground">Composite Risk</p>
            <RiskIndicator score={sku?.priceGapRisk.score ?? 0} maxScore={30} />
            <p className="text-muted-foreground">Price Gap</p>
            <RiskIndicator
              score={sku?.stockCoverageRisk.score ?? 0}
              maxScore={30}
            />
            <p className="text-muted-foreground">Stock Coverage</p>
            <RiskIndicator
              score={sku?.demandTrendRisk.score ?? 0}
              maxScore={20}
            />
            <p className="text-muted-foreground">Demand Trend</p>
            <RiskIndicator
              score={sku?.marginProximityRisk.score ?? 0}
              maxScore={20}
            />
            <p className="text-muted-foreground">Margin Proximity</p>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Agent Rationale</h3>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : rationale ? (
            <>
              <Badge
                variant={
                  rationale.decisionType === 'exception_ticket'
                    ? 'destructive'
                    : 'default'
                }
                className="gap-2"
              >
                {rationale.decisionType === 'exception_ticket' ? (
                  <AlertCircle className="h-3 w-3" />
                ) : (
                  <CheckCircle className="h-3 w-3" />
                )}
                {rationale.decisionType === 'exception_ticket'
                  ? 'Exception Ticket'
                  : 'Autonomous Action'}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {rationale.explanation}
              </p>
            </>
          ) : (
            <p className="text-sm text-destructive">
              Could not load rationale.
            </p>
          )}
        </div>

        <SheetFooter className="mt-6">
          {rationale?.decisionType === 'exception_ticket' && (
            <>
              <Button variant="outline" onClick={onClose}>
                Reject
              </Button>
              <Button onClick={handleApprove}>Approve</Button>
            </>
          )}
          {rationale?.decisionType === 'autonomous' && (
            <Button onClick={onClose}>Acknowledge</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
