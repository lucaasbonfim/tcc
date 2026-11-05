import {createBrowserRouter,createRoutesFromElements,RouterProvider,Navigate,Route} from 'react-router-dom';
import {lazy,Suspense} from 'react';
import Loading from './components/Loading';
import ResearchLayout from "./components/ResearchLayout";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AdminLoginPage from "./pages/AdminLoginPage";
import ResearchDashboardPage from './pages/ResearchDashboardPage';
import ResearchProjectsPage from './pages/ResearchProjectsPage';
import ResearchProjectFormPage from './pages/ResearchProjectFormPage';
import ResearchProjectPage from './pages/ResearchProjectPage';
import ResearchRunsPage from './pages/ResearchRunsPage';
const ResearchRunPage=lazy(()=>import('./pages/ResearchRunPage'));

const router=createBrowserRouter(createRoutesFromElements(<>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <ResearchLayout />
              </AdminProtectedRoute>
            }
          >
            <Route index element={<ResearchDashboardPage />} />
            <Route path="projects" element={<ResearchProjectsPage />} />
            <Route path="projects/new" element={<ResearchProjectFormPage />} />
            <Route path="projects/:projectId" element={<ResearchProjectPage />} />
            <Route path="projects/:projectId/edit" element={<ResearchProjectFormPage />} />
            <Route path="requirements" element={<ResearchRunsPage view="requirements" />} />
            <Route path="test-cases" element={<ResearchRunsPage view="tests" />} />
            <Route path="runs" element={<ResearchRunsPage />} />
            <Route path="runs/:runId" element={<Suspense fallback={<Loading>Carregando análise…</Loading>}><ResearchRunPage /></Suspense>} />
            <Route path="analysis" element={<ResearchRunsPage view="analysis" />} />
            <Route path="reports" element={<ResearchRunsPage view="reports" />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </>));
function App(){return <RouterProvider router={router}/>;}

export default App;
