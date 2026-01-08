import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStocktakeStore } from '@/stores/stocktakeStore'
import { useAuthStore } from '@/stores/authStore'
import Button from '@/components/ui/Button'
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const {
    currentStocktake,
    stocktakes,
    fetchStocktakes,
    createStocktake,
    setCurrentStocktake,
  } = useStocktakeStore()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [stocktakeName, setStocktakeName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchStocktakes()
  }, [fetchStocktakes])

  const handleCreateStocktake = async () => {
    if (!stocktakeName.trim()) return

    setIsCreating(true)
    try {
      await createStocktake(stocktakeName)
      setIsCreateModalOpen(false)
      setStocktakeName('')
    } catch (error) {
      console.error('Failed to create stocktake:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Welcome, {user?.username}!
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage your stock reconciliation tasks
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} size="lg">
          <svg
            className="mr-2 h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Stocktake
        </Button>
      </div>

      {/* Current Stocktake */}
      {currentStocktake && (
        <Card>
          <CardHeader>
            <CardTitle>Current Stocktake</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {currentStocktake.name}
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Stage {currentStocktake.stage} of 7
                </p>
              </div>
              <Button onClick={() => navigate('/counting')}>
                Continue Counting
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Stocktakes */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Stocktakes</CardTitle>
        </CardHeader>
        <CardContent>
          {stocktakes.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">
              No stocktakes yet. Create one to get started!
            </p>
          ) : (
            <div className="space-y-3">
              {stocktakes.slice(0, 5).map((stocktake) => (
                <div
                  key={stocktake.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {stocktake.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Stage {stocktake.stage} • {stocktake.status}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setCurrentStocktake(stocktake)
                      navigate('/counting')
                    }}
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Stocktake Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Stocktake"
      >
        <div className="space-y-4">
          <Input
            label="Stocktake Name"
            value={stocktakeName}
            onChange={(e) => setStocktakeName(e.target.value)}
            placeholder="e.g., January 2026 Stocktake"
          />
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStocktake}
              isLoading={isCreating}
              disabled={!stocktakeName.trim() || isCreating}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
