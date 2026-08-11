import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import ClientsBilling from './pages/ClientsBilling.jsx';
import Plans from './pages/Plans.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Overview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <ClientsBilling />
          </ProtectedRoute>
        }
      />
      <Route
        path="/plans"
        element={
          <ProtectedRoute>
            <Plans />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
