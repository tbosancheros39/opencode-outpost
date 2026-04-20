const ACK_POOL = [
  "⏳ Got it, working on it...",
  "🔍 On it!",
  "💭 Processing your request...",
  "🚀 Request received!",
  "⚡ Working on it...",
];

export function randomAck(): string {
  return ACK_POOL[Math.floor(Math.random() * ACK_POOL.length)];
}
