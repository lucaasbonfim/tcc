import { BrowserRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import ExperimentPage from "./pages/ExperimentPage";
import IdentificationPage from "./pages/IdentificationPage";

function App() {
  return (
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
  );
}

export default App;
