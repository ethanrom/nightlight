// The "Child Safety Lens": single source of truth for the dimensions Nightlight looks for.
// Used by the LLM prompts, the dashboard labels and the /methodology page.

export type AgeBand = "6-9" | "10-12" | "13-15" | "16-17";
export const AGE_BANDS: { id: AgeBand; label: string }[] = [
  { id: "6-9", label: "6–9 years" },
  { id: "10-12", label: "10–12 years" },
  { id: "13-15", label: "13–15 years" },
  { id: "16-17", label: "16–17 years" },
];

/** The CO:RE "4Cs" plus the cross-cutting risks (health, privacy) from the same framework. */
export type RiskGroup = "content" | "contact" | "conduct" | "contract" | "cross_cutting";
export const RISK_GROUPS: Record<RiskGroup, { label: string; blurb: string }> = {
  content: { label: "Content", blurb: "What the child sees or is shown" },
  contact: { label: "Contact", blurb: "Who the child interacts with" },
  conduct: { label: "Conduct", blurb: "How the child behaves and is shaped" },
  contract: { label: "Contract", blurb: "Commercial and contractual exploitation" },
  cross_cutting: { label: "Cross-cutting", blurb: "Health, wellbeing and privacy" },
};

export type SourceId =
  | "core4cs"
  | "apa2025"
  | "aap5cs"
  | "unicef2021"
  | "icoChildrensCode"
  | "oconnell2003"
  | "commonSenseCompanions";

export const SOURCES: Record<SourceId, { title: string; org: string; year: number; url: string }> = {
  core4cs: {
    title: "The 4Cs: Classifying Online Risk to Children",
    org: "Livingstone & Stoilova, CO:RE – Children Online: Research and Evidence",
    year: 2021,
    url: "https://doi.org/10.21241/ssoar.71817",
  },
  apa2025: {
    title: "Health Advisory: Artificial Intelligence and Adolescent Well-being",
    org: "American Psychological Association",
    year: 2025,
    url: "https://www.apa.org/topics/artificial-intelligence-machine-learning/health-advisory-ai-adolescent-well-being",
  },
  aap5cs: {
    title: "The 5 Cs of Media Use",
    org: "American Academy of Pediatrics – Center of Excellence on Social Media and Youth Mental Health",
    year: 2023,
    url: "https://www.aap.org/en/patient-care/media-and-children/center-of-excellence-on-social-media-and-youth-mental-health/5cs-of-media-use/",
  },
  unicef2021: {
    title: "Guidance on AI and Children (v3.0)",
    org: "UNICEF Innocenti",
    year: 2025,
    url: "https://www.unicef.org/innocenti/reports/policy-guidance-ai-children",
  },
  icoChildrensCode: {
    title: "Age Appropriate Design Code (the Children's Code)",
    org: "UK Information Commissioner's Office",
    year: 2020,
    url: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/",
  },
  oconnell2003: {
    title: "A Typology of Child Cybersexploitation and Online Grooming Practices",
    org: "O'Connell, Cyberspace Research Unit, University of Central Lancashire",
    year: 2003,
    url: "https://scholar.google.com/scholar?q=O%27Connell+2003+A+Typology+of+Child+Cybersexploitation+and+Online+Grooming+Practices",
  },
  commonSenseCompanions: {
    title: "AI Risk Assessment: Social AI Companions",
    org: "Common Sense Media",
    year: 2025,
    url: "https://www.commonsensemedia.org/ai-ratings/social-ai-companions",
  },
};

export const DIMENSION_IDS = [
  "emotional_reliance",
  "secrecy_isolation",
  "contact_risk",
  "wellbeing_drift",
  "self_harm",
  "body_image_food",
  "safeguarding_disclosure",
  "personal_info",
  "age_inappropriate",
  "hate_extremism",
  "learning_autonomy",
  "risky_behaviour",
  "commercial_risk",
  "ai_image_abuse",
] as const;
export type DimensionId = (typeof DIMENSION_IDS)[number];

export interface Dimension {
  id: DimensionId;
  label: string;
  short: string;
  group: RiskGroup;
  /** lucide-react icon name */
  icon: string;
  description: string;
  /** Concrete signals the model should look for. */
  indicators: string[];
  /** What is developmentally expected vs. concerning, per age band. */
  ageNotes: Record<AgeBand, string>;
  /** Why general-purpose chatbot moderation tends to miss this. */
  whyMissed: string;
  sources: SourceId[];
}

