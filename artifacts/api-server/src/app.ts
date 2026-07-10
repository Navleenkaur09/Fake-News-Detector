import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve frontend static files
const clientPath = path.resolve(import.meta.dirname, "../../fake-news-detector/dist/public");
app.use(express.static(clientPath));

// Fallback all non-API routes to index.html for React Router
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
  } else {
    res.sendFile(path.join(clientPath, "index.html"));
  }
});

export default app;
