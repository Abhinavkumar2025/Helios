import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { AppShell } from "./components/layout/AppShell";

// 16 Required Pages
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { LiveMap } from "./pages/LiveMap";
import { BusFleet } from "./pages/BusFleet";
import { BusDetail } from "./pages/BusDetail";
import { IncidentCenter } from "./pages/IncidentCenter";
import { AccidentSOS } from "./pages/AccidentSOS";
import { CameraCenter } from "./pages/CameraCenter";
import { Potholes } from "./pages/Potholes";
import { Waterlogging } from "./pages/Waterlogging";
import { RoadSigns } from "./pages/RoadSigns";
import { TrafficAnalytics } from "./pages/TrafficAnalytics";
import { AIModelStatus } from "./pages/AIModelStatus";
import { Analytics } from "./pages/Analytics";
import { Notifications } from "./pages/Notifications";
import { Settings } from "./pages/Settings";

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Application Shell with Persistent Sidebar & TopNav */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/overview" replace />} />
              <Route path="overview" element={<Overview />} />
              <Route path="map" element={<LiveMap />} />
              <Route path="buses" element={<BusFleet />} />
              <Route path="buses/:busId" element={<BusDetail />} />
              <Route path="incidents" element={<IncidentCenter />} />
              <Route path="accidents" element={<AccidentSOS />} />
              <Route path="cameras" element={<CameraCenter />} />
              <Route path="potholes" element={<Potholes />} />
              <Route path="waterlogging" element={<Waterlogging />} />
              <Route path="road-signs" element={<RoadSigns />} />
              <Route path="traffic" element={<TrafficAnalytics />} />
              <Route path="ai-models" element={<AIModelStatus />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Route>
          </Routes>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
