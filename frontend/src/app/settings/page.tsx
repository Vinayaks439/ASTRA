import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import SettingsForm from '@/components/settings/settings-form'

export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
      <div className="mx-auto grid w-full max-w-6xl gap-2">
        <h1 className="font-heading text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your agent settings, risk thresholds, and notification
          preferences.
        </p>
      </div>
      <div className="mx-auto grid w-full max-w-6xl items-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Agent Configuration</CardTitle>
            <CardDescription>
              Adjust the parameters that control the AI agent's autonomous
              behavior.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
