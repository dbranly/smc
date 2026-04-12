import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { ProjetProvider } from './ProjetContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Fondations from './pages/Fondations'
import GrosOeuvre from './pages/GrosOeuvre'
import { Finitions } from './pages/AutresLots'
import Maquette3D from './pages/Maquette3D'
import Utilisateurs from './pages/Utilisateurs'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <ProjetProvider>
                <Layout />
              </ProjetProvider>
            </ProtectedRoute>
          }>
            <Route index              element={<Dashboard />} />
            <Route path="fondations"  element={<Fondations />} />
            <Route path="gros-oeuvre" element={<GrosOeuvre />} />
            <Route path="finitions"   element={<Finitions />} />
            <Route path="maquette-3d" element={<Maquette3D />} />
            <Route path="utilisateurs" element={<Utilisateurs />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
