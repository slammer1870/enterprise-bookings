import { trpc, HydrateClient, getQueryClient } from '@/trpc/server'

export default async function Test() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(trpc.lessons.getById.queryOptions({ id: 1 }))

  const lesson = queryClient.getQueryData(trpc.lessons.getById.queryKey({ id: 1 }))

  console.log('LESSON', lesson?.classOption.name)

  return (
    <HydrateClient>
      <div>Test</div>
    </HydrateClient>
  )
}
