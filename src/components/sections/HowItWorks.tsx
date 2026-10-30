import React from 'react';
import { SectionHeading } from '../ui/SectionHeading';
import { Key, FileQuestion, Users, CheckSquare, Trophy, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Infiltrate Room',
      desc: 'Host a room or enter a 6-character room code from your friends to assemble the operative team.',
      icon: <Key className="w-5 h-5 text-agency-accent" />,
    },
    {
      step: '02',
      title: 'Receive Secret Role',
      desc: 'Agents receive the shared secret location/codeword. The designated Imposter receives nothing.',
      icon: <FileQuestion className="w-5 h-5 text-agency-warning" />,
    },
    {
      step: '03',
      title: 'Interrogate & Discuss',
      desc: 'Take turns asking sharp, non-obvious questions. Scrutinize suspect pauses and vague replies.',
      icon: <Users className="w-5 h-5 text-agency-accent" />,
    },
    {
      step: '04',
      title: 'Emergency Vote',
      desc: 'When time expires or suspicion peaks, cast confidential ballots on who among you is the imposter.',
      icon: <CheckSquare className="w-5 h-5 text-agency-accent" />,
    },
    {
      step: '05',
      title: 'Reveal & Score',
      desc: 'Unmask identities, tally round points, and proceed through 3 escalating rounds to crown the agency winner.',
      icon: <Trophy className="w-5 h-5 text-agency-amber" />,
    },
  ];

  return (
    <section className="py-16 sm:py-24 border-t border-agency-border/60 bg-agency-bgSecondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="PROTOCOL EXECUTION"
          title="MISSION"
          highlight="FLOW"
          description="Five straightforward steps from deployment to debriefing. Simple to learn, impossible to master."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 relative">
          {steps.map((s, index) => (
            <div
              key={index}
              className="bg-agency-card border border-agency-border rounded-xl p-5 flex flex-col justify-between hover:border-agency-accent/50 transition-all duration-200 group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2.5 rounded-lg bg-agency-surface border border-agency-border group-hover:border-agency-accent/40 group-hover:bg-agency-surface/80 transition-colors">
                    {s.icon}
                  </div>
                  <span className="font-mono text-xl font-extrabold text-agency-muted/40 group-hover:text-agency-accent transition-colors">
                    {s.step}
                  </span>
                </div>
                <h3 className="font-bold text-white text-base mb-2 group-hover:text-agency-accent transition-colors">
                  {s.title}
                </h3>
                <p className="text-xs text-agency-muted leading-relaxed">{s.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-agency-border/40 text-[10px] font-mono text-agency-muted flex items-center justify-between">
                <span>STAGE {s.step}</span>
                <span className="text-agency-accent">CLEAR</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link to="/how-to-play">
            <Button
              variant="outline"
              size="md"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              EXPLORE FULL OPERATIVE PROTOCOL & GUIDEBOOK
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};
