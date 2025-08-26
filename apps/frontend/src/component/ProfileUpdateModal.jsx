import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  Divider,
} from "@mui/material";

export default function ProfileUpdateModal({
  open,
  onClose,
  onSave,
  isSaving = false,
  initialTenant,
}) {
  const [sellerBusinessName, setSellerBusinessName] = useState("");
  const [sellerFullNTN, setSellerFullNTN] = useState("");
  const [sellerProvince, setSellerProvince] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");

  useEffect(() => {
    if (initialTenant) {
      setSellerBusinessName(initialTenant.sellerBusinessName || "");
      setSellerFullNTN(initialTenant.sellerFullNTN || "");
      setSellerProvince(initialTenant.sellerProvince || "");
      setSellerAddress(initialTenant.sellerAddress || "");
    }
  }, [initialTenant]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      sellerBusinessName: sellerBusinessName?.trim(),
      sellerFullNTN: sellerFullNTN?.trim(),
      sellerProvince: sellerProvince?.trim(),
      sellerAddress: sellerAddress?.trim(),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Update Company Profile</DialogTitle>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              label="Seller Business Name"
              value={sellerBusinessName}
              onChange={(e) => setSellerBusinessName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Seller Full NTN"
              value={sellerFullNTN}
              onChange={(e) => setSellerFullNTN(e.target.value)}
              fullWidth
            />
            <TextField
              label="Seller Province"
              value={sellerProvince}
              onChange={(e) => setSellerProvince(e.target.value)}
              fullWidth
            />
            <TextField
              label="Seller Address"
              value={sellerAddress}
              onChange={(e) => setSellerAddress(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="contained" type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
