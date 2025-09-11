import { createContext, useContext, useState, useEffect } from "react";
import { updateTokenManager, api } from "../API/Api";

const TenantSelectionContext = createContext();

export const TenantSelectionProvider = ({ children }) => {
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tokensLoaded, setTokensLoaded] = useState(false);

  const isProduction = () => {
    return (
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1" &&
      !window.location.hostname.includes("dev") &&
      !window.location.hostname.includes("test")
    );
  };

  const getStorageKey = (baseKey) => {
    const env = isProduction() ? "production" : "development";
    return `${baseKey}_${env}`;
  };

  useEffect(() => {
    console.log(
      "TenantSelectionProvider: tokensLoaded changed to:",
      tokensLoaded,
      "Selected tenant:",
      selectedTenant ? selectedTenant.sellerBusinessName : "None",
      "Token available:",
      selectedTenant?.sandboxProductionToken ? "Yes" : "No",
      "Environment:",
      isProduction() ? "Production" : "Development"
    );
  }, [tokensLoaded, selectedTenant]);

  const loadStoredTenant = async () => {
    const storageKey = getStorageKey("selectedTenant");
    const storedTenant =
      localStorage.getItem(storageKey) ||
      localStorage.getItem("selectedTenant");
    console.log(
      `Loading stored tenant from ${storageKey}:`,
      storedTenant ? "Found" : "Not found"
    );

    if (storedTenant) {
      try {
        const tenant = JSON.parse(storedTenant);
        console.log("Parsed tenant data:", {
          name: tenant.sellerBusinessName,
          hasToken: !!tenant.sandboxProductionToken,
          tokenLength: tenant.sandboxProductionToken?.length || 0,
        });

        // Never trust token from storage; strip it
        const {
          sandboxProductionToken,
          sandboxTestToken,
          productionToken,
          token,
          ...sanitized
        } = tenant || {};
        setSelectedTenant(sanitized);
        // Always fetch fresh token from server when a tenant is present
        await fetchTenantTokens(sanitized);
      } catch (error) {
        console.error("Error parsing stored tenant:", error);
        localStorage.removeItem(storageKey);
        setTokensLoaded(false);
      }
    } else {
      setTokensLoaded(false);
    }
  };

  const fetchTenantTokens = async (tenant) => {
    setLoading(true);
    setTokensLoaded(false);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Fetching tokens (attempt ${attempt}/3)`);

        // Determine the appropriate endpoint based on user type
        // Check if user is admin by looking at the stored user data
        const storedUser = localStorage.getItem("user");
        let isAdmin = false;

        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            isAdmin = userData.role === "admin";
          } catch (error) {
            console.error("Error parsing user data:", error);
          }
        }

        // Use appropriate endpoint based on user type
        const endpoint = isAdmin
          ? `/admin/tenants/${tenant.tenant_id}`
          : `/user/tenants/${tenant.tenant_id}`;

        const response = await api.get(endpoint);

        if (
          response.data.success &&
          response.data.data.sandboxProductionToken
        ) {
          const tenantWithTokens = response.data.data;
          // Keep tokens in memory only; persist sanitized tenant for id/name reuse
          const {
            sandboxProductionToken,
            sandboxTestToken,
            productionToken,
            token,
            ...sanitized
          } = tenantWithTokens;
          setSelectedTenant({
            ...sanitized,
            sandboxProductionToken,
            sandboxTestToken,
          });
          localStorage.setItem(
            getStorageKey("selectedTenant"),
            JSON.stringify(sanitized)
          );
          // Also store a legacy key for interceptor compatibility
          localStorage.setItem("selectedTenant", JSON.stringify(sanitized));
          setTokensLoaded(true);
          console.log(
            "Successfully fetched tokens:",
            tenantWithTokens.sellerBusinessName
          );
          return true;
        } else {
          console.log(
            `Server response indicates failure on attempt ${attempt}`
          );
        }
      } catch (error) {
        console.error(`Error fetching tokens (attempt ${attempt}/3):`, error);
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    console.error("All attempts to fetch tokens failed");
    setTokensLoaded(false);
    return false;
  };

  useEffect(() => {
    loadStoredTenant();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      const storageKey = getStorageKey("selectedTenant");
      const {
        sandboxProductionToken,
        sandboxTestToken,
        productionToken,
        token,
        ...sanitized
      } = selectedTenant || {};
      localStorage.setItem(storageKey, JSON.stringify(sanitized));
      // Maintain legacy key without token for consumers like interceptors
      localStorage.setItem("selectedTenant", JSON.stringify(sanitized));
    } else {
      localStorage.removeItem(getStorageKey("selectedTenant"));
      localStorage.removeItem("selectedTenant");
    }
  }, [selectedTenant]);

  const getSandboxToken = () => {
    const token = selectedTenant?.sandboxProductionToken || null;
    console.log("getSandboxToken:", token ? "Token found" : "No token");
    return token;
  };

  const getProductionToken = () => {
    return getSandboxToken(); // Same token for both environments
  };

  const getCurrentToken = (environment = "sandbox") => {
    const token = getSandboxToken();
    console.log(
      `getCurrentToken (${environment}):`,
      token ? "Token found" : "No token"
    );
    return token;
  };

  useEffect(() => {
    if (selectedTenant && tokensLoaded) {
      updateTokenManager({
        getSandboxToken,
        getProductionToken,
        getCurrentToken,
      });
    } else {
      updateTokenManager({
        getSandboxToken: () => null,
        getProductionToken: () => null,
        getCurrentToken: () => null,
      });
    }
  }, [selectedTenant, tokensLoaded]);

  const selectTenant = async (tenant) => {
    try {
      setLoading(true);
      setTokensLoaded(false);
      if (!tenant.sandboxProductionToken) {
        const success = await fetchTenantTokens(tenant);
        if (!success) {
          setSelectedTenant(tenant);
          setTokensLoaded(false);
        }
      } else {
        setSelectedTenant(tenant);
        setTokensLoaded(true);
      }
    } catch (error) {
      console.error("Error selecting tenant:", error);
      setSelectedTenant(tenant);
      setTokensLoaded(false);
    } finally {
      setLoading(false);
    }
  };

  const retryTokenFetch = async () => {
    if (!selectedTenant) {
      console.warn("No tenant selected, cannot retry token fetch");
      return false;
    }
    return await fetchTenantTokens(selectedTenant);
  };

  const validateAndRefreshToken = async () => {
    if (!selectedTenant) {
      console.warn("No tenant selected, cannot validate token");
      return false;
    }
    if (selectedTenant.sandboxProductionToken) {
      console.log("Token exists, assuming valid");
      setTokensLoaded(true);
      return true;
    }
    return await retryTokenFetch();
  };

  const clearSelectedTenant = () => {
    setSelectedTenant(null);
    setTokensLoaded(false);
    localStorage.removeItem(getStorageKey("selectedTenant"));
    localStorage.removeItem("selectedTenant");
  };

  const isTenantSelected = () => {
    return selectedTenant !== null;
  };

  const getSelectedTenantId = () => {
    return selectedTenant?.tenant_id;
  };

  const getSelectedTenantName = () => {
    return selectedTenant?.sellerBusinessName;
  };

  return (
    <TenantSelectionContext.Provider
      value={{
        selectedTenant,
        selectTenant,
        clearSelectedTenant,
        isTenantSelected,
        getSelectedTenantId,
        getSelectedTenantName,
        getSandboxToken,
        getProductionToken,
        getCurrentToken,
        loading,
        setLoading,
        tokensLoaded,
        retryTokenFetch,
        validateAndRefreshToken,
      }}
    >
      {children}
    </TenantSelectionContext.Provider>
  );
};

export const useTenantSelection = () => {
  const context = useContext(TenantSelectionContext);
  if (!context) {
    throw new Error(
      "useTenantSelection must be used within a TenantSelectionProvider"
    );
  }
  return context;
};
