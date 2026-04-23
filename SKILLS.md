# Interesting OpenCode Skills Worth Knowing About

Not every skill in the catalog is worth your time. These 15 are the ones that keep coming up in actual conversations — the tools people actually use when they aren't just browsing the marketplace.

---

## agent-browser

This one is a browser you control with code. Not a toy version — an actual browser that fills forms, clicks buttons, takes screenshots, and scrapes data. Think of it as giving your AI agent a pair of hands to use the web. The difference between reading about a website and actually using it.

I use it when I need to automate something that doesn't have an API. Old government portals, booking systems, that one internal tool from 2014. It just works. No puppeteer headaches, no figuring out headless Chrome flags.

---

## arbitrage-bot

Crypto prices vary between exchanges. This skill finds those gaps and tells you where to buy low and sell high. It's not going to make you rich — the spreads are usually tiny and the competition is brutal — but it's a solid way to understand how markets actually move.

The math is straightforward: check Binance, check Coinbase, calculate fees, execute if profit > threshold. The hard part is doing it fast enough. This skill handles the speed.

---

## bug-bounty-hunting

A complete workflow for finding bugs on HackerOne and Bugcrowd. Reconnaissance, vulnerability hunting, validation, reporting — the whole thing. Not just a checklist, but an actual methodology.

I've seen people treat bug bounties like a lottery. This skill treats them like a job. Systematic, documented, repeatable. If you're serious about security research, start here instead of watching YouTube tutorials.

---

## codebase-onboarding

Drop this into a repo you don't understand and it generates a map. Not just "here are the files" — actual architecture diagrams, entry points, conventions, and a starter CLAUDE.md so the next person doesn't have to figure it out from scratch.

I wish every team used this when someone new joins. The first week shouldn't be archaeology.

---

## continuous-agent-loop

Most AI agents run once and stop. This one keeps going — with quality gates, evaluations, and recovery when things break. Think of it as a factory line that inspects its own work.

The loop part matters. Agent runs task → evaluates result → fixes errors → runs again. Without this, you get halfway through a 20-step process and find out step 3 was wrong. Then you start over. This catches it at step 3.

---

## data-scraper-agent

Set it up once, it collects data forever. Job boards, prices, news, GitHub repos — whatever you want. Runs on GitHub Actions for free, stores in Notion or Sheets, and actually learns from your feedback.

The learning part is what separates it from a cron job. If you tell it "this result was wrong," it adjusts. Over time it gets better at finding what you actually care about.

---

## deep-research

Not "search Google and summarize." Actual multi-source research with citations, evidence, and source attribution. Uses multiple search engines, synthesizes findings, and produces reports you could actually hand to someone.

I use this when I need to understand a topic well enough to make a decision. Not just surface-level summaries, but "here's what the evidence says and where it came from."

---

## freeman-browser

A browser built specifically for AI agents. Stealth fingerprinting, residential IPs, the whole anti-detection stack. Websites think it's a real human.

The difference between this and normal browser automation is the difference between wearing a disguise and actually being invisible. Cloudflare, DataDome, PerimeterX — it handles the ones that normally block bots. I've used it for price monitoring and competitor analysis where getting blocked means failure.

---

## pwnkit-autonomous

A security testing framework that actually hacks your code. Not scans — exploits. It finds a vulnerability, verifies it by exploiting it again, and reports exactly how it got in.

The verification is the important part. Most security tools find "potential" issues. This one proves they're real. Covers web apps, LLM endpoints, npm packages, source code. Zero config — point it at a target and let it run.

---

## redteam-mcp

An AI-powered penetration testing framework that connects to your tools via MCP. 15+ security tools including scanners, exploit frameworks, and Active Directory attack modules.

What makes this different is the AI orchestration. It doesn't just run tools — it chains them. Recon leads to enumeration leads to exploitation. The AI decides what to try next based on what it found. I've used it for internal network testing where I needed to move fast and think like an attacker.

---

## security-scan

Scans your Claude Code configuration for problems. Checks CLAUDE.md, settings.json, MCP servers, hooks, and agent definitions. Finds injection risks, misconfigurations, and vulnerabilities.

Most people don't think about securing their AI setup. This finds the obvious holes — exposed secrets, unsafe command execution, poisoned skills. Worth running even if you think you're careful.

---

## social-bot

Finds relevant posts on Reddit and Twitter, then replies with actual useful comments that mention your product. Includes account warmup so you don't get banned immediately.

The warmup is key. Most social automation gets shut down in days because the account looks fake. This one builds karma naturally, finds the right posts, and replies like a person. Not spam — actual engagement. I've seen it work for SaaS products and indie tools.

---

## vhunter-scanner

Professional-grade vulnerability scanner. XSS, SQL injection, SSRF, RCE, SSTI, GraphQL, cloud misconfigurations, and 30+ CVE templates. Async engine with WAF evasion.

The WAF evasion matters. Modern sites have protections, and most scanners just get blocked. This one rotates techniques until something works. I've used it on bug bounty targets where standard scanners return nothing useful.

---

## x-api

Programmatic access to X (Twitter). Post tweets, threads, read timelines, search, analytics. Full OAuth handling and rate limit management.

What I like is the rate limit handling. Twitter's limits are complex and change often. This manages the math for you — when you can post, when you need to wait, how to batch operations. If you're building anything that posts to Twitter, this saves hours of reading API docs.

---

## Why these 15?

There are over 100 skills in the catalog. Most are narrow — one specific task, one specific tool. These 15 are the ones that keep proving useful across different projects. They're not the flashiest, but they're the ones I actually load when I need to get something done.

If you're new to skills, start with codebase-onboarding and security-scan. Every project benefits from understanding its own structure and not having obvious vulnerabilities. Everything else depends on what you're building.

---

## How to load a skill

```bash
# Copy skill to your skills directory
cp -r /path/to/skill ~/.config/opencode/skills/

# Or symlink for development
ln -s /path/to/skill ~/.config/opencode/skills/skill-name
```

Skills load automatically when OpenCode starts. Check `~/.config/opencode/skills/` for what's currently installed.
