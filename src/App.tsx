import React from "react";
import { Routes, Route } from "react-router-dom";
import {
  About,
  Admin,
  AdviceCenter,
  AdviceDetail,
  Ask,
  Feed,
  Home,
  Login,
  MessagingCenter,
  Notifications,
  Profile,
  Register,
  Terms,
} from "./pages";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(900px_400px_at_10%_-10%,rgba(124,58,237,0.35),transparent),radial-gradient(800px_380px_at_90%_0%,rgba(59,130,246,0.3),transparent)]" />
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/advice" element={<AdviceCenter />} />
          <Route path="/advice/:id" element={<AdviceDetail />} />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagingCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="/about" element={<About />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
