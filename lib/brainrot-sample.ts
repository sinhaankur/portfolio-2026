/**
 * A realistic sample feed for the BrainRot demo — the kind of short-form scroll
 * the app is built to scan. Deliberately varied but skewed (like a real
 * algorithmic feed): heavy on rage/money/self-improvement hooks, with a few
 * calm posts mixed in, so the mirror has something honest to reflect.
 *
 * Written as generic captions — no real accounts. The live extension (phase 2)
 * will scrape the actual feed DOM instead of using this.
 */

import type { FeedItem } from "./brainrot"

export const SAMPLE_FEED: FeedItem[] = [
  { id: "1", author: "@hustlegrind", platform: "reels", text: "Day 47 of my 5am morning routine. While you were sleeping I made $400. Broke people will never understand this mindset. 🔥" },
  { id: "2", author: "@truthbombs", platform: "shorts", text: "They DON'T want you to know this. The mainstream media lied to you again. Wake up before it's too late. 🚨" },
  { id: "3", author: "@moneytips", platform: "tiktok", text: "This passive income hack made me a millionaire. Only 3 spots left in my course. Don't miss out." },
  { id: "4", author: "@ragereacts", platform: "shorts", text: "This is DISGUSTING. How dare they. Absolutely unbelievable what these people are getting away with. Politicians destroyed." },
  { id: "5", author: "@cozycorner", platform: "reels", text: "Made soup and read by the window today. Grateful for the small wholesome moments. 🥰" },
  { id: "6", author: "@gymbro", platform: "tiktok", text: "You'll never get shredded with that weak mindset. No excuses. Insane transformation, wait for it..." },
  { id: "7", author: "@dramaalert", platform: "shorts", text: "EXPOSED: the leaked truth about your favorite celebrity. This scandal is worse than you think. Part 2 coming." },
  { id: "8", author: "@cryptoking", platform: "tiktok", text: "Bitcoin about to crash or moon? Everyone is buying. Get in before it's gone. This is not financial advice 💀" },
  { id: "9", author: "@redflagqueen", platform: "reels", text: "If your situationship does THIS, run. Toxic behavior. Red flag. He's not the one, bestie." },
  { id: "10", author: "@doomnews", platform: "shorts", text: "BREAKING: economic collapse warning. Recession is coming. Protect yourself before it's too late. Developing story." },
  { id: "11", author: "@puppytime", platform: "reels", text: "The most adorable golden retriever puppy learning to howl. This is the cutest thing you'll see today. 🐶" },
  { id: "12", author: "@grindset", platform: "tiktok", text: "Successful people don't rest. Discipline over motivation. Level up while everyone else scrolls. The grind never stops." },
  { id: "13", author: "@hottakes", platform: "shorts", text: "Unpopular opinion that will make you FURIOUS. The elite don't want the real ones to know this. IYKYK." },
  { id: "14", author: "@recipedaily", platform: "reels", text: "Easy 15-minute viral pasta recipe. Save this for later! So good and simple." },
  { id: "15", author: "@luxlife", platform: "tiktok", text: "My $2M dream home tour. You'll never afford this with a poor mindset. Manifest luxury. ✨" },
  { id: "16", author: "@politicsnow", platform: "shorts", text: "The government betrayed us again. This corrupt policy is shameful. Share this before they take it down." },
  { id: "17", author: "@mindfulmin", platform: "reels", text: "A gentle reminder that rest is productive too. You're doing enough. Breathe. 🌿" },
  { id: "18", author: "@viralclips", platform: "shorts", text: "Wait for it... you won't believe the ending. Watch till the end. This is INSANE. 😱" },
  { id: "19", author: "@sidehustle", platform: "tiktok", text: "Quit your 9-5. This side hustle prints money while you sleep. Financial freedom is one click away." },
  { id: "20", author: "@conspiracyhr", platform: "shorts", text: "They're hiding the truth about this. Do your own research. Don't be a sheep. The cover-up is real." },
]
