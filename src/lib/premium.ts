import { supabase } from '@/lib/supabase'

export async function checkPremiumStatus(netlifyId: string): Promise<{
  isPremium: boolean
  isFounder: boolean
}> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username, is_premium, is_founder_override')
      .eq('id', netlifyId)
      .maybeSingle()

    if (error || !profile) {
      return { isPremium: false, isFounder: false }
    }

    const isFounder =
      profile.username === 'ceo' ||
      profile.is_founder_override === true

    if (isFounder) {
      return { isPremium: true, isFounder: true }
    }

    if (profile.is_premium === true) {
      return { isPremium: true, isFounder: false }
    }

    return { isPremium: false, isFounder: false }
  } catch (error) {
    console.error('Premium status check failed:', error)
    return { isPremium: false, isFounder: false }
  }
}
