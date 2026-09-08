import { Link, Navigate, Route, Routes } from "react-router-dom";
import GroupPage from "./pages/GroupPage.jsx";
import HomePage from "./pages/HomePage.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          Split Fair
        </Link>
        <p className="tagline">Group expenses, simplified settle-up</p>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/groups/:id" element={<GroupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
