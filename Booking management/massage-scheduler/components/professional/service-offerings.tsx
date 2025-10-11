"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Clock, DollarSign, Edit, Plus } from "lucide-react"

interface Service {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
}

interface ProfessionalService {
  id?: string
  professional_id: string
  service_id: string
  custom_price: number | null
  is_offered: boolean
  service: Service
}

export function ServiceOfferings() {
  const [professionalServices, setProfessionalServices] = useState<ProfessionalService[]>([])
  const [availableServices, setAvailableServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<ProfessionalService | null>(null)
  const [professionalId, setProfessionalId] = useState<string>("")

  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      setProfessionalId(user.id)

      // Load all available services
      const { data: services, error: servicesError } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("name")

      if (servicesError) throw servicesError
      setAvailableServices(services || [])

      // Load professional's service offerings
      const { data: professionalServices, error: professionalError } = await supabase
        .from("professional_services")
        .select(
          `
          *,
          service:services(*)
        `,
        )
        .eq("professional_id", user.id)

      if (professionalError) throw professionalError
      setProfessionalServices(professionalServices || [])
    } catch (error) {
      console.error("Error loading services:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleService = async (serviceId: string, currentStatus: boolean) => {
    try {
      const supabase = createClient()
      const existingService = professionalServices.find((ps) => ps.service_id === serviceId)

      if (existingService?.id) {
        // Update existing service
        const { error } = await supabase
          .from("professional_services")
          .update({ is_offered: !currentStatus })
          .eq("id", existingService.id)

        if (error) throw error

        setProfessionalServices((prev) =>
          prev.map((ps) => (ps.id === existingService.id ? { ...ps, is_offered: !currentStatus } : ps)),
        )
      } else {
        // Add new service
        const service = availableServices.find((s) => s.id === serviceId)
        if (!service) return

        const { data, error } = await supabase
          .from("professional_services")
          .insert([
            {
              professional_id: professionalId,
              service_id: serviceId,
              custom_price: null,
              is_offered: true,
            },
          ])
          .select(
            `
            *,
            service:services(*)
          `,
          )
          .single()

        if (error) throw error

        setProfessionalServices((prev) => [...prev, data])
      }
    } catch (error) {
      console.error("Error toggling service:", error)
      alert("Failed to update service")
    }
  }

  const handleUpdateService = async (professionalServiceId: string, customPrice: number | null) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("professional_services")
        .update({ custom_price: customPrice })
        .eq("id", professionalServiceId)

      if (error) throw error

      setProfessionalServices((prev) =>
        prev.map((ps) => (ps.id === professionalServiceId ? { ...ps, custom_price: customPrice } : ps)),
      )
      setIsEditDialogOpen(false)
      setSelectedService(null)
    } catch (error) {
      console.error("Error updating service:", error)
      alert("Failed to update service")
    }
  }

  const getEffectivePrice = (professionalService: ProfessionalService) => {
    return professionalService.custom_price || professionalService.service.price
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-green-600">Loading your services...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const offeredServices = professionalServices.filter((ps) => ps.is_offered)
  const unOfferedServices = availableServices.filter(
    (service) => !professionalServices.some((ps) => ps.service_id === service.id),
  )

  return (
    <div className="space-y-6">
      {/* Offered Services */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Service Offerings</CardTitle>
              <CardDescription>Services you currently offer to clients</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {offeredServices.map((professionalService) => (
              <div key={professionalService.id} className="p-4 border rounded-lg flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h4 className="font-semibold text-green-900">{professionalService.service.name}</h4>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Offered</Badge>
                    <span className="text-sm font-medium text-green-600">
                      ${getEffectivePrice(professionalService)}
                      {professionalService.custom_price && (
                        <span className="text-xs text-muted-foreground ml-1">(custom)</span>
                      )}
                    </span>
                  </div>
                  {professionalService.service.description && (
                    <p className="text-sm text-green-700 mb-2">{professionalService.service.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-green-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {professionalService.service.duration_minutes} minutes
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      Base: ${professionalService.service.price}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedService(professionalService)
                      setIsEditDialogOpen(true)
                    }}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit Price
                  </Button>
                  <Switch
                    checked={professionalService.is_offered}
                    onCheckedChange={() =>
                      handleToggleService(professionalService.service_id, professionalService.is_offered)
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          {offeredServices.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No services offered yet. Add your first service to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Services to Add */}
      {unOfferedServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Services</CardTitle>
            <CardDescription>Services you can add to your offerings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {unOfferedServices.map((service) => (
                <div key={service.id} className="p-4 border rounded-lg flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h4 className="font-semibold text-green-900">{service.name}</h4>
                      <Badge variant="secondary">Available</Badge>
                      <span className="text-sm font-medium text-green-600">${service.price}</span>
                    </div>
                    {service.description && <p className="text-sm text-green-700 mb-2">{service.description}</p>}
                    <div className="flex items-center gap-4 text-sm text-green-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {service.duration_minutes} minutes
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />${service.price}
                      </span>
                    </div>
                  </div>
                  <Button onClick={() => handleToggleService(service.id, false)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Service
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Service Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service Price</DialogTitle>
            <DialogDescription>Set a custom price for this service or use the default price</DialogDescription>
          </DialogHeader>
          {selectedService && (
            <EditServiceForm
              professionalService={selectedService}
              onSave={(customPrice) => handleUpdateService(selectedService.id!, customPrice)}
              onCancel={() => {
                setIsEditDialogOpen(false)
                setSelectedService(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface EditServiceFormProps {
  professionalService: ProfessionalService
  onSave: (customPrice: number | null) => void
  onCancel: () => void
}

function EditServiceForm({ professionalService, onSave, onCancel }: EditServiceFormProps) {
  const [useCustomPrice, setUseCustomPrice] = useState(!!professionalService.custom_price)
  const [customPrice, setCustomPrice] = useState(professionalService.custom_price || professionalService.service.price)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(useCustomPrice ? customPrice : null)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold">{professionalService.service.name}</h4>
          <p className="text-sm text-muted-foreground">Default price: ${professionalService.service.price}</p>
        </div>

        <div className="flex items-center space-x-2">
          <Switch checked={useCustomPrice} onCheckedChange={setUseCustomPrice} />
          <Label>Use custom price</Label>
        </div>

        {useCustomPrice && (
          <div className="grid gap-2">
            <Label htmlFor="customPrice">Custom Price ($)</Label>
            <Input
              id="customPrice"
              type="number"
              min="0"
              step="0.01"
              value={customPrice}
              onChange={(e) => setCustomPrice(Number.parseFloat(e.target.value))}
              required
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save Price</Button>
      </div>
    </form>
  )
}
