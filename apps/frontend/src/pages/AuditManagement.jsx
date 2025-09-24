import React, { useState, useEffect } from "react";

const AuditManagement = () => {
  const [activeTab, setActiveTab] = useState("logs");
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSummary, setAuditSummary] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filters, setFilters] = useState({
    entityType: "",
    operation: "",
    tenantId: "",
    startDate: "",
    endDate: "",
    search: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== "")),
      });

      console.log('🔍 Frontend Debug - Fetching audit logs with params:', queryParams.toString());
      console.log('🔍 Frontend Debug - Current filters:', filters);

      const response = await fetch(`/api/audit/logs?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const result = await response.json();
      console.log('🔍 Frontend Debug - Audit logs response:', result);
      
      if (result.success) {
        setAuditLogs(result.data.logs);
        setPagination(result.data.pagination);
      } else {
        setError(result.message);
        console.error('🔍 Frontend Debug - Audit logs API error:', result.message);
      }
    } catch (err) {
      setError("Failed to fetch audit logs");
      console.error("Error fetching audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch audit summary
  const fetchAuditSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== "")),
      });

      const response = await fetch(`/api/audit/summary?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setAuditSummary(result.data.summaries);
        setPagination(result.data.pagination);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("Failed to fetch audit summary");
      console.error("Error fetching audit summary:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      console.log('🔍 Frontend Debug - Fetching statistics...');
      const response = await fetch("/api/audit/statistics", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const result = await response.json();
      console.log('🔍 Frontend Debug - Statistics response:', result);
      
      if (result.success) {
        setStatistics(result.data);
        console.log('🔍 Frontend Debug - Statistics set:', result.data);
      } else {
        console.error('🔍 Frontend Debug - Statistics API error:', result.message);
      }
    } catch (err) {
      console.error("Error fetching statistics:", err);
    }
  };

  useEffect(() => {
    // Always fetch statistics for the summary cards
    fetchStatistics();
    
    if (activeTab === "logs") {
      fetchAuditLogs();
    } else if (activeTab === "summary") {
      fetchAuditSummary();
    } else if (activeTab === "statistics") {
      fetchStatistics();
    }
  }, [activeTab, pagination.page, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const exportAuditLogs = async () => {
    try {
      const queryParams = new URLSearchParams({
        format: "csv",
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== "")),
      });

      const response = await fetch(`/api/audit/export?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error("Error exporting audit logs:", err);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getOperationColor = (operation) => {
    switch (operation) {
      case "CREATE": return "text-green-600 bg-green-100";
      case "UPDATE": return "text-blue-600 bg-blue-100";
      case "DELETE": return "text-red-600 bg-red-100";
      case "SAVE_DRAFT": return "text-yellow-600 bg-yellow-100";
      case "SAVE_AND_VALIDATE": return "text-purple-600 bg-purple-100";
      case "SUBMIT_TO_FBR": return "text-indigo-600 bg-indigo-100";
      case "BULK_CREATE": return "text-orange-600 bg-orange-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getEntityTypeColor = (entityType) => {
    switch (entityType) {
      case "invoice": return "text-purple-600 bg-purple-100";
      case "buyer": return "text-orange-600 bg-orange-100";
      case "product": return "text-indigo-600 bg-indigo-100";
      case "user": return "text-pink-600 bg-pink-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  // Show detailed audit information
  const showAuditDetails = (log) => {
    setSelectedLog(log);
    setShowDetailsModal(true);
  };

  // Close details modal
  const closeDetailsModal = () => {
    setSelectedLog(null);
    setShowDetailsModal(false);
  };

  // Helper function to render object as table
  const renderObjectAsTable = (obj, title) => {
    if (!obj) return <p className="text-sm text-gray-500">No data available</p>;
    
    const parsedObj = typeof obj === 'string' ? JSON.parse(obj) : obj;
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Field
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(parsedObj).map(([key, value]) => (
              <tr key={key}>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  {key}
                </td>
                <td className="px-4 py-2 text-sm text-gray-500">
                  {value === null 
                    ? <span className="text-gray-500 italic">null</span>
                    : typeof value === 'object' && value !== null 
                      ? JSON.stringify(value, null, 2) 
                      : String(value)
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Helper function to render changed fields as comparison table
  const renderChangedFieldsAsTable = (changedFields) => {
    if (!changedFields) return <p className="text-sm text-gray-500">No changes detected</p>;
    
    console.log('🔍 Frontend Debug - Raw changedFields:', changedFields);
    const parsedFields = typeof changedFields === 'string' ? JSON.parse(changedFields) : changedFields;
    console.log('🔍 Frontend Debug - Parsed changedFields:', parsedFields);
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Field
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Previous Value
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                New Value
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(parsedFields).map(([field, values]) => (
              <tr key={field}>
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  {field}
                </td>
                <td className="px-4 py-2 text-sm text-red-600">
                  {values.old === null 
                    ? <span className="text-gray-500 italic">null</span>
                    : typeof values.old === 'object' && values.old !== null 
                      ? JSON.stringify(values.old, null, 2) 
                      : String(values.old)
                  }
                </td>
                <td className="px-4 py-2 text-sm text-green-600">
                  {values.new === null 
                    ? <span className="text-gray-500 italic">null</span>
                    : typeof values.new === 'object' && values.new !== null 
                      ? JSON.stringify(values.new, null, 2) 
                      : String(values.new)
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Audit Management</h1>
          <p className="text-gray-600 mt-2">
            Track and monitor all system activities and changes
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Operations</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.totalOperations || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Created</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.operationsByType?.CREATE || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Updated</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.operationsByType?.UPDATE || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Deleted</p>
                <p className="text-2xl font-semibold text-gray-900">{statistics.operationsByType?.DELETE || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: "logs", name: "Audit Logs", icon: "📋" },
                { id: "summary", name: "Summary", icon: "📊" },
                { id: "statistics", name: "Statistics", icon: "📈" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Filters */}
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entity Type
                  </label>
                  <select
                    value={filters.entityType}
                    onChange={(e) => handleFilterChange("entityType", e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="invoice">Invoice</option>
                    <option value="buyer">Buyer</option>
                    <option value="product">Product</option>
                    <option value="user">User</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Operation
                  </label>
                  <select
                    value={filters.operation}
                    onChange={(e) => handleFilterChange("operation", e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Operations</option>
                    <option value="CREATE">Create</option>
                    <option value="UPDATE">Update</option>
                    <option value="DELETE">Delete</option>
                    <option value="SAVE_DRAFT">Save Draft</option>
                    <option value="SAVE_AND_VALIDATE">Save & Validate</option>
                    <option value="SUBMIT_TO_FBR">Submit to FBR</option>
                    <option value="BULK_CREATE">Bulk Create</option>
                  </select>
                </div>


                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange("startDate", e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange("endDate", e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search
                  </label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    placeholder="Search..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-between">
                <button
                  onClick={() => {
                    setFilters({
                      entityType: "",
                      operation: "",
                      tenantId: "",
                      startDate: "",
                      endDate: "",
                      search: "",
                    });
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Clear Filters
                </button>

                {activeTab === "logs" && (
                  <button
                    onClick={exportAuditLogs}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                  >
                    Export CSV
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            {loading && (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {!loading && !error && (
              <>
                {activeTab === "logs" && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Entity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Operation
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEntityTypeColor(log.entityType)}`}>
                                  {log.entityType}
                                </span>
                                <span className="ml-2 text-sm text-gray-900">#{log.entityId}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getOperationColor(log.operation)}`}>
                                {log.operation}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{log.userName || "Unknown"}</div>
                              <div className="text-sm text-gray-500">{log.userEmail || "N/A"}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(log.created_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <button
                                onClick={() => showAuditDetails(log)}
                                className="text-blue-600 hover:text-blue-900 font-medium"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === "summary" && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Entity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created By
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Modified By
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Operations
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {auditSummary.map((summary) => (
                          <tr key={summary.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEntityTypeColor(summary.entityType)}`}>
                                {summary.entityType}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{summary.entityName || "N/A"}</div>
                              <div className="text-sm text-gray-500">ID: {summary.entityId}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{summary.createdByName || "Unknown"}</div>
                              <div className="text-sm text-gray-500">{summary.createdByEmail || "N/A"}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{summary.lastModifiedByName || "Unknown"}</div>
                              <div className="text-sm text-gray-500">{summary.lastModifiedByEmail || "N/A"}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {summary.totalOperations}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {summary.isDeleted ? (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full text-red-600 bg-red-100">
                                  Deleted
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full text-green-600 bg-green-100">
                                  Active
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === "statistics" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Operations by Entity Type</h3>
                      <div className="space-y-3">
                        {Object.entries(statistics.operationsByEntity || {}).map(([entityType, count]) => (
                          <div key={entityType} className="flex justify-between items-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEntityTypeColor(entityType)}`}>
                              {entityType}
                            </span>
                            <span className="text-sm font-medium text-gray-900">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Top Users by Activity</h3>
                      <div className="space-y-3">
                        {statistics.topUsers?.slice(0, 10).map((user, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{user.userName || "Unknown"}</div>
                              <div className="text-xs text-gray-500">{user.userEmail || "N/A"}</div>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{user.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Details Modal */}
      {showDetailsModal && selectedLog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-medium text-gray-900">
                Audit Details - {selectedLog.entityType} #{selectedLog.entityId}
              </h3>
              <button
                onClick={closeDetailsModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                {/* Basic Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Operation</label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getOperationColor(selectedLog.operation)}`}>
                        {selectedLog.operation}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Entity Type</label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEntityTypeColor(selectedLog.entityType)}`}>
                        {selectedLog.entityType}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">User</label>
                      <p className="text-sm text-gray-900">{selectedLog.userName || "Unknown"}</p>
                      <p className="text-sm text-gray-500">{selectedLog.userEmail || "N/A"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Date</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedLog.created_at)}</p>
                    </div>
                    {selectedLog.entityType !== "invoice" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">IP Address</label>
                          <p className="text-sm text-gray-900">{selectedLog.ipAddress || "N/A"}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Tenant</label>
                          <p className="text-sm text-gray-900">{selectedLog.tenantName || "N/A"}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Old Values (for UPDATE/DELETE operations) */}
                {selectedLog.oldValues && (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="text-md font-semibold text-red-900 mb-3">Previous Values</h4>
                    <div className="bg-white p-3 rounded border">
                      {renderObjectAsTable(selectedLog.oldValues)}
                    </div>
                  </div>
                )}

                {/* New Values (for CREATE/UPDATE operations) */}
                {selectedLog.newValues && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="text-md font-semibold text-green-900 mb-3">New Values</h4>
                    <div className="bg-white p-3 rounded border">
                      {renderObjectAsTable(selectedLog.newValues)}
                    </div>
                  </div>
                )}

                {/* Changed Fields (for UPDATE operations) */}
                {selectedLog.changedFields && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="text-md font-semibold text-blue-900 mb-3">Changed Fields</h4>
                    <div className="bg-white p-3 rounded border">
                      {renderChangedFieldsAsTable(selectedLog.changedFields)}
                    </div>
                  </div>
                )}


            </div>

            <div className="mt-6 flex justify-end flex-shrink-0 border-t pt-4">
              <button
                onClick={closeDetailsModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditManagement;
