import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface RiskIndicatorProps {
  score: number
  maxScore: number
  className?: string
}

export default function RiskIndicator({
  score,
  maxScore,
  className,
}: RiskIndicatorProps) {
  const percentage = (score / maxScore) * 100
  const riskLevel =
    percentage >= 75 ? 'critical' : percentage >= 40 ? 'warning' : 'healthy'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="w-8 text-right font-medium">{score}</span>
      <Progress
        value={percentage}
        className="h-2 w-24"
        indicatorClassName={cn({
          'bg-red-500': riskLevel === 'critical',
          'bg-yellow-500': riskLevel === 'warning',
          'bg-green-500': riskLevel === 'healthy',
        })}
      />
    </div>
  )
}
