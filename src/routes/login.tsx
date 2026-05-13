import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/login')({
  component: LoginRedirect,
})

function LoginRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate({ to: '/signin', replace: true })
  }, [navigate])
  return null
}
