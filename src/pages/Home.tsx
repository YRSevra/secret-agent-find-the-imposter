import React, { useState } from 'react';
import { Hero } from '../components/sections/Hero';
import { GameInformation } from '../components/sections/GameInformation';
import { Features } from '../components/sections/Features';
import { HowItWorks } from '../components/sections/HowItWorks';
import { ScreenFoundationShowcase } from '../components/preview/ScreenFoundationShowcase';
import { RoomAccessModal } from '../components/preview/RoomAccessModal';

export const Home: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <Hero onPlayClick={() => setIsModalOpen(true)} />
      <GameInformation />
      <Features />
      <HowItWorks />
      <ScreenFoundationShowcase />

      {/* Room Access Preview Modal */}
      <RoomAccessModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default Home;
