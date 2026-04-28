import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AuctionError, AuctionService } from "./services/auctionService.js";
import { JsonFileStore } from "./storage/JsonFileStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findProjectRoot(startDir: string): string {
  const candidates = [process.cwd(), startDir];

  for (const candidate of candidates) {
    let currentDir = path.resolve(candidate);

    while (true) {
      if (existsSync(path.join(currentDir, "data", "seed.json"))) {
        return currentDir;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
  }

  throw new Error("Unable to locate project root. Run the server from the project directory.");
}

const projectRoot = findProjectRoot(__dirname);

const app = express();
const port = Number(process.env.PORT ?? 4000);
const seedPath = path.join(projectRoot, "data", "seed.json");
const statePath = path.join(projectRoot, "data", "state.json");
const service = new AuctionService(new JsonFileStore(seedPath, statePath));

app.use(cors());
app.use(express.json({ limit: "64kb" }));

const asyncRoute =
  (handler: express.RequestHandler): express.RequestHandler =>
  (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "npl-bidding-system" });
});

app.get(
  "/api/state",
  asyncRoute(async (_request, response) => {
    response.json(await service.getState());
  })
);

app.post(
  "/api/auction/start",
  asyncRoute(async (request, response) => {
    response.json(await service.startAuction(request.body));
  })
);

app.post(
  "/api/auction/bid",
  asyncRoute(async (request, response) => {
    response.status(201).json(await service.placeBid(request.body));
  })
);

app.post(
  "/api/auction/reject",
  asyncRoute(async (request, response) => {
    response.json(await service.rejectBid(request.body));
  })
);

app.post(
  "/api/auction/accept",
  asyncRoute(async (_request, response) => {
    response.json(await service.acceptBid());
  })
);

app.post(
  "/api/auction/unsold",
  asyncRoute(async (_request, response) => {
    response.json(await service.markUnsold());
  })
);

app.post(
  "/api/reset",
  asyncRoute(async (_request, response) => {
    response.json(await service.reset());
  })
);

const clientDir = path.join(projectRoot, "dist", "client");
const indexHtml = path.join(clientDir, "index.html");
if (existsSync(indexHtml)) {
  app.use(express.static(clientDir));
  app.use((request, response, next) => {
    if (request.method === "GET" && !request.path.startsWith("/api/")) {
      response.sendFile(indexHtml);
      return;
    }
    next();
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof AuctionError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Unexpected server error." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`NPL Bidding System API running on http://localhost:${port}`);
});
