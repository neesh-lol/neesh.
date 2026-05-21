import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronRight,
  ImagePlus,
  Loader2,
  Sparkles,
  User,
  Users,
} from 'lucide-react'

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
})

type InterestRoom = {
  id: string
  name: string
  slug: string
  description: string | null
}

type ProfileRow = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  interests: string[] | null
  onboarding_completed: boolean | null
}

function cleanUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace('@', '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20)
}

function OnboardingPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [rooms, setRooms] = useState<InterestRoom[]>([])
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  useEffect(() => {
    if (!user) return

    async function loadData() {
      setLoading(true)
      setMessage('')

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url,interests,onboarding_completed')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Onboarding profile load error:', profileError)
      }

      if (profileData?.onboarding_completed) {
        navigate({ to: '/home' })
        return
      }

      if (profileData) {
        setProfile(profileData)
        setUsername(profileData.username ?? '')
        setDisplayName(profileData.display_name ?? '')
        setSelectedInterests(profileData.interests ?? [])
        setAvatarPreview(profileData.avatar_url ?? '')
      }

      const { data: roomData, error: roomError } = await supabase
        .from('interest_rooms')
        .select('*')
        .order('name', { ascending: true })

      if (roomError) {
        console.error('Interest rooms load error:', roomError)
        setMessage(roomError.message)
      }

      setRooms(roomData ?? [])
      setLoading(false)
    }

    loadData()
  }, [user, navigate])

  const selectedRooms = useMemo(() => {
    return rooms.filter((room) => selectedInterests.includes(room.name))
  }, [rooms, selectedInterests])

  const canFinish =
    cleanUsername(username).length >= 3 &&
    displayName.trim().length >= 2 &&
    selectedInterests.length >= 3

  const toggleInterest = (interestName: string) => {
    setMessage('')

    setSelectedInterests((current) => {
      if (current.includes(interestName)) {
        return current.filter((item) => item !== interestName)
      }

      return [...current, interestName]
    })
  }

  const uploadAvatar = async () => {
    if (!user || !avatarFile) return avatarPreview || null

    const lower = avatarFile.name.toLowerCase()

    if (
      !lower.endsWith('.png') &&
      !lower.endsWith('.jpg') &&
      !lower.endsWith('.jpeg') &&
      !lower.endsWith('.webp') &&
      !lower.endsWith('.gif')
    ) {
      throw new Error('Profile picture must be PNG, JPG, WEBP, or GIF.')
    }

    const ext = lower.split('.').pop() || 'png'
    const path = `${user.id}/avatar-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, avatarFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: avatarFile.type || 'image/png',
      })

    if (uploadError) {
      console.error('Avatar upload error:', uploadError)

      if (
        uploadError.message?.toLowerCase().includes('bucket') ||
        uploadError.message?.toLowerCase().includes('not found')
      ) {
        setMessage('Profile picture skipped because the avatars storage bucket does not exist yet. Setup can still continue.')
        return avatarPreview || null
      }

      setMessage('Profile picture could not upload. Setup can still continue.')
      return avatarPreview || null
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)

    return data.publicUrl
  }

  const joinSelectedRooms = async () => {
    if (!user || selectedRooms.length === 0) return

    const rows = selectedRooms.map((room) => ({
      room_id: room.id,
      user_id: user.id,
    }))

    const { error } = await supabase.from('room_members').upsert(rows, {
      onConflict: 'room_id,user_id',
    })

    if (error) {
      console.error('Join selected rooms error:', error)
    }
  }

  const finishOnboarding = async () => {
    if (!user || !canFinish) return

    setSaving(true)
    setMessage('')

    const finalUsername = cleanUsername(username)

    if (finalUsername.length < 3) {
      setMessage('Username must be at least 3 characters.')
      setSaving(false)
      return
    }

    try {
      const { data: usernameTaken, error: usernameError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', finalUsername)
        .neq('id', user.id)
        .maybeSingle()

      if (usernameError) {
        console.error('Username check error:', usernameError)
      }

      if (usernameTaken) {
        setMessage('That username is already taken.')
        setSaving(false)
        return
      }

      const avatarUrl = await uploadAvatar()

      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            username: finalUsername,
            display_name: displayName.trim(),
            avatar_url: avatarUrl,
            interests: selectedInterests,
            onboarding_completed: true,
            last_seen_at: new Date().toISOString(),
          },
          {
            onConflict: 'id',
          }
        )

      if (error) {
        console.error('Finish onboarding error:', error)
        setMessage(error.message)
        setSaving(false)
        return
      }

      await joinSelectedRooms()

      navigate({ to: '/home' })
    } catch (error: any) {
      console.error('Onboarding save error:', error)
      setMessage(error?.message ?? 'Could not finish onboarding.')
    }

    setSaving(false)
  }

  if (!ready || !user || loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-zinc-950 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs mb-4">
            <Sparkles size={14} />
            Welcome to neesh.
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight">
            Set up your profile
          </h1>

          <p className="text-sm text-zinc-500 mt-2 max-w-xl">
            Pick your username, choose at least 3 interests, add a profile picture,
            and join your first rooms.
          </p>
        </div>

        {message && (
          <div className="mb-5 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-xs text-yellow-300">
            {message}
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <User size={16} className="text-zinc-400" />
                <h2 className="text-sm font-semibold text-white">
                  Profile info
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-2">
                    Username
                  </label>
                  <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden focus-within:border-zinc-600">
                    <span className="pl-3 text-zinc-600 text-sm">@</span>
                    <input
                      value={username}
                      onChange={(e) => setUsername(cleanUsername(e.target.value))}
                      placeholder="username"
                      className="w-full bg-transparent px-1.5 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    3-20 characters. Letters, numbers, and underscores only.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 mb-2">
                    Display name
                  </label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
                    placeholder="Your display name"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 mb-2">
                    Profile picture
                  </label>

                  <label className="flex items-center gap-4 bg-zinc-950 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-zinc-700 transition-colors">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt=""
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                        <ImagePlus size={22} />
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {avatarFile ? avatarFile.name : 'Upload profile picture'}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Optional · PNG, JPG, WEBP, or GIF.
                      </p>
                    </div>

                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        setAvatarFile(file)

                        if (file) {
                          setAvatarPreview(URL.createObjectURL(file))
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-zinc-400" />
                  <h2 className="text-sm font-semibold text-white">
                    Choose at least 3 interests
                  </h2>
                </div>

                <span
                  className={`text-xs ${
                    selectedInterests.length >= 3 ? 'text-emerald-400' : 'text-zinc-500'
                  }`}
                >
                  {selectedInterests.length}/3
                </span>
              </div>

              {rooms.length === 0 ? (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-500">
                  No interest rooms found. Make sure you ran the SQL that creates
                  the interest_rooms table.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {rooms.map((room) => {
                    const selected = selectedInterests.includes(room.name)

                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => toggleInterest(room.name)}
                        className={`text-left rounded-xl border p-4 transition-colors ${
                          selected
                            ? 'bg-purple-500/10 border-purple-500/40'
                            : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <p className="text-sm font-semibold text-white">
                            {room.name}
                          </p>

                          {selected && (
                            <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                              <Check size={13} className="text-white" />
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-zinc-500 line-clamp-2">
                          {room.description ?? 'Find people with this interest.'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sticky top-5">
              <h2 className="text-sm font-semibold text-white mb-4">
                Setup checklist
              </h2>

              <div className="space-y-3 mb-5">
                <ChecklistItem
                  label="Pick a username"
                  done={cleanUsername(username).length >= 3}
                />
                <ChecklistItem
                  label="Add a display name"
                  done={displayName.trim().length >= 2}
                />
                <ChecklistItem
                  label="Choose 3 interests"
                  done={selectedInterests.length >= 3}
                />
                <ChecklistItem
                  label="Add profile picture"
                  done={!!avatarPreview}
                  optional
                />
                <ChecklistItem
                  label="Join your rooms"
                  done={selectedRooms.length > 0}
                />
              </div>

              {selectedRooms.length > 0 && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 mb-5">
                  <p className="text-xs text-zinc-500 mb-2">
                    Rooms you’ll join
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {selectedRooms.slice(0, 5).map((room) => (
                      <span
                        key={room.id}
                        className="px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400"
                      >
                        {room.name}
                      </span>
                    ))}

                    {selectedRooms.length > 5 && (
                      <span className="px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-500">
                        +{selectedRooms.length - 5}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-600 mt-2">
                    You’ll be added automatically when you finish.
                  </p>
                </div>
              )}

              <button
                onClick={finishOnboarding}
                disabled={!canFinish || saving}
                className="w-full flex items-center justify-center gap-2 bg-white text-zinc-950 rounded-xl py-3 text-sm font-bold hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Finish setup
                    <ChevronRight size={16} />
                  </>
                )}
              </button>

              <p className="text-[11px] text-zinc-600 mt-3 text-center">
                You can edit your profile later.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChecklistItem({
  label,
  done,
  optional,
}: {
  label: string
  done: boolean
  optional?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-zinc-300">
          {label}
        </p>
        {optional && (
          <p className="text-[10px] text-zinc-600">
            Optional
          </p>
        )}
      </div>

      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          done ? 'bg-emerald-500' : 'bg-zinc-800'
        }`}
      >
        {done && <Check size={13} className="text-white" />}
      </div>
    </div>
  )
}
