import React from "react";
import { Routes, Route } from "react-router-dom";
import {
  About,
  AdvisorProfile,
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
  QuestionShare,
  Register,
  Terms,
} from "./pages";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import ReportIssueButton from "./components/ReportIssueButton";
import MobileBottomNav from "./components/MobileBottomNav";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1080px_520px_at_8%_-12%,rgba(124,58,237,0.30),transparent),radial-gradient(980px_460px_at_95%_0%,rgba(6,182,212,0.18),transparent),radial-gradient(760px_420px_at_50%_110%,rgba(34,197,94,0.09),transparent)]" />
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:pb-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/advisors/:id" element={<AdvisorProfile />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/advice" element={<AdviceCenter />} />
          <Route path="/advice/:id" element={<AdviceDetail />} />
          <Route path="/q/:id" element={<QuestionShare />} />
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
      <MobileBottomNav />
      <Footer />
    </div>
  );
}
