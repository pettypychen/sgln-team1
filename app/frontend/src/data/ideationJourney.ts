import type { IconName } from "@/components/journey/icons";

/** One raw idea from the divergence exercise. */
export interface JourneyIdea {
  name: string;
  description: string;
}

/** A themed cluster of ideas, with its accent color from the token palette. */
export interface JourneyTheme {
  name: string;
  /** Accent hex — drawn from the tailwind token palette (teal/analyst/etc.). */
  color: string;
  ideas: JourneyIdea[];
}

export interface ConvergeStep {
  title: string;
  description: string;
}

export interface FunnelStage {
  count: number;
  label: string;
  /** Relative width of the stage bar, 0–1. */
  width: number;
}

export interface Finalist {
  name: string;
  description: string;
  winner?: boolean;
  /** Winning criteria shown on the winner card. */
  strengths?: string[];
}

export interface IdeaPillar {
  icon: IconName;
  title: string;
  description: string;
  bold: string;
  tags: string[];
}

export interface FlowStep {
  step: string;
  title: string;
  description: string;
}

export interface RoadmapItem {
  icon: IconName;
  title: string;
  description: string;
}

export interface JourneySection {
  id: string;
  label: string;
}

/** Anchor targets for the in-page journey nav. */
export const JOURNEY_SECTIONS: JourneySection[] = [
  { id: "challenge", label: "Challenge" },
  { id: "ideas", label: "27 ideas" },
  { id: "narrow", label: "Narrowing" },
  { id: "finalists", label: "Front-runners" },
  { id: "idea", label: "The idea" },
  { id: "next", label: "What's next" },
];

export const JOURNEY_THEMES: JourneyTheme[] = [
  {
    name: "Simulation & practice",
    color: "#2f9e5f",
    ideas: [
      {
        name: "Workplace Flight Simulator",
        description:
          "A safe environment where trainees deliver real work artefacts on realistic workflows — with feedback at every step.",
      },
      {
        name: "Deliberate-practice gym",
        description:
          "A structured space to drill specific professional skills repeatedly, the way athletes train.",
      },
      {
        name: "Decade-long simulation",
        description:
          "A long-horizon simulation that compresses years of career decisions into a single guided experience.",
      },
      {
        name: "Competency-based progression",
        description:
          "Advance by demonstrating mastery of skills, not by time served.",
      },
    ],
  },
  {
    name: "Mentorship & transfer",
    color: "#4a9fd8",
    ideas: [
      {
        name: "WorkflowStore",
        description:
          "A shared library where experienced professionals publish their workflows for others to learn from and reuse.",
      },
      {
        name: "Apprenticeship 2.0",
        description:
          "A modern apprenticeship pairing juniors with seniors on real, accountable work.",
      },
      {
        name: "10,000-hour debt swap",
        description:
          "Juniors trade effort for senior mentorship — exchanging hours to build expertise faster.",
      },
      {
        name: "Capability mesh",
        description:
          "A network that maps who knows what, so knowledge finds the people who need it.",
      },
    ],
  },
  {
    name: "Real-world exposure",
    color: "#c1673c",
    ideas: [
      {
        name: "Startup founder mandate",
        description:
          "Graduates create their own job by starting something — learning by owning the outcome.",
      },
      {
        name: "Internships",
        description:
          "Structured placements that put graduates inside real teams doing real work.",
      },
      {
        name: "National Graduate Tour of Duty",
        description:
          "A national programme rotating graduates through different organisations to broaden exposure.",
      },
      {
        name: "Rotations",
        description:
          "Move across functions in fixed cycles to build breadth before depth.",
      },
    ],
  },
  {
    name: "Human + AI dynamics",
    color: "#d98d5f",
    ideas: [
      {
        name: "AI orchestrators",
        description:
          "Humans direct and stay accountable for AI output, rather than being replaced by it.",
      },
      {
        name: "Adversarial specialists",
        description:
          "Sharpen judgment by challenging and stress-testing AI work rather than accepting it.",
      },
      {
        name: "Fix-the-broken-AI",
        description:
          "Learn by diagnosing and repairing flawed AI output — reverse-engineering what good work looks like.",
      },
      {
        name: "AI-free zones",
        description:
          "Protected time where work is done without AI, so foundational skills still get built.",
      },
      {
        name: "AI gets fired at noon",
        description:
          "AI is switched off midday, forcing people to build and defend their own thinking.",
      },
    ],
  },
  {
    name: "Systemic & cultural",
    color: "#242424",
    ideas: [
      {
        name: "Government-backed apprenticeships",
        description:
          "State-supported apprenticeship schemes that de-risk hiring juniors for employers.",
      },
      {
        name: "Learning-velocity culture",
        description:
          "Make how fast someone learns the thing organisations hire and reward for.",
      },
      {
        name: "Graduate guild",
        description:
          "A professional guild that vouches for, supports, and develops early-career members.",
      },
      {
        name: "Redesign work itself",
        description:
          "Rethink how jobs are structured so meaningful early-career work still exists.",
      },
    ],
  },
];

