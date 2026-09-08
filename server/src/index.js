import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createQueries, openDb } from "./db.js";
import { createRouter } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);

const db = openDb();
const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "100kb" }));
app.use("/api", createRouter(createQueries(db)));

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  const message = status === 500 ? "Something went wrong" : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Split Fair API listening on http://localhost:${PORT}`);
});
