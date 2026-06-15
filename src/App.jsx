import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import WelcomeModal from "@/components/WelcomeModal";
import { GuideProvider } from "@/contexts/GuideContext";
import { usePageTracking } from "@/hooks/usePageTracking";

// Public pages
import Schedule from "@/pages/Schedule";
import Event from "@/pages/Event";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import NotFound from "@/pages/NotFound";

// Authenticated pages
import Register from "@/pages/Register";
import MyRegistrations from "@/pages/MyRegistrations";
import WaiverPrint from "@/pages/WaiverPrint";

// Admin pages
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminClimbsManage from "@/pages/admin/ClimbsManage";
import AdminClimbForm from "@/pages/admin/ClimbForm";
import AdminClimbDetail from "@/pages/admin/ClimbDetail";
import AdminUsersManage from "@/pages/admin/UsersManage";
import AllRegistrations from "@/pages/admin/AllRegistrations";
import ManagePayments from "@/pages/admin/ManagePayments";
import AdminAnalytics from "@/pages/admin/Analytics";

export default function App() {
  usePageTracking();
  return (
    <GuideProvider>
      <WelcomeModal />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Schedule />} />
        <Route path="/event/:climbId" element={<Event />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Authenticated users */}
        <Route element={<ProtectedRoute />}>
          <Route path="/register/:climbId" element={<Register />} />
          <Route path="/my-registrations" element={<MyRegistrations />} />
          <Route path="/waiver/:registrationId" element={<WaiverPrint />} />
        </Route>

        {/* Admin only */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/climbs" element={<AdminClimbsManage />} />
          <Route path="/admin/climbs/new" element={<AdminClimbForm />} />
          <Route path="/admin/climbs/:id/edit" element={<AdminClimbForm />} />
          <Route path="/admin/climbs/:id" element={<AdminClimbDetail />} />
          <Route path="/admin/users" element={<AdminUsersManage />} />
          <Route path="/admin/registrations" element={<AllRegistrations />} />
          <Route path="/admin/payments" element={<ManagePayments />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </GuideProvider>
  );
}
