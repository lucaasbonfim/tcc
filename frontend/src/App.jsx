import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import ExperimentReadyRoute from "./components/ExperimentReadyRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import { ParticipantProvider } from "./contexts/ParticipantContext";
import AdminOverviewPage from "./pages/AdminOverviewPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminParticipantDetailsPage from "./pages/AdminParticipantDetailsPage";
import AdminParticipantsPage from "./pages/AdminParticipantsPage";
import AdminTasksPage from "./pages/AdminTasksPage";
import ConsentPage from "./pages/ConsentPage";
import ExperimentPage from "./pages/ExperimentPage";
import ExperimentTaskPage from "./pages/ExperimentTaskPage";
import IdentificationPage from "./pages/IdentificationPage";
import ProfilePage from "./pages/ProfilePage";

function App() {
  return (
    <ParticipantProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<IdentificationPage />} />
          <Route
            path="/consent"
            element={
              <ProtectedRoute>
                <ConsentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/experiment"
            element={
              <ExperimentReadyRoute>
                <ExperimentPage />
              </ExperimentReadyRoute>
            }
          />
          <Route
            path="/experiment/task/:taskId"
            element={
              <ExperimentReadyRoute>
                <ExperimentTaskPage />
              </ExperimentReadyRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <AdminLayout />
              </AdminProtectedRoute>
            }
          >
            <Route index element={<AdminOverviewPage />} />
            <Route path="participants" element={<AdminParticipantsPage />} />
            <Route
              path="participants/:id"
              element={<AdminParticipantDetailsPage />}
            />
            <Route path="tasks" element={<AdminTasksPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ParticipantProvider>
  );
}

export default App;
