import { BrowserRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { ParticipantProvider } from "./contexts/ParticipantContext";
import ExperimentPage from "./pages/ExperimentPage";
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
        </Routes>
      </BrowserRouter>
    </ParticipantProvider>
  );
}

export default App;
