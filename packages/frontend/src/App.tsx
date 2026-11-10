import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import LabPage from "./pages/LabPage";
import "./App.css";

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
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/labs/:slug" element={<LabPage />} />
            <Route path="*" element={<p>Page not found.</p>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
