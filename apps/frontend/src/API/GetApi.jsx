import axios from "axios";
import { API_CONFIG } from "./Api";
import Swal from "sweetalert2";

// Don't destructure sandBoxTestToken at import time, use it dynamically
const { apiKey } = API_CONFIG;

export const postData = async (endpoint, data, environment = "sandbox") => {
  // Get current token dynamically from context
  let token = API_CONFIG.getCurrentToken(environment);

  if (!token) {
    const error = new Error(
      `No ${environment} token found for the selected Company. Please select a Company to load credentials.`
    );
    console.error("Token not available for API call:", error.message);
    throw error;
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  try {
    const res = await axios.post(
      `https://gw.fbr.gov.pk/${endpoint}`,
      data,
      config
    );
    console.log("Actual Response:", res);
    console.log("Request Data:", JSON.stringify(data, null, 2));
    console.log("Response Status:", res.status);
    console.log("Response Data:", JSON.stringify(res.data, null, 2));

    // Log the response for debugging
    console.log("FBR API Response Structure:", {
      hasValidationResponse: !!res.data.validationResponse,
      hasInvoiceNumber: !!res.data.invoiceNumber,
      hasSuccess: !!res.data.success,
      responseKeys: Object.keys(res.data || {}),
    });

    // Don't throw error for missing validationResponse - handle it gracefully
    if (!res.data.validationResponse) {
      console.warn(
        "FBR response missing validationResponse field, but continuing with response"
      );
    }
    return res;
  } catch (error) {
    console.error("FBR API Error:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data, // Log full error response
      config: {
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout,
      },
    });

    // Enhanced error logging for debugging
    if (error.response?.data) {
      console.error("FBR Error Response Details:", {
        validationResponse: error.response.data.validationResponse,
        invoiceStatuses: error.response.data.invoiceStatuses,
        error: error.response.data.error,
        message: error.response.data.message,
        statusCode: error.response.data.statusCode,
      });
    }

    if (error.response?.status === 401) {
      Swal.fire({
        icon: "error",
        title: "Unauthorized",
        text: `Authentication failed for ${environment} environment. Please check your token or contact FBR support.`,
        confirmButtonColor: "#d33",
      });
    }
    throw error;
  }
};

export const fetchData = async (endpoint, environment = "sandbox") => {
  // Get current token dynamically from context
  let token = API_CONFIG.getCurrentToken(environment);

  if (!token) {
    const error = new Error(
      `No ${environment} token found for the selected Company. Please select a Company to load credentials.`
    );
    console.error("Token not available for API call:", error.message);
    throw error;
  }

  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  try {
    const res = await axios.get(`https://gw.fbr.gov.pk/${endpoint}`, config);
    return res.data;
  } catch (error) {
    // Only log critical errors, not expected 500 errors from FBR API
    if (error.response?.status !== 500) {
      console.error(`fetchData error for ${endpoint}:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
    }
    throw error;
  }
};
