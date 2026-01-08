import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function CountingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Barcode Scanning & Counting
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Counting Interface</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400">
            Barcode scanning interface will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
