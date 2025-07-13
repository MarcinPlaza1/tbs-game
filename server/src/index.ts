import { createHTTPServer } from '@trpc/server/adapters/standalone';
import cors from 'cors';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { env } from './config/env';

const server = createHTTPServer({
  router: appRouter,
  createContext,
  middleware: cors({
    origin: env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
});

server.listen(env.PORT || 3000);
console.log(`🚀 Server running on port ${env.PORT || 3000}`); 