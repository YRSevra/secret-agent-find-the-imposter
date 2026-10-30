# Secret Agent – Find the Imposter

> A premium, real-time multiplayer browser social deduction game built with React, TypeScript, Vite, and Tailwind CSS.

---

## 1. Game Overview

**Secret Agent – Find the Imposter** is a modern browser-based social deduction experience designed for quick, frictionless play across devices with zero mandatory installation or account creation. Players connect in private game rooms, decipher who knows the classified briefing, and eliminate the imposter before their agency cover is blown.

### Key Highlights
- **Frictionless Access**: Instant entry via 6-character room codes. No account or download required.
- **Cross-Platform Responsive**: Flawless experience across mobile phones, tablets, laptops, and desktop monitors.
- **Adaptive Player Count**: Supports intimate 2-Player Duel Mode as well as Classic Party Mode for 3–8 players.
- **Classified Agency Aesthetic**: Immersive dark spy interface with terminal cues and intelligence badges.

---

## 2. Core Game Concept

1. **Room Assembly**: A host creates a private lobby with a unique 6-character room code; agents join effortlessly.
2. **Role Assignment**: Players receive secret roles: **Agent** or **Imposter**.
3. **Classified Briefing**: Agents are given a shared secret word/location. One randomly designated player is the Imposter and receives no secret word.
4. **Interrogation & Clues**: Players take turns asking questions, discussing clues, and scrutinizing each other's answers without explicitly giving away the secret word.
5. **Deduction & Voting**: Players cast classified votes on who they believe is the Imposter.
6. **Multi-Round Play**: Matches run through three structured rounds with dynamic scoring.
7. **Final Debrief**: An end-of-game leaderboard crowns the top operative.

---

## 3. Technology Stack