export const CONVERGE_STEPS: ConvergeStep[] = [
  {
    title: "Objective scoring",
    description:
      "We used Claude to score all 27 ideas against a shared set of criteria — feasibility, impact, fit.",
  },
  {
    title: "Team voting with rationale",
    description:
      "Each of us voted and wrote down why — surfacing conviction, not just scores.",
  },
];

export const CONVERGE_INSIGHT =
  "judgment is built by doing real work with feedback. Several front-runners — the deliberate-practice gym, competency-based progression, the decade-long simulation — were variants of the same concept.";

export const FUNNEL_STAGES: FunnelStage[] = [
  { count: 27, label: "raw ideas", width: 1 },
  { count: 5, label: "themed clusters", width: 0.8 },
  { count: 3, label: "front-runners", width: 0.58 },
  { count: 1, label: "to build", width: 0.36 },
];

export const FINALISTS: Finalist[] = [
  {
    name: "AI Orchestrators",
    description:
      "Humans stay accountable for AI output — directing the work rather than being replaced by it.",
  },
  {
    name: "Startup Founder mandate",
    description:
      "Create your own job — take control of what you can when traditional entry paths close.",
  },
  {
    name: "Workplace Flight Simulator",
    description: "",
    winner: true,
    strengths: [
      "Builds judgment through doing",
      "Teaches AI through application",
      "De-risks hiring for employers",
    ],
  },
];

export const IDEA_INTRO =
  "Pilots log hundreds of hours in a simulator before they ever fly a real plane. Graduates should get the same — a safe place to build judgment on real work before the stakes are real.";

export const IDEA_PILLARS: IdeaPillar[] = [
  {
    icon: "computer",
    title: "The simulation",
    description:
      "on realistic workflows — a legal filing, a set of accounts — with feedback at every step.",
    bold: "Trainees deliver actual work artefacts",
    tags: ["Legal use cases", "Accounting use cases"],
  },
  {
    icon: "shield-check",
    title: "The accreditation layer",
    description:
      "— plus a suggested progression pathway for what to master next.",
    bold: "Completed simulations become portable, verifiable credentials",
    tags: ["LinkedIn-portable", "Employer view", "Careers & Skills Passport · SWDA"],
  },
];

export const SWDA_INTRO_BOLD = "Skills and Workforce Development Agency (SWDA)";

export const SWDA_FLOW: FlowStep[] = [
  {
    step: "Step 1",
    title: "Earn the credential",
    description:
      "Finish a workplace flight simulation and receive a verifiable credential.",
  },
  {
    step: "Step 2",
    title: "Store it in the CSP",
    description:
      "SWDA enables it to be held in the Careers & Skills Passport (CSP).",
  },
  {
    step: "Step 3",
    title: "Apply for jobs",
    description:
      "CSP's integrations with job portals like Seek (JobsDB) attach the credential to applications.",
  },
  {
    step: "Step 4",
    title: "Employers verify",
    description:
      "Employers confirm the applicant completed the simulations and holds the skills the role needs.",
  },
];

export const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    icon: "git-fork",
    title: "WorkflowStore",
    description:
      "veterans contribute workflows like open-source repos; SMEs install the ones they need.",
  },
  {
    icon: "community",
    title: "Intelligent pairing",
    description:
      "match mentors and mentees on the skills each is building.",
  },
];
