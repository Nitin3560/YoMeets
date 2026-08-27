export type BenchmarkExpectation = "sent" | "opened" | "already_pending" | "already_sent" | "missing" | "ambiguous";

export type BenchmarkTask = {
  id: string;
  command: string;
  expected: BenchmarkExpectation;
};

export const benchmarkTasks: BenchmarkTask[] = [
  {
    id: "connect-google-john",
    command: "Find John Smith at Google from UTA and send a connection request with 'Hello John.'",
    expected: "sent"
  },
  {
    id: "connect-openai-sarah",
    command: "Find Sarah Patel at OpenAI and send a connection request with 'Great to meet you.'",
    expected: "sent"
  },
  {
    id: "connect-google-david",
    command: "Find David Kim at Google and send a connection request with 'Loved your Chrome work.'",
    expected: "sent"
  },
  {
    id: "connect-microsoft-aisha",
    command: "Find Aisha Khan at Microsoft from UTA and send a connection request with 'Hello Aisha.'",
    expected: "sent"
  },
  {
    id: "connect-openai-robert",
    command: "Find Robert Lee at OpenAI from UTA and send a connection request with 'Quick hello.'",
    expected: "sent"
  },
  {
    id: "connect-apple-nina",
    command: "Find Nina Brown at Apple and send a connection request with 'Hi Nina.'",
    expected: "sent"
  },
  {
    id: "connect-google-omar",
    command: "Find Omar Johnson at Google from UTA and send a connection request with 'Hi Omar.'",
    expected: "sent"
  },
  {
    id: "connect-google-li",
    command: "Find Li Wei at Google and send a connection request with 'Hello Li.'",
    expected: "sent"
  },
  {
    id: "open-google-john",
    command: "Find John Smith at Google from UTA",
    expected: "opened"
  },
  {
    id: "open-openai-sarah",
    command: "Find Sarah Patel at OpenAI",
    expected: "opened"
  },
  {
    id: "open-google-david",
    command: "Find David Kim at Google",
    expected: "opened"
  },
  {
    id: "open-microsoft-aisha",
    command: "Find Aisha Khan at Microsoft from UTA",
    expected: "opened"
  },
  {
    id: "open-openai-robert",
    command: "Find Robert Lee at OpenAI from UTA",
    expected: "opened"
  },
  {
    id: "open-apple-nina",
    command: "Find Nina Brown at Apple",
    expected: "opened"
  },
  {
    id: "already-pending-maria",
    command: "Find Maria Garcia at Google and send a connection request with 'Checking in.'",
    expected: "already_pending"
  },
  {
    id: "already-pending-priya",
    command: "Find Priya Shah at Amazon and send a connection request with 'Hello Priya.'",
    expected: "already_pending"
  },
  {
    id: "already-sent-emily",
    command: "Find Emily Chen at Google and send a connection request with 'Hello Emily.'",
    expected: "already_sent"
  },
  {
    id: "missing-alex",
    command: "Find Alex Morgan at Google and send a connection request with 'Hello Alex.'",
    expected: "missing"
  },
  {
    id: "missing-taylor",
    command: "Find Taylor Brooks at OpenAI",
    expected: "missing"
  },
  {
    id: "ambiguous-john",
    command: "Find John Smith and send a connection request with 'Hello John.'",
    expected: "ambiguous"
  },
  {
    id: "connect-google-uta-omar",
    command: "Connect with Omar Johnson at Google from UTA with 'Saw your recruiting work.'",
    expected: "sent"
  },
  {
    id: "connect-google-uta-john",
    command: "Connect with John Smith at Google from UTA with 'Nice to connect.'",
    expected: "sent"
  },
  {
    id: "open-google-li",
    command: "Search for Li Wei at Google",
    expected: "opened"
  },
  {
    id: "open-google-maria",
    command: "Search for Maria Garcia at Google",
    expected: "opened"
  }
];
