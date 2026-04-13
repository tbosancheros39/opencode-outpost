# Steer Command — Integracijski Plan

## Pregled

`/steer` je nova komanda koja omogućava korisniku da **prekine trenutni zadatak i odmah pošalje novi prompt** u jednom koraku — slično kao "interrupt and redirect" u OpenCode-u.

## ⚠️ CRITICAL BUG — TREBA POPRAVITI

**`/steer` komanda će biti BLOKIRANA kada je sesija busy!**

Problem je u `src/interaction/busy.ts`:

```typescript
export const BUSY_ALLOWED_COMMANDS = ["/abort", "/status", "/help"] as const;
```

`/steer` **nije** u ovoj listi. Kada korisnik pošalje `/steer` dok agent radi:

1. `interactionGuardMiddleware` proverava `isBusyAllowedCommand("/steer")`
2. Vraća `false` jer `/steer` nije u listi
3. Komanda se blokira sa porukom "Please finish your current interaction first"
4. **`steerCommand` se uopšte NE poziva!**

**Fix koji treba primijeniti:**

U fajlu `src/interaction/busy.ts`, linija 4:

```typescript
// PRIJE:
export const BUSY_ALLOWED_COMMANDS = ["/abort", "/status", "/help"] as const;

// POSLIJE:
export const BUSY_ALLOWED_COMMANDS = ["/abort", "/stop", "/status", "/help", "/steer"] as const;
```

Napomena: Dodao sam i `/stop` jer vidim da se u `definitions.ts` oba `/abort` i `/stop` mapiraju na isti `abortCommand`, a `/stop` bi također trebao biti dozvoljen tokom busy state-a.

## Motivacija

Trenutno kada agent radi na zadatku, korisnik može samo:
- Čekati da završi
- Koristiti `/abort` da zaustavi i početi ispočetka

`/steer` kombinuje ova dva koraka u jednu komandu:
```
/steer Stop looping and use python instead
```

## Arhitektura

### Flow

```
User: /steer novi prompt
    │
    ▼
1. abortCurrentOperation(ctx)   ← abort + čekanje na idle
    │
    ├── stopEventListening()
    ├── summaryAggregator.clear()
    ├── clearAllInteractionState()
    ├── opencodeClient.session.abort()
    ├── pollSessionStatus()      ← čeka max 5s da postane idle
    └── foregroundSessionState.markIdle()
    │
    ▼ (abort vratio true)
2. processUserPrompt(ctx, novi prompt)
    │
    └── šalje novi prompt OpenCode-u
```

### Zašto ovaj flow radi

1. **abortCurrentOperation vraća `boolean`** — caller zna da li je abort uspio
2. **Tek nakon abort-a** šaljemo novi prompt — `processUserPrompt` neće biti odbijen jer je sesija busy
3. **Koristi postojeće patterns** — dijelimo kod sa `/abort` komandom

## Koraci Implementacije

### Korak 1: Refaktor abort.ts

**Datoteka:** `src/bot/commands/abort.ts`

**Izmjene:**
- `abortCurrentOperation` vraća `Promise<boolean>` umjesto `Promise<void>`
- `true` = uspješno abortovan (sesija idle)
- `false` = nije uspjelo ili sesija nije bila aktivna

```typescript
export async function abortCurrentOperation(
  ctx: Context,
  options: AbortCurrentOperationOptions = {},
): Promise<boolean> {
  // ... postojeća logika ...
  // Na kraju:
  if (finalStatus === "idle" || finalStatus === "not-found") {
    foregroundSessionState.markIdle(currentSession.id);
    if (notifyUser && chatId !== null && waitingMessageId !== null) {
      await ctx.api.editMessageText(chatId, waitingMessageId, t("stop.success"));
    }
    return true;  // ← DODANO
  }
  // ...
  return false;  // ← DODANO
}
```

### Korak 2: Kreiraj steer.ts

**Datoteka:** `src/bot/commands/steer.ts`

```typescript
import { CommandContext, Context } from "grammy";
import { abortCurrentOperation } from "./abort.js";
import { processUserPrompt, type ProcessPromptDeps } from "../handlers/prompt.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

export async function steerCommand(
  ctx: CommandContext<Context>,
  promptDeps: ProcessPromptDeps,
): Promise<void> {
  const chatId = ctx.chat?.id ?? null;
  const newPrompt = (ctx.match as string)?.trim();

  if (!chatId) {
    logger.warn("[Steer] Chat context is missing");
    return;
  }

  if (!newPrompt) {
    await ctx.reply(t("steer.usage"));
    return;
  }

  logger.info(`[Steer] Redirecting agent with: "${newPrompt}"`);

  // 1. Abort the current operation and wait for idle
  const aborted = await abortCurrentOperation(ctx, { notifyUser: true });

  if (!aborted) {
    await ctx.reply(t("steer.abort_failed"));
    return;
  }

  // 2. Process the new prompt
  await processUserPrompt(ctx, newPrompt, promptDeps);
}
```

