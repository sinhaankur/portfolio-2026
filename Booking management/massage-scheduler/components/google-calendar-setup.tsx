"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, CheckCircle, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"

export function GoogleCalendarSetup() {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if Google Calendar is connected
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      const response = await fetch("/api/auth/google/status")
      const data = await response.json()
      setIsConnected(data.connected)
    } catch (error) {
      console.error("Error checking connection:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const connectGoogleCalendar = () => {
    window.location.href = "/api/auth/google?action=login"
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
            <span>Checking Google Calendar connection...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Google Calendar Integration
        </CardTitle>
        <CardDescription>Connect your Google Calendar to automatically sync appointments</CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span>Google Calendar is connected</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              <span>Google Calendar not connected</span>
            </div>
            <Button onClick={connectGoogleCalendar} className="bg-emerald-600 hover:bg-emerald-700">
              Connect Google Calendar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
