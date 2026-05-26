import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/shell/AppShell";
import { ChatPage } from "@/pages/ChatPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { NotificationPage } from "@/pages/NotificationPage";
import { PresentationModeProvider } from "@/context/PresentationModeContext";

export default function App() {
  return (
    <PresentationModeProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/library/*" element={<LibraryPage />} />
          <Route path="/notifications" element={<NotificationPage />} />
          {/* Catch-all → chat for now; will become 404 page later */}
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Route>
      </Routes>
    </PresentationModeProvider>
  );
}
