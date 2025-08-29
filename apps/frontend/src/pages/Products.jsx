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
import { api } from "../API/Api";
import Swal from "sweetalert2";

const Products = () => {
  const { selectedTenant } = useTenantSelection();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

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
          Swal.fire({
            icon: "success",
            title: "Product Deleted",
            text: "Product has been deleted successfully.",
            timer: 2000,
            showConfirmButton: false,
          });
        }
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to delete product. Please try again.",
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

          Swal.fire({
            icon: "success",
            title: "Product Updated",
            text: "Product has been updated successfully.",
            timer: 2000,
            showConfirmButton: false,
          });
        }
      } else {
        // Create new product
        const response = await api.post(
          `/tenant/${selectedTenant.tenant_id}/products`,
          {
            name: productData.name,
            description: productData.description,
            hsCode: productData.hsCode,
            uom: productData.uoM,
          }
        );

        if (response.data.success) {
          setProducts([...products, response.data.data]);
          setIsProductModalOpen(false);

          Swal.fire({
            icon: "success",
            title: "Product Added",
            text: "Product has been added successfully.",
            timer: 2000,
            showConfirmButton: false,
          });
        }
      }
    } catch (error) {
      console.error("Error saving product:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to save product. Please try again.",
      });
    }
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
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
      />

      {/* Product Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={closeProductModal}
        onSave={handleSaveProduct}
        initialProduct={editingProduct}
      />
    </Container>
  );
};

export default Products;
