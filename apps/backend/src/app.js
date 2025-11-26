import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import ejs from "ejs"

// Import MySQL connector instead of MongoDB
import mysqlConnector from "./dbConnector/mysqlConnector.js";

// Import new MySQL routes
import authRoutes from "./routes/authRoutes.js";
import tenantAuthRoutes from "./routes/tenantAuthRoutes.js";
import userAuthRoutes from "./routes/userAuthRoutes.js";
import userManagementRoutes from "./routes/userManagementRoutes.js";
import userCompanyRoutes from "./routes/userCompanyRoutes.js";
import roleManagementRoutes from "./routes/roleManagementRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import { requestIdMiddleware } from "./middleWare/auditMiddleware.js";

import tenantRoutes from "./routes/tenantRoutes.js";
import buyerRoutes from "./routes/buyerRoutes.js";
import invoiceRoutes, { publicInvoiceRoutes } from "./routes/invoiceRoutes.js";
import invoiceBackupRoutes from "./routes/invoiceBackupRoutes.js";
import hsCodeRoutes from "./routes/hsCodeRoutes.js";
import performanceRoutes from "./routes/performanceRoutes.js";

dotenv.config();

const RAJBY_USERNAME = process.env.RAJBY_USERNAME || "innovative";
const RAJBY_PASSWORD = process.env.RAJBY_PASSWORD || "K7#mP!vL9qW2xR$8";
const RAJBY_API_KEY = process.env.RAJBY_API_KEY || "";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure EJS as view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Add request ID middleware for audit tracking
app.use(requestIdMiddleware);
app.use(
  helmet({
    // contentSecurityPolicy:{
    //   directives: {
    //     defaultSrc: ["'self'"],
    //     connectSrc: [
    //       "'self'",
    //       "https://gw.fbr.gov.pk",
    //       "http://157.245.150.54:5155",
    //       "http://103.104.84.43:5000",
    //       "https://103.104.84.43:5000",
    //     ],
    //     scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    //     styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    //     imgSrc: ["'self'", "data:", "https:"],
    //     fontSrc: ["'self'", "https:"],
    //   },
    // },
    contentSecurityPolicy: false,

  })
);
app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://157.245.150.54:5155",
      "http://157.245.150.54:5155",
      "https://fbrtestcase.inplsoftwares.online",
      "http://103.104.84.43:5000",
      "https://103.104.84.43:5000",
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
app.use("/api/user-auth", userAuthRoutes);
app.use("/api/user-management", userManagementRoutes);
app.use("/api/role-management", roleManagementRoutes);
app.use("/api/user", userCompanyRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/admin", tenantRoutes);
app.use("/api/tenant/:tenantId", buyerRoutes);
app.use("/api/tenant/:tenantId", invoiceRoutes);
app.use("/api/tenant/:tenantId", invoiceBackupRoutes);

// Performance monitoring routes
app.use("/api/tenant/:tenantId/performance", performanceRoutes);

// HS Code Routes (with caching)
app.use("/api", hsCodeRoutes);

// Public Invoice Routes
app.use("/api", publicInvoiceRoutes);

// Lightweight proxy to bypass browser CORS for buyer registration check
app.post("/api/buyer-check", async (req, res) => {
  try {
    const { registrationNo } = req.body || {};
    if (!registrationNo) {
      return res.status(400).json({ error: "registrationNo is required" });
    }

    const axios = (await import("axios")).default;
    const upstream = await axios.post(
      "https://buyercheckapi.inplsoftwares.online/checkbuyer.php",
      {
        token: "89983e4a-c009-3f9b-bcd6-a605c3086709",
        registrationNo,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );

    return res.status(200).json(upstream.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: "Upstream request failed" };
    console.error("/api/buyer-check proxy error:", status, data);
    return res.status(status).json({ error: data?.error || "Proxy error" });
  }
});

// Proxy endpoint for external Rajby login API to bypass CORS
app.post("/api/rajby-login", async (req, res) => {
  try {
    const axios = (await import("axios")).default;
    if (!RAJBY_API_KEY) {
      console.warn(
        "RAJBY_API_KEY not configured; external Rajby login may fail authentication."
      );
    }
    const upstream = await axios.post(
      "http://103.104.84.43:5000/api/Auth/login",
      {
        userName: RAJBY_USERNAME,
        password: RAJBY_PASSWORD,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "text/plain",
          Authorization: RAJBY_API_KEY,
        },
        timeout: 30000,
      }
    );

    return res.status(200).json(upstream.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: "External API request failed" };
    console.error("/api/rajby-login proxy error:", status, data);
    return res.status(status).json({ error: data?.error || "Proxy error" });
  }
});

// Proxy endpoint for external Rajby buyers API
app.get("/api/rajby-buyers", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "") || authHeader?.replace("bearer ", "");
    
    if (!token) {
      console.error("/api/rajby-buyers: No token provided. Headers:", req.headers);
      return res.status(401).json({ error: "Rajby token is required" });
    }

    console.log("/api/rajby-buyers: Token received, length:", token.length);
    console.log("/api/rajby-buyers: Token preview:", token.substring(0, 50) + "..." + token.substring(token.length - 20));

    const axios = (await import("axios")).default;
    const upstream = await axios.get(
      "http://103.104.84.43:5000/api/Buyer/local-invoice-buyers",
      {
        headers: {
          Accept: "text/plain",
          Authorization: `Bearer ${token.trim()}`,
        },
        timeout: 10000,
      }
    );

    return res.status(200).json(upstream.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: "External API request failed" };
    const responseHeaders = err?.response?.headers || {};
    
    console.error("/api/rajby-buyers proxy error:", {
      status,
      data,
      message: err.message,
      responseStatus: err?.response?.status,
      responseData: err?.response?.data,
      responseHeaders: responseHeaders,
      requestUrl: err?.config?.url,
      requestHeaders: err?.config?.headers,
    });
    
    // If 401, provide more helpful error message
    if (status === 401) {
      return res.status(401).json({ 
        error: "Authentication failed. The Rajby token may be expired. Please login again to refresh the token.",
        details: "The external API rejected the token. This usually means the token has expired."
      });
    }
    
    return res.status(status).json({ error: data?.error || data?.message || "Proxy error" });
  }
});

