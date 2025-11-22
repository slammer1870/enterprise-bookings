import { AuthView } from "@daveyplate/better-auth-ui";
import { authViewPaths } from "@daveyplate/better-auth-ui/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path: [path] }));
}

export default async function AuthPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathArray } = await params;
  const path = pathArray.join('/');

  return (
    <main className="container mx-auto flex min-h-[calc(100vh-200px)] items-center justify-center p-4 md:p-6">
      <AuthView path={path} />
    </main>
  );
}

