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
import { Clock, Edit, Save } from "lucide-react"

interface Schedule {
  id?: string
  professional_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export function ScheduleManager() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [professionalId, setProfessionalId] = useState<string>("")

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      setProfessionalId(user.id)

      const { data, error } = await supabase
        .from("professional_schedules")
        .select("*")
        .eq("professional_id", user.id)
        .order("day_of_week")

      if (error) throw error

      // Create default schedule for all days if none exist
      const existingDays = data?.map((s) => s.day_of_week) || []
      const defaultSchedules: Schedule[] = []

      for (let day = 0; day < 7; day++) {
        const existing = data?.find((s) => s.day_of_week === day)
        if (existing) {
          defaultSchedules.push(existing)
        } else {
          defaultSchedules.push({
            professional_id: user.id,
            day_of_week: day,
            start_time: "09:00",
            end_time: "17:00",
            is_available: day >= 1 && day <= 5, // Monday to Friday by default
          })
        }
      }

      setSchedules(defaultSchedules)
    } catch (error) {
      console.error("Error loading schedules:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleAvailability = async (dayOfWeek: number, currentAvailability: boolean) => {
    try {
      const supabase = createClient()
      const schedule = schedules.find((s) => s.day_of_week === dayOfWeek)

      if (schedule?.id) {
        // Update existing schedule
        const { error } = await supabase
          .from("professional_schedules")
          .update({ is_available: !currentAvailability })
          .eq("id", schedule.id)

        if (error) throw error
      } else {
        // Create new schedule
        const { data, error } = await supabase
          .from("professional_schedules")
          .insert([
            {
              professional_id: professionalId,
              day_of_week: dayOfWeek,
              start_time: schedule?.start_time || "09:00",
              end_time: schedule?.end_time || "17:00",
              is_available: !currentAvailability,
            },
          ])
          .select()
          .single()

        if (error) throw error

        // Update local state with new ID
        setSchedules((prev) =>
          prev.map((s) =>
            s.day_of_week === dayOfWeek ? { ...s, id: data.id, is_available: !currentAvailability } : s,
          ),
        )
        return
      }

      setSchedules((prev) =>
        prev.map((s) => (s.day_of_week === dayOfWeek ? { ...s, is_available: !currentAvailability } : s)),
      )
    } catch (error) {
      console.error("Error updating availability:", error)
      alert("Failed to update availability")
    }
  }

  const handleUpdateSchedule = async (dayOfWeek: number, startTime: string, endTime: string) => {
    try {
      const supabase = createClient()
      const schedule = schedules.find((s) => s.day_of_week === dayOfWeek)

      if (schedule?.id) {
        // Update existing schedule
        const { error } = await supabase
          .from("professional_schedules")
          .update({ start_time: startTime, end_time: endTime })
          .eq("id", schedule.id)

        if (error) throw error
      } else {
        // Create new schedule
        const { data, error } = await supabase
          .from("professional_schedules")
          .insert([
            {
              professional_id: professionalId,
              day_of_week: dayOfWeek,
              start_time: startTime,
              end_time: endTime,
              is_available: schedule?.is_available || false,
            },
          ])
          .select()
          .single()

        if (error) throw error

        // Update local state with new ID
        setSchedules((prev) =>
          prev.map((s) =>
            s.day_of_week === dayOfWeek ? { ...s, id: data.id, start_time: startTime, end_time: endTime } : s,
          ),
        )
        setIsEditDialogOpen(false)
        setEditingDay(null)
        return
      }

      setSchedules((prev) =>
        prev.map((s) => (s.day_of_week === dayOfWeek ? { ...s, start_time: startTime, end_time: endTime } : s)),
      )
      setIsEditDialogOpen(false)
      setEditingDay(null)
    } catch (error) {
      console.error("Error updating schedule:", error)
      alert("Failed to update schedule")
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-green-600">Loading your schedule...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Weekly Schedule
          </CardTitle>
          <CardDescription>Set your availability for each day of the week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {schedules.map((schedule) => (
              <div key={schedule.day_of_week} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-24">
                    <h4 className="font-semibold text-green-900">{DAYS_OF_WEEK[schedule.day_of_week]}</h4>
                  </div>
                  <Badge variant={schedule.is_available ? "default" : "secondary"}>
                    {schedule.is_available ? "Available" : "Unavailable"}
                  </Badge>
                  {schedule.is_available && (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Clock className="w-4 h-4" />
                      {schedule.start_time} - {schedule.end_time}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {schedule.is_available && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingDay(schedule.day_of_week)
                        setIsEditDialogOpen(true)
                      }}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit Hours
                    </Button>
                  )}
                  <Switch
                    checked={schedule.is_available}
                    onCheckedChange={() => handleToggleAvailability(schedule.day_of_week, schedule.is_available)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Schedule Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingDay !== null ? DAYS_OF_WEEK[editingDay] : ""} Hours</DialogTitle>
            <DialogDescription>Set your working hours for this day</DialogDescription>
          </DialogHeader>
          {editingDay !== null && (
            <EditScheduleForm
              schedule={schedules.find((s) => s.day_of_week === editingDay)!}
              onSave={(startTime, endTime) => handleUpdateSchedule(editingDay, startTime, endTime)}
              onCancel={() => {
                setIsEditDialogOpen(false)
                setEditingDay(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface EditScheduleFormProps {
  schedule: Schedule
  onSave: (startTime: string, endTime: string) => void
  onCancel: () => void
}

function EditScheduleForm({ schedule, onSave, onCancel }: EditScheduleFormProps) {
  const [startTime, setStartTime] = useState(schedule.start_time)
  const [endTime, setEndTime] = useState(schedule.end_time)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (startTime >= endTime) {
      alert("End time must be after start time")
      return
    }
    onSave(startTime, endTime)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="startTime">Start Time</Label>
          <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="endTime">End Time</Label>
          <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          <Save className="w-4 h-4 mr-2" />
          Save Hours
        </Button>
      </div>
    </form>
  )
}
