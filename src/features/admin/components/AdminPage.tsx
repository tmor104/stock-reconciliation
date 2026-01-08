import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Administration
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400">
            User management and admin tools will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
