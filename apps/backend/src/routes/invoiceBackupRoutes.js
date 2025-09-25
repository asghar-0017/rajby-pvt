import express from "express";
import * as invoiceBackupController from "../controller/mysql/invoiceBackupController.js";
import { identifyTenant } from "../middleWare/tenantMiddleware.js";
import { authenticateToken } from "../middleWare/authMiddleware.js";
import { requirePermission, requireAnyPermission } from "../middleWare/permissionMiddleware.js";

const router = express.Router();

// Apply middleware for all routes
router.use(authenticateToken, identifyTenant);

// Get backup history for a specific invoice
router.get(
  "/invoices/:invoiceId/backups",
  requirePermission("invoice_backup.view"),
  invoiceBackupController.getInvoiceBackupHistory
);

// Get backup summary for a specific invoice
router.get(
  "/invoices/:invoiceId/backup-summary",
  requirePermission("invoice_backup.view"),
  invoiceBackupController.getInvoiceBackupSummary
);

// Get all backups for a tenant with filtering
router.get(
  "/backups",
  requirePermission("invoice_backup.view"),
  invoiceBackupController.getAllBackups
);

// Get backup statistics for a tenant
router.get(
  "/backups/statistics",
  requirePermission("invoice_backup.view"),
  invoiceBackupController.getBackupStatistics
);

// Export backup data to CSV
router.get(
  "/backups/export",
  requirePermission("invoice_backup.export"),
  invoiceBackupController.exportBackups
);

export default router;
