import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AlertTriangle, BotMessageSquare, ShieldCheck } from 'lucide-react'

interface AiSummaryProps {
  summary: string
  stats: {
    totalSkusNeedingAttention: number
    criticalSkusNeedingAttention: number
    warningSkusNeedingAttention: number
    topRiskDriver: string
  }
}

export default function AiSummary({ summary, stats }: AiSummaryProps) {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              SKUs Needing Attention
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalSkusNeedingAttention}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.criticalSkusNeedingAttention} critical,{' '}
              {stats.warningSkusNeedingAttention} warning
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Risk Driver</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.topRiskDriver}</div>
            <p className="text-xs text-muted-foreground">
              Across {stats.totalSkusNeedingAttention} SKUs
            </p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Live AI Summary
            </CardTitle>
            <BotMessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{summary}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
