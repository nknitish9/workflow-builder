import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/api/_app';

export const trpc = createTRPCReact<AppRouter>();
