import type { Sku } from '@/lib/types'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '../ui/button'
import { ArrowUpDown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import RiskIndicator from './risk-indicator'
import SkuTableRowActions from './sku-table-row-actions'

const SortableHeader = ({
  column,
  title,
}: {
  column: any
  title: string
}) => (
  <Button
    variant="ghost"
    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
  >
    {title}
    <ArrowUpDown className="ml-2 h-4 w-4" />
  </Button>
)

export const getSkuTableColumns = (): ColumnDef<Sku>[] => [
  {
    accessorKey: 'name',
    header: 'SKU Name',
    cell: ({ row }) => {
      const sku = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 rounded-md">
            <AvatarImage
              src={sku.imageUrl}
              alt={sku.name}
              className="rounded-md"
              data-ai-hint={sku.imageHint}
            />
            <AvatarFallback className="rounded-md">
              {sku.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{sku.name}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'compositeRiskScore',
    header: ({ column }) => (
      <SortableHeader column={column} title="Composite Risk" />
    ),
    cell: ({ row }) => (
      <RiskIndicator
        score={row.original.compositeRiskScore.score}
        maxScore={100}
      />
    ),
  },
  {
    accessorKey: 'priceGapRisk',
    header: ({ column }) => (
      <SortableHeader column={column} title="Price Gap" />
    ),
    cell: ({ row }) => (
      <RiskIndicator score={row.original.priceGapRisk.score} maxScore={30} />
    ),
  },
  {
    accessorKey: 'stockCoverageRisk',
    header: ({ column }) => (
      <SortableHeader column={column} title="Stock Coverage" />
    ),
    cell: ({ row }) => (
      <RiskIndicator
        score={row.original.stockCoverageRisk.score}
        maxScore={30}
      />
    ),
  },
  {
    accessorKey: 'demandTrendRisk',
    header: ({ column }) => (
      <SortableHeader column={column} title="Demand Trend" />
    ),
    cell: ({ row }) => (
      <RiskIndicator
        score={row.original.demandTrendRisk.score}
        maxScore={20}
      />
    ),
  },
  {
    accessorKey: 'marginProximityRisk',
    header: ({ column }) => (
      <SortableHeader column={column} title="Margin Proximity" />
    ),
    cell: ({ row }) => (
      <RiskIndicator
        score={row.original.marginProximityRisk.score}
        maxScore={20}
      />
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <SkuTableRowActions sku={row.original} />,
  },
]