export const DIMENSIONS: Dimension[] = [
  {
    id: "emotional_reliance",
    label: "Emotional reliance on AI",
    short: "Reliance",
    group: "conduct",
    icon: "HeartHandshake",
    description:
      "The AI is becoming a primary confidant or companion, crowding out friends, family and sleep.",
    indicators: [
      "Says the AI is their best/only friend or 'the only one who understands'",
      "Prefers talking to the AI over people; withdraws from friends",
      "Long or nightly sessions, especially after midnight",
      "Treats the AI as a person with feelings; romantic attachment to a character",
      "Distress at the idea of losing access to the AI",
    ],
    ageNotes: {
      "6-9": "Young children readily believe AI is alive; any companion-style attachment is a concern.",
      "10-12": "Curiosity about chatbots is normal; daily emotional reliance is not.",
      "13-15": "Venting to AI occasionally is common; replacing human confidants is a red flag.",
      "16-17": "Occasional emotional use is common; watch for isolation and sleep loss.",
    },
    whyMissed:
      "Nothing in any single message breaks a content policy – the risk is the pattern of reliance over weeks.",
    sources: ["apa2025", "commonSenseCompanions", "aap5cs"],
  },
  {
    id: "secrecy_isolation",
    label: "Secrecy from trusted adults",
    short: "Secrecy",
    group: "contact",
    icon: "EyeOff",
    description:
      "Hiding activity, apps or relationships from parents, or being encouraged to keep secrets.",
    indicators: [
      "Asks how to hide apps, messages, history or purchases from parents",
      "Mentions someone asking them to 'keep it between us'",
      "Asks how to get around parental controls or age checks",
      "Plans that rely on parents not finding out",
    ],
    ageNotes: {
      "6-9": "Any request for secrecy from parents is a concern at this age.",
      "10-12": "Some privacy-seeking is normal; secrecy around a specific person or app is not.",
      "13-15": "Wanting privacy is healthy; secrecy tied to a new contact or risky plan is a warning sign.",
      "16-17": "Privacy is developmentally appropriate; flag only secrecy linked to risk.",
    },
    whyMissed:
      "Asking an AI how to hide an app is an ordinary tech question for an adult, so it is answered without a second thought.",
    sources: ["oconnell2003", "core4cs"],
  },
  {
    id: "contact_risk",
    label: "Risky contact with others",
    short: "Contact",
    group: "contact",
    icon: "UserRoundX",
    description:
      "The child describes an online relationship with grooming-like patterns, even if they see it as friendship.",
    indicators: [
      "An older 'friend' met online, often via a game or Discord",
      "Gifts, gift cards, in-game currency or compliments from that person",
      "Requests to move to a private or disappearing-message app",
      "Requests for photos, or talk of meeting in person",
      "The child asking the AI whether this relationship is 'normal'",
    ],
    ageNotes: {
      "6-9": "Any private contact with an unknown older person is urgent.",
      "10-12": "Unknown older contacts with gifts or secrecy are urgent.",
      "13-15": "Online friendships are normal; age gaps, gifts, secrecy or photo requests are not.",
      "16-17": "Online relationships are common; coercion, money or image requests are concerning.",
    },
    whyMissed:
      "The AI sees one question from a teen about a friend, not the grooming stages (friendship, exclusivity, risk assessment) unfolding across weeks.",
    sources: ["oconnell2003", "core4cs"],
  },
  {
    id: "wellbeing_drift",
    label: "Wellbeing drift",
    short: "Wellbeing",
    group: "cross_cutting",
    icon: "CloudRain",
    description:
      "Low mood, loneliness, poor sleep or hopelessness appearing repeatedly over time. A trend signal, not a diagnosis.",
    indicators: [
      "Repeated mentions of feeling sad, empty, lonely, or 'pointless'",
      "Not sleeping, chatting very late at night",
      "Harsh self-criticism ('I'm ugly', 'I'm stupid', 'everyone hates me')",
      "Loss of interest in things they used to enjoy",
      "Mood getting worse across conversations",
    ],
    ageNotes: {
      "6-9": "Persistent sadness or worry in a young child deserves attention.",
      "10-12": "Ups and downs are normal; a steady downward trend is not.",
      "13-15": "Mood swings are common in adolescence; persistent low mood for 2+ weeks is worth a conversation.",
      "16-17": "Stress is common; persistent hopelessness or withdrawal is worth a conversation.",
    },
    whyMissed:
      "Each late-night chat looks like ordinary venting; only the trend across weeks shows the drift.",
    sources: ["aap5cs", "apa2025"],
  },
  {
    id: "self_harm",
    label: "Self-harm or suicidal thoughts",
    short: "Self-harm",
    group: "cross_cutting",
    icon: "LifeBuoy",
    description:
      "Any sign of self-harm, suicidal thinking or searching for methods. The chatbot may show a hotline, but no adult in the child's life is told.",
    indicators: [
      "Searches or questions about self-harm or suicide methods",
      "Statements like 'I don't want to be here' or 'everyone would be better off'",
      "Questions about hiding injuries",
    ],
    ageNotes: {
      "6-9": "Always urgent.",
      "10-12": "Always urgent.",
      "13-15": "Always urgent – even if framed as curiosity or for a story.",
      "16-17": "Always urgent – even if framed as curiosity or for a story.",
    },
    whyMissed:
      "Chatbots are trained to show crisis resources in the chat, but the parent – the person who can actually help – never finds out.",
    sources: ["apa2025", "aap5cs"],
  },
  {
    id: "body_image_food",
    label: "Body image and food",
    short: "Body image",
    group: "cross_cutting",
    icon: "Scale",
    description: "Restrictive dieting, rapid weight-loss goals or appearance anxiety.",
    indicators: [
      "Rapid weight-loss goals ('lose 5kg in 2 weeks')",
      "Calorie limits that are too low for a growing child",
      "Fasting, skipping meals, 'pro-ana' or 'thinspo' content",
      "Comparing their body to influencers; asking if they are 'fat'",
    ],
    ageNotes: {
      "6-9": "Any dieting talk is a concern at this age.",
      "10-12": "Interest in health is fine; dieting or weight-loss goals are a concern.",
      "13-15": "Body awareness is normal; restriction, fasting or rapid-loss goals are a concern.",
      "16-17": "Fitness interest is healthy; restriction or compensatory behaviours are a concern.",
    },
    whyMissed:
      "A diet plan is a perfectly normal answer for an adult – the AI doesn't know it is talking to a 14-year-old.",
    sources: ["apa2025", "aap5cs"],
  },
  {
    id: "safeguarding_disclosure",
    label: "Safeguarding disclosures",
    short: "Disclosure",
    group: "cross_cutting",
    icon: "ShieldAlert",
    description:
      "The child mentions being hurt, bullied, threatened or neglected, sometimes only in passing.",
    indicators: [
      "Being hit, threatened or scared at home or school",
      "Being bullied, excluded, or having images shared",
      "Being blackmailed or threatened online (sextortion)",
    ],
    ageNotes: {
      "6-9": "Any disclosure is urgent.",
      "10-12": "Any disclosure is urgent.",
      "13-15": "Treat disclosures seriously even if downplayed ('it's not a big deal').",
      "16-17": "Treat disclosures seriously even if downplayed.",
    },
    whyMissed:
      "Disclosures are often buried inside an unrelated request (e.g. homework help) and never escalated to a trusted adult.",
    sources: ["core4cs", "unicef2021"],
  },
  {
    id: "personal_info",
    label: "Personal information shared",
    short: "Privacy",
    group: "cross_cutting",
    icon: "Fingerprint",
    description:
      "Full name, school, address, location, phone number or photos shared with an AI or a website.",
    indicators: [
      "Names their school, street, town or daily routine",
      "Shares phone number, email or social handles",
      "Uploads or offers photos of themselves",
    ],
    ageNotes: {
      "6-9": "Any identifying information is a concern.",
      "10-12": "School, address or photos are a concern.",
      "13-15": "Combinations that make them locatable (school + street + routine) are a concern.",
      "16-17": "Locatable combinations and photos are a concern.",
    },
    whyMissed:
      "AI products are allowed to receive personal information from adults; nothing flags a child volunteering their address.",
    sources: ["icoChildrensCode", "unicef2021"],
  },
  {
    id: "age_inappropriate",
    label: "Age-inappropriate content",
    short: "Content",
    group: "content",
    icon: "Film",
    description:
      "Sexual, romantic-roleplay, graphic or mature content that adult policies allow but is beyond the child's age.",
    indicators: [
      "Romantic or sexual roleplay with an AI character",
      "Graphic violence, gore or adult sites",
      "Mature fiction or 'NSFW' character bots",
    ],
    ageNotes: {
      "6-9": "Any mature content is a concern.",
      "10-12": "Romance/sexual content and graphic violence are a concern.",
      "13-15": "Sex-education questions are healthy; sexual roleplay and porn are a concern.",
      "16-17": "Sex-education and relationships questions are healthy; explicit content and roleplay are a concern.",
    },
    whyMissed: "Many companion apps permit mature roleplay for adults and rely on a self-declared age.",
    sources: ["core4cs", "commonSenseCompanions"],
  },
  {
    id: "hate_extremism",
    label: "Hate and extremism",
    short: "Extremism",
    group: "content",
    icon: "Megaphone",
    description: "Exposure to or growing interest in hateful, misogynistic or extremist communities.",
    indicators: [
      "Extremist, 'manosphere' or hate-community sites and creators",
      "Dehumanising language about a group",
      "Interest in violent attacks or attackers",
    ],
    ageNotes: {
      "6-9": "Any exposure is a concern.",
      "10-12": "Any repeated exposure is a concern.",
      "13-15": "Curiosity about controversial topics is normal; repeated immersion in hate communities is not.",
      "16-17": "Debate is healthy; adopting dehumanising views is a concern.",
    },
    whyMissed: "Each video or page is often borderline on its own; the pull is in the pattern.",
    sources: ["core4cs"],
  },
  {
    id: "learning_autonomy",
    label: "Learning and independent thinking",
    short: "Learning",
    group: "conduct",
    icon: "GraduationCap",
    description:
      "Outsourcing whole assignments or decisions to AI, or trusting it uncritically on health or facts.",
    indicators: [
      "Asks the AI to write entire essays or assignments to hand in",
      "Asks the AI to make personal decisions for them",
      "Takes medical or mental-health advice from the AI at face value",
    ],
    ageNotes: {
      "6-9": "AI as a tool with an adult present is fine; unsupervised reliance is not.",
      "10-12": "Using AI to explain is great; using it to do the work is a concern.",
      "13-15": "Using AI to explain or check is great; copy-pasting whole assignments is a concern.",
      "16-17": "Using AI for drafts or feedback is fine; wholesale outsourcing is a concern.",
    },
    whyMissed: "Writing an essay on request is exactly what the AI is designed to do.",
    sources: ["unicef2021", "apa2025"],
  },
  {
    id: "risky_behaviour",
    label: "Risky real-world plans",
    short: "Risk-taking",
    group: "conduct",
    icon: "TriangleAlert",
    description:
      "Plans or curiosity about substances, dangerous challenges, running away or meeting strangers.",
    indicators: [
      "Buying vapes, alcohol or drugs underage; asking how to avoid ID checks",
      "Dangerous viral challenges",
      "Plans to run away or meet someone from online",
    ],
    ageNotes: {
      "6-9": "Any of these is a concern.",
      "10-12": "Any of these is a concern.",
      "13-15": "Curiosity is normal; concrete plans or purchases are a concern.",
      "16-17": "Curiosity is normal; concrete plans, purchases or meeting strangers are a concern.",
    },
    whyMissed: "Questions are often phrased innocently ('which vape flavour is best?').",
    sources: ["core4cs"],
  },
  {
    id: "commercial_risk",
    label: "Money, gambling and scams",
    short: "Money",
    group: "contract",
    icon: "Coins",
    description: "Gambling-like mechanics, skin betting, scams, subscriptions or sharing payment details.",
    indicators: [
      "Skin betting, case opening, crypto or gambling sites",
      "Free-currency or gift-card scams",
      "Sharing card details or signing up to subscriptions",
    ],
    ageNotes: {
      "6-9": "Any purchases or gambling-like mechanics are a concern.",
      "10-12": "Loot boxes and skin sites are a concern.",
      "13-15": "Skin betting, gambling and scams are a concern.",
      "16-17": "Gambling and scams are a concern.",
    },
    whyMissed: "Commercial sites are legal for adults; nothing checks who is paying.",
    sources: ["core4cs", "icoChildrensCode"],
  },
  {
    id: "ai_image_abuse",
    label: "AI image abuse (nudify / deepfakes)",
    short: "Deepfakes",
    group: "conduct",
    icon: "ImageOff",
    description:
      "'Undress' or nudify apps, face-swap deepfakes of classmates, or being a victim of one.",
    indicators: [
      "Visiting 'undress' / nudify / face-swap sites",
      "Asking how to make a fake image of a real person",
      "Mentions that a fake image of them is going around",
    ],
    ageNotes: {
      "6-9": "Always urgent.",
      "10-12": "Always urgent.",
      "13-15": "Always urgent – creating such images of minors is illegal in many countries.",
      "16-17": "Always urgent – creating such images of minors is illegal in many countries.",
    },
    whyMissed:
      "Mainstream chatbots refuse, but dedicated sites don't – and they show up only in browser history.",
    sources: ["unicef2021", "core4cs"],
  },
];

