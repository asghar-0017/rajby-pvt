import InvoiceBackupService from "../../service/InvoiceBackupService.js";
import { logAuditEvent } from "../../middleWare/auditMiddleware.js";

/**
 * Get backup history for a specific invoice
 */
export const getInvoiceBackupHistory = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { 
      limit = 50, 
      offset = 0, 
      backupType = null 
    } = req.query;

    const backups = await InvoiceBackupService.getInvoiceBackupHistory({
      tenantModels: req.tenantModels,
      invoiceId: parseInt(invoiceId),
      limit: parseInt(limit),
      offset: parseInt(offset),
      backupType
    });

    res.status(200).json({
      success: true,
      message: "Invoice backup history retrieved successfully",
      data: {
        backups,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: backups.length
        }
      }
    });
  } catch (error) {
    console.error("Error getting invoice backup history:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving invoice backup history",
      error: error.message
    });
  }
};

/**
 * Get backup summary for a specific invoice
 */
export const getInvoiceBackupSummary = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const summary = await InvoiceBackupService.getInvoiceBackupSummary({
      tenantModels: req.tenantModels,
      invoiceId: parseInt(invoiceId)
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: "No backup summary found for this invoice"
      });
    }

    res.status(200).json({
      success: true,
      message: "Invoice backup summary retrieved successfully",
      data: summary
    });
  } catch (error) {
    console.error("Error getting invoice backup summary:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving invoice backup summary",
      error: error.message
    });
  }
};

/**
 * Get all backups for a tenant with filtering
 */
export const getAllBackups = async (req, res) => {
  try {
    const { InvoiceBackup, InvoiceBackupSummary } = req.tenantModels;
    const {
      limit = 50,
      offset = 0,
      backupType = null,
      invoiceId = null,
      startDate = null,
      endDate = null,
      userId = null
    } = req.query;

    // Build where clause
    const whereClause = {};
    
    if (backupType) {
      whereClause.backup_type = backupType;
    }
    
    if (invoiceId) {
      whereClause.original_invoice_id = parseInt(invoiceId);
    }
    
    if (userId) {
      whereClause.user_id = parseInt(userId);
    }
    
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at[req.tenantDb.Sequelize.Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.created_at[req.tenantDb.Sequelize.Op.lte] = new Date(endDate);
      }
    }

    const backups = await InvoiceBackup.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: InvoiceBackupSummary,
          as: 'InvoiceBackupSummary',
          required: false
        }
      ]
    });

    const totalCount = await InvoiceBackup.count({ where: whereClause });

    res.status(200).json({
      success: true,
      message: "Backups retrieved successfully",
      data: {
        backups,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount,
          hasMore: (parseInt(offset) + parseInt(limit)) < totalCount
        }
      }
    });
  } catch (error) {
    console.error("Error getting all backups:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving backups",
      error: error.message
    });
  }
};

/**
 * Get backup statistics for a tenant
 */
