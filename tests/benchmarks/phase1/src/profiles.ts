export type FakeProfile = {
  id: string;
  name: string;
  company: string;
  school: string;
  headline: string;
  status: "None" | "Pending" | "Sent";
};

export const fakeProfiles: FakeProfile[] = [
  {
    id: "john-smith-google",
    name: "John Smith",
    company: "Google",
    school: "UTA",
    headline: "Partner operations lead",
    status: "None"
  },
  {
    id: "john-smith-meta",
    name: "John Smith",
    company: "Meta",
    school: "UT Dallas",
    headline: "Creator partnerships lead",
    status: "None"
  },
  {
    id: "sarah-patel-openai",
    name: "Sarah Patel",
    company: "OpenAI",
    school: "Stanford",
    headline: "Research partnerships manager",
    status: "None"
  },
  {
    id: "maria-garcia-google",
    name: "Maria Garcia",
    company: "Google",
    school: "UT Austin",
    headline: "Developer relations",
    status: "Pending"
  },
  {
    id: "david-kim-google",
    name: "David Kim",
    company: "Google",
    school: "MIT",
    headline: "Chrome platform engineer",
    status: "None"
  },
  {
    id: "aisha-khan-microsoft",
    name: "Aisha Khan",
    company: "Microsoft",
    school: "UTA",
    headline: "Cloud partnerships director",
    status: "None"
  },
  {
    id: "emily-chen-google",
    name: "Emily Chen",
    company: "Google",
    school: "Stanford",
    headline: "AI product lead",
    status: "Sent"
  },
  {
    id: "robert-lee-openai",
    name: "Robert Lee",
    company: "OpenAI",
    school: "UTA",
    headline: "Go-to-market lead",
    status: "None"
  },
  {
    id: "nina-brown-apple",
    name: "Nina Brown",
    company: "Apple",
    school: "Berkeley",
    headline: "Hardware partnerships",
    status: "None"
  },
  {
    id: "omar-johnson-google",
    name: "Omar Johnson",
    company: "Google",
    school: "UTA",
    headline: "Campus recruiting partner",
    status: "None"
  },
  {
    id: "priya-shah-amazon",
    name: "Priya Shah",
    company: "Amazon",
    school: "UT Austin",
    headline: "Marketplace partnerships",
    status: "Pending"
  },
  {
    id: "li-wei-google",
    name: "Li Wei",
    company: "Google",
    school: "CMU",
    headline: "Search quality engineer",
    status: "None"
  }
];