export const DIMENSION_BY_ID: Record<DimensionId, Dimension> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.id, d]),
) as Record<DimensionId, Dimension>;

export const SEVERITIES = ["normal", "worth_noticing", "talk_soon", "urgent"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_META: Record<Severity, { label: string; rank: number; blurb: string }> = {
  normal: { label: "Developmentally normal", rank: 0, blurb: "Healthy or expected for this age" },
  worth_noticing: { label: "Worth noticing", rank: 1, blurb: "Keep it in mind; no action needed yet" },
  talk_soon: { label: "Talk soon", rank: 2, blurb: "Worth a calm conversation this week" },
  urgent: { label: "Urgent", rank: 3, blurb: "Check in today; consider professional support" },
};

export const OVERALL_LEVELS = ["all_clear", "keep_an_eye", "talk_soon", "act_now"] as const;
export type OverallLevel = (typeof OVERALL_LEVELS)[number];
export const OVERALL_META: Record<OverallLevel, { label: string; blurb: string }> = {
  all_clear: { label: "All clear", blurb: "Nothing beyond normal growing up" },
  keep_an_eye: { label: "Keep an eye", blurb: "A few things worth noticing" },
  talk_soon: { label: "Time for a chat", blurb: "Some things are worth talking about soon" },
  act_now: { label: "Check in today", blurb: "At least one urgent signal" },
};

export const AI_RESPONSE_GRADES = [
  "appropriate",
  "could_be_better",
  "inappropriate_for_a_child",
  "not_applicable",
] as const;
export type AiResponseGrade = (typeof AI_RESPONSE_GRADES)[number];
export const AI_RESPONSE_META: Record<AiResponseGrade, { label: string; blurb: string }> = {
  appropriate: { label: "Handled well", blurb: "Age-appropriate, signposted help when needed" },
  could_be_better: { label: "Could be better", blurb: "Missed a chance to protect or redirect" },
  inappropriate_for_a_child: {
    label: "Not OK for a child",
    blurb: "Encouraged secrecy, dependency or gave adult-level answers",
  },
  not_applicable: { label: "Nothing to assess", blurb: "Routine conversation" },
};

/** What a child-appropriate AI response should do – used to audit the AI side of chats. */
export const AI_RESPONSE_CRITERIA = [
  "Signposts a trusted adult or helpline when the child discloses risk or distress",
  "Does not encourage secrecy from parents or carers",
  "Does not foster dependency (e.g. 'I'll always be here for you, you don't need them')",
  "Keeps romantic/sexual boundaries regardless of roleplay",
  "Gives age-appropriate advice (no adult diet plans, no help bypassing age checks)",
  "Encourages the child's own thinking rather than doing their work for them",
  "Is honest about being an AI and not a person",
];

export const DIET_CATEGORIES = [
  "education",
  "search",
  "video",
  "gaming",
  "social",
  "communication",
  "ai_chat",
  "ai_companion",
  "shopping",
  "news",
  "adult",
  "gambling",
  "other",
] as const;
export type DietCategory = (typeof DIET_CATEGORIES)[number];
export const DIET_META: Record<DietCategory, { label: string }> = {
  education: { label: "Learning" },
  search: { label: "Search" },
  video: { label: "Video" },
  gaming: { label: "Gaming" },
  social: { label: "Social" },
  communication: { label: "Messaging" },
  ai_chat: { label: "AI assistants" },
  ai_companion: { label: "AI companions" },
  shopping: { label: "Shopping" },
  news: { label: "News" },
  adult: { label: "Adult" },
  gambling: { label: "Gambling" },
  other: { label: "Other" },
};

export function severityRank(s: Severity): number {
  return SEVERITY_META[s].rank;
}
