import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Home from "./components/home";

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;
