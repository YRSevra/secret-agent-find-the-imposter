import React, { useState } from 'react';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Shield,
  HelpCircle,
  Vote,
  Target,
  Trophy,
  Swords,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { RoomAccessModal } from '../components/preview/RoomAccessModal';

export const HowToPlay: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('all');

  const guideTopics = [
    { id: 'overview', title: 'Mission Overview', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'roles', title: 'Operative Roles', icon: <Shield className="w-4 h-4" /> },
    { id: 'discussion', title: 'Q&A & Interrogation', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'voting', title: 'Voting & Elimination', icon: <Vote className="w-4 h-4" /> },
    { id: 'scoring', title: 'Scoring & Rounds', icon: <Trophy className="w-4 h-4" /> },
    { id: 'duel', title: 'Duel Mode (2P)', icon: <Swords className="w-4 h-4" /> },
  ];

  return (
    <div className="py-8 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <SectionHeading
        badge="AGENCY FIELD MANUAL"
        title="RULES OF"
        highlight="ENGAGEMENT"
        description="Comprehensive directive for intelligence operatives. Learn to decipher truth from fabrication, master subtle clues, and emerge triumphant."
      />

      {/* Quick Navigation Filter Bar */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4 mb-12 scrollbar-none">
        <button
          onClick={() => setActiveSection('all')}
          className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold tracking-wider shrink-0 transition-all border ${
            activeSection === 'all'
              ? 'bg-agency-accent text-agency-dark border-agency-accent shadow-glow-sm'
              : 'bg-agency-card text-agency-muted border-agency-border hover:text-white'
          }`}
        >
          FULL PROTOCOL
        </button>
        {guideTopics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => setActiveSection(topic.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold tracking-wider shrink-0 transition-all border ${
              activeSection === topic.id
                ? 'bg-agency-surface text-agency-accent border-agency-accent shadow-glow-sm'
                : 'bg-agency-card text-agency-muted border-agency-border hover:text-white'
            }`}
          >
            {topic.icon}
            <span>{topic.title}</span>
          </button>
        ))}
      </div>

      <div className="space-y-12">
        {/* 1. Mission Overview */}
        {(activeSection === 'all' || activeSection === 'overview') && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-black text-agency-accent">01 //</span>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                MISSION OVERVIEW & OBJECTIVE
              </h3>
            </div>

            <Card variant="default" className="p-6 sm:p-8">
              <p className="text-sm sm:text-base text-agency-muted leading-relaxed mb-6">
                <strong className="text-white">Secret Agent – Find the Imposter</strong> is a game
                of deception, observation, and communication. A team of operatives assembles in a
                private room. All loyal Agents receive a secret location or word; one randomly
                chosen player is the Imposter and receives nothing.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-agency-surface rounded-xl border border-agency-border">
                  <div className="flex items-center gap-2 text-agency-accent font-mono font-bold text-sm mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    AGENT VICTORY CONDITION
                  </div>
                  <p className="text-xs text-agency-muted leading-relaxed">
                    Identify and vote out the undercover Imposter during the emergency voting phase,
                    or force them into a desperate, inaccurate secret word guess.
                  </p>
                </div>

                <div className="p-4 bg-agency-surface rounded-xl border border-agency-border">
                  <div className="flex items-center gap-2 text-agency-warning font-mono font-bold text-sm mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    IMPOSTER VICTORY CONDITION
                  </div>
                  <p className="text-xs text-agency-muted leading-relaxed">
                    Survive all interrogation rounds without receiving the majority of elimination
                    votes, OR correctly deduce the secret location word before extraction.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 2. Operative Roles Explanation */}
        {(activeSection === 'all' || activeSection === 'roles') && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-black text-agency-accent">02 //</span>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                ROLE DOSSIERS & STRATEGY
              </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Agent Role Card */}
              <Card variant="interactive" withReticle className="space-y-4">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="classified" size="md" withDot>
                      LOYAL OPERATIVE
                    </Badge>
                    <span className="text-xs font-mono text-agency-accent">ROLE: AGENT</span>
                  </div>
                  <CardTitle className="text-2xl text-agency-accent">The Secret Agent</CardTitle>
                  <CardDescription>
                    Knows the classified location (e.g. "Space Station", "Submarine", "Casino Royale").
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-agency-surface rounded-lg text-xs space-y-1.5 border border-agency-border">
                    <span className="font-mono text-white font-bold block">TACTICAL PROTOCOL:</span>
                    <p className="text-agency-muted">
                      When questioned, provide an answer that reassures other agents you know the
                      secret word, but keep it nuanced enough so the Imposter cannot figure it out.
                    </p>
                  </div>
                  <div className="p-3 bg-agency-surface rounded-lg text-xs text-agency-muted flex items-start gap-2 border border-agency-border">
                    <Lightbulb className="w-4 h-4 text-agency-accent shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Pro Tip:</strong> Don't be too obvious! If the
                      secret word is "Hospital", saying "There are doctors everywhere" instantly
                      hands victory to the imposter.
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Imposter Role Card */}
              <Card variant="interactive" withReticle className="space-y-4">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="danger" size="md" withDot>
                      UNDERCOVER MOLE
                    </Badge>
                    <span className="text-xs font-mono text-agency-warning">ROLE: IMPOSTER</span>
                  </div>
                  <CardTitle className="text-2xl text-agency-warning">The Imposter</CardTitle>
                  <CardDescription>
                    Does NOT know the classified location. Screen displays "UNKNOWN // ACCESS DENIED".
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-agency-surface rounded-lg text-xs space-y-1.5 border border-agency-border">
                    <span className="font-mono text-white font-bold block">TACTICAL PROTOCOL:</span>
                    <p className="text-agency-muted">
                      Pay close attention to questions and answers. Craft plausible, adaptable
                      responses that sound believable in multiple environments while subtly probing for intel.
                    </p>
                  </div>
                  <div className="p-3 bg-agency-surface rounded-lg text-xs text-agency-muted flex items-start gap-2 border border-agency-border">
                    <Lightbulb className="w-4 h-4 text-agency-warning shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Pro Tip:</strong> If agents begin cornering
                      you with votes, you can trigger a "Decryption Hail Mary" to guess the secret word
                      for an instant upset victory!
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* 3. Discussion & Q&A Rules */}
        {(activeSection === 'all' || activeSection === 'discussion') && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-black text-agency-accent">03 //</span>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                INTERROGATION & QUESTION PROTOCOLS
              </h3>
            </div>

            <Card className="p-6 sm:p-8 space-y-6">
              <p className="text-sm text-agency-muted leading-relaxed">
                Interrogation proceeds through structured turn circles or open discussion timers.
                Agents address specific players with targeted inquiries:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-agency-surface rounded-xl border border-agency-border space-y-2">
                  <span className="text-xs font-mono text-agency-accent font-bold">RULE 1</span>
                  <h4 className="text-sm font-bold text-white">Direct Targeting</h4>
                  <p className="text-xs text-agency-muted leading-relaxed">
                    Player A poses a question directly to Player B. Player B cannot immediately
                    ask Player A back, keeping discussion dynamic.
                  </p>
                </div>

                <div className="p-4 bg-agency-surface rounded-xl border border-agency-border space-y-2">
                  <span className="text-xs font-mono text-agency-accent font-bold">RULE 2</span>
                  <h4 className="text-sm font-bold text-white">Subtle Answers</h4>
                  <p className="text-xs text-agency-muted leading-relaxed">
                    Answers must be truthful for agents, but phrased with enough ambiguity that the
                    imposter cannot easily guess the environment.
                  </p>
                </div>

                <div className="p-4 bg-agency-surface rounded-xl border border-agency-border space-y-2">
                  <span className="text-xs font-mono text-agency-accent font-bold">RULE 3</span>
                  <h4 className="text-sm font-bold text-white">Turn Clocks</h4>
                  <p className="text-xs text-agency-muted leading-relaxed">
                    Each interrogation turn has a countdown timer (typically 45–60 seconds). Fast
                    responses prevent awkward stalling.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 4. Voting & Identity Reveal */}
        {(activeSection === 'all' || activeSection === 'voting') && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-black text-agency-accent">04 //</span>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                VOTING ARENA & IDENTITY UNMASKING
              </h3>
            </div>

            <Card className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-base font-bold text-white font-mono flex items-center gap-2">
                    <Vote className="w-5 h-5 text-agency-warning" />
                    EMERGENCY SUMMIT VOTE
                  </h4>
                  <p className="text-xs sm:text-sm text-agency-muted leading-relaxed">
                    Once the interrogation rounds conclude or an operative triggers an early call,
                    the Voting Arena opens. Every operative casts a confidential vote targeting the
                    player they suspect is the Imposter.
                  </p>
                  <ul className="text-xs font-mono text-agency-muted space-y-2 list-disc list-inside">
                    <li>Votes are revealed simultaneously when the timer expires.</li>
                    <li>The player with the majority of votes is unmasked.</li>
                    <li>In the event of a tied vote, an emergency tie-breaker round initiates.</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-base font-bold text-white font-mono flex items-center gap-2">
                    <Target className="w-5 h-5 text-agency-accent" />
                    UNMASKING & LAST STAND
                  </h4>
                  <p className="text-xs sm:text-sm text-agency-muted leading-relaxed">
                    If the unmasked player is indeed the Imposter, they are given one final chance
                    to guess the secret location word. If their guess is accurate, they steal the round victory!
                  </p>
                  <div className="p-3 bg-agency-surface rounded-lg border border-agency-border text-xs text-agency-accent font-mono">
                    STATUS: Identity confirmed via Agency Terminal.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 5. Scoring & Three Rounds */}
        {(activeSection === 'all' || activeSection === 'scoring') && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-black text-agency-accent">05 //</span>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                THREE-ROUND CAMPAIGN & POINT MATRIX
              </h3>
            </div>

            <Card className="p-6 sm:p-8 space-y-6">
              <p className="text-sm text-agency-muted leading-relaxed">
                A match spans exactly <strong className="text-white">three rounds</strong>. Locations
                and imposter roles rotate each round. Scores accumulate across rounds to determine the
                overall Intelligence Champion.
              </p>

              {/* Scoring Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-agency-border text-agency-muted bg-agency-surface">
                      <th className="p-3">OUTCOME</th>
                      <th className="p-3">AGENT SCORE</th>
                      <th className="p-3">IMPOSTER SCORE</th>
                      <th className="p-3">BONUS CONDITION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-agency-border/60">
                    <tr className="hover:bg-agency-surface/40 transition-colors">
                      <td className="p-3 text-white font-bold">Imposter correctly unmasked</td>
                      <td className="p-3 text-agency-accent">+100 PTS each</td>
                      <td className="p-3 text-agency-muted">0 PTS</td>
                      <td className="p-3 text-agency-muted">+25 PTS for unanimous vote</td>
                    </tr>
                    <tr className="hover:bg-agency-surface/40 transition-colors">
                      <td className="p-3 text-white font-bold">Imposter escapes elimination</td>
                      <td className="p-3 text-agency-muted">0 PTS</td>
                      <td className="p-3 text-agency-accent">+200 PTS</td>
                      <td className="p-3 text-agency-muted">+50 PTS if zero votes received</td>
                    </tr>
                    <tr className="hover:bg-agency-surface/40 transition-colors">
                      <td className="p-3 text-white font-bold">Imposter unmasked but guesses secret word</td>
                      <td className="p-3 text-agency-muted">0 PTS</td>
                      <td className="p-3 text-agency-accent">+150 PTS</td>
                      <td className="p-3 text-agency-muted">Clutch Hail Mary bonus</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* 6. Duel Mode (2P) */}
        {(activeSection === 'all' || activeSection === 'duel') && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl font-black text-agency-accent">06 //</span>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                DUEL MODE (2-PLAYER SPECIAL PROTOCOL)
              </h3>
            </div>

            <Card variant="interactive" withReticle className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                    <Swords className="w-5 h-5 text-agency-accent" />
                    HEAD-TO-HEAD INTELLIGENCE CLASH
                  </h4>
                  <p className="text-xs sm:text-sm text-agency-muted mt-1">
                    Custom mechanics optimized specifically for intimate 2-player sessions.
                  </p>
                </div>
                <Badge variant="warning" size="md">
                  SPECIAL 2P RULES
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-agency-surface rounded-xl border border-agency-border">
                  <span className="font-mono text-xs text-agency-accent font-bold block mb-1">
                    CLUE CARDS MATRIX
                  </span>
                  <p className="text-xs text-agency-muted">
                    Players draw structured question prompts from agency dossiers to challenge each
                    other without voting dilution.
                  </p>
                </div>

                <div className="p-4 bg-agency-surface rounded-xl border border-agency-border">
                  <span className="font-mono text-xs text-agency-accent font-bold block mb-1">
                    BLUFF VERIFICATION
                  </span>
                  <p className="text-xs text-agency-muted">
                    At any point, either player can issue a formal "Call Bluff". If correct, you
                    win the duel round instantly.
                  </p>
                </div>

                <div className="p-4 bg-agency-surface rounded-xl border border-agency-border">
                  <span className="font-mono text-xs text-agency-accent font-bold block mb-1">
                    ASYMMETRIC AI DECOY
                  </span>
                  <p className="text-xs text-agency-muted">
                    Optional neutral agency intel reports drop during the duel to add misdirection
                    and depth.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Bottom Deploy CTA */}
        <div className="pt-8 text-center bg-agency-card border border-agency-border rounded-2xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-agency-accent to-transparent opacity-80" />
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            READY TO COMMENCE YOUR MISSION?
          </h3>
          <p className="text-sm text-agency-muted max-w-xl mx-auto mb-6">
            Assemble your operatives, spin up a secure room code, and put your deductive intuition to the test.
          </p>
          <Button
            variant="primary"
            size="lg"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => setIsModalOpen(true)}
          >
            ENTER MISSION TERMINAL
          </Button>
        </div>
      </div>

      {/* Room Access Modal */}
      <RoomAccessModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default HowToPlay;
