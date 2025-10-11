"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, ExternalLink } from "lucide-react"

export function SlackSetup() {
  const [webhookUrl, setWebhookUrl] = useState("")
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")

  const handleSaveWebhook = async () => {
    try {
      const response = await fetch("/api/slack/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      })

      if (response.ok) {
        setConnectionStatus("success")
        setStatusMessage("Slack webhook URL saved successfully!")
      } else {
        throw new Error("Failed to save webhook URL")
      }
    } catch (error) {
      setConnectionStatus("error")
      setStatusMessage("Failed to save webhook URL. Please try again.")
    }
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    try {
      const response = await fetch("/api/slack/test", {
        method: "POST",
      })

      if (response.ok) {
        setConnectionStatus("success")
        setStatusMessage("Test message sent successfully! Check your Slack channel.")
      } else {
        throw new Error("Failed to send test message")
      }
    } catch (error) {
      setConnectionStatus("error")
      setStatusMessage("Failed to send test message. Please check your webhook URL.")
    } finally {
      setIsTestingConnection(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 5.042 10.12h2.52v2.522a2.528 2.528 0 0 1-2.52 2.523Zm0-6.330a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 5.042 3.79a2.528 2.528 0 0 1 2.52 2.522 2.528 2.528 0 0 1-2.52 2.523Zm6.33 0a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 11.372 3.79a2.528 2.528 0 0 1 2.52 2.522 2.528 2.528 0 0 1-2.52 2.523Zm0 2.523h2.52a2.528 2.528 0 0 1 2.52 2.522 2.528 2.528 0 0 1-2.52 2.523h-2.52v-2.523a2.528 2.528 0 0 1 0-2.522Zm6.33-2.523a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 17.702 3.79a2.528 2.528 0 0 1 2.52 2.522 2.528 2.528 0 0 1-2.52 2.523Zm0 6.33a2.528 2.528 0 0 1-2.52-2.523v-2.522h2.52a2.528 2.528 0 0 1 2.52 2.522 2.528 2.528 0 0 1-2.52 2.523Z" />
            </svg>
            Slack Integration
          </CardTitle>
          <CardDescription>Get instant notifications in Slack when new appointments are booked</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Slack Webhook URL</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Create a webhook URL in your Slack workspace to receive notifications
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveWebhook} disabled={!webhookUrl}>
              Save Webhook URL
            </Button>
            <Button variant="outline" onClick={handleTestConnection} disabled={isTestingConnection || !webhookUrl}>
              {isTestingConnection ? "Testing..." : "Test Connection"}
            </Button>
          </div>

          {connectionStatus !== "idle" && (
            <Alert
              className={connectionStatus === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}
            >
              {connectionStatus === "success" ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={connectionStatus === "success" ? "text-green-800" : "text-red-800"}>
                {statusMessage}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Create a Slack App</h4>
            <p className="text-sm text-muted-foreground">
              Go to{" "}
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline inline-flex items-center gap-1"
              >
                api.slack.com/apps <ExternalLink className="w-3 h-3" />
              </a>{" "}
              and create a new app for your workspace.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">2. Enable Incoming Webhooks</h4>
            <p className="text-sm text-muted-foreground">
              In your app settings, go to "Incoming Webhooks" and activate them.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">3. Create a Webhook URL</h4>
            <p className="text-sm text-muted-foreground">
              Click "Add New Webhook to Workspace" and select the channel where you want to receive notifications.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">4. Copy and Paste</h4>
            <p className="text-sm text-muted-foreground">
              Copy the webhook URL and paste it in the field above, then save and test the connection.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
