import { createClient } from "@/lib/supabase/client"

export type UserRole = "admin" | "professional" | "customer"

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  avatar_url: string | null
  is_active: boolean
}

// Generate random 6-digit code
export function generateTwoFactorCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Send 2FA code via email
export async function sendTwoFactorCode(email: string, code: string, type: "login" | "signup" = "login") {
  const response = await fetch("/api/auth/send-2fa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, type }),
  })

  if (!response.ok) {
    throw new Error("Failed to send 2FA code")
  }
}

// Verify 2FA code
export async function verifyTwoFactorCode(userId: string, code: string, type = "login_2fa") {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("two_factor_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("token", code)
    .eq("token_type", type)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .single()

  if (error || !data) {
    return { success: false, error: "Invalid or expired code" }
  }

  // Mark token as used
  await supabase.from("two_factor_tokens").update({ used_at: new Date().toISOString() }).eq("id", data.id)

  return { success: true }
}

// Store 2FA token in database
export async function storeTwoFactorToken(userId: string, token: string, type = "login_2fa") {
  const supabase = createClient()

  // Delete any existing unused tokens for this user and type
  await supabase.from("two_factor_tokens").delete().eq("user_id", userId).eq("token_type", type).is("used_at", null)

  // Create new token (expires in 10 minutes)
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + 10)

  const { error } = await supabase.from("two_factor_tokens").insert({
    user_id: userId,
    token,
    token_type: type,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    throw new Error("Failed to store 2FA token")
  }
}