// Proxy endpoint for external Rajby products API
app.get("/api/rajby-products", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "") || authHeader?.replace("bearer ", "");
    
    if (!token) {
      console.error("/api/rajby-products: No token provided. Headers:", req.headers);
      return res.status(401).json({ error: "Rajby token is required" });
    }

    console.log("/api/rajby-products: Token received, length:", token.length);
    console.log("/api/rajby-products: Token preview:", token.substring(0, 50) + "..." + token.substring(token.length - 20));

    const axios = (await import("axios")).default;
    const upstream = await axios.get(
      "http://103.104.84.43:5000/api/Item/all",
      {
        headers: {
          Accept: "text/plain",
          Authorization: `Bearer ${token.trim()}`,
        },
        timeout: 10000,
      }
    );

    return res.status(200).json(upstream.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: "External API request failed" };
    const responseHeaders = err?.response?.headers || {};
    
    console.error("/api/rajby-products proxy error:", {
      status,
      data,
      message: err.message,
      responseStatus: err?.response?.status,
      responseData: err?.response?.data,
      responseHeaders: responseHeaders,
      requestUrl: err?.config?.url,
      requestHeaders: err?.config?.headers,
    });
    
    // If 401, provide more helpful error message
    if (status === 401) {
      return res.status(401).json({ 
        error: "Authentication failed. The Rajby token may be expired. Please login again to refresh the token.",
        details: "The external API rejected the token. This usually means the token has expired."
      });
    }
    
    return res.status(status).json({ error: data?.error || data?.message || "Proxy error" });
  }
});

// Serve static files from frontend build with proper MIME types
app.use(express.static(path.join(__dirname, "dist"), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    }
  }
}));

// Catch-all route for SPA - must be last (exclude API routes and static assets)
app.get("*", (req, res) => {
  // Skip API routes and static assets
  if (req.path.startsWith("/api/") || 
      req.path.startsWith("/assets/") || 
      req.path.includes(".")) {
    return res.status(404).json({ error: "Not found" });
  }
  
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
