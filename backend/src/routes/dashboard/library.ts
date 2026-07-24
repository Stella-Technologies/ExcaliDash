import express from "express";
import fs from "fs";
import path from "path";
import { DashboardRouteDeps } from "./types";

const DEFAULT_LIBRARY_PATH = path.resolve(__dirname, "../../../default_library.json");

let cachedDefaultLibrary: unknown[] | null = null;

const loadDefaultLibrary = (): unknown[] => {
  if (cachedDefaultLibrary) return cachedDefaultLibrary;
  try {
    const raw = fs.readFileSync(DEFAULT_LIBRARY_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.type === "excalidrawlib" && Array.isArray(parsed.items)) {
      cachedDefaultLibrary = parsed.items;
      return cachedDefaultLibrary;
    }
    console.warn("[library] default_library.json has unexpected format");
    return [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[library] Failed to load default_library.json:", error);
    }
    return [];
  }
};

export const registerLibraryRoutes = (
  app: express.Express,
  deps: DashboardRouteDeps
) => {
  const { prisma, requireAuth, asyncHandler, parseJsonField } = deps;

  app.get("/library", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const libraryId = `user_${req.user.id}`;
    const library = await prisma.library.findUnique({ where: { id: libraryId } });
    if (!library) {
      const defaultItems = loadDefaultLibrary();
      return res.json({ items: defaultItems });
    }

    return res.json({ items: parseJsonField(library.items, []) });
  }));

  app.put("/library", requireAuth, asyncHandler(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Items must be an array" });
    }

    const libraryId = `user_${req.user.id}`;
    const library = await prisma.library.upsert({
      where: { id: libraryId },
      update: { items: JSON.stringify(items) },
      create: { id: libraryId, items: JSON.stringify(items) },
    });

    return res.json({ items: parseJsonField(library.items, []) });
  }));
};
