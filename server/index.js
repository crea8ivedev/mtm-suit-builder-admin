import "dotenv/config";
import express from "express";
import cors from "cors";
import supplierRoutes from "./routes/suppliers.js";
import orderRoutes from "./routes/orders.js";
import customerRoutes from "./routes/customers.js";
import authRoutes from "./routes/auth.js";
import kutetailorRoutes from "./routes/kutetailor.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.FRONTEND_URL ?? null,
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/kutetailor", kutetailorRoutes);

app.get("/health", (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() }),
);

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
}

export default app;
