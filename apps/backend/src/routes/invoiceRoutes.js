import express from "express";
import * as invoiceController from "../controller/mysql/invoiceController.js";
import { identifyTenant } from "../middleWare/tenantMiddleware.js";
import { authenticateToken } from "../middleWare/authMiddleware.js";

const router = express.Router();

// ✅ Public route — NO middleware
router.get("/print-invoice/:id", invoiceController.printInvoice);

// ✅ Apply middleware only for protected routes
router.use(authenticateToken, identifyTenant);

// ✅ Protected routes
router.post("/invoices", invoiceController.createInvoice);
router.post("/invoices/save", invoiceController.saveInvoice);
router.post(
  "/invoices/save-validate",
  invoiceController.saveAndValidateInvoice
);

// Standard routes (fallback)
router.post("/invoices/bulk", invoiceController.bulkCreateInvoices);
router.post(
  "/invoices/check-existing",
  invoiceController.checkExistingInvoices
);

router.get("/invoices", invoiceController.getAllInvoices);
router.get(
  "/invoices/number/:invoiceNumber",
  invoiceController.getInvoiceByNumber
);
router.get("/invoices/stats/summary", invoiceController.getInvoiceStats);
router.get("/dashboard/summary", invoiceController.getDashboardSummary);

// Download invoice template (tenant-specific) - MUST come before dynamic :id route
router.get(
  "/invoices/template.xlsx",
  invoiceController.downloadInvoiceTemplateExcel
);

// Place specific routes before dynamic ones to avoid shadowing
router.get("/invoices/:id", invoiceController.getInvoiceById);
router.put("/invoices/:id", invoiceController.updateInvoice);
router.delete("/invoices/:id", invoiceController.deleteInvoice);
router.post("/invoices/:id/submit", invoiceController.submitSavedInvoice);

// Get document types from FBR
router.get(
  "/tenant/:tenantId/document-types",
  authenticateToken,
  identifyTenant,
  invoiceController.getDocumentTypesController
);

// Get provinces from FBR
router.get(
  "/tenant/:tenantId/provinces",
  authenticateToken,
  identifyTenant,
  invoiceController.getProvincesController
);

// Validate invoice data with FBR
router.post(
  "/tenant/:tenantId/validate-invoice",
  authenticateToken,
  identifyTenant,
  invoiceController.validateInvoiceDataController
);

// Submit invoice data to FBR
router.post(
  "/tenant/:tenantId/submit-invoice",
  authenticateToken,
  identifyTenant,
  invoiceController.submitInvoiceDataController
);

export default router;

// 👇 Export the public route separately
export const publicInvoiceRoutes = express.Router();
publicInvoiceRoutes.get("/print-invoice/:id", invoiceController.printInvoice);
publicInvoiceRoutes.post("/bulk-print-invoices", invoiceController.bulkPrintInvoices);
