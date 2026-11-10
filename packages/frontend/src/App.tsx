import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import LabPage from "./pages/LabPage";
import "./App.css";

// The routed content, wrapped in an error boundary so a crash in one page
// leaves the nav usable. Keyed by path: a boundary that has caught an error
// keeps showing its fallback until reset, so without the key, navigating to
// another page would still show the error.
function RoutedContent() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname} label="This page">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/labs/:slug" element={<LabPage />} />
        <Route path="*" element={<p>Page not found.</p>} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="page">
        <nav className="nav" aria-label="Main">
          <Link to="/" className="brand">
            <span aria-hidden="true">🧟</span> frankenstack
          </Link>
        </nav>
        <main>
          <RoutedContent />
        </main>
      </div>
    </BrowserRouter>
  );
}
