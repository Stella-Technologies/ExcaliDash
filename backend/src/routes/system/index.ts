import express from "express";
import { registerUpdateRoutes } from "./update";

export type SystemRouteDeps = {
  asyncHandler: <T = void>(
    fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<T>
  ) => express.RequestHandler;
  getBackendVersion: () => string;
  requireAuth: express.RequestHandler;
  optionalAuth: express.RequestHandler;
};

export const registerSystemRoutes = (app: express.Express, deps: SystemRouteDeps) => {
  registerUpdateRoutes(app, deps);
};

