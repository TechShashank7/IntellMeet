import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, useAuth } from '@clerk/clerk-react';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import MeetingRoom from './pages/MeetingRoom';
import AISummary from './pages/AISummary';
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
        <Route path="/login/*" element={
          <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
            <SignIn routing="path" path="/login" fallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard" />
          </div>
        } />
        
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
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
