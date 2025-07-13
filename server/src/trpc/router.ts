import { router } from './trpc';
import { authRouter } from './routers/auth';
import { gameRouter } from './routers/game';
import { mapRouter } from './routers/map';
import { userRouter } from './routers/user';

export const appRouter = router({
  auth: authRouter,
  game: gameRouter,
  map: mapRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter; 