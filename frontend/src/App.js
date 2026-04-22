import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import VehicleDetail from "@/pages/VehicleDetail";
import BookingFlow from "@/pages/BookingFlow";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Account from "@/pages/Account";
import Locations from "@/pages/Locations";
import About from "@/pages/About";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminVehicles from "@/pages/admin/AdminVehicles";
import AdminBookings from "@/pages/admin/AdminBookings";
import AdminBookingDetail from "@/pages/admin/AdminBookingDetail";
import AdminLocationsPage from "@/pages/admin/AdminLocations";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import AdminCustomerDetail from "@/pages/admin/AdminCustomerDetail";

function PublicShell({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicShell><Home /></PublicShell>} />
            <Route path="/katalog" element={<PublicShell><Catalog /></PublicShell>} />
            <Route path="/fahrzeug/:id" element={<PublicShell><VehicleDetail /></PublicShell>} />
            <Route path="/standorte" element={<PublicShell><Locations /></PublicShell>} />
            <Route path="/ueber-uns" element={<PublicShell><About /></PublicShell>} />
            <Route path="/login" element={<PublicShell><Login /></PublicShell>} />
            <Route path="/registrieren" element={<PublicShell><Register /></PublicShell>} />
            <Route path="/buchen/:vehicleId" element={<ProtectedRoute><PublicShell><BookingFlow /></PublicShell></ProtectedRoute>} />
            <Route path="/konto" element={<ProtectedRoute><PublicShell><Account /></PublicShell></ProtectedRoute>} />

            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="fahrzeuge" element={<AdminVehicles />} />
              <Route path="buchungen" element={<AdminBookings />} />
              <Route path="buchungen/:id" element={<AdminBookingDetail />} />
              <Route path="standorte" element={<AdminLocationsPage />} />
              <Route path="kunden" element={<AdminCustomers />} />
              <Route path="kunden/:id" element={<AdminCustomerDetail />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
