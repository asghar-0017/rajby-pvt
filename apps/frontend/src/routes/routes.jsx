// AppRouter.js
import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
// Alternative import for production if server routing doesn't work:
// import { HashRouter as BrowserRouter, Route, Routes } from "react-router-dom";
import Sidebar from "../component/Sidebar";
import Login from "../pages/login";
import TenantLogin from "../pages/TenantLogin";
import { AuthProvider, useAuth } from "../Context/AuthProvider"; // <-- useAuth import karein
import { TenantProvider } from "../Context/TenantProvider";
import { TenantSelectionProvider } from "../Context/TenantSelectionProvider";
import ProtectedRoute from "../Context/ProtectedRoute";
import CreateInvoice from "../pages/createInvoiceForm";
import TenantDashboard from "../component/TenantDashboard";
import YourInvoices from "../pages/YourInvoices";
import EmailVerification from "../pages/EmailVerification";
import OTP from "../pages/OTP";
import ResetPassword from "../pages/ResetPassword";
import ForgotPassword from "../pages/ForgotPassword";
import RegisterUser from "../pages/RegisterUser";
import { RegisteredUsers } from "../pages/RegisteredUsers";
import Buyers from "../pages/Buyers";
import TenantManagement from "../pages/TenantManagement";

// import ProductionForm from "../pages/productionForm"

const SidebarWithLogout = () => {
  const { logout } = useAuth();
  return <Sidebar onLogout={logout} />;
};

const AppRouter = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <TenantSelectionProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/tenant-login" element={<TenantLogin />} />
              <Route
                path="/email-verification"
                element={<EmailVerification />}
              />
              <Route path="/otp" element={<OTP />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <SidebarWithLogout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<TenantDashboard />} />
                <Route path="create-invoice" element={<CreateInvoice />} />
                <Route path="your-invoices" element={<YourInvoices />} />
                <Route path="register-buyer" element={<RegisterUser />} />
                <Route path="registered-users" element={<RegisteredUsers />} />
                <Route path="buyers" element={<Buyers />} />
                <Route
                  path="tenant-management"
                  element={<TenantManagement />}
                />
              </Route>
            </Routes>
          </TenantSelectionProvider>
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default AppRouter;
