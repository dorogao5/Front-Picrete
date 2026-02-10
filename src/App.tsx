import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getDefaultAppPath, isAuthenticated } from "@/lib/auth";
import Landing from "./pages/Landing";
import Demo from "./pages/Demo";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import JoinCourse from "./pages/JoinCourse";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import CreateExam from "./pages/CreateExam";
import TakeExam from "./pages/TakeExam";
import TaskBank from "./pages/TaskBank";
import TrainerSets from "./pages/TrainerSets";
import TrainerSetView from "./pages/TrainerSetView";
import OcrReview from "./pages/OcrReview";
import ExamResult from "./pages/ExamResult";
import ExamSubmissions from "./pages/ExamSubmissions";
import SubmissionReview from "./pages/SubmissionReview";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import DataProcessingConsent from "./pages/DataProcessingConsent";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const DashboardRedirect = () => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getDefaultAppPath()} replace />;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfUse />} />
            <Route path="/consent" element={<DataProcessingConsent />} />
            <Route path="/dashboard" element={<DashboardRedirect />} />
            <Route path="/join-course" element={<ProtectedRoute><JoinCourse /></ProtectedRoute>} />

            {/* Legacy redirects */}
            <Route path="/teacher" element={<DashboardRedirect />} />
            <Route path="/student" element={<DashboardRedirect />} />
            <Route path="/create-exam" element={<DashboardRedirect />} />
            <Route path="/exam/:examId" element={<DashboardRedirect />} />
            <Route path="/exam/:examId/edit" element={<DashboardRedirect />} />
            <Route path="/exam/:examId/submissions" element={<DashboardRedirect />} />
            <Route path="/submission/:submissionId" element={<DashboardRedirect />} />
            <Route path="/exam/:sessionId/result" element={<DashboardRedirect />} />
            <Route path="/exam/:sessionId/ocr-review" element={<DashboardRedirect />} />

            {/* Course routes */}
            <Route path="/c/:courseId/teacher" element={<ProtectedRoute roles={["teacher", "admin"]}><TeacherDashboard /></ProtectedRoute>} />
            <Route path="/c/:courseId/create-exam" element={<ProtectedRoute roles={["teacher", "admin"]}><CreateExam /></ProtectedRoute>} />
            <Route path="/c/:courseId/exam/:examId/edit" element={<ProtectedRoute roles={["teacher", "admin"]}><CreateExam /></ProtectedRoute>} />
            <Route path="/c/:courseId/exam/:examId/submissions" element={<ProtectedRoute roles={["teacher", "admin"]}><ExamSubmissions /></ProtectedRoute>} />
            <Route path="/c/:courseId/submission/:submissionId" element={<ProtectedRoute roles={["teacher", "admin"]}><SubmissionReview /></ProtectedRoute>} />
            <Route path="/c/:courseId/task-bank" element={<ProtectedRoute roles={["student", "teacher", "admin"]}><TaskBank /></ProtectedRoute>} />

            <Route path="/c/:courseId/student" element={<ProtectedRoute roles={["student", "admin"]}><StudentDashboard /></ProtectedRoute>} />
            <Route path="/c/:courseId/trainer" element={<ProtectedRoute roles={["student", "admin"]}><TrainerSets /></ProtectedRoute>} />
            <Route path="/c/:courseId/trainer/:setId" element={<ProtectedRoute roles={["student", "admin"]}><TrainerSetView /></ProtectedRoute>} />
            <Route path="/c/:courseId/exam/:examId" element={<ProtectedRoute roles={["student", "admin"]}><TakeExam /></ProtectedRoute>} />
            <Route path="/c/:courseId/exam/:sessionId/ocr-review" element={<ProtectedRoute roles={["student", "admin"]}><OcrReview /></ProtectedRoute>} />
            <Route path="/c/:courseId/exam/:sessionId/result" element={<ProtectedRoute roles={["student", "admin"]}><ExamResult /></ProtectedRoute>} />

            {/* Admin only */}
            <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
