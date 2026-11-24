import { ErrorBoundaryLayout, LoadingOverlay } from '@fluxu-labs/lib';
import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router-dom';
import { Appbar } from 'src/components/Appbar';
import { AuthGuard } from 'src/guards/AuthGuard';
import { PermissionGuard } from 'src/guards/PermissionGuard';

// ----------------------------------------------------------------------

const Abastecimentos = lazy(() => import('src/pages/Abastecimentos'));

// ----------------------------------------------------------------------

const router = createBrowserRouter([
  {
    element: <ErrorBoundaryLayout />,
    children: [
      {
        path: '/',
        element: (
          <AuthGuard>
            <Suspense fallback={<LoadingOverlay />}>
              <Appbar />
              <Outlet />
            </Suspense>
          </AuthGuard>
        ),
        children: [
          {
            path: '',
            element: (
              <PermissionGuard
                method="some"
                permissions={['trip_fuel_access']}
                redirect
              >
                <Abastecimentos />
              </PermissionGuard>
            ),
          },
        ],
      },

      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

// ----------------------------------------------------------------------

export function Router() {
  return <RouterProvider router={router} />;
}
