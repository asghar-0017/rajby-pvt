import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import ejs from "ejs";

// Import MySQL connector instead of MongoDB
import mysqlConnector from "./dbConnector/mysqlConnector.js";

// Import new MySQL routes
import authRoutes from "./routes/authRoutes.js";
import tenantAuthRoutes from "./routes/tenantAuthRoutes.js";

import tenantRoutes from "./routes/tenantRoutes.js";
import buyerRoutes from "./routes/buyerRoutes.js";
import invoiceRoutes, { publicInvoiceRoutes } from "./routes/invoiceRoutes.js";
import hsCodeRoutes from "./routes/hsCodeRoutes.js";

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure EJS as view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "dist")));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          "https://gw.fbr.gov.pk",
          "https://aqmsburhani.inplsoftwares.online",
        ],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:"],
      },
    },
  })
);
app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "https://aqmsburhani.inplsoftwares.online",
      "https://aqmsburhani.inplsoftwares.online",
      "https://fbrtestcase.inplsoftwares.online",
      "*",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-ID"],
    credentials: true,
    maxAge: 86400, // 24 hours
  })
);

app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/invoices",
  express.static(path.join(process.cwd(), "public/invoices"))
);
// MySQL Routes
app.use("/api/auth", authRoutes);
app.use("/api/tenant-auth", tenantAuthRoutes);
app.use("/api/admin", tenantRoutes);
app.use("/api/tenant/:tenantId", buyerRoutes);
app.use("/api/tenant/:tenantId", invoiceRoutes);

// HS Code Routes (with caching)
app.use("/api", hsCodeRoutes);

// Public Invoice Routes
app.use("/api", publicInvoiceRoutes);

// Catch-all route for SPA - must be last
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

export const logger = {
  info: (msg) => console.log(`INFO: ${msg}`),
  error: (msg) => console.error(`ERROR: ${msg}`),
};

const startServer = async () => {
  try {
    // Initialize MySQL instead of MongoDB
    await mysqlConnector({}, logger);
    console.log("✅ Connected to MySQL multi-tenant database system");

    // Start the server first
    const port = process.env.PORT || 5150;
    const server = app.listen(port, () => {
      console.log("🚀 Server is running on port", port);
      console.log("📋 MySQL Multi-Tenant System Ready!");
      console.log("🔗 API Endpoints:");
    });
  } catch (error) {
    console.log("❌ Error starting server", error);
    process.exit(1);
  }
};

export default startServer;
