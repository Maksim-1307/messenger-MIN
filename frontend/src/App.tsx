import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { ChatsPage } from './pages/ChatsPage';
import { ChatPage } from './pages/ChatPage';
import { useAuth } from './hooks/useAuth';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route
          path="login"
          element={isAuthenticated ? <Navigate to="/profile" replace /> : <LoginPage />}
        />
        <Route
          path="register"
          element={isAuthenticated ? <Navigate to="/profile" replace /> : <RegisterPage />}
        />
        <Route
          path="profile"
          element={
            <ProfilePage />
          }
        />
        <Route
          path="chats"
          element={<ChatsPage />}
        />
        <Route
          path="chat/:userId"
          element={<ChatPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
