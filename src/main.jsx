import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import App from './App.jsx';
import RoleGuard from './components/RoleGuard';
import { AuthProvider } from './context/AuthContext';
import './index.css';

// Lazy load pages
const SignIn = lazy(() => import('./pages/SignIn.jsx'));
const SignUp = lazy(() => import('./pages/SignUp.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const UpdatePassword = lazy(() => import('./pages/UpdatePassword.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));

// Loading component
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
  </div>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/signin" replace />,
      },
      {
        path: "signin",
        element: (
          <Suspense fallback={<Loading />}>
            <SignIn />
          </Suspense>
        ),
      },
      {
        path: "signup",
        element: (
          <Suspense fallback={<Loading />}>
            <SignUp />
          </Suspense>
        ),
      },
      {
        path: "forgot-password",
        element: (
          <Suspense fallback={<Loading />}>
            <ForgotPassword />
          </Suspense>
        ),
      },
      {
        path: "update-password",
        element: (
          <Suspense fallback={<Loading />}>
            <UpdatePassword />
          </Suspense>
        ),
      },
      {
        path: "admin",
        element: <RoleGuard allowedRoles={["admin"]} />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<Loading />}>
                <AdminDashboard />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: "dashboard",
        element: <RoleGuard allowedRoles={["staff"]} />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<Loading />}>
                <Dashboard />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: "*",
        element: <Navigate to="/signin" replace />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
