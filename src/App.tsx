import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { Home } from './pages/Home';
import { HowToPlay } from './pages/HowToPlay';
import { RoomConnection } from './pages/RoomConnection';
import { RoleReveal } from './pages/RoleReveal';
import { Discussion } from './pages/Discussion';
import { Voting } from './pages/Voting';
import { RoundSummary } from './pages/RoundSummary';
import { FinalLeaderboard } from './pages/FinalLeaderboard';
import { RematchLobby } from './pages/RematchLobby';
import { RoomAccessModal } from './components/preview/RoomAccessModal';

export const App: React.FC = () => {
  const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);

  return (
    <Router>
      <div className="min-h-screen bg-agency-bg text-agency-text flex flex-col font-sans selection:bg-agency-accent selection:text-agency-dark">
        {/* Global Navigation Bar */}
        <Navbar onPlayClick={() => setIsGlobalModalOpen(true)} />

        {/* Main Content Router */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/how-to-play" element={<HowToPlay />} />
            <Route path="/room/:code" element={<RoomConnection />} />
            <Route path="/room/:code/role-reveal" element={<RoleReveal />} />
            <Route path="/room/:code/discussion" element={<Discussion />} />
            <Route path="/room/:code/voting" element={<Voting />} />
            <Route path="/room/:code/round-summary" element={<RoundSummary />} />
            <Route path="/room/:code/final-results" element={<FinalLeaderboard />} />
            <Route path="/room/:code/rematch" element={<RematchLobby />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Global Footer */}
        <Footer />

        {/* Global Room Access Modal */}
        <RoomAccessModal
          isOpen={isGlobalModalOpen}
          onClose={() => setIsGlobalModalOpen(false)}
        />
      </div>
    </Router>
  );
};

export default App;
