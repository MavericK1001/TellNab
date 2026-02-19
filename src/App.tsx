import React from "react";
import { Routes, Route } from "react-router-dom";
import {
  About,
  Admin,
  AdviceCenter,
  AdviceDetail,
  Ask,
  Feed,
  Groups,
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
import ReportIssueButton from "./components/ReportIssueButton";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1080px_520px_at_8%_-12%,rgba(124,58,237,0.34),transparent),radial-gradient(980px_460px_at_95%_0%,rgba(56,189,248,0.26),transparent),radial-gradient(760px_420px_at_50%_110%,rgba(16,185,129,0.12),transparent)]" />
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/groups" element={<Groups />} />
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
              <ProtectedRoute allowedRoles={["ADMIN", "MODERATOR"]}>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="/about" element={<About />} />
          <Route path="/terms" element={<Terms />} />
        </Routes>
      </main>
      <ReportIssueButton />
      <Footer />
    </div>
  );
}
