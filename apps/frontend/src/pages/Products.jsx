import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Container,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useTenantSelection } from "../Context/TenantSelectionProvider";
import ProductTable from "../component/ProductTable";
import ProductModal from "../component/ProductModal";
import ProductUploader from "../component/ProductUploader";
import { api, fetchRajbyProducts, performRajbyLogin } from "../API/Api";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { showBulkErrorModal } from "../utils/showBulkErrorModal";

const productErrorColumns = [
  {
    header: "Row",
    getValue: (error, idx) => error.row ?? error.index ?? idx + 1,
  },
  {
    header: "Item ID",
    getValue: (error) => error.itemId || error.itemID || error.productId || "—",
  },
  {
    header: "Item Code",
    getValue: (error) =>
      error.itemCode || error.item_code || error.productCode || "—",
  },
  {
    header: "Error",
    getValue: (error) =>
      error.error ||
      error.message ||
      (Array.isArray(error.errors) ? error.errors.join(", ") : "Unknown"),
  },
];

const Products = () => {
  const { selectedTenant } = useTenantSelection();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);

  useEffect(() => {
    if (selectedTenant) {
      fetchProducts();
    }
  }, [selectedTenant]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/tenant/${selectedTenant.tenant_id}/products`
      );
      if (response.data.success) {
        setProducts(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (productId) => {
    try {
      const confirmed = await Swal.fire({
        title: "Delete Product",
        text: "Are you sure you want to delete this product?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel",
      });

      if (confirmed.isConfirmed) {
        setLoading(true);
        const response = await api.delete(
          `/tenant/${selectedTenant.tenant_id}/products/${productId}`
        );

        if (response.data.success) {
          setProducts(products.filter((p) => p.id !== productId));
          toast.success("Product has been deleted successfully.", {
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product. Please try again.", {
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduct = async (productData) => {
    try {
      if (editingProduct) {
        // Update existing product
        const response = await api.put(
          `/tenant/${selectedTenant.tenant_id}/products/${editingProduct.id}`,
          {
            itemId: productData.itemId,
            itemCode: productData.itemCode,
            type: productData.type,
            name: productData.name,
            description: productData.description,
            hsCode: productData.hsCode,
            uom: productData.uoM,
          }
        );

        if (response.data.success) {
          setProducts(
            products.map((p) =>
              p.id === editingProduct.id ? response.data.data : p
            )
          );
          setEditingProduct(null);
          setIsProductModalOpen(false);

          toast.success("Product has been updated successfully.", {
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      } else {
        // Create new product
        const response = await api.post(
          `/tenant/${selectedTenant.tenant_id}/products`,
          {
            itemId: productData.itemId,
            itemCode: productData.itemCode,
            type: productData.type,
            name: productData.name,
            description: productData.description,
            hsCode: productData.hsCode,
            uom: productData.uoM,
          }
        );

        if (response.data.success) {
          setProducts([...products, response.data.data]);
          setIsProductModalOpen(false);

          toast.success("Product has been added successfully.", {
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      }
    } catch (error) {
      console.error("Error saving product:", error);
      
      let errorMessage = "Failed to save product. Please try again.";
      
      if (error.response) {
        const { status, data } = error.response;
        
        if (status === 400) {
          if (data.message && data.message.includes("HS Code is required")) {
            errorMessage = "HS Code is required for the product.";
          } else if (data.message && data.message.includes("name is required")) {
            errorMessage = "Product name is required.";
          } else {
            errorMessage = data.message || "Invalid data provided. Please check all fields.";
          }
        } else if (status === 409) {
          if (data.message && data.message.includes("HS Code")) {
            errorMessage = data.message;
          } else {
            errorMessage = "A product with this information already exists.";
          }
        } else if (status === 500) {
          errorMessage = "Server error occurred. Please try again later.";
        } else {
          errorMessage = data.message || "An error occurred while saving the product.";
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage, {
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  const openUploader = () => {
    setIsUploaderOpen(true);
  };

  const closeUploader = () => {
    setIsUploaderOpen(false);
  };

  const handleBulkUpload = async (productsData) => {
    try {
      setLoading(true);

      // Use the bulk endpoint for better performance and detailed results
      const response = await api.post(
        `/tenant/${selectedTenant.tenant_id}/products/bulk`,
        {
          products: productsData.map(product => ({
            itemId: product.itemId,
            itemCode: product.itemCode,
            type: product.type,
            name: product.productName || product.name,
            description: product.productDescription || product.description,
            hsCode: product.hsCode,
            uom: product.uom,
          }))
        }
      );

      if (response.data.success) {
        const { summary, createdProducts, errors, performance } = response.data.data;
        
        // Update the products list with successfully created products
        if (createdProducts && createdProducts.length > 0) {
          setProducts((prev) => [...prev, ...createdProducts]);
        }

        // Show appropriate toast messages based on results
        if (summary.failed > 0) {
          toast.warning(`${summary.successful} products uploaded, ${summary.failed} failed.`, {
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          
          showBulkErrorModal(summary, errors || [], {
            title: "Upload completed with issues",
            entityLabel: "products",
            columns: productErrorColumns,
          });
        } else {
          toast.success(`${summary.successful} products have been uploaded successfully.`, {
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }

        // Return detailed results for the ProductUploader to display
        return {
          data: {
            data: {
              summary,
              errors: errors || [],
              performance,
              createdProducts: createdProducts || [],
            },
          },
        };
      } else {
        throw new Error(response.data.message || "Bulk upload failed");
      }
    } catch (error) {
      console.error("Error uploading products:", error);
      
      // Fallback to individual uploads if bulk endpoint fails
      console.log("Bulk upload failed, falling back to individual uploads...");
      
      const createdProducts = [];
      const errors = [];

      for (const product of productsData) {
        try {
          const response = await api.post(
            `/tenant/${selectedTenant.tenant_id}/products`,
            {
              itemId: product.itemId,
              itemCode: product.itemCode,
              type: product.type,
              name: product.productName || product.name,
              description: product.productDescription || product.description,
              hsCode: product.hsCode,
              uom: product.uom,
            }
          );

          if (response.data.success) {
            createdProducts.push(response.data.data);
          } else {
            errors.push({
              product: product.productName || product.name,
              error: response.data.message || "Failed to create product",
            });
          }
        } catch (individualError) {
          errors.push({
            product: product.productName || product.name,
            error:
              individualError.response?.data?.message ||
              individualError.message ||
              "Error creating product",
          });
        }
      }

      if (createdProducts.length > 0) {
        setProducts((prev) => [...prev, ...createdProducts]);
      }

      return {
        data: {
          data: {
            summary: {
              successful: createdProducts.length,
              failed: errors.length,
            },
            errors: errors,
            createdProducts: createdProducts,
          },
        },
      };
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      const rajbyToken = localStorage.getItem("Rajbytoken");
      
      if (!rajbyToken) {
        Swal.fire({
          icon: "error",
          title: "Token Not Found",
          text: "Rajby token not found. Please login again.",
        });
        return;
      }

      if (!selectedTenant) {
        Swal.fire({
          icon: "warning",
          title: "No Company Selected",
          text: "Please select a company first.",
        });
        return;
      }

      // Show loading
      Swal.fire({
        title: "Syncing Products...",
        text: "Please wait while we fetch products from Rajby API",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // Ensure Rajby token exists
      if (!localStorage.getItem("Rajbytoken")) {
        const loginData = await performRajbyLogin();
        if (loginData?.token) {
          localStorage.setItem("Rajbytoken", loginData.token);
        }
      }

      // Fetch products directly from Rajby API
      const response = await fetchRajbyProducts();

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error("Invalid response from API");
      }

      // Map external API data to internal format
      const productsToSync = response.data.map((product) => ({
        itemId: product.itemId || "",
        itemCode: product.itemCode || "",
        type: product.type || "",
        name: product.itemDescr || product.itemCode || "",
        description: product.itemDescr || "",
        hsCode: product.hsCode || "",
        uom: "PCS", // Default value as not available in external API
      }));

      if (productsToSync.length === 0) {
        Swal.fire({
          icon: "info",
          title: "No Products Found",
          text: "No products found in the external system.",
        });
        return;
      }

      // Use bulk upload to save products
      const bulkResponse = await handleBulkUpload(productsToSync);

      const syncSummary = bulkResponse.data.data.summary;
      const syncErrors = bulkResponse.data.data.errors || [];
      const hasFailures = syncSummary.failed > 0;

      Swal.fire({
        icon: hasFailures ? "warning" : "success",
        title: hasFailures ? "Sync completed with issues" : "Sync Complete",
        text: hasFailures
          ? `${syncSummary.successful} product(s) added, ${syncSummary.failed} skipped. You can review the detailed reasons above.`
          : `Successfully synced ${syncSummary.successful} product(s).`,
      });

      if (hasFailures) {
        showBulkErrorModal(syncSummary, syncErrors, {
          title: "Products skipped during sync",
          entityLabel: "products",
          columns: productErrorColumns,
        });
      }

      // Refresh products list
      await fetchProducts();
    } catch (error) {
      console.error("Error syncing products:", error);
      Swal.fire({
        icon: "error",
        title: "Sync Failed",
        text: error.response?.data?.error || error.message || "Failed to sync products. Please try again.",
      });
    }
  };

  if (!selectedTenant) {
    return (
      <Container maxWidth="lg" sx={{ mt: 10, mb: 4 }}>
        <Alert severity="warning" sx={{ mt: 2 }}>
          Please select a Company to continue
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <ProductTable
        products={products}
        loading={loading}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        onAdd={handleAddProduct}
        onUpload={openUploader}
        onSync={handleSync}
        selectedTenant={selectedTenant}
        onBulkDeleted={(ids) =>
          setProducts((prev) => prev.filter((p) => !ids.includes(p.id)))
        }
      />

      {/* Product Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={closeProductModal}
        onSave={handleSaveProduct}
        initialProduct={editingProduct}
      />

      {/* Product Uploader */}
      <ProductUploader
        isOpen={isUploaderOpen}
        onClose={closeUploader}
        onUpload={handleBulkUpload}
        selectedTenant={selectedTenant}
      />
    </Container>
  );
};

export default Products;
