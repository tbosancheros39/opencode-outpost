export const bs = {
  "cmd.description.status": "Status servera i sesije",
  "cmd.description.new": "Kreiraj novu sesiju",
  "cmd.description.stop": "Zaustavi trenutnu akciju",
  "cmd.description.sessions": "Lista sesija",
  "cmd.description.projects": "Lista projekata",
  "cmd.description.task": "Kreiraj zakazani zadatak",
  "cmd.description.tasklist": "Lista zakazanih zadataka",
  "cmd.description.commands": "Prilagođene komande",
  "cmd.description.opencode_start": "Pokreni OpenCode server",
  "cmd.description.opencode_stop": "Zaustavi OpenCode server",
  "cmd.description.help": "Pomoć",
  "cmd.description.shell": "Izvrši shell komandu na ovom računaru",
  "cmd.description.ls": "Prikaži sadržaj direktorija na ovom računaru",
  "cmd.description.read": "Pročitaj sadržaj lokalnog fajla",
  "cmd.description.tasks": "Lista vaših nedavnih zadataka",
  "cmd.description.logs": "Pregledaj sistemske logove",
  "cmd.description.health": "Provjeri zdravlje sistema",
  "cmd.description.journal": "Pregledaj systemd journal greške",
  "cmd.description.sandbox": "Pokreni komandu u bubblewrap sandbox okruženju",
  "cmd.description.cost": "Cost and token usage analytics",
  "cmd.description.diff": "Show git diff of current project",
  "cmd.description.branch": "Git branch manager",
  "cmd.description.commit": "Interactive git commit",
  "cmd.description.export": "Export session as file",
  "cmd.description.messages": "Browse session history",
  "cmd.description.skills": "Browse available skills",
  "cmd.description.mcps": "Pregled MCP servera",
  "cmd.description.models": "Pregled i odabir modela",
  "cmd.description.compact": "Compact session context to free up tokens",
  "cmd.description.notify": "Notification preferences",
  "cmd.description.ask_and_leave": "Ask in group and leave",
  "cmd.description.steer": "Interrupt and redirect the agent",

  "ask_and_leave.error.groups_only":
    "Ova komanda funkcioniše samo u grupnim četovima.\n\nDodajte bota u grupu i tamo koristite /ask_and_leave <pitanje>.",
  "ask_and_leave.error.no_query":
    "Please provide a question.\n\nExample: /ask_and_leave What is the capital of France?",
  "steer.usage": "Usage: /steer <new instruction>\n\nExample: /steer Stop looping and use python",
  "steer.abort_failed":
    "Could not interrupt the agent. The session is still busy. Try again or use /abort first.",

  "callback.unknown_command": "Nepoznata komanda",
  "callback.processing_error": "Greška pri obradi",

  "error.load_agents": "❌ Neuspješno učitavanje liste agenata",
  "error.load_models": "❌ Neuspješno učitavanje liste modela",
  "error.load_variants": "❌ Neuspješno učitavanje liste varijanti",
  "error.context_button": "❌ Neuspješna obrada kontekst dugmeta",
  "error.generic": "🔴 Nešto je pošlo po zlu.",

  "interaction.blocked.expired": "⚠️ Ova interakcija je istekla. Molim vas pokrenite je ponovo.",
  "interaction.blocked.expected_callback":
    "⚠️ Za ovaj korak koristite inline dugmad ili dodirnite Otkaži.",
  "interaction.blocked.expected_text": "⚠️ Za ovaj korak pošaljite tekstualnu poruku.",
  "interaction.blocked.expected_command": "⚠️ Za ovaj korak pošaljite komandu.",
  "interaction.blocked.command_not_allowed": "⚠️ Ova komanda nije dostupna u trenutnom koraku.",
  "interaction.blocked.finish_current":
    "⚠️ Završite trenutnu interakciju prvo (odgovorite ili otkažite), zatim otvorite drugi meni.",

  "inline.blocked.expected_choice":
    "⚠️ Odaberite opciju koristeći inline dugmad ili dodirnite Otkaži.",
  "inline.blocked.command_not_allowed": "⚠️ Ova komanda nije dostupna dok je inline meni aktivan.",

  "question.blocked.expected_answer":
    "⚠️ Odgovorite na trenutno pitanje koristeći dugmad, Prilagođeni odgovor, ili Otkaži.",
  "question.blocked.command_not_allowed":
    "⚠️ Ova komanda nije dostupna dok se ne završi trenutni tok pitanja.",

  "inline.button.cancel": "❌ Otkaži",
  "inline.inactive_callback": "Ovaj meni je neaktivan",
  "inline.cancelled_callback": "Otkazano",

  "common.unknown": "nepoznato",
  "common.unknown_error": "nepoznata greška",

  "start.welcome":
    "👋 Dobrodošli u OpenCode Telegram Bot!\n\nKoristite komande:\n/projects — odaberite projekat\n/sessions — lista sesija\n/new — nova sesija\n/task — zakazani zadatak\n/tasklist — zakazani zadaci\n/status — status\n/help — pomoć\n\nKoristite donje dugmiće za odabir režima rada, modela i varijante.",
  "help.keyboard_hint":
    "💡 Koristite donje dugmiće za režim rada agenta, model, varijantu i radnje konteksta.",
  "help.text":
    "📖 **Pomoć**\n\n/status - Provjeri status servera\n/sessions - Lista sesija\n/new - Kreiraj novu sesiju\n/help - Pomoć",

  "bot.thinking": "💭 Razmišljam...",
  "bot.working_on_it": "⏳ Primljeno, radim na tome...",
  "bot.project_not_selected": "🏗 Projekat nije odabran.\n\nPrvo odaberite projekat sa /projects.",
  "bot.global_mode_active": "🌍 Radim u Global Modu (bez konteksta projekta)",
  "bot.session_reset_to_global":
    "⚠️ Sesija je prebačena u Global Mode. Koristite /projects za rad sa projektom.",
  "bot.creating_session": "🔄 Kreiram novu sesiju...",
  "bot.create_session_error":
    "🔴 Neuspješno kreiranje sesije. Pokušajte /new ili provjerite status servera sa /status.",
  "bot.session_created": "✅ Sesiju kreirano: {title}",
  "bot.session_busy":
    "⏳ Agent već pokreće zadatak. Sačekajte završetak ili koristite /abort za prekid.",
  "bot.session_reset_project_mismatch":
    "⚠️ Aktivna sesija ne odgovara odabranom projektu, pa je resetovana. Koristite /sessions za odabir ili /new za kreiranje.",
  "bot.prompt_send_error": "Neuspješno slanje zahtjeva OpenCode-u.",
  "bot.session_error": "🔴 OpenCode je vratio grešku: {message}",
  "bot.session_retry":
    "🔁 {message}\n\nPružatelj usluga nastavlja davati istu grešku pri ponovljenim pokušajima. Koristite /abort za prekid.",
  "bot.unknown_command": "⚠️ Nepoznata komanda: {command}. Koristite /help za dostupne komande.",
  "bot.photo_downloading": "⏳ Preuzimanje fotografije...",
  "bot.photo_too_large": "⚠️ Fotografija je prevelika (maks. {maxSizeMb}MB)",
  "bot.photo_model_no_image": "⚠️ Trenutni model ne podržava ulaz slike. Šaljem samo tekst.",
  "bot.photo_download_error": "🔴 Neuspješno preuzimanje fotografije",
  "bot.photo_no_caption":
    "💡 Savjet: Dodajte opis kako biste opisali šta želite uraditi sa ovom fotografijom.",
  "bot.file_downloading": "⏳ Preuzimanje fajla...",
  "bot.file_too_large": "⚠️ Fajl je preveliki (maks. {maxSizeMb}MB)",
  "bot.file_download_error": "🔴 Neuspješno preuzimanje fajla",
  "bot.model_no_pdf": "⚠️ Trenutni model ne podržava PDF ulaz. Šaljem samo tekst.",
  "bot.text_file_too_large": "⚠️ Tekstualni fajl je preveliki (maks. {maxSizeKb}KB)",
  "chat_limit.exceeded": "⚠️ Too many active chats. Wait for previous conversations to finish.",
  "rate_limit.exceeded": "⚠️ Too many messages. Please slow down.",

  "status.header_running": "🟢 OpenCode Server je pokrenut",
  "status.health.healthy": "Zdrav",
  "status.health.unhealthy": "Nezdrav",
  "status.line.health": "Status: {health}",
  "status.line.version": "Verzija: {version}",
  "status.line.managed_yes": "Pokrenuto od bota: Da",
  "status.line.managed_no": "Pokrenuto od bota: Ne",
  "status.line.pid": "PID: {pid}",
  "status.line.uptime_sec": "Uptime: {seconds} sekundi",
  "status.line.mode": "Mod: {mode}",
  "status.line.model": "Model: {model}",
  "status.agent_not_set": "nije postavljeno",
  "status.project_selected": "Projekat: {project}",
  "status.project_not_selected": "Projekat: nije odabran",
  "status.project_hint": "Koristite /projects za odabir projekta",
  "status.session_selected": "Trenutna sesija: {title}",
  "status.session_not_selected": "Trenutna sesija: nije odabrana",
  "status.session_hint": "Koristite /sessions za odabir ili /new za kreiranje",
  "status.server_unavailable":
    "🔴 OpenCode Server je nedostupan\n\nKoristite /opencode_start za pokretanje servera.",

  "projects.empty":
    "📭 Nema pronađenih projekata.\n\nOtvorite direktorij u OpenCode-u i kreirajte barem jednu sesiju, pa će se pojaviti ovdje.",
  "projects.select": "Odaberite projekat:",
  "projects.select_with_current": "Odaberite projekat:\n\nTrenutni: 🏗 {project}",
  "projects.page_indicator": "Stranica {current}/{total}",
  "projects.prev_page": "⬅️ Prethodna",
  "projects.next_page": "Sljedeća ➡️",
  "projects.fetch_error":
    "🔴 OpenCode Server je nedostupan ili je došlo do greške pri učitavanju projekata.",
  "projects.page_load_error": "Ne može se učitati ova stranica. Pokušajte ponovo.",
  "projects.selected":
    "✅ Projekat odabran: {project}\n\n📋 Sesija je resetovana. Koristite /sessions ili /new za ovaj projekat.",
  "projects.select_error": "🔴 Neuspješan odabir projekta.",

  "sessions.project_not_selected":
    "🏗 Projekat nije odabran.\n\nPrvo odaberite projekat sa /projects.",
  "sessions.empty": "📭 Nema pronađenih sesija.\n\nKreirajte novu sesiju sa /new.",
  "sessions.select": "Odaberite sesiju:",
  "sessions.select_page": "Odaberite sesiju (stranica {page}):",
  "sessions.fetch_error":
    "🔴 OpenCode Server je nedostupan ili je došlo do greške pri učitavanju sesija.",
  "sessions.select_project_first": "🔴 Projekat nije odabran. Koristite /projects.",
  "sessions.page_empty_callback": "Nema sesija na ovoj stranici",
  "sessions.page_load_error_callback": "Ne može se učitati ova stranica. Pokušajte ponovo.",
  "sessions.button.prev_page": "⬅️ Prethodna",
  "sessions.button.next_page": "Sljedeća ➡️",
  "sessions.loading_context": "⏳ Učitavanje konteksta i najnovijih poruka...",
  "sessions.selected": "✅ Sesiju odabrano: {title}",
  "sessions.select_error": "🔴 Neuspješan odabir sesije.",
  "sessions.preview.empty": "Nema nedavnih poruka.",
  "sessions.preview.title": "Nedavne poruke:",
  "sessions.preview.you": "Vi:",
  "sessions.preview.agent": "Agent:",

  "new.project_not_selected": "🏗 Projekat nije odabran.\n\nPrvo odaberite projekat sa /projects.",
  "new.created": "✅ Novu sesiju kreirano: {title}",
  "new.create_error":
    "🔴 OpenCode Server je nedostupan ili je došlo do greške pri kreiranju sesije.",

  "stop.no_active_session":
    "🛑 Agent nije pokrenut\n\nKreirajte sesiju sa /new ili odaberite jednu preko /sessions.",
  "stop.in_progress":
    "🛑 Event stream zaustavljen, šaljem abort signal...\n\nČekanje da se agent zaustavi.",
  "stop.warn_unconfirmed":
    "⚠️ Event stream zaustavljen, ali server nije potvrdio abort.\n\nProvjerite /status i pokušajte /abort ponovo za nekoliko sekundi.",
  "stop.warn_maybe_finished": "⚠️ Event stream zaustavljen, ali agent je možda već završio.",
  "stop.success": "✅ Akcija agenta prekinuta. Više poruka iz ovog izvršavanja neće biti poslano.",
  "stop.warn_still_busy":
    "⚠️ Signal poslan, ali agent je i dalje zauzet.\n\nEvent stream je već onemogućen, tako da se srednje poruke neće slati.",
  "stop.warn_timeout":
    "⚠️ Timeout zahtjeva za abort.\n\nEvent stream je već onemogućen, pokušajte /abort ponovo za nekoliko sekundi.",
  "stop.warn_local_only": "⚠️ Event stream zaustavljen lokalno, ali server-side abort nije uspio.",
  "stop.error":
    "🔴 Neuspješno zaustavljanje akcije.\n\nEvent stream je zaustavljen, pokušajte /abort ponovo.",

  "opencode_start.already_running_managed":
    "⚠️ OpenCode Server je već pokrenut\n\nPID: {pid}\nUptime: {seconds} sekundi",
  "opencode_start.already_running_external":
    "✅ OpenCode Server je već pokrenut kao vanjski proces\n\nVerzija: {version}\n\nOvaj server nije pokrenut od bota, pa /opencode-stop ne može ga zaustaviti.",
  "opencode_start.starting": "🔄 Pokretanje OpenCode Servera...",
  "opencode_start.start_error":
    "🔴 Neuspješno pokretanje OpenCode Servera\n\nGreška: {error}\n\nProvjerite da li je OpenCode CLI instaliran i dostupan u PATH:\nopencode --version\nnpm install -g @opencode-ai/cli",
  "opencode_start.started_not_ready":
    "⚠️ OpenCode Server pokrenut, ali ne odgovara\n\nPID: {pid}\n\nServer se možda još uvijek pokreće. Pokušajte /status za nekoliko sekundi.",
  "opencode_start.success":
    "✅ OpenCode Server uspješno pokrenut\n\nPID: {pid}\nVerzija: {version}",
  "opencode_start.error":
    "🔴 Došlo je do greške pri pokretanju servera.\n\nProvjerite aplikacijske logove za detalje.",
  "opencode_stop.external_running":
    "⚠️ OpenCode Server je pokrenut kao vanjski proces\n\nOvaj server nije pokrenut putem /opencode-start.\nZaustavite ga ručno ili koristite /status za provjeru stanja.",
  "opencode_stop.not_running": "⚠️ OpenCode Server nije pokrenut",
  "opencode_stop.stopping": "🛑 Zaustavljanje OpenCode Servera...\n\nPID: {pid}",
  "opencode_stop.stop_error": "🔴 Neuspješno zaustavljanje OpenCode Servera\n\nGreška: {error}",
  "opencode_stop.success": "✅ OpenCode Server uspješno zaustavljen",
  "opencode_stop.error":
    "🔴 Došlo je do greške pri zaustavljanju servera.\n\nProvjerite aplikacijske logove za detalje.",

  "agent.changed_callback": "Modus promijenjen: {name}",
  "agent.changed_message": "✅ Modus promijenjen na: {name}",
  "agent.change_error_callback": "Neuspješna promjena modusa",
  "agent.menu.current": "Trenutni modus: {name}\n\nOdaberite modus:",
  "agent.menu.select": "Odaberite radni modus:",
  "agent.menu.empty": "⚠️ Nema dostupnih agenata",
  "agent.menu.error": "�️ Neuspješno učitavanje liste agenata",

  "model.changed_callback": "Model promijenjen: {name}",
  "model.changed_message": "✅ Model promijenjen na: {name}",
  "model.change_error_callback": "Neuspješna promjena modela",
  "model.menu.empty": "⚠️ Nema dostupnih modela",
  "model.menu.select": "Odaberite model:",
  "model.menu.current": "Trenutni model: {name}\n\nOdaberite model:",
  "model.menu.favorites_title": "⭐ Favoriti (Dodajte modele u favorite u OpenCode CLI)",
  "model.menu.favorites_empty": "— Prazno.",
  "model.menu.recent_title": "🕘 Nedavno",
  "model.menu.recent_empty": "— Prazno.",
  "model.menu.favorites_hint": "ℹ️ Dodajte modele u favorite u OpenCode CLI da bi ostali na vrhu.",
  "model.menu.error": "🔴 Neuspješno učitavanje liste modela",

  "variant.model_not_selected_callback": "Greška: model nije odabran",
  "variant.changed_callback": "Varijanta promijenjena: {name}",
  "variant.changed_message": "✅ Varijanta promijenjena na: {name}",
  "variant.change_error_callback": "Neuspješna promjena varijante",
  "variant.select_model_first": "⚠️ Prvo odaberite model",
  "variant.menu.empty": "⚠️ Nema dostupnih varijanti",
  "variant.menu.current": "Trenutna varijanta: {name}\n\nOdaberite varijantu:",
  "variant.menu.error": "🔴 Neuspješno učitavanje liste varijanti",

  "context.button.confirm": "✅ Da, kompaktuj kontekst",
  "context.no_active_session": "⚠️ Nema aktivne sesije. Kreirajte sesiju sa /new",
  "context.confirm_text":
    '📊 Kompaktovanje konteksta za sesiju "{title}"\n\nOvo će smanjiti korištenje konteksta uklanjanjem starih poruka iz historije. Trenutni zadatak neće biti prekinut.\n\nNastaviti?',
  "context.callback_session_not_found": "Sesiju nije pronađena",
  "context.callback_compacting": "Kompaktovanje konteksta...",
  "context.progress": "⏳ Kompaktovanje konteksta...",
  "context.error": "❌ Neuspješno kompaktovanje konteksta",
  "context.success": "✅ Kontekst uspješno kompaktovan",

  "permission.inactive_callback": "Zahtjev za dozvolu je neaktivan",
  "permission.processing_error_callback": "Greška pri obradi",
  "permission.no_active_request_callback": "Greška: nema aktivnog zahtjeva",
  "permission.reply.once": "Dozvoljeno jednom",
  "permission.reply.always": "Uvijek dozvoljeno",
  "permission.reply.reject": "Odbijeno",
  "permission.send_reply_error": "❌ Neuspješno slanje odgovora na zahtjev za dozvolu",
  "permission.denied.super_user_only": "⚠️ Ova akcija zahtijeva dozvolu super korisnika.",
  "permission.blocked.expected_reply":
    "⚠️ Prvo odgovorite na zahtjev za dozvolu koristeći dugmad iznad.",
  "permission.blocked.command_not_allowed":
    "⚠️ Ova komanda nije dostupna dok ne odgovorite na zahtjev za dozvolu.",
  "permission.header": "{emoji} Zahtjev za dozvolu: {name}\n\n",
  "permission.button.allow": "✅ Dozvoli jednom",
  "permission.button.always": "🔓 Dozvoli uvijek",
  "permission.button.reject": "❌ Odbij",
  "permission.name.bash": "Bash",
  "permission.name.edit": "Uredi",
  "permission.name.write": "Piši",
  "permission.name.read": "Čitaj",
  "permission.name.webfetch": "Web Fetch",
  "permission.name.websearch": "Web Pretraga",
  "permission.name.glob": "Pretraga Fajlova",
  "permission.name.grep": "Pretraga Sadržaja",
  "permission.name.list": "Lista Direktorija",
  "permission.name.task": "Zadatak",
  "permission.name.lsp": "LSP",
  "permission.name.external_directory": "Vanjski Direktorij",

  "question.inactive_callback": "Anketa je neaktivna",
  "question.processing_error_callback": "Greška pri obradi",
  "question.select_one_required_callback": "Odaberite barem jednu opciju",
  "question.enter_custom_callback": "Pošaljite svoj prilagođeni odgovor kao poruku",
  "question.cancelled": "❌ Anketa otkazana",
  "question.answer_already_received": "Odgovor već primljen, molim vas sačekajte...",
  "question.completed_no_answers": "✅ Anketa završena (bez odgovora)",
  "question.no_active_project": "❌ Nema aktivnog projekta",
  "question.no_active_request": "❌ Nema aktivnog zahtjeva",
  "question.send_answers_error": "❌ Neuspješno slanje odgovora agentu",
  "question.multi_hint": "\n(Možete odabrati više opcija)",
  "question.button.submit": "✅ Gotovo",
  "question.button.custom": "🔤 Prilagođeni odgovor",
  "question.button.cancel": "❌ Otkaži",
  "question.use_custom_button_first":
    '⚠️ Da biste poslali tekst, prvo dodirnite "Prilagođeni odgovor" za trenutno pitanje.',
  "question.summary.title": "✅ Anketa završena!\n\n",
  "question.summary.question": "Pitanje {index}:\n{question}\n\n",
  "question.summary.answer": "Odgovor:\n{answer}\n\n",

  "keyboard.agent_mode": "{emoji} {name} Mod",
  "keyboard.context": "📊 {used} / {limit} ({percent}%)",
  "keyboard.context_empty": "📊 0",
  "keyboard.variant": "💭 {name}",
  "keyboard.variant_default": "💡 Podrazumijevano",
  "keyboard.updated": "⌨️ Tastatura ažurirana",

  "pinned.default_session_title": "nova sesija",
  "pinned.unknown": "Nepoznato",
  "pinned.line.project": "Projekat: {project}",
  "pinned.line.model": "Model: {model}",
  "pinned.line.context": "Kontekst: {used} / {limit} ({percent}%)",
  "pinned.line.cost": "Trošak: {cost} potrošeno",
  "pinned.files.title": "Fajlovi ({count}):",
  "pinned.files.item": "  {path}{diff}",
  "pinned.files.more": "  ... i {count} više",

  "tool.todo.overflow": "*({count} više zadataka)*",
  "tool.file_header.write":
    "Piši Fajl/Putanja: {path}\n============================================================\n\n",
  "tool.file_header.edit":
    "Uredi Fajl/Putanja: {path}\n============================================================\n\n",

  "runtime.wizard.ask_token": "Unesite Telegram bot token (dobijte ga od @BotFather).\n> ",
  "runtime.wizard.ask_language":
    "Odaberite jezik interfejsa.\nUnesite broj jezika iz liste ili locale kod.\nPritisnite Enter za zadržavanje podrazumijevanog jezika: {defaultLocale}\n{options}\n> ",
  "runtime.wizard.language_invalid": "Unesite broj jezika iz liste ili podržani locale kod.\n",
  "runtime.wizard.language_selected": "Odabrani jezik: {language}\n",
  "runtime.wizard.token_required": "Token je obavezan. Molim vas pokušajte ponovo.\n",
  "runtime.wizard.token_invalid":
    "Token izgleda nevažeće (očekivani format <id>:<secret>). Molim vas pokušajte ponovo.\n",
  "runtime.wizard.ask_user_id":
    "Unesite vaš Telegram User ID (možete ga dobiti od @userinfobot).\n> ",
  "runtime.wizard.user_id_invalid": "Unesite pozitivan cijeli broj (> 0).\n",
  "runtime.wizard.ask_api_url":
    "Unesite OpenCode API URL (opcionalno).\nPritisnite Enter za korištenje podrazumijevanog: {defaultUrl}\n> ",
  "runtime.wizard.ask_server_username":
    "Unesite OpenCode server username (opcionalno).\nPritisnite Enter za korištenje podrazumijevanog: {defaultUsername}\n> ",
  "runtime.wizard.ask_server_password":
    "Unesite OpenCode server password (opcionalno).\nPritisnite Enter za zadržavanje praznog.\n> ",
  "runtime.wizard.api_url_invalid":
    "Unesite važeći URL (http/https) ili pritisnite Enter za podrazumijevano.\n",
  "runtime.wizard.start": "OpenCode Telegram Bot postavljanje.\n",
  "runtime.wizard.saved": "Konfiguracija sačuvana:\n- {envPath}\n- {settingsPath}\n",
  "runtime.wizard.not_configured_starting":
    "Aplikacija još nije konfigurisana. Pokretanje čarobnjaka...\n",
  "runtime.wizard.tty_required":
    "Interaktivni čarobnjak zahtijeva TTY terminal. Pokrenite `opencode-telegram config` u interaktivnom shell-u.",

  "rename.no_session": "⚠️ Nema aktivne sesije. Kreirajte ili odaberite sesiju prvo.",
  "rename.prompt": "📝 Unesite novi naslov za sesiju:\n\nTrenutni: {title}",
  "rename.empty_title": "⚠️ Naslov ne može biti prazan.",
  "rename.success": "✅ Sesiju preimenovano u: {title}",
  "rename.error": "�️ Neuspješno preimenovanje sesije.",
  "rename.cancelled": "❌ Preimenovanje otkazano.",
  "rename.inactive_callback": "Zahtjev za preimenovanje je neaktivan",
  "rename.inactive": "⚠️ Zahtjev za preimenovanje nije aktivan. Pokrenite /rename ponovo.",
  "rename.blocked.expected_name":
    "⚠️ Pošaljite novi naziv sesije kao tekst ili dodirnite Otkaži u poruci za preimenovanje.",
  "rename.blocked.command_not_allowed":
    "⚠️ Ova komanda nije dostupna dok preimenovanje čeka novi naziv.",
  "rename.button.cancel": "❌ Otkaži",

  "task.prompt.schedule":
    "⏰ Pošaljite raspored zadatka na prirodnom jeziku.\n\nPrimjeri:\n- svakih 5 minuta\n- svaki dan u 17:00\n- sutra u 12:00",
  "task.schedule_empty": "⚠️ Raspored ne može biti prazan.",
  "task.parse.in_progress": "⏳ Parsiranje rasporeda...",
  "task.parse_error":
    "🔴 Neuspješno parsiranje rasporeda.\n\n{message}\n\nPošaljite raspored ponovo u jasnijem obliku.",
  "task.schedule_preview":
    "✅ Raspored parsiran\n\nKako sam razumio: {summary}\n{cronLine}Vremenska zona: {timezone}\nTip: {kind}\nSljedeće pokretanje: {nextRunAt}",
  "task.schedule_preview.cron": "Cron: {cron}",
  "task.prompt.body": "📝 Sada pošaljite šta bot treba raditi po rasporedu.",
  "task.prompt_empty": "⚠️ Tekst zadatka ne može biti prazan.",
  "task.created":
    "✅ Zakazani zadatak kreiran\n\nZadatak: {description}\nProjekat: {project}\nModel: {model}\nRaspored: {schedule}\n{cronLine}Sljedeće pokretanje: {nextRunAt}",
  "task.created.cron": "Cron: {cron}",
  "task.button.retry_schedule": "🔁 Ponovo unesi raspored",
  "task.button.cancel": "❌ Otkaži",
  "task.retry_schedule_callback": "Ponovni unos rasporeda...",
  "task.cancel_callback": "Otkazivanje...",
  "task.cancelled": "❌ Kreiranje zakazanog zadatka otkazano.",
  "task.inactive_callback": "Ovaj tok zakazanog zadatka je neaktivan",
  "task.inactive": "⚠️ Kreiranje zakazanog zadatka nije aktivan. Pokrenite /task ponovo.",
  "task.blocked.expected_input":
    "⚠️ Završite trenutno postavljanje zakazanog zadatka slanjem teksta ili korištenjem dugmeta u poruci o rasporedu.",
  "task.blocked.command_not_allowed":
    "⚠️ Ova komanda nije dostupna dok je kreiranje zakazanog zadatka aktivno.",
  "task.limit_reached":
    "⚠️ Dostignuto je ograničenje zadataka ({limit}). Prvo obrišite postojeći zakazani zadatak.",
  "task.schedule_too_frequent":
    "Ponavljajući raspored je prečest. Minimalni dozvoljeni interval je jednom svakih 5 minuta.",
  "task.kind.cron": "ponavljajući",
  "task.kind.once": "jednokratno",
  "task.run.success": "⏰ Zakazani zadatak završen: {description}",
  "task.run.error": "🔴 Zakazani zadatak nije uspio: {description}\n\nGreška: {error}",

  "tasklist.empty": "📭 Još nema zakazanih zadataka.",
  "tasklist.select": "Odaberite zakazani zadatak:",
  "tasklist.details":
    "�️ Zakazani zadatak\n\nZadatak: {prompt}\nProjekat: {project}\nRaspored: {schedule}\n{cronLine}Vremenska zona: {timezone}\nSljedeće pokretanje: {nextRunAt}\nZadnje pokretanje: {lastRunAt}\nBroj pokretanja: {runCount}",
  "tasklist.details.cron": "Cron: {cron}",
  "tasklist.button.delete": "🗑 Obriši",
  "tasklist.button.cancel": "❌ Otkaži",
  "tasklist.deleted_callback": "Obrisano",
  "tasklist.cancelled_callback": "Otkazano",
  "tasklist.inactive_callback": "Ovaj meni zakazanih zadataka je neaktivan",
  "tasklist.load_error": "🔴 Neuspješno učitavanje zakazanih zadataka.",

  "commands.select": "Odaberite OpenCode komandu:",
  "commands.empty": "📭 Nema dostupnih OpenCode komandi za ovaj projekat.",
  "commands.fetch_error": "🔴 Neuspješno učitavanje OpenCode komandi.",
  "commands.no_description": "Bez opisa",
  "commands.button.execute": "✅ Izvrši",
  "commands.button.cancel": "❌ Otkaži",
  "commands.confirm":
    "Potvrdite izvršavanje komande {command}. Da biste je izvršili sa argumentima, pošaljite argumente kao poruku.",
  "commands.inactive_callback": "Ovaj meni komandi je neaktivan",
  "commands.cancelled_callback": "Otkazano",
  "commands.execute_callback": "Izvršavanje komande...",
  "commands.executing_prefix": "⚡ Izvršavanje komande:",
  "commands.arguments_empty":
    "⚠️ Argumenti ne mogu biti prazni. Pošaljite tekst ili dodirnite Izvrši.",
  "commands.execute_error": "🔴 Neuspješno izvršavanje OpenCode komande.",
  "commands.select_page": "Odaberite OpenCode komandu (stranica {page}):",
  "commands.button.prev_page": "⬅️ Prethodna",
  "commands.button.next_page": "Sljedeća ➡️",
  "commands.page_empty_callback": "Nema komandi na ovoj stranici",
  "commands.page_load_error_callback": "Ne može se učitati ova stranica. Pokušajte ponovo.",

  "cmd.description.rename": "Preimenuj trenutnu sesiju",

  "cli.usage":
    "Upotreba:\n  opencode-telegram [start] [--mode sources|installed]\n  opencode-telegram status\n  opencode-telegram stop\n  opencode-telegram config\n\nNapomene:\n  - Bez komande podrazumijeva se `start`\n  - `--mode` je trenutno podržan samo za `start`",
  "cli.placeholder.status":
    "Komanda `status` je trenutno placeholder. Prave provjere statusa će biti dodane u sloj servisa (Faza 5).",
  "cli.placeholder.stop":
    "Komanda `stop` je trenutno placeholder. Pravo zaustavljanje pozadinskog procesa će biti dodano u sloj servisa (Faza 5).",
  "cli.placeholder.unavailable": "Komanda nije dostupna.",
  "cli.error.prefix": "CLI greška: {message}",
  "cli.args.unknown_command": "Nepoznata komanda: {value}",
  "cli.args.mode_requires_value": "Opcija --mode zahtijeva vrijednost: sources|installed",
  "cli.args.invalid_mode": "Nevažeća vrijednost za --mode: {value}. Očekivano sources|installed",
  "cli.args.unknown_option": "Nepoznata opcija: {value}",
  "cli.args.mode_only_start": "Opcija --mode je podržana samo za start komandu",

  "legacy.models.fetch_error":
    "🔴 Neuspješno učitavanje liste modela. Provjerite status servera sa /status.",
  "legacy.models.empty": "📋 Nema dostupnih modela. Konfigurišite pružaoce u OpenCode.",
  "legacy.models.header": "📋 Dostupni modeli:\n\n",
  "legacy.models.no_provider_models": "  ⚠️ Nema dostupnih modela\n",
  "legacy.models.env_hint": "💡 Za korištenje modela u .env:\n",
  "legacy.models.error": "An error occurred while loading models list.",

  "models.all_models_header": "All available models:",
  "models.free_models_header": "Available free models:",
  "models.no_free_models": "No free models available. Please contact administrator.",
  "models.selection_hint": "Click a model to select it.",

  "stt.recognizing": "🎤 Prepoznavanje audio zapisa...",
  "stt.recognized": "🎤 Prepoznato:\n{text}",
  "stt.not_configured":
    "🎤 Prepoznavanje glasa nije konfigurisano.\n\nPostavite STT_API_URL i STT_API_KEY u .env da ga omogućite.",
  "stt.error": "🔴 Neuspješno prepoznavanje audio zapisa: {error}",
  "stt.empty_result": "🎤 Govor nije detektovan u audio poruci.",

  "export.no_session": "⚠️ No active session.\n\nCreate or select a session first.",
  "export.exporting": "📤 <i>Exporting session...</i>",
  "export.success": "✅ Session exported: {title}",
  "export.error": "🔴 Export failed: {message}",
  "export.error_no_session": "⚠️ Unable to identify chat.",

  "messages.no_session": "⚠️ No active session.\n\nCreate or select a session first.",
  "messages.no_project": "🏗 Project is not selected.\n\nFirst select a project with /projects.",
  "messages.empty": "📭 No messages in this session.\n\nStart a conversation to see messages here.",
  "messages.error_load": "🔴 Failed to load messages.\n\nCheck server status with /status.",
  "messages.error_no_session": "⚠️ Unable to identify chat.",
  "messages.header": "💬 Messages ({from}-{to} of {total})\n\nScroll through session history.",
  "messages.button.prev": "◀ Prev",
  "messages.button.next": "Next ▶",
  "messages.button.fork": "🔄 Fork",
  "messages.button.revert": "↩ Revert",
  "messages.button.cancel": "❌ Cancel",
  "messages.inactive_callback": "This messages menu is inactive",
  "messages.cancelled_callback": "Cancelled",
  "messages.forking": "🔄 Forking session...",
  "messages.fork_success": "✅ Session forked successfully.\n\nNew session ID: {newSessionId}",
  "messages.fork_error": "🔴 Failed to fork session.",
  "messages.reverting": "↩️ Reverting session...",
  "messages.revert_success": "✅ Session reverted successfully.",
  "messages.revert_error": "🔴 Failed to revert session.",

  "skills.no_project": "🏗 Project is not selected.\n\nFirst select a project with /projects.",
  "skills.empty": "📭 No skills available.\n\nSkills are defined in your OpenCode configuration.",
  "skills.error_load": "🔴 Failed to load skills.\n\nCheck server status with /status.",
  "skills.error_no_session": "⚠️ Unable to identify chat.",
  "skills.header": "🛠 Skills ({from}-{to} of {total})\n\nSelect a skill to activate:",
  "skills.hint": "💡 Skills extend OpenCode capabilities. Activation is per-session.",
  "skills.no_description": "No description",
  "skills.button.prev": "◀ Prev",
  "skills.button.next": "Next ▶",
  "skills.button.cancel": "❌ Cancel",
  "skills.inactive_callback": "This skills menu is inactive",
  "skills.cancelled_callback": "Cancelled",
  "skills.not_found": "Skill not found",
  "skills.activating": "⚡ Activating skill...",
  "skills.activation_notice":
    "✅ Skill /{name} selected.\n\nThe skill will be used in the current session.",
  "skills.no_session_warning":
    "⚠️ No active session.\n\nCreate or select a session first to use skills.",

  "mcps.no_project": "🏗 Project is not selected.\n\nFirst select a project with /projects.",
  "mcps.empty":
    "📭 No MCP servers configured.\n\nMCP servers are defined in your OpenCode configuration.",
  "mcps.error_load": "🔴 Failed to load MCP servers.\n\nCheck server status with /status.",
  "mcps.error_no_chat": "⚠️ Unable to identify chat.",
  "mcps.header": "🔌 MCP Servers ({total})\n\nManage your Model Context Protocol servers:",
  "mcps.hint": "💡 Use buttons below to connect or disconnect servers.",
  "mcps.status.connected": "Connected",
  "mcps.status.disabled": "Disabled",
  "mcps.status.failed": "Failed",
  "mcps.status.needs_auth": "Needs authentication",
  "mcps.status.needs_client_registration": "Needs client registration",
  "mcps.status.unknown": "Unknown",
  "mcps.button.connect": "🔌 Connect {name}",
  "mcps.button.disconnect": "⛔ Disconnect {name}",
  "mcps.button.cancel": "❌ Cancel",
  "mcps.inactive_callback": "This MCP servers menu is inactive",
  "mcps.cancelled_callback": "Cancelled",
  "mcps.not_found": "MCP server not found",
  "mcps.connecting": "🔌 Connecting...",
  "mcps.connected": "✅ MCP server {name} connected successfully.",
  "mcps.connect_error": "🔴 Failed to connect MCP server {name}.",
  "mcps.disconnecting": "⛔ Disconnecting...",
  "mcps.disconnected": "✅ MCP server {name} disconnected successfully.",
  "mcps.disconnect_error": "🔴 Failed to disconnect MCP server {name}.",
  "inline.cmd.summarise.title": "📝 Summarise",
  "inline.cmd.summarise.description": "Condense long text into key points",
  "inline.cmd.eli5.title": "👶 ELI5",
  "inline.cmd.eli5.description": "Explain like I'm 5, super simple!",
  "inline.cmd.deep_research.title": "🔬 Deep Research",
  "inline.cmd.deep_research.description": "Thorough, detailed investigation",
  "inline.cmd.steel_man.title": "💪 Steel-Man",
  "inline.cmd.steel_man.description": "Make an argument stronger (opposite of straw-man)",
  "inline.cmd.feynman.title": "🎓 Feynman",
  "inline.cmd.feynman.description": "Teach a concept simply (Feynman technique)",
  "inline.cmd.devils_advocate.title": "😈 Devil's Advocate",
  "inline.cmd.devils_advocate.description": "Argue the opposing view",
  "inline.cmd.error.query_too_short":
    "⚠️ Please provide more context (at least {min} characters after the command)",
  "inline.cmd.error.resolution_failed": "⚠️ Failed to generate response. Please try again.",
  "inline.cmd.suggestion.usage": "Use: {prefix} [your question]",
  "inline.cmd.button.generate": "✅ Generate Answer",
  "inline.cmd.button.edit": "✏️ Edit Query",
  "inline.cmd.error.callback_expired": "⚠️ This inline request expired. Please send it again.",
  "inline.cmd.error.callback_invalid": "⚠️ This inline action is invalid.",
  "inline.thinking": "🧠 Razmišljam... trenutak!",
  "inline.loading": "⏳ Generišem odgovor...",
  "inline.loading_global": "⏳ 🌍 Generišem odgovor (Global Mode)...",
  // ── LLM Guard (Two-Phase) ──────────────────────────────────────────────
  "llm.guard.query_timeout": "⏱ Vrijeme je isteklo. Molim pokušajte ponovo.",
  "llm.guard.confirm_timeout": "⏱ Vrijeme je isteklo.",
  "llm.guard.cancelled": "❌ Komanda otkazana.",
  "llm.guard.nothing_pending": "Ništa na čekanju.",
  "llm.guard.query_too_short": "Molim unesite upit od najmanje 2 karaktera.",
  "llm.guard.edit_prompt":
    'Komanda: <b>/{command}</b>\nPrethodno: "{query}"\n\n<i>Pošaljite ažurirani upit (ističe za 5 min):</i>',
  "llm.guard.queue_failed":
    '<b>/{command}</b>: "{query}"\n\n⚠️ Neuspješno dodavanje u red. Pokušati ponovo?',
  "llm.guard.fallback_query": "Koji je vaš upit?",
  "cmd.description.tts": "Uključi/isključi text-to-speech za odgovore",
  "tts.enabled": "🔊 Text-to-speech uključen",
  "tts.disabled": "🔇 Text-to-speech isključen",
  "tts.error": "❌ TTS greška",
  "tts.failed": "❌ Neuspješno generisanje audio odgovora.",
  "tts.not_configured": "⚠️ TTS nije konfigurisan. Postavite TTS_API_URL i TTS_API_KEY.",
  "tts.text_too_long": "⚠️ Tekst previše dugačak za TTS (maksimalno {max} karaktera)",
} as const;