**Napomena:** Stvarna implementacija prima `promptDeps` kao parametar — ovo je ispravno jer `processUserPrompt` zahtijeva bot instancu i event subscription funkciju. Prosljeđivanje je urađeno u `index.ts` pri registraciji komande.

### Korak 3: Dodaj i18n ključeve

**Datoteka:** `src/i18n/en.ts`

```typescript
"cmd.description.steer": "Interrupt and redirect the agent",
"steer.usage": "Usage: /steer <new instruction>\n\nExample: /steer Stop looping and use python",
"steer.abort_failed": "❌ Could not interrupt the agent. The session is still busy.",
```

### Korak 4: Dodaj u definitions.ts

**Datoteka:** `src/bot/commands/definitions.ts`

```typescript
const COMMAND_DEFINITIONS: BotCommandI18nDefinition[] = [
  // ... postojeće ...
  { command: "steer", descriptionKey: "cmd.description.steer" },
];
```

### Korak 5: Registruj u index.ts

**Datoteka:** `src/bot/index.ts`

```typescript
import { steerCommand } from "./commands/steer.js";

// ... u createBot() funkciji, gdje se registruju komande (linija 1152-1154):
bot.command("steer", async (ctx) => {
  await steerCommand(ctx, { bot, ensureEventSubscription });
});
```

**VAŽNO:** Komanda je registrovana inline da bi se proslijedili `promptDeps` (bot instanca i `ensureEventSubscription` funkcija) koji su potrebni za `processUserPrompt`.

## Detalji Implementacije

### Zašto dijelimo kod sa abort.ts?

`abortCurrentOperation` već ima sav potrebni logic:
- Zaustavlja SSE streaming
- Čisti interaction state
- Abortuje server-side sesiju
- Čeka da sesija postane idle
- Ažurira foreground state

Jedino što `steer` dodaje je **što dalje sa novim promptom**.

### Šta ako abort ne uspije?

Ako `abortCurrentOperation` vrati `false`, znači:
- Sesija se nije uspjela zaustaviti unutar 5s timeout-a
- ILI nije bilo aktivne sesije
- ILI je došlo do greške

U tom slučaju `steer` vraća grešku korisniku i **ne šalje novi prompt** — ovo sprečava da se prompt odbije jer je sesija busy.

### Šta ako korisnik pošalje /steer bez teksta?

`steerCommand` provjerava `ctx.match?.trim()` i vraća usage poruku.

### Šta ako sesija nije aktivna (nema busy state)?

`abortCurrentOperation` vraća `true` čak i ako sesija nije bila aktivna (`not-found` status), tako da će se novi prompt normalno obraditi.

## Test Plan

### Manual Test 1: Steer tokom aktivnog zadatka
1. Pošalji prompt koji dugo traje
2. Dok agent radi, pošalji `/steer stop and use a different approach`
3. Provjeri da je prvi zadatak prekinut
4. Provjeri da novi prompt počinje

### Manual Test 2: Steer bez aktivnog zadatka
1. Pošalji `/steer hello world`
2. Provjeri da radi normalno (ne vraća grešku)

### Manual Test 3: Steer bez argumenta
1. Pošalji samo `/steer`
2. Provjeri da vraća usage poruku

## Moguća Proširenja

1. **Auto-steer**: Dodati opciju da se `/steer` ponaša kao prefix — npr. svaki tekst koji počinje sa `!` se tretira kao steer
2. **Steer history**: Čuvati history zadnjih steer komandi za undo
3. **Merge context**: Dodati opciju da se stari i novi prompt kombinuju umjesto da se zamijene

## Budući Rad

Ova integracija je dio šireg cilja — omogućiti fluidnu komunikaciju sa agentom dok radi, slično kao što OpenCode omogućava u terminalu. `/steer` je prvi korak; budući rad može uključivati:

- Real-time streaming gdje korisnik vidi output dok agent još radi
- Mogućnost da se doda dodatni kontekst bez prekida
- Interaktivni "ask while working" mode

---

## Rezime: Šta treba popraviti

| Prioritet | Fajl | Problem | Status |
|-----------|------|---------|--------|
| 🔴 KRITIČNO | `src/interaction/busy.ts` | `/steer` nije u `BUSY_ALLOWED_COMMANDS` | **TREBA POPRAVITI** |
| 🟡 KOZMETIČKO | `src/bot/commands/abort.ts` | `abortLocalStreaming(chatId)` prima `chatId` ali ga ne koristi | Može se ostaviti |

### Akcije koje treba preduzeti:

1. **OBAVEZNO:** Dodati `/steer` (i `/stop`) u `BUSY_ALLOWED_COMMANDS` u `busy.ts`
2. **OPCIONALNO:** Počistiti dead code u `abortLocalStreaming` ako želiš

Kada se popravi critical bug, `/steer` će raditi kako je opisano u ovom dokumentu.