### Frontend Architecture
- **Framework**: [React 18](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with custom Classified Agency theme tokens
- **Icons**: [Lucide React](https://lucide.dev/)
- **Routing**: [React Router DOM v6](https://reactrouter.com/)
- **Audio Engine**: Web Audio API synthesized procedural SFX
- **Code Quality**: ESLint 9 (Flat Config) & Prettier-aligned linting

### Serverless Backend & Cloud Storage
- **Serverless API**: Netlify Functions (`/.netlify/functions/game`) powered by `@netlify/functions` and `@netlify/blobs`
- **Cloud Persistence**: Netlify Blobs (`secret-agent-rooms` store) with strong consistency (`consistency: 'strong'`)
- **Lambda Compatibility**: Automatic context initialization via `connectLambda(event)` for seamless zero-config cloud storage
- **Concurrency & Integrity**: Server-authoritative state transitions with version-incremented conditional writes
- **Local Fallback**: Local JSON persistence (`.netlify/blobs-local/rooms.json`) for offline development and local automated testing

---

## 4. Project Directory Structure

```text
MULTIPLAYER_GAME/
│
├── public/
│   ├── assets/              # Static media assets
│   ├── avatars/             # Player avatar icons
│   ├── sounds/              # Audio cues & effects
│   └── logo.svg             # Classified agency insignia
│
├── src/
│   ├── components/          # Reusable UI building blocks (Buttons, Modals, Cards, Avatars)
│   ├── pages/               # Top-level routes (Home, Connection, RoleReveal, Discussion, Voting, etc.)
│   ├── services/            # Client API services (`GameApiService` communicating with Netlify Function)
│   ├── server/              # Server-authoritative logic & storage
│   │   ├── roomManager.ts         # Room creation, joining, capacity & session tokens
│   │   ├── storage.ts             # Netlify Blobs strong-consistency persistence adapter
│   │   ├── roleAssignment.ts      # Cryptographic secret role & word assignment
│   │   ├── discussionManager.ts   # Interrogation turns & encrypted chat comms
│   │   ├── votingManager.ts       # Secret ballot voting, ties & second-tie elimination
│   │   ├── scoreManager.ts        # Tournament scoring engine
│   │   ├── rematchManager.ts      # Rematch states, history archive & host transfers
│   │   ├── finalResultsManager.ts # Leaderboard ranking & tactical merit calculation
│   │   └── security.ts            # Sanitization & token generation
│   ├── types/               # TypeScript data models, contracts & API payloads
│   ├── constants/           # Secret word banks, avatars, and configuration
│   ├── styles/              # Global & tactical design system CSS stylesheets
│   ├── App.tsx              # Application shell & route switchers
│   ├── main.tsx             # Application DOM entry point
│   └── index.css            # Tailwind directives & base styles
│
├── netlify/
│   └── functions/
│       └── game.ts          # Serverless entrypoint invoking `connectLambda` & `RoomManager`
│
├── netlify.toml             # Build commands, functions config, & SPA rewrite rules
├── package.json             # Dependencies and build/test scripts
├── package-lock.json        # Deterministic dependency lockfile
├── tsconfig.json            # Strict TypeScript configuration
├── vite.config.ts           # Vite bundler configuration & proxies
├── tailwind.config.js       # Classified Agency color theme
├── eslint.config.js         # ESLint configuration
├── index.html               # HTML entry point
├── .gitignore               # Ignored version-control artifacts
└── README.md                # Project documentation
```

---

## 5. Development Setup Instructions

### Prerequisites
- **Node.js**: v18.0.0+ (Tested on v24.x)
- **npm**: v9.0.0+ (Tested on v11.x)

### Installation
Clone or navigate to the project directory and install dependencies:

```bash
cd MULTIPLAYER_GAME
npm install
```

### Running Locally
To launch the Vite development server with hot module replacement (HMR):

```bash
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 6. Available npm Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local development server at `http://localhost:5173` |
| `npm run build` | Runs TypeScript compiler checks (`tsc -b`) and generates production assets in `dist/` |
| `npm run lint` | Analyzes code quality using ESLint |
| `npm run preview` | Locally serves the production build from `dist/` |

---

## 7. 12-Phase Development Roadmap

- [x] **Phase 1: Project Initialization & Professional Development Foundation** *(Completed)*
- [x] **Phase 2: Premium UI/UX Design & Visual Identity** *(Completed)*
- [x] **Phase 3: Real Multiplayer Room Management System** *(Completed)*
- [x] **Phase 4: Real-Time Waiting Lobby & Player Management** *(Completed)*
- [x] **Phase 5: Secure Secret Role Assignment & Imposter Engine** *(Completed)*
- [x] **Phase 6: Real-Time Question Turns, Answers & Live Discussion** *(Completed)*
- [x] **Phase 7: Secure Voting System & Imposter Elimination Engine** *(Completed)*
- [x] **Phase 8: Scoring System, Three-Round Match & Auto-Transitions** *(Completed)*
- [x] **Phase 9: Final Match Leaderboard, Champions & Victory Celebration** *(Completed)*
- [x] **Phase 10: Rematch, Play Again & Complete Room Lifecycle** *(Completed)*
- [x] **Phase 11: End-to-End Testing, Cross-Device Polish & Production Readiness** *(Completed)*
- [x] **Phase 12: Production Deployment, Release Packages & Handshake Submission** *(Completed)*

---

## 8. Automated Testing & Verification

The test suite runs 100% server-authoritatively across all completed gameplay phases:

```bash
# Run all verification test suites (Phases 3 through 11)
npm test

# Run individual phase suites
npm run test:phase3   # Room Management
npm run test:phase4   # Waiting Lobby
npm run test:phase5   # Role Assignment
npm run test:phase6   # Interrogation Arena
npm run test:phase7   # Secret Ballot Voting
npm run test:phase8   # 3-Round Tournament & Scoring
npm run test:phase9   # Final Leaderboard & Awards
npm run test:phase10  # Rematch & Room Lifecycle
npm run test:phase11  # E2E Multi-Client Integration

# Code Quality Checks
npm run lint          # ESLint (0 errors, 0 warnings)
npm run build         # TypeScript compilation & production bundling
```

---

## 9. Production Deployment & Deliverables

Release packages and documentation are available in `RELEASE/`:
- `RELEASE/Secret-Agent-Production-Deployment.zip` (Deployable production bundle)
- `RELEASE/Secret-Agent-Source-Code.zip` (Complete clean source codebase)
- `RELEASE/DEPLOYMENT-GUIDE.md` (Step-by-step Netlify deployment manual)
- `RELEASE/PRODUCTION-CHECKLIST.md` (Production readiness verification checklist)
- `RELEASE/RELEASE-NOTES.md` (Version 1.0.0 release changelog)
- `HANDSHAKE-MISSION-SUBMISSION.md` (Submission-ready briefing and demo script)
