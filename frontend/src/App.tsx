import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import MeetingRoom from './pages/MeetingRoom';
import AISummary from './pages/AISummary';
import RecordingDetail from './pages/RecordingDetail';
import TaskBoard from './pages/TaskBoard';
import DashboardLayout from './layouts/DashboardLayout';
import Onboarding from './pages/Onboarding';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoaded, isSignedIn } = useAuth();
  
  if (!isLoaded) return null;

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login/*" element={<SignInPage />} />
        <Route path="/signup/*" element={<SignUpPage />} />
        
        {/* Protected Routes with Sidebar Layout */}
        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<TaskBoard />} />
          {/* Add other sidebar routes here if needed */}
        </Route>

        {/* Protected Fullscreen Routes */}
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/meeting/:id" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />
        <Route path="/summary/:id" element={<ProtectedRoute><AISummary /></ProtectedRoute>} />
        <Route path="/recordings/:id" element={<ProtectedRoute><RecordingDetail /></ProtectedRoute>} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
