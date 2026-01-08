import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Settings
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>User Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400">
            User settings and preferences will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
