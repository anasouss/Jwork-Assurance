import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useSession } from '../auth/session';
import { ApiError, queryString } from './transport';
import { paged } from './schemas';

export function useData<T>(path: string, schema: z.ZodType<T>, enabled = true) {
  const { get, session } = useSession();
  const result = useQuery({
    queryKey: [session?.space, session?.profile?.id ?? session?.user?.id, session?.user?.agenceId, path],
    queryFn: ({ signal }) => get(path, schema, signal), enabled: !!session && enabled,
  });
  const denied = result.error instanceof ApiError && [401, 403, 404].includes(result.error.status);
  return { ...result, data: denied ? undefined : result.data };
}
export function usePages<T extends { id: string }>(path: string, schema: z.ZodType<T>, filters: Record<string, string | undefined> = {}, enabled = true) {
  const { get, session } = useSession();
  const result = useInfiniteQuery({
    queryKey: [session?.space, session?.profile?.id ?? session?.user?.id, session?.user?.agenceId, path, filters],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => get(`${path}${queryString({ ...filters, page: pageParam, size: 25 })}`, paged(schema), signal),
    getNextPageParam: (last) => last.page.last ? undefined : last.page.number + 1,
    enabled: !!session && enabled,
  });
  const denied = result.error instanceof ApiError && [401, 403, 404].includes(result.error.status);
  const items = denied ? [] : result.data?.pages.flatMap((page) => page.items) ?? [];
  // Overlapping pages during live updates must not create duplicate native keys.
  const unique = [...new Map(items.map((item) => [item.id, item])).values()];
  return { ...result, items: unique };
}
