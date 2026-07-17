import { AuthView } from '@daveyplate/better-auth-ui'
import { authViewPaths } from '@daveyplate/better-auth-ui/server'

export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params

  return (
    <div className="container flex grow flex-col items-center justify-center self-center py-4 md:py-6 min-h-screen mx-auto">
      <AuthView path={path} />
    </div>
  )
}
