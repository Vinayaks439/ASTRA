'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import useLocalStorage from '@/hooks/use-local-storage'
import { Separator } from '../ui/separator'

const settingsSchema = z.object({
  riskThresholds: z.object({
    priceGap: z.number().min(0).max(30),
    stockCoverage: z.number().min(0).max(30),
    demandTrend: z.number().min(0).max(20),
    marginProximity: z.number().min(0).max(20),
  }),
  features: z.object({
    poRecommendations: z.boolean(),
    whatsappNotifications: z.boolean(),
  }),
  whatsappNumber: z
    .string()
    .min(10, { message: 'Please enter a valid phone number.' }),
})

type SettingsFormValues = z.infer<typeof settingsSchema>

const defaultValues: SettingsFormValues = {
  riskThresholds: {
    priceGap: 24,
    stockCoverage: 24,
    demandTrend: 16,
    marginProximity: 16,
  },
  features: {
    poRecommendations: true,
    whatsappNotifications: true,
  },
  whatsappNumber: '+15551234567',
}

export default function SettingsForm() {
  const [storedSettings, setStoredSettings] = useLocalStorage(
    'sellerflow-settings',
    defaultValues
  )

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: storedSettings,
  })

  function onSubmit(data: SettingsFormValues) {
    setStoredSettings(data)
    toast({
      title: 'Settings Saved',
      description: 'Your new settings have been applied.',
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Risk Thresholds</h3>
          <p className="text-sm text-muted-foreground">
            Set the score at which a risk category triggers an exception ticket instead of an autonomous action.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <FormField
            control={form.control}
            name="riskThresholds.priceGap"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price Gap Risk (0-30)</FormLabel>
                <div className="flex items-center gap-4">
                  <FormControl>
                    <Slider
                      min={0}
                      max={30}
                      step={1}
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                    />
                  </FormControl>
                  <span className="font-mono text-lg">{field.value}</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="riskThresholds.stockCoverage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Coverage Risk (0-30)</FormLabel>
                <div className="flex items-center gap-4">
                  <FormControl>
                    <Slider
                      min={0}
                      max={30}
                      step={1}
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                    />
                  </FormControl>
                  <span className="font-mono text-lg">{field.value}</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="riskThresholds.demandTrend"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Demand Trend Risk (0-20)</FormLabel>
                <div className="flex items-center gap-4">
                  <FormControl>
                    <Slider
                      min={0}
                      max={20}
                      step={1}
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                    />
                  </FormControl>
                  <span className="font-mono text-lg">{field.value}</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="riskThresholds.marginProximity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Margin Proximity Risk (0-20)</FormLabel>
                <div className="flex items-center gap-4">
                  <FormControl>
                    <Slider
                      min={0}
                      max={20}
                      step={1}
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                    />
                  </FormControl>
                  <span className="font-mono text-lg">{field.value}</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <Separator/>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Features & Notifications</h3>
          <p className="text-sm text-muted-foreground">
            Enable or disable optional agent features and notification channels.
          </p>
        </div>

         <FormField
            control={form.control}
            name="features.poRecommendations"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">PO Recommendations</FormLabel>
                  <FormDescription>
                    Allow the agent to recommend Purchase Orders for low-stock items.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

         <FormField
            control={form.control}
            name="features.whatsappNotifications"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">WhatsApp Notifications</FormLabel>
                  <FormDescription>
                    Receive simulated notifications for agent actions.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        
        <FormField
          control={form.control}
          name="whatsappNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp Number</FormLabel>
              <FormControl>
                <Input placeholder="+15551234567" {...field} />
              </FormControl>
              <FormDescription>
                The number where simulated notifications will be sent.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save Changes</Button>
      </form>
    </Form>
  )
}