export const getBackupStatistics = async (req, res) => {
  try {
    const { InvoiceBackup, InvoiceBackupSummary } = req.tenantModels;
    const { startDate = null, endDate = null } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.created_at = {};
      if (startDate) {
        dateFilter.created_at[req.tenantDb.Sequelize.Op.gte] = new Date(startDate);
      }
      if (endDate) {
        dateFilter.created_at[req.tenantDb.Sequelize.Op.lte] = new Date(endDate);
      }
    }

    // Get statistics
    const [
      totalBackups,
      draftBackups,
      savedBackups,
      editBackups,
      postBackups,
      fbrRequestBackups,
      fbrResponseBackups,
      totalInvoicesWithBackups,
      recentBackups
    ] = await Promise.all([
      InvoiceBackup.count({ where: dateFilter }),
      InvoiceBackup.count({ where: { ...dateFilter, backup_type: 'DRAFT' } }),
      InvoiceBackup.count({ where: { ...dateFilter, backup_type: 'SAVED' } }),
      InvoiceBackup.count({ where: { ...dateFilter, backup_type: 'EDIT' } }),
      InvoiceBackup.count({ where: { ...dateFilter, backup_type: 'POST' } }),
      InvoiceBackup.count({ where: { ...dateFilter, backup_type: 'FBR_REQUEST' } }),
      InvoiceBackup.count({ where: { ...dateFilter, backup_type: 'FBR_RESPONSE' } }),
      InvoiceBackupSummary.count(),
      InvoiceBackup.findAll({
        where: dateFilter,
        order: [['created_at', 'DESC']],
        limit: 10,
        attributes: ['id', 'backup_type', 'backup_reason', 'created_at', 'user_name']
      })
    ]);

    // Get top users by backup activity
    const topUsers = await InvoiceBackup.findAll({
      where: dateFilter,
      attributes: [
        'user_id',
        'user_name',
        'user_email',
        [req.tenantDb.Sequelize.fn('COUNT', req.tenantDb.Sequelize.col('id')), 'backup_count']
      ],
      group: ['user_id', 'user_name', 'user_email'],
      order: [[req.tenantDb.Sequelize.literal('backup_count'), 'DESC']],
      limit: 10
    });

    res.status(200).json({
      success: true,
      message: "Backup statistics retrieved successfully",
      data: {
        summary: {
          totalBackups,
          totalInvoicesWithBackups,
          draftBackups,
          savedBackups,
          editBackups,
          postBackups,
          fbrRequestBackups,
          fbrResponseBackups
        },
        topUsers,
        recentBackups
      }
    });
  } catch (error) {
    console.error("Error getting backup statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving backup statistics",
      error: error.message
    });
  }
};

/**
 * Export backup data to CSV
 */
export const exportBackups = async (req, res) => {
  try {
    const { InvoiceBackup } = req.tenantModels;
    const {
      backupType = null,
      invoiceId = null,
      startDate = null,
      endDate = null,
      userId = null
    } = req.query;

    // Build where clause (same as getAllBackups)
    const whereClause = {};
    
    if (backupType) {
      whereClause.backup_type = backupType;
    }
    
    if (invoiceId) {
      whereClause.original_invoice_id = parseInt(invoiceId);
    }
    
    if (userId) {
      whereClause.user_id = parseInt(userId);
    }
    
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at[req.tenantDb.Sequelize.Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.created_at[req.tenantDb.Sequelize.Op.lte] = new Date(endDate);
      }
    }

    const backups = await InvoiceBackup.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      attributes: [
        'id',
        'original_invoice_id',
        'system_invoice_id',
        'invoice_number',
        'backup_type',
        'backup_reason',
        'status_before',
        'status_after',
        'fbr_invoice_number',
        'user_name',
        'user_email',
        'user_role',
        'created_at'
      ]
    });

    // Convert to CSV format
    const csvHeaders = [
      'ID',
      'Original Invoice ID',
      'System Invoice ID',
      'Invoice Number',
      'Backup Type',
      'Backup Reason',
      'Status Before',
      'Status After',
      'FBR Invoice Number',
      'User Name',
      'User Email',
      'User Role',
      'Created At'
    ];

    const csvRows = backups.map(backup => [
      backup.id,
      backup.original_invoice_id,
      backup.system_invoice_id,
      backup.invoice_number,
      backup.backup_type,
      backup.backup_reason,
      backup.status_before,
      backup.status_after,
      backup.fbr_invoice_number,
      backup.user_name,
      backup.user_email,
      backup.user_role,
      backup.created_at
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field || ''}"`).join(','))
      .join('\n');

    // Set response headers for CSV download
    const filename = `invoice_backups_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.status(200).send(csvContent);

    // Log audit event for export
    await logAuditEvent(
      req,
      "backup",
      null,
      "EXPORT",
      null,
      {
        exportType: "CSV",
        filename,
        recordCount: backups.length,
        filters: {
          backupType,
          invoiceId,
          startDate,
          endDate,
          userId
        }
      },
      {
        entityName: "Invoice Backups Export",
        endpoint: req.originalUrl,
        method: req.method
      }
    );

  } catch (error) {
    console.error("Error exporting backups:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting backup data",
      error: error.message
    });
  }
};
