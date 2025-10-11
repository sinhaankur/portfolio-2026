"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Edit, Trash2, MoreHorizontal, Clock, DollarSign } from "lucide-react"

interface Service {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  is_active: boolean
  created_at: string
}

export function ServiceManager() {
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("services").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error("Error loading services:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddService = async (serviceData: Omit<Service, "id" | "created_at">) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("services").insert([serviceData]).select().single()

      if (error) throw error
      setServices((prev) => [data, ...prev])
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error("Error adding service:", error)
      alert("Failed to add service")
    }
  }

  const handleUpdateService = async (serviceId: string, updates: Partial<Service>) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("services").update(updates).eq("id", serviceId)

      if (error) throw error

      setServices((prev) => prev.map((service) => (service.id === serviceId ? { ...service, ...updates } : service)))
      setIsEditDialogOpen(false)
      setSelectedService(null)
    } catch (error) {
      console.error("Error updating service:", error)
      alert("Failed to update service")
    }
  }

  const handleToggleServiceStatus = async (serviceId: string, currentStatus: boolean) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("services").update({ is_active: !currentStatus }).eq("id", serviceId)

      if (error) throw error

      setServices((prev) =>
        prev.map((service) => (service.id === serviceId ? { ...service, is_active: !currentStatus } : service)),
      )
    } catch (error) {
      console.error("Error updating service status:", error)
      alert("Failed to update service status")
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-blue-600">Loading services...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service Management</CardTitle>
              <CardDescription>Manage massage services and pricing</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Service
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Service</DialogTitle>
                  <DialogDescription>Create a new massage service</DialogDescription>
                </DialogHeader>
                <ServiceForm onSave={handleAddService} onCancel={() => setIsAddDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="p-4 border rounded-lg flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h4 className="font-semibold text-blue-900">{service.name}</h4>
                    <Badge variant={service.is_active ? "default" : "secondary"}>
                      {service.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <span className="text-sm font-medium text-blue-600">${service.price}</span>
                  </div>
                  {service.description && <p className="text-sm text-blue-700 mb-2">{service.description}</p>}
                  <div className="flex items-center gap-4 text-sm text-blue-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {service.duration_minutes} minutes
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />${service.price}
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedService(service)
                        setIsEditDialogOpen(true)
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Service
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleServiceStatus(service.id, service.is_active)}>
                      {service.is_active ? (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>

          {services.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No services found. Add your first service to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Service Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>Update service information</DialogDescription>
          </DialogHeader>
          {selectedService && (
            <ServiceForm
              service={selectedService}
              onSave={(updates) => handleUpdateService(selectedService.id, updates)}
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

interface ServiceFormProps {
  service?: Service
  onSave: (serviceData: any) => void
  onCancel: () => void
}

function ServiceForm({ service, onSave, onCancel }: ServiceFormProps) {
  const [name, setName] = useState(service?.name || "")
  const [description, setDescription] = useState(service?.description || "")
  const [durationMinutes, setDurationMinutes] = useState(service?.duration_minutes || 60)
  const [price, setPrice] = useState(service?.price || 0)
  const [isActive, setIsActive] = useState(service?.is_active ?? true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name,
      description: description || null,
      duration_minutes: durationMinutes,
      price: Number.parseFloat(price.toString()),
      is_active: isActive,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Service Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            id="duration"
            type="number"
            min="15"
            step="15"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number.parseInt(e.target.value))}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="price">Price ($)</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(Number.parseFloat(e.target.value))}
            required
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="isActive">Active Service</Label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{service ? "Update Service" : "Add Service"}</Button>
      </div>
    </form>
  )
}
