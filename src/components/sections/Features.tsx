import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';
import { UserCheck, MessageSquareCode, Wifi, Vote, Award, ShieldAlert } from 'lucide-react';

export const Features: React.FC = () => {
  const features = [
    {
      icon: <UserCheck className="w-6 h-6 text-agency-accent" />,
      title: 'Hidden Identities',
      description:
        'Cryptographic role assignment ensures absolute secrecy. Only you inspect your private briefing dossier on your personal screen.',
      tag: 'COVERT OPS',
    },
    {
      icon: <MessageSquareCode className="w-6 h-6 text-agency-accent" />,
      title: 'Strategic Questioning',
      description:
        'Operatives cross-examine each other under pressure. Craft clues that prove your identity to allies without feeding the imposter.',
      tag: 'INTERROGATION',
    },
    {
      icon: <Wifi className="w-6 h-6 text-agency-accent" />,
      title: 'Real-Time Synchronization',
      description:
        'Instantaneous multiplayer state orchestration. Timer clocks, votes, and status indicators pulse simultaneously across every connected device.',
      tag: 'E2E SYNC',
    },
    {
      icon: <Vote className="w-6 h-6 text-agency-warning" />,
      title: 'Classified Voting Arena',
      description:
        'Emergency ballots are cast under secrecy. Deliberate on suspects and lock in your vote before the extraction countdown expires.',
      tag: 'ELIMINATION',
    },
    {
      icon: <Award className="w-6 h-6 text-agency-amber" />,
      title: 'Competitive Scoring Matrix',
      description:
        'Tactical point algorithms reward sharp deduction, clever bluffs, and clutch imposter guesses across three evolving rounds.',
      tag: 'LEADERBOARD',
    },
    {
      icon: <ShieldAlert className="w-6 h-6 text-agency-accent" />,
      title: 'Zero Barrier Access',
      description:
        'No downloads, no passwords, no personal data. Pure lightweight browser execution tuned for smooth 60fps interaction on mobile or desktop.',
      tag: 'FRICTIONLESS',
    },
  ];

  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="TACTICAL CAPABILITIES"
          title="CORE INTELLIGENCE"
          highlight="FEATURES"
          description="Designed from the ground up for high-fidelity social deduction without technical overhead."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, index) => (
            <Card key={index} variant="interactive" className="group">
              <CardHeader className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-lg bg-agency-surface border border-agency-border group-hover:border-agency-accent/40 group-hover:bg-agency-surface/80 transition-all">
                    {feat.icon}
                  </div>
                  <span className="text-[10px] font-mono tracking-widest text-agency-muted bg-agency-surface px-2 py-0.5 rounded border border-agency-border">
                    {feat.tag}
                  </span>
                </div>
                <CardTitle className="group-hover:text-agency-accent transition-colors">
                  {feat.title}
                </CardTitle>
                <CardDescription className="mt-2 text-sm leading-relaxed">
                  {feat.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
