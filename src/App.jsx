import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import WelcomeModal from "@/components/WelcomeModal";
import LoadingSpinner from "@/components/LoadingSpinner";
import { GuideProvider } from "@/contexts/GuideContext";
import { usePageTracking } from "@/hooks/usePageTracking";

// The landing page stays in the entry chunk; every other route loads on
// demand so a first visit downloads only what the schedule needs.
import Schedule from "@/pages/Schedule";
import NotFound from "@/pages/NotFound";

const Event = lazy(() => import("@/pages/Event"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const Register = lazy(() => import("@/pages/Register"));
const MyRegistrations = lazy(() => import("@/pages/MyRegistrations"));
const ClimbFeedback = lazy(() => import("@/pages/ClimbFeedback"));
const WaiverPrint = lazy(() => import("@/pages/WaiverPrint"));
const ReleaseNotes = lazy(() => import("@/pages/ReleaseNotes"));
const Privacy = lazy(() => import("@/pages/Privacy"));

// Admin pages — lazy so anonymous landing traffic doesn't download the whole
// admin surface (ClimbForm alone is ~2100 lines) just to read the schedule.
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminClimbsManage = lazy(() => import("@/pages/admin/ClimbsManage"));
const AdminClimbForm = lazy(() => import("@/pages/admin/ClimbForm"));
const AdminClimbDetail = lazy(() => import("@/pages/admin/ClimbDetail"));
const AdminClimbDaySheet = lazy(() => import("@/pages/admin/ClimbDaySheet"));
const AdminClimbDonations = lazy(() => import("@/pages/admin/ClimbDonations"));
const AdminUsersManage = lazy(() => import("@/pages/admin/UsersManage"));
const AllRegistrations = lazy(() => import("@/pages/admin/AllRegistrations"));
const ManagePayments = lazy(() => import("@/pages/admin/ManagePayments"));
const AdminAnalytics = lazy(() => import("@/pages/admin/Analytics"));
const AdminAppInsights = lazy(() => import("@/pages/admin/AppInsights"));
const AdminReleaseNotesManage = lazy(
  () => import("@/pages/admin/ReleaseNotesManage"),
);
const AdminReleaseNoteForm = lazy(
  () => import("@/pages/admin/ReleaseNoteForm"),
);

export default function App() {
  usePageTracking();
  return (
    <GuideProvider>
      <WelcomeModal />
      <Suspense fallback={<LoadingSpinner fullPage />}>
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
            <Route path="/release-notes" element={<ReleaseNotes />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/feedback/:climbId" element={<ClimbFeedback />} />
          </Route>

          {/* Admin only */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/climbs" element={<AdminClimbsManage />} />
            <Route path="/admin/climbs/new" element={<AdminClimbForm />} />
            <Route path="/admin/climbs/:id/edit" element={<AdminClimbForm />} />
            <Route path="/admin/climbs/:id" element={<AdminClimbDetail />} />
            <Route path="/admin/climbs/:id/sheet" element={<AdminClimbDaySheet />} />
            <Route path="/admin/climbs/:id/donations" element={<AdminClimbDonations />} />
            <Route path="/admin/users" element={<AdminUsersManage />} />
            <Route path="/admin/registrations" element={<AllRegistrations />} />
            <Route path="/admin/payments" element={<ManagePayments />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/insights" element={<AdminAppInsights />} />
            <Route
              path="/admin/release-notes"
              element={<AdminReleaseNotesManage />}
            />
            <Route
              path="/admin/release-notes/new"
              element={<AdminReleaseNoteForm />}
            />
            <Route
              path="/admin/release-notes/:id/edit"
              element={<AdminReleaseNoteForm />}
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </GuideProvider>
  );
}
