import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import { ParticipantProvider } from "./contexts/ParticipantContext";
import AdminOverviewPage from "./pages/AdminOverviewPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminParticipantDetailsPage from "./pages/AdminParticipantDetailsPage";
import AdminParticipantsPage from "./pages/AdminParticipantsPage";
import AdminTasksPage from "./pages/AdminTasksPage";
import ExperimentPage from "./pages/ExperimentPage";
import ExperimentTaskPage from "./pages/ExperimentTaskPage";
import IdentificationPage from "./pages/IdentificationPage";

function App() {
  return (
    <ParticipantProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<IdentificationPage />} />
          <Route
            path="/experiment"
            element={
              <ProtectedRoute>
                <ExperimentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/experiment/task/:taskId"
            element={
              <ProtectedRoute>
                <ExperimentTaskPage />
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
