const awardXp = async () => {
  if (!user) return

  const { error } = await supabase.rpc('increment_user_xp', {
    user_id_input: user.id,
    xp_amount: 10,
  })

  if (error) {
    console.error('XP update error:', error)
  }
}
