import type { AuthUser } from '@voklance/shared';

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthUser;
    validatedQuery?: unknown;
    validatedParams?: unknown;
  }
}
