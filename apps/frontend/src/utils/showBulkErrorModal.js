import Swal from "sweetalert2";

const buildCellValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  return String(value);
};

const defaultBuyerColumns = [
  {
    header: "Row",
    getValue: (error, idx) => error.row ?? error.index ?? idx + 1,
  },
  {
    header: "Buyer ID",
    getValue: (error) =>
      error.buyerId || error.buyer_id || error.buyerCode || "—",
  },
  {
    header: "Buyer Name",
    getValue: (error) =>
      error.buyerName ||
      error.buyerBusinessName ||
      error.buyer_main_name ||
      "—",
  },
  {
    header: "NTN/CNIC",
    getValue: (error) =>
      error.ntn ||
      error.buyerNTNCNIC ||
      error.registrationNo ||
      error.ntnCnic ||
      "—",
  },
  {
    header: "Error",
    getValue: (error) =>
      error.error ||
      error.message ||
      (Array.isArray(error.errors) ? error.errors.join(", ") : "Unknown"),
  },
];

export const showBulkErrorModal = (
  summary,
  errors = [],
  options = {}
) => {
  if (!summary || !Array.isArray(errors) || errors.length === 0) {
    return;
  }

  const {
    title = "Upload completed with issues",
    limit = 30,
    entityLabel = "records",
    columns = defaultBuyerColumns,
  } = options;

  const displayErrors = errors.slice(0, limit);

  const headerHtml = columns
    .map((col) => `<th>${col.header}</th>`)
    .join("");

  const rowsHtml = displayErrors
    .map((error, idx) => {
      const cells = columns
        .map((col) => `<td>${buildCellValue(col.getValue(error, idx))}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `
    <style>
      .bulk-error-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .bulk-error-table th,
      .bulk-error-table td {
        border: 1px solid #e0e0e0;
        padding: 6px 8px;
        text-align: left;
      }
      .bulk-error-table th {
        background: #f5f5f5;
        font-weight: 600;
      }
      .bulk-error-table tbody tr:nth-child(even) {
        background: #fbfbfb;
      }
      .bulk-error-table-wrapper {
        max-height: 320px;
        overflow-y: auto;
        margin-top: 12px;
        border: 1px solid #f0f0f0;
      }
      .bulk-error-summary {
        margin-bottom: 8px;
        font-size: 14px;
      }
    </style>
    <div class="bulk-error-summary">
      ${summary.successful} ${entityLabel} added, ${summary.failed} failed.
    </div>
    <div class="bulk-error-table-wrapper">
      <table class="bulk-error-table">
        <thead>
          <tr>
            ${headerHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
    ${
      errors.length > limit
        ? `<p style="margin-top:8px;font-size:12px;color:#666;">…and ${
            errors.length - limit
          } more issue(s)</p>`
        : ""
    }
  `;

  Swal.fire({
    icon: "warning",
    title,
    html,
    width: "70%",
    confirmButtonText: "Close",
    customClass: {
      popup: "bulk-error-popup",
    },
  });
};

export default showBulkErrorModal;

