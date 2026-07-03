import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoadingState from "./components/ui/LoadingState";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const CreateOrder = lazy(() => import("./pages/CreateOrder"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const StyleAdjustments = lazy(() => import("./pages/StyleAdjustments"));
const Fabric = lazy(() => import("./pages/Fabric"));
const FabricCreate = lazy(() => import("./pages/FabricCreate"));
const FabricEdit = lazy(() => import("./pages/FabricEdit"));
const FabricBulkImport = lazy(() => import("./pages/FabricBulkImport"));

function PrivateRoute({ children }) {
  const isAuth = localStorage.getItem("suit_admin_auth") === "true";
  return isAuth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <PrivateRoute>
                <Orders />
              </PrivateRoute>
            }
          />
          <Route
            path="/orders/new"
            element={
              <PrivateRoute>
                <CreateOrder />
              </PrivateRoute>
            }
          />
          <Route
            path="/orders/:orderId"
            element={
              <PrivateRoute>
                <OrderDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <PrivateRoute>
                <Customers />
              </PrivateRoute>
            }
          />
          <Route
            path="/customers/:customerId"
            element={
              <PrivateRoute>
                <CustomerDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/kuttailor"
            element={
              <PrivateRoute>
                <StyleAdjustments />
              </PrivateRoute>
            }
          />
          <Route
            path="/fabric"
            element={
              <PrivateRoute>
                <Fabric />
              </PrivateRoute>
            }
          />
          <Route
            path="/fabric/new"
            element={
              <PrivateRoute>
                <FabricCreate />
              </PrivateRoute>
            }
          />
          <Route
            path="/fabric/bulk-import"
            element={
              <PrivateRoute>
                <FabricBulkImport />
              </PrivateRoute>
            }
          />
          <Route
            path="/fabric/:productId"
            element={
              <PrivateRoute>
                <FabricEdit />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
