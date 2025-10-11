import { createClient } from "@/lib/supabase/server"
import type { UserProfile } from "./auth"

// Server-side auth utilities that can only be used in server components, server actions, or route handlers

// Get user profile (server-side only)
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

  if (error || !data) {
    return null
  }

  return data as UserProfile
}

// Get current user from server
export async function getCurrentUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

// Get current user profile from server
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const user = await getCurrentUser()

  if (!user) {
    return null
  }

  return getUserProfile(user.id)
}
