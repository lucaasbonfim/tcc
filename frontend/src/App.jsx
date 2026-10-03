import { BrowserRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { ParticipantProvider } from "./contexts/ParticipantContext";
import AITaskPage from "./pages/AITaskPage";
import ExperimentPage from "./pages/ExperimentPage";
import IdentificationPage from "./pages/IdentificationPage";
import ManualTaskPage from "./pages/ManualTaskPage";

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
                <ManualTaskPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/experiment/task/:taskId/ai"
            element={
              <ProtectedRoute>
                <AITaskPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ParticipantProvider>
  );
}

export default App;
