import React, { useState, useEffect } from 'react';
import { api } from '../API/Api';

const PerformanceDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/performance/metrics');
      if (response.data.success) {
        setMetrics(response.data.data);
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading metrics</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">No metrics available</h3>
            <p className="text-sm text-yellow-700 mt-1">Performance metrics will appear here after the first upload.</p>
          </div>
        </div>
      </div>
    );
  }

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceColor = (ms) => {
    if (ms < 100) return 'text-green-600';
    if (ms < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceLabel = (ms) => {
    if (ms < 100) return '🚀 Ultra-Fast';
    if (ms < 500) return '⚡ Fast';
    if (ms < 1000) return '🐌 Slow';
    return '🐌 Very Slow';
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">🚀 Performance Dashboard</h2>
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Overall Performance */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Overall Performance</p>
              <p className="text-2xl font-bold text-blue-900">
                {getPerformanceLabel(metrics.overall?.averageTime || 0)}
              </p>
            </div>
            <div className="text-3xl">⚡</div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-blue-700">
              Avg: {formatTime(metrics.overall?.averageTime || 0)}
            </p>
            <p className="text-sm text-blue-700">
              Best: {formatTime(metrics.overall?.bestTime || 0)}
            </p>
          </div>
        </div>

        {/* Upload Speed */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Upload Speed</p>
              <p className="text-2xl font-bold text-green-900">
                {metrics.overall?.invoicesPerSecond?.toFixed(2) || 0}
              </p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-green-700">invoices/second</p>
            <p className="text-sm text-green-700">
              Total: {metrics.overall?.totalUploads || 0} uploads
            </p>
          </div>
        </div>

        {/* Database Performance */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Database</p>
              <p className="text-2xl font-bold text-purple-900">
                {formatTime(metrics.database?.averageQueryTime || 0)}
              </p>
            </div>
            <div className="text-3xl">🗄️</div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-purple-700">Avg query time</p>
            <p className="text-sm text-purple-700">
              Queries: {metrics.database?.totalQueries || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Uploads */}
      {metrics.recentUploads && metrics.recentUploads.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Uploads</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="space-y-3">
              {metrics.recentUploads.slice(0, 5).map((upload, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">
                      {upload.invoicesCount > 100 ? '🚀' : upload.invoicesCount > 50 ? '⚡' : '📄'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {upload.invoicesCount} invoices
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(upload.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${getPerformanceColor(upload.uploadTime)}`}>
                      {formatTime(upload.uploadTime)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {getPerformanceLabel(upload.uploadTime)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Performance Tips */}
      <div className="mt-8 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-3">💡 Performance Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700">
          <div>
            <p className="font-medium">🚀 For Ultra-Fast Uploads:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Use the Excel template format</li>
              <li>No file size limits - upload unlimited invoices!</li>
              <li>Upload during off-peak hours for best performance</li>
            </ul>
          </div>
          <div>
            <p className="font-medium">⚡ Current Status:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Database: {metrics.database?.status || 'Unknown'}</li>
              <li>Indexes: {metrics.database?.indexesOptimized ? '✅ Optimized' : '⚠️ Needs optimization'}</li>
              <li>Connection Pool: {metrics.database?.connectionPool || 'Unknown'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
