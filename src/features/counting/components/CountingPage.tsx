import { useEffect, useState, useRef } from 'react'
import { useStocktakeStore } from '@/stores/stocktakeStore'
import { useScanStore } from '@/stores/scanStore'
import { useProductStore } from '@/stores/productStore'
import { useAppStore } from '@/stores/appStore'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'

export default function CountingPage() {
  const { currentStocktake } = useStocktakeStore()
  const { scans, fetchScans, addScan, updateScan, deleteScan } = useScanStore()
  const { locations, fetchProducts, fetchLocations, getProductByBarcode } = useProductStore()
  const { currentLocation, setCurrentLocation } = useAppStore()

  const [barcode, setBarcode] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const [editingScan, setEditingScan] = useState<any>(null)
  const [editQuantity, setEditQuantity] = useState('')

  const barcodeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProducts()
    fetchLocations()
  }, [fetchProducts, fetchLocations])

  useEffect(() => {
    if (currentStocktake) {
      fetchScans(currentStocktake.id)
    }
  }, [currentStocktake, fetchScans])

  // Auto-focus barcode input
  useEffect(() => {
    if (!editingScan && barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }, [editingScan, isScanning])

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentStocktake) {
      setError('Please select a stocktake first')
      return
    }

    if (!barcode.trim()) {
      setError('Please enter a barcode')
      return
    }

    if (!currentLocation) {
      setError('Please select a location first')
      return
    }

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity')
      return
    }

    setIsScanning(true)
    setError('')

    try {
      // Look up product
      const product = getProductByBarcode(barcode.trim())

      if (!product) {
        setError(`Product not found for barcode: ${barcode}`)
        setIsScanning(false)
        return
      }

      // Add scan
      await addScan(currentStocktake.id, {
        barcode: barcode.trim(),
        product_name: product.product_name,
        quantity: qty,
        location: currentLocation,
      })

      // Reset form
      setBarcode('')
      setQuantity('1')
      barcodeInputRef.current?.focus()
    } catch (err) {
      console.error('Scan error:', err)
      setError('Failed to add scan. Please try again.')
    } finally {
      setIsScanning(false)
    }
  }

  const handleEditScan = (scan: any) => {
    setEditingScan(scan)
    setEditQuantity(scan.quantity.toString())
  }

  const handleUpdateScan = async () => {
    if (!editingScan) return

    const qty = parseFloat(editQuantity)
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity')
      return
    }

    try {
      await updateScan(editingScan.id, qty)
      setEditingScan(null)
      setEditQuantity('')
    } catch (err) {
      console.error('Update error:', err)
      setError('Failed to update scan')
    }
  }

  const handleDeleteScan = async (scanId: string) => {
    if (!confirm('Are you sure you want to delete this scan?')) return

    try {
      await deleteScan(scanId)
    } catch (err) {
      console.error('Delete error:', err)
      setError('Failed to delete scan')
    }
  }

  // Filter scans by current location
  const locationScans = currentLocation
    ? scans.filter((s) => s.location === currentLocation)
    : scans

  // Calculate totals
  const totalItems = locationScans.length
  const totalQuantity = locationScans.reduce((sum, s) => sum + s.quantity, 0)

  if (!currentStocktake) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Barcode Scanning
        </h1>
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
              No stocktake selected
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              Please select or create a stocktake from the dashboard
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Barcode Scanning
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            {currentStocktake.name} - Stage {currentStocktake.stage}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {totalItems} items scanned
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total quantity: {totalQuantity.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Location Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {locations.map((location) => (
              <button
                key={location.id}
                onClick={() => setCurrentLocation(location.name)}
                className={`rounded-lg border-2 p-4 text-center transition-all ${
                  currentLocation === location.name
                    ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                }`}
              >
                <p className="font-medium">{location.name}</p>
                {location.description && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {location.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scanning Form */}
      <Card>
        <CardHeader>
          <CardTitle>Scan Product</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleScan} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Input
                  ref={barcodeInputRef}
                  label="Barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or type barcode..."
                  disabled={!currentLocation || isScanning}
                  autoFocus
                />
              </div>
              <Input
                label="Quantity"
                type="number"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={!currentLocation || isScanning}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              isLoading={isScanning}
              disabled={!currentLocation || isScanning || !barcode.trim()}
            >
              {isScanning ? 'Adding...' : 'Add Scan'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Scans List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Scanned Items {currentLocation && `- ${currentLocation}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {locationScans.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">
              No scans yet. Start scanning items!
            </p>
          ) : (
            <div className="space-y-2">
              {locationScans.map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {scan.product_name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {scan.barcode} • Qty: {scan.quantity}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditScan(scan)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteScan(scan.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingScan}
        onClose={() => setEditingScan(null)}
        title="Edit Scan"
      >
        {editingScan && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Product
              </p>
              <p className="text-gray-900 dark:text-gray-100">
                {editingScan.product_name}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {editingScan.barcode}
              </p>
            </div>

            <Input
              label="Quantity"
              type="number"
              step="0.01"
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
            />

            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={() => setEditingScan(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateScan}>Update</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
