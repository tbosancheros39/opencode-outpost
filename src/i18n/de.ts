import type { I18nDictionary } from "./en.js";

export const de: I18nDictionary = {
  "cmd.description.status": "Server- und Sitzungsstatus",
  "cmd.description.new": "Neue Sitzung erstellen",
  "cmd.description.stop": "Aktuelle Aktion stoppen",
  "cmd.description.sessions": "Sitzungen auflisten",
  "cmd.description.projects": "Projekte auflisten",
  "cmd.description.task": "Geplante Aufgabe erstellen",
  "cmd.description.tasklist": "Geplante Aufgaben anzeigen",
  "cmd.description.commands": "Benutzerdefinierte Befehle",
  "cmd.description.opencode_start": "OpenCode-Server starten",
  "cmd.description.opencode_stop": "OpenCode-Server stoppen",
  "cmd.description.help": "Hilfe",
  "cmd.description.start": "Bot starten oder zurücksetzen",
  "cmd.description.fe": "Datei-Explorer",
  "cmd.description.branch": "Git Branch Manager",
  "cmd.description.commit": "Interaktiver Git Commit",
  "cmd.description.diff": "Git Diff des aktuellen Projekts",
  "cmd.description.digest": "Kontextzusammenfassung der aktuellen Sitzung",
  "cmd.description.find": "Semantische Suche im Sitzungsverlauf",
  "cmd.description.pin": "Dateien im Kontext pinnen",
  "cmd.description.resume": "Aus Snapshot wiederherstellen",
  "cmd.description.snapshot": "Sitzungskontext in SQLite speichern",

  // === Find Command ===
  "cmd.find.error": "Suche im Sitzungsverlauf fehlgeschlagen.",
  "cmd.find.no_messages": "Keine Nachrichten in dieser Sitzung gefunden.",
  "cmd.find.no_results": "Keine Ergebnisse für Ihre Suche gefunden.",
  "cmd.find.no_session": "Keine aktive Sitzung. Starten Sie zuerst eine Sitzung mit /new.",
  "cmd.find.results_header": "Suchergebnisse für \"{query}\" ({count} gefunden):\n\n",
  "cmd.find.searching": "Suche nach: {query}...",
  "cmd.find.usage": "Verwendung: /find <query> - Sitzungsverlauf durchsuchen\nBeispiel: /find authentication",
  "cmd.find.error_query_too_long": "Suchanfrage zu lang. Bitte halte Suchen unter 500 Zeichen.",

  // === Pin Command ===
  "cmd.pin.added": "Gepinnte Datei hinzugefügt: {path}",
  "cmd.pin.already_pinned": "Datei ist bereits gepinnt: {path}",
  "cmd.pin.cleared": "Alle gepinnten Dateien gelöscht.",
  "cmd.pin.empty": "Keine gepinnten Dateien. Verwenden Sie /pin <filepath>, um eine Datei zu pinnen.",
  "cmd.pin.error_add": "Datei konnte nicht gepinnt werden.",
  "cmd.pin.error_clear": "Gepinnte Dateien konnten nicht gelöscht werden.",
  "cmd.pin.error_is_directory": "Ein Verzeichnis kann nicht als Datei angeheftet werden: {path}",
  "cmd.pin.error_remove": "Gepinnte Datei konnte nicht entfernt werden.",
  "cmd.pin.file_not_found": "Datei nicht gefunden: {path}",
  "cmd.pin.header": "📌 Gepinnte Dateien:",
  "cmd.pin.hint": "Verwenden Sie /pin add <path> zum Hinzufügen, /pin remove <path> zum Entfernen, /pin clear zum Löschen.",
  "cmd.pin.limit_reached": "Maximale Anzahl gepinnter Dateien erreicht ({limit}). Entfernen Sie zuerst eine.",
  "cmd.pin.not_found": "Gepinnte Datei nicht gefunden: {path}",
  "cmd.pin.removed": "Gepinnte Datei entfernt: {path}",
  "cmd.pin.usage_add": "Verwendung: /pin add <filepath>",
  "cmd.pin.usage_remove": "Verwendung: /pin remove <filepath>",
  "cmd.pin.button_clear_all": "🧹 Alle löschen",
  "cmd.pin.button_refresh": "🔄 Aktualisieren",
  "cmd.pin.callback_invalid_index": "Ungültiger Dateiindex.",
  "cmd.pin.menu_title": "📌 Dateien anheften",
  "cmd.pin.no_files": "Keine aktuellen oder angehefteten Dateien.\nStarte eine Sitzung und interagiere mit Dateien — sie erscheinen hier automatisch.",
  "cmd.pin.pinned_header": "📌 Angeheftet — tippen zum Lösen:",
  "cmd.pin.recent_header": "📄 Aktuell — tippen zum Anheften:",

  // === Snapshot Command ===
  "cmd.snapshot.deleted": "Snapshot gelöscht: {id}",
  "cmd.snapshot.empty": "Keine Snapshots für diese Sitzung gefunden.",
  "cmd.snapshot.error_delete": "Snapshot konnte nicht gelöscht werden.",
  "cmd.snapshot.error_list": "Snapshots konnten nicht aufgelistet werden.",
  "cmd.snapshot.error_load": "Snapshot konnte nicht geladen werden.",
  "cmd.snapshot.error_save": "Snapshot konnte nicht gespeichert werden.",
  "cmd.snapshot.error_name_too_long": "Snapshot-Name zu lang. Maximum ist 100 Zeichen.",
  "cmd.snapshot.info": "Snapshot: {name}\nID: {id}\nSitzung: {session}\nDatum: {date}",
  "cmd.snapshot.list_header": "📸 Sitzungs-Snapshots:",
  "cmd.snapshot.list_page": "📸 Sitzungs-Snapshots (Seite {page}):",
  "cmd.snapshot.no_session": "Keine aktive Sitzung. Starten Sie zuerst eine Sitzung mit /new.",
  "cmd.snapshot.not_found": "Snapshot nicht gefunden: {id}",
  "cmd.snapshot.prev_page": "Zurück",
  "cmd.snapshot.next_page": "Weiter",
  "cmd.snapshot.saved": "Snapshot gespeichert: {name}\nID: {id}",
  "cmd.snapshot.usage_delete": "Verwendung: /snapshot delete <id>",
  "cmd.snapshot.usage_load": "Verwendung: /snapshot load <id>",

  // === Resume Command ===
  "cmd.resume.error": "Sitzung konnte nicht wiederhergestellt werden.",
  "cmd.resume.no_snapshots": "Keine Snapshots gefunden. Verwenden Sie /snapshot, um einen zu speichern.",
  "cmd.resume.prev_page": "Zurück",
  "cmd.resume.next_page": "Weiter",
  "cmd.resume.select": "Wählen Sie einen Snapshot zur Wiederherstellung:",
  "cmd.resume.select_page": "Wählen Sie einen Snapshot zur Wiederherstellung (Seite {page}):",
  "cmd.resume.session_not_found": "Sitzung nicht gefunden: {id}",
  "cmd.resume.success": "Sitzung wiederhergestellt: {title}\nAus Snapshot: {name}",

  // === Digest Command ===
  "cmd.digest.empty": "Keine Nachrichten zum Zusammenfassen.",
  "cmd.digest.error": "Zusammenfassung konnte nicht erstellt werden.",
  "cmd.digest.generating": "Sitzungszusammenfassung wird erstellt...",
  "cmd.digest.header": "# Sitzungszusammenfassung: {title}\n\n",
  "cmd.digest.no_session": "Keine aktive Sitzung. Starten Sie zuerst eine Sitzung mit /new.",

  "callback.unknown_command": "Unbekannter Befehl",
  "callback.processing_error": "Verarbeitungsfehler",

  "error.load_agents": "❌ Agentenliste konnte nicht geladen werden",
  "error.load_models": "❌ Modellliste konnte nicht geladen werden",
  "error.load_variants": "❌ Variantenliste konnte nicht geladen werden",
  "error.context_button": "❌ Kontext-Button konnte nicht verarbeitet werden",
  "error.generic": "🔴 Etwas ist schiefgelaufen.",

  "interaction.blocked.expired": "⚠️ Diese Interaktion ist abgelaufen. Bitte starte sie erneut.",
  "interaction.blocked.expected_callback":
    "⚠️ Bitte benutze für diesen Schritt die Inline-Buttons oder tippe auf Abbrechen.",
  "interaction.blocked.expected_text": "⚠️ Bitte sende für diesen Schritt eine Textnachricht.",
  "interaction.blocked.expected_command": "⚠️ Bitte sende für diesen Schritt einen Befehl.",
  "interaction.blocked.command_not_allowed":
    "⚠️ Dieser Befehl ist in diesem Schritt nicht verfügbar.",
  "interaction.blocked.finish_current":
    "⚠️ Schließe zuerst die aktuelle Interaktion ab (antworten oder abbrechen), dann öffne ein anderes Menü.",

  "inline.blocked.expected_choice":
    "⚠️ Wähle eine Option über die Inline-Buttons oder tippe auf Abbrechen.",
  "inline.blocked.command_not_allowed":
    "⚠️ Dieser Befehl ist nicht verfügbar, solange das Inline-Menü aktiv ist.",

  "question.blocked.expected_answer":
    "⚠️ Beantworte die aktuelle Frage über Buttons, Eigene Antwort oder Abbrechen.",
  "question.blocked.command_not_allowed":
    "⚠️ Dieser Befehl ist erst verfügbar, wenn der aktuelle Frage-Flow abgeschlossen ist.",

  "inline.button.cancel": "❌ Abbrechen",
  "inline.inactive_callback": "Dieses Menü ist inaktiv",
  "inline.cancelled_callback": "Abgebrochen",

  "common.unknown": "unbekannt",
  "common.unknown_error": "unbekannter Fehler",

  "start.welcome":
    "👋 Willkommen beim OpenCode Telegram Bot!\n\nNutze Befehle:\n/projects — Projekt auswählen\n/sessions — Sitzungsliste\n/new — neue Sitzung\n/task — geplante Aufgabe\n/tasklist — geplante Aufgaben\n/status — Status\n/help — Hilfe\n\nNutze die unteren Buttons, um Modus, Modell und Variante zu wählen.",
  "help.keyboard_hint":
    "💡 Nutze die unteren Buttons für Modus, Modell, Variante und Kontextaktionen.",
  "help.text":
    "📖 **Hilfe**\n\n/status - Serverstatus prüfen\n/sessions - Sitzungsliste\n/new - Neue Sitzung erstellen\n/help - Hilfe",

  "bot.thinking": "💭 Denke...",
  "bot.project_not_selected":
    "🏗 Projekt ist nicht ausgewählt.\n\nWähle zuerst ein Projekt mit /projects.",
  "bot.creating_session": "🔄 Erstelle eine neue Sitzung...",
  "bot.create_session_error":
    "🔴 Sitzung konnte nicht erstellt werden. Versuche /new oder prüfe den Serverstatus mit /status.",
  "bot.session_created": "✅ Sitzung erstellt: {title}",
  "bot.session_busy":
    "⏳ Agent führt bereits eine Aufgabe aus. Warte auf Abschluss oder nutze /abort, um den aktuellen Lauf zu unterbrechen.",
  "bot.session_reset_project_mismatch":
    "⚠️ Die aktive Sitzung passt nicht zum ausgewählten Projekt und wurde daher zurückgesetzt. Nutze /sessions zur Auswahl oder /new, um eine neue Sitzung zu erstellen.",
  "bot.prompt_send_error": "Anfrage konnte nicht an OpenCode gesendet werden.",
  "bot.session_error": "🔴 OpenCode meldete einen Fehler: {message}",
  "bot.session_retry":
    "🔁 {message}\n\nDer Provider liefert bei wiederholten Versuchen immer wieder denselben Fehler. Mit /abort abbrechen.",
  "bot.unknown_command":
    "⚠️ Unbekannter Befehl: {command}. Nutze /help, um verfügbare Befehle zu sehen.",
  "bot.photo_downloading": "⏳ Lade Foto herunter...",
  "bot.photo_too_large": "⚠️ Foto ist zu groß (max. {maxSizeMb}MB)",
  "bot.photo_model_no_image":
    "⚠️ Das aktuelle Modell unterstützt keine Bildeingabe. Sende nur Text.",
  "bot.photo_download_error": "🔴 Foto konnte nicht heruntergeladen werden",
  "bot.photo_no_caption":
    "💡 Tipp: Füge eine Bildunterschrift hinzu, um zu beschreiben, was du mit diesem Foto tun möchtest.",
  "bot.file_downloading": "⏳ Lade Datei herunter...",
  "bot.file_too_large": "⚠️ Datei ist zu groß (max. {maxSizeMb}MB)",
  "bot.file_download_error": "🔴 Datei konnte nicht heruntergeladen werden",
  "bot.model_no_pdf": "⚠️ Das aktuelle Modell unterstützt keine PDF-Eingabe. Sende nur Text.",
  "bot.text_file_too_large": "⚠️ Textdatei ist zu groß (max. {maxSizeKb}KB)",
  "chat_limit.exceeded": "⚠️ Too many active chats. Wait for previous conversations to finish.",
  "rate_limit.exceeded": "⚠️ Too many messages. Please slow down.",

  "status.header_running": "🟢 OpenCode-Server läuft",
  "status.health.healthy": "OK",
  "status.health.unhealthy": "Nicht OK",
  "status.line.health": "Status: {health}",
  "status.line.version": "Version: {version}",
  "status.line.managed_yes": "Vom Bot gestartet: Ja",
  "status.line.managed_no": "Vom Bot gestartet: Nein",
  "status.line.pid": "PID: {pid}",
  "status.line.uptime_sec": "Betriebszeit: {seconds} s",
  "status.line.mode": "Modus: {mode}",
  "status.line.model": "Modell: {model}",
  "status.agent_not_set": "nicht gesetzt",
  "status.project_selected": "Projekt: {project}",
  "status.project_not_selected": "Projekt: nicht ausgewählt",
  "status.project_hint": "Nutze /projects, um ein Projekt auszuwahlen",
  "status.session_selected": "Aktuelle Sitzung: {title}",
  "status.session_not_selected": "Aktuelle Sitzung: nicht ausgewählt",
  "status.session_hint": "Nutze /sessions zur Auswahl oder /new zum Erstellen",
  "status.server_unavailable":
    "🔴 OpenCode-Server ist nicht verfügbar\n\nNutze /opencode_start, um den Server zu starten.",

  "projects.empty":
    "📭 Keine Projekte gefunden.\n\nÖffne ein Verzeichnis in OpenCode und erstelle mindestens eine Sitzung, dann erscheint es hier.",
  "projects.select": "Projekt auswählen:",
  "projects.select_with_current": "Projekt auswählen:\n\nAktuell: 🏗 {project}",
  "projects.page_indicator": "Seite {current}/{total}",
  "projects.prev_page": "⬅️ Zurück",
  "projects.next_page": "Weiter ➡️",
  "projects.fetch_error":
    "🔴 OpenCode-Server ist nicht verfügbar oder beim Laden der Projekte ist ein Fehler aufgetreten.",
  "projects.page_load_error": "Diese Seite konnte nicht geladen werden. Bitte versuche es erneut.",
  "projects.selected":
    "✅ Projekt ausgewählt: {project}\n\n📋 Sitzung wurde zurückgesetzt. Nutze /sessions oder /new für dieses Projekt.",
  "projects.select_error": "🔴 Projekt konnte nicht ausgewählt werden.",

  "sessions.project_not_selected":
    "🏗 Projekt ist nicht ausgewählt.\n\nWähle zuerst ein Projekt mit /projects.",
  "sessions.empty": "📭 Keine Sitzungen gefunden.\n\nErstelle eine neue Sitzung mit /new.",
  "sessions.select": "Sitzung auswählen:",
  "sessions.select_page": "Sitzung auswählen (Seite {page}):",
  "sessions.fetch_error":
    "🔴 OpenCode-Server ist nicht verfügbar oder beim Laden der Sitzungen ist ein Fehler aufgetreten.",
  "sessions.select_project_first": "🔴 Projekt ist nicht ausgewählt. Nutze /projects.",
  "sessions.page_empty_callback": "Auf dieser Seite gibt es keine Sitzungen",
  "sessions.page_load_error_callback":
    "Diese Seite kann nicht geladen werden. Bitte versuche es erneut.",
  "sessions.button.prev_page": "⬅️ Zurück",
  "sessions.button.next_page": "Weiter ➡️",
  "sessions.loading_context": "⏳ Lade Kontext und letzte Nachrichten...",
  "sessions.selected": "✅ Sitzung ausgewählt: {title}",
  "sessions.select_error": "🔴 Sitzung konnte nicht ausgewählt werden.",
  "sessions.preview.empty": "Keine neuen Nachrichten.",
  "sessions.preview.title": "Letzte Nachrichten:",
  "sessions.preview.you": "Du:",
  "sessions.preview.agent": "Agent:",

  "new.project_not_selected":
    "🏗 Projekt ist nicht ausgewählt.\n\nWähle zuerst ein Projekt mit /projects.",
  "new.created": "✅ Neue Sitzung erstellt: {title}",
  "new.create_error":
    "🔴 OpenCode-Server ist nicht verfügbar oder beim Erstellen der Sitzung ist ein Fehler aufgetreten.",

  "stop.no_active_session":
    "🛑 Agent wurde nicht gestartet\n\nErstelle eine Sitzung mit /new oder wähle eine über /sessions aus.",
  "stop.in_progress":
    "🛑 Event-Stream gestoppt, sende Abbruchsignal...\n\nWarte darauf, dass der Agent stoppt.",
  "stop.warn_unconfirmed":
    "⚠️ Event-Stream gestoppt, aber der Server hat den Abbruch nicht bestätigt.\n\nPrüfe /status und versuche /abort in ein paar Sekunden erneut.",
  "stop.warn_maybe_finished":
    "⚠️ Event-Stream gestoppt, aber der Agent konnte bereits fertig sein.",
  "stop.success":
    "✅ Agent-Aktion unterbrochen. Von diesem Lauf werden keine weiteren Nachrichten gesendet.",
  "stop.warn_still_busy":
    "⚠️ Signal gesendet, aber der Agent ist noch beschäftigt.\n\nDer Event-Stream ist bereits deaktiviert, daher werden keine Zwischenmeldungen gesendet.",
  "stop.warn_timeout":
    "⚠️ Timeout beim Abbruch.\n\nDer Event-Stream ist bereits deaktiviert, versuche /abort in ein paar Sekunden erneut.",
  "stop.warn_local_only":
    "⚠️ Event-Stream lokal gestoppt, aber serverseitiger Abbruch ist fehlgeschlagen.",
  "stop.error":
    "🔴 Aktion konnte nicht gestoppt werden.\n\nEvent-Stream ist gestoppt, versuche /abort erneut.",

  "opencode_start.already_running_managed":
    "⚠️ OpenCode-Server läuft bereits\n\nPID: {pid}\nBetriebszeit: {seconds} Sekunden",
  "opencode_start.already_running_external":
    "✅ OpenCode-Server läuft bereits als externer Prozess\n\nVersion: {version}\n\nDieser Server wurde nicht vom Bot gestartet, daher kann /opencode-stop ihn nicht stoppen.",
  "opencode_start.starting": "🔄 Starte OpenCode-Server...",
  "opencode_start.start_error":
    "🔴 OpenCode-Server konnte nicht gestartet werden\n\nFehler: {error}\n\nPrüfe, ob OpenCode CLI installiert und im PATH verfügbar ist:\nopencode --version\nnpm install -g @opencode-ai/cli",
  "opencode_start.started_not_ready":
    "⚠️ OpenCode-Server gestartet, aber reagiert nicht\n\nPID: {pid}\n\nDer Server startet möglicherweise noch. Versuche /status in ein paar Sekunden.",
  "opencode_start.success":
    "✅ OpenCode-Server erfolgreich gestartet\n\nPID: {pid}\nVersion: {version}",
  "opencode_start.error":
    "🔴 Beim Starten des Servers ist ein Fehler aufgetreten.\n\nSiehe Anwendungslogs für Details.",
  "opencode_stop.external_running":
    "⚠️ OpenCode-Server läuft als externer Prozess\n\nDieser Server wurde nicht über /opencode-start gestartet.\nStoppe ihn manuell oder nutze /status, um den Zustand zu prüfen.",
  "opencode_stop.not_running": "⚠️ OpenCode-Server läuft nicht",
  "opencode_stop.stopping": "🛑 Stoppe OpenCode-Server...\n\nPID: {pid}",
  "opencode_stop.stop_error": "🔴 OpenCode-Server konnte nicht gestoppt werden\n\nFehler: {error}",
  "opencode_stop.success": "✅ OpenCode-Server erfolgreich gestoppt",
  "opencode_stop.error":
    "🔴 Beim Stoppen des Servers ist ein Fehler aufgetreten.\n\nSiehe Anwendungslogs für Details.",

  "agent.changed_callback": "Modus geändert: {name}",
  "agent.changed_message": "✅ Modus geändert zu: {name}",
  "agent.change_error_callback": "Modus konnte nicht geändert werden",
  "agent.menu.current": "Aktueller Modus: {name}\n\nModus auswählen:",
  "agent.menu.select": "Arbeitsmodus auswählen:",
  "agent.menu.empty": "⚠️ Keine verfügbaren Agenten",
  "agent.menu.error": "🔴 Agentenliste konnte nicht geladen werden",

  "model.changed_callback": "Modell geändert: {name}",
  "model.changed_message": "✅ Modell geändert zu: {name}",
  "model.change_error_callback": "Modell konnte nicht geändert werden",
  "model.menu.empty": "⚠️ Keine verfügbaren Modelle",
  "model.menu.select": "Modell auswählen:",
  "model.menu.current": "Aktuelles Modell: {name}\n\nModell auswählen:",
  "model.menu.favorites_title":
    "⭐ Favoriten (Füge Modelle in OpenCode CLI zu den Favoriten hinzu)",
  "model.menu.favorites_empty": "— Leer.",
  "model.menu.recent_title": "🕘 Zuletzt verwendet",
  "model.menu.recent_empty": "— Leer.",
  "model.menu.favorites_hint":
    "ℹ️ Füge Modelle in OpenCode CLI zu den Favoriten hinzu, damit sie oben angezeigt werden.",
  "model.menu.error": "🔴 Modellliste konnte nicht geladen werden",

  "variant.model_not_selected_callback": "Fehler: Modell ist nicht ausgewählt",
  "variant.changed_callback": "Variante geändert: {name}",
  "variant.changed_message": "✅ Variante geändert zu: {name}",
  "variant.change_error_callback": "Variante konnte nicht geändert werden",
  "variant.select_model_first": "⚠️ Zuerst ein Modell auswählen",
  "variant.menu.empty": "⚠️ Keine verfügbaren Varianten",
  "variant.menu.current": "Aktuelle Variante: {name}\n\nVariante auswählen:",
  "variant.menu.error": "🔴 Variantenliste konnte nicht geladen werden",

  "context.button.confirm": "✅ Ja, Kontext komprimieren",
  "context.no_active_session": "⚠️ Keine aktive Sitzung. Erstelle eine Sitzung mit /new",
  "context.confirm_text":
    '📊 Kontext-Komprimierung für Sitzung "{title}"\n\nDadurch wird die Kontextnutzung reduziert, indem alte Nachrichten aus dem Verlauf entfernt werden. Die aktuelle Aufgabe wird nicht unterbrochen.\n\nFortfahren?',
  "context.callback_session_not_found": "Sitzung nicht gefunden",
  "context.callback_compacting": "Komprimiere Kontext...",
  "context.progress": "⏳ Komprimiere Kontext...",
  "context.error": "❌ Kontext-Komprimierung fehlgeschlagen",
  "context.success": "✅ Kontext erfolgreich komprimiert",

  "permission.inactive_callback": "Berechtigungsanfrage ist inaktiv",
  "permission.processing_error_callback": "Verarbeitungsfehler",
  "permission.no_active_request_callback": "Fehler: keine aktive Anfrage",
  "permission.reply.once": "Einmal erlaubt",
  "permission.reply.always": "Immer erlaubt",
  "permission.reply.reject": "Abgelehnt",
  "permission.send_reply_error": "❌ Antwort auf Berechtigungsanfrage konnte nicht gesendet werden",
  "permission.blocked.expected_reply":
    "⚠️ Bitte beantworte zuerst die Berechtigungsanfrage mit den Buttons oben.",
  "permission.blocked.command_not_allowed":
    "⚠️ Dieser Befehl ist erst verfügbar, wenn du die Berechtigungsanfrage beantwortet hast.",
  "permission.header": "{emoji} Berechtigungsanfrage: {name}\n\n",
  "permission.button.allow": "✅ Einmal erlauben",
  "permission.button.always": "🔓 Immer erlauben",
  "permission.button.reject": "❌ Ablehnen",
  "permission.name.bash": "Bash",
  "permission.name.edit": "Bearbeiten",
  "permission.name.write": "Schreiben",
  "permission.name.read": "Lesen",
  "permission.name.webfetch": "Web-Abruf",
  "permission.name.websearch": "Web-Suche",
  "permission.name.glob": "Dateisuche",
  "permission.name.grep": "Inhaltssuche",
  "permission.name.list": "Verzeichnis auflisten",
  "permission.name.task": "Task",
  "permission.name.lsp": "LSP",
  "permission.name.external_directory": "Externes Verzeichnis",

  "question.inactive_callback": "Umfrage ist inaktiv",
  "question.processing_error_callback": "Verarbeitungsfehler",
  "question.select_one_required_callback": "Wähle mindestens eine Option",
  "question.enter_custom_callback": "Sende deine eigene Antwort als Nachricht",
  "question.cancelled": "❌ Umfrage abgebrochen",
  "question.answer_already_received": "Antwort bereits erhalten, bitte warten...",
  "question.completed_no_answers": "✅ Umfrage abgeschlossen (keine Antworten)",
  "question.no_active_project": "❌ Kein aktives Projekt",
  "question.no_active_request": "❌ Keine aktive Anfrage",
  "question.send_answers_error": "❌ Antworten konnten nicht an den Agenten gesendet werden",
  "question.multi_hint": "\n(Du kannst mehrere Optionen auswählen)",
  "question.button.submit": "✅ Fertig",
  "question.button.custom": "🔤 Eigene Antwort",
  "question.button.cancel": "❌ Abbrechen",
  "question.use_custom_button_first":
    '⚠️ Um Text zu senden, tippe zuerst bei der aktuellen Frage auf "Eigene Antwort".',
  "question.summary.title": "✅ Umfrage abgeschlossen!\n\n",
  "question.summary.question": "Frage {index}:\n{question}\n\n",
  "question.summary.answer": "Antwort:\n{answer}\n\n",

  "keyboard.agent_mode": "{emoji} {name} Modus",
  "keyboard.context": "📊 {used} / {limit} ({percent}%)",
  "keyboard.context_empty": "📊 0",
  "keyboard.variant": "💭 {name}",
  "keyboard.variant_default": "💡 Standard",
  "keyboard.updated": "⌨️ Tastatur aktualisiert",

  "pinned.default_session_title": "neue Sitzung",
  "pinned.unknown": "Unbekannt",
  "pinned.line.project": "Projekt: {project}",
  "pinned.line.model": "Modell: {model}",
  "pinned.line.context": "Kontext: {used} / {limit} ({percent}%)",
  "pinned.line.cost": "Kosten: {cost} ausgegeben",
  "pinned.files.title": "Dateien ({count}):",
  "pinned.files.item": "  {path}{diff}",
  "pinned.files.more": "  ... und {count} mehr",

  "tool.todo.overflow": "*({count} weitere Aufgaben)*",
  "tool.file_header.write":
    "Datei/Pfad schreiben: {path}\n============================================================\n\n",
  "tool.file_header.edit":
    "Datei/Pfad bearbeiten: {path}\n============================================================\n\n",

  "runtime.wizard.ask_token": "Telegram-Bot-Token eingeben (von @BotFather).\n> ",
  "runtime.wizard.ask_language":
    "Oberflächensprache auswählen.\nGib die Sprach-Nummer aus der Liste oder den Locale-Code ein.\nDrücke Enter, um die Standardsprache beizubehalten: {defaultLocale}\n{options}\n> ",
  "runtime.wizard.language_invalid":
    "Gib eine Sprach-Nummer aus der Liste oder einen unterstützten Locale-Code ein.\n",
  "runtime.wizard.language_selected": "Ausgewählte Sprache: {language}\n",
  "runtime.wizard.token_required": "Token ist erforderlich. Bitte versuche es erneut.\n",
  "runtime.wizard.token_invalid":
    "Token sieht ungültig aus (erwartetes Format <id>:<secret>). Bitte versuche es erneut.\n",
  "runtime.wizard.ask_user_id":
    "Gib deine Telegram User ID ein (du bekommst sie bei @userinfobot).\n> ",
  "runtime.wizard.user_id_invalid": "Gib eine positive ganze Zahl ein (> 0).\n",
  "runtime.wizard.ask_api_url":
    "OpenCode API URL eingeben (optional).\nEnter drücken für Standard: {defaultUrl}\n> ",
  "runtime.wizard.ask_server_username":
    "OpenCode-Server-Benutzername eingeben (optional).\nEnter drücken für Standard: {defaultUsername}\n> ",
  "runtime.wizard.ask_server_password":
    "OpenCode-Server-Passwort eingeben (optional).\nEnter drücken, um es leer zu lassen.\n> ",
  "runtime.wizard.api_url_invalid":
    "Gib eine gültige URL (http/https) ein oder drücke Enter für Standard.\n",
  "runtime.wizard.start": "OpenCode Telegram Bot Einrichtung.\n",
  "runtime.wizard.saved": "Konfiguration gespeichert:\n- {envPath}\n- {settingsPath}\n",
  "runtime.wizard.not_configured_starting":
    "Anwendung ist noch nicht konfiguriert. Starte Assistent...\n",
  "runtime.wizard.tty_required":
    "Der interaktive Assistent erfordert ein TTY-Terminal. Führe `opencode-telegram config` in einer interaktiven Shell aus.",

  "rename.no_session": "⚠️ Keine aktive Sitzung. Erstelle oder wähle zuerst eine Sitzung.",
  "rename.prompt": "📝 Neuen Titel für die Sitzung eingeben:\n\nAktuell: {title}",
  "rename.empty_title": "⚠️ Titel darf nicht leer sein.",
  "rename.success": "✅ Sitzung umbenannt in: {title}",
  "rename.error": "🔴 Sitzung konnte nicht umbenannt werden.",
  "rename.cancelled": "❌ Umbenennen abgebrochen.",
  "rename.inactive_callback": "Umbenennen-Anfrage ist inaktiv",
  "rename.inactive": "⚠️ Umbenennen-Anfrage ist nicht aktiv. Starte /rename erneut.",
  "rename.blocked.expected_name":
    "⚠️ Sende den neuen Sitzungsnamen als Text oder tippe in der Umbenennen-Nachricht auf Abbrechen.",
  "rename.blocked.command_not_allowed":
    "⚠️ Dieser Befehl ist nicht verfügbar, solange beim Umbenennen auf einen neuen Namen gewartet wird.",
  "rename.button.cancel": "❌ Abbrechen",

  "task.prompt.schedule":
    "⏰ Sende den Zeitplan der Aufgabe in natürlicher Sprache.\n\nBeispiele:\n- alle 5 Minuten\n- jeden Tag um 17:00\n- morgen um 12:00",
  "task.schedule_empty": "⚠️ Der Zeitplan darf nicht leer sein.",
  "task.parse.in_progress": "⏳ Zeitplan wird verarbeitet...",
  "task.parse_error":
    "🔴 Zeitplan konnte nicht erkannt werden.\n\n{message}\n\nSende den Zeitraum bitte noch einmal klarer formuliert.",
  "task.schedule_preview":
    "✅ Zeitplan erkannt\n\nVerstanden als: {summary}\n{cronLine}Zeitzone: {timezone}\nTyp: {kind}\nNächster Lauf: {nextRunAt}",
  "task.schedule_preview.cron": "Cron: {cron}",
  "task.prompt.body": "📝 Sende jetzt, was der Bot nach Zeitplan tun soll.",
  "task.prompt_empty": "⚠️ Der Aufgabentext darf nicht leer sein.",
  "task.created":
    "✅ Geplante Aufgabe erstellt\n\nAufgabe: {description}\nProjekt: {project}\nModell: {model}\nZeitplan: {schedule}\n{cronLine}Nächster Lauf: {nextRunAt}",
  "task.created.cron": "Cron: {cron}",
  "task.button.retry_schedule": "🔁 Zeitplan neu eingeben",
  "task.button.cancel": "❌ Abbrechen",
  "task.retry_schedule_callback": "Zeitplaneingabe wird zurückgesetzt...",
  "task.cancel_callback": "Abbruch...",
  "task.cancelled": "❌ Erstellung der geplanten Aufgabe abgebrochen.",
  "task.inactive_callback": "Dieser Ablauf für geplante Aufgaben ist nicht mehr aktiv",
  "task.inactive": "⚠️ Die Erstellung geplanter Aufgaben ist nicht aktiv. Starte /task erneut.",
  "task.blocked.expected_input":
    "⚠️ Schließe zuerst die aktuelle geplante Aufgabe ab: Sende Text oder nutze die Schaltfläche in der Zeitplan-Nachricht.",
  "task.blocked.command_not_allowed":
    "⚠️ Dieser Befehl ist nicht verfügbar, solange die Erstellung einer geplanten Aufgabe aktiv ist.",
  "task.limit_reached":
    "⚠️ Aufgabenlimit erreicht ({limit}). Lösche zuerst eine bestehende geplante Aufgabe.",
  "task.schedule_too_frequent":
    "Der wiederkehrende Zeitplan ist zu häufig. Das minimale erlaubte Intervall ist einmal alle 5 Minuten.",
  "task.kind.cron": "wiederkehrend",
  "task.kind.once": "einmalig",
  "task.run.success": "⏰ Geplante Aufgabe abgeschlossen: {description}",
  "task.run.error": "🔴 Geplante Aufgabe fehlgeschlagen: {description}\n\nFehler: {error}",

  "tasklist.empty": "📭 Noch keine geplanten Aufgaben.",
  "tasklist.select": "Wähle eine geplante Aufgabe:",
  "tasklist.details":
    "⏰ Geplante Aufgabe\n\nAufgabe: {prompt}\nProjekt: {project}\nZeitplan: {schedule}\n{cronLine}Zeitzone: {timezone}\nNächster Lauf: {nextRunAt}\nLetzter Lauf: {lastRunAt}\nAnzahl Läufe: {runCount}",
  "tasklist.details.cron": "Cron: {cron}",
  "tasklist.button.delete": "🗑 Löschen",
  "tasklist.button.cancel": "❌ Abbrechen",
  "tasklist.deleted_callback": "Gelöscht",
  "tasklist.cancelled_callback": "Abgebrochen",
  "tasklist.inactive_callback": "Dieses Menü für geplante Aufgaben ist inaktiv",
  "tasklist.load_error": "🔴 Geplante Aufgaben konnten nicht geladen werden.",

  "commands.select": "Wähle einen OpenCode-Befehl:",
  "commands.empty": "📭 Für dieses Projekt sind keine OpenCode-Befehle verfügbar.",
  "commands.fetch_error": "🔴 OpenCode-Befehle konnten nicht geladen werden.",
  "commands.no_description": "Keine Beschreibung",
  "commands.button.execute": "✅ Ausführen",
  "commands.button.cancel": "❌ Abbrechen",
  "commands.confirm":
    "Bestätige die Ausführung des Befehls {command}. Für die Ausführung mit Argumenten sende die Argumente als Nachricht.",
  "commands.inactive_callback": "Dieses Befehlsmenü ist inaktiv",
  "commands.cancelled_callback": "Abgebrochen",
  "commands.execute_callback": "Befehl wird ausgeführt...",
  "commands.executing_prefix": "⚡ Befehl wird ausgeführt:",
  "commands.arguments_empty":
    "⚠️ Argumente dürfen nicht leer sein. Sende Text oder tippe auf Ausführen.",
  "commands.execute_error": "🔴 OpenCode-Befehl konnte nicht ausgeführt werden.",
  "commands.select_page": "Wähle einen OpenCode-Befehl (Seite {page}):",
  "commands.button.prev_page": "⬅️ Zurück",
  "commands.button.next_page": "Weiter ➡️",
  "commands.page_empty_callback": "Keine Befehle auf dieser Seite",
  "commands.page_load_error_callback":
    "Diese Seite konnte nicht geladen werden. Bitte versuche es erneut.",

  "cmd.description.rename": "Aktuelle Sitzung umbenennen",

  "cli.usage":
    "Verwendung:\n  opencode-telegram [start] [--mode sources|installed]\n  opencode-telegram status\n  opencode-telegram stop\n  opencode-telegram config\n\nHinweise:\n  - Ohne Befehl wird standardmäßig `start` verwendet\n  - `--mode` wird derzeit nur für `start` unterstützt",
  "cli.placeholder.status":
    "Befehl `status` ist derzeit ein Platzhalter. Echte Statusprüfungen werden in der Service-Schicht hinzugefügt (Phase 5).",
  "cli.placeholder.stop":
    "Befehl `stop` ist derzeit ein Platzhalter. Ein echter Stop des Hintergrundprozesses wird in der Service-Schicht hinzugefügt (Phase 5).",
  "cli.placeholder.unavailable": "Befehl ist nicht verfügbar.",
  "cli.error.prefix": "CLI-Fehler: {message}",
  "cli.args.unknown_command": "Unbekannter Befehl: {value}",
  "cli.args.mode_requires_value": "Option --mode erfordert einen Wert: sources|installed",
  "cli.args.invalid_mode": "Ungültiger Wert für --mode: {value}. Erwartet sources|installed",
  "cli.args.unknown_option": "Unbekannte Option: {value}",
  "cli.args.mode_only_start": "Option --mode wird nur für den start-Befehl unterstützt",

  "legacy.models.fetch_error":
    "🔴 Modellliste konnte nicht geladen werden. Prüfe den Serverstatus mit /status.",
  "legacy.models.empty": "📋 Keine verfügbaren Modelle. Konfiguriere Provider in OpenCode.",
  "legacy.models.header": "📋 Verfügbare Modelle:\n\n",
  "legacy.models.no_provider_models": "  ⚠️ Keine verfügbaren Modelle\n",
  "legacy.models.env_hint": "💡 Um ein Modell in .env zu nutzen:\n",
  "legacy.models.error": "🔴 Beim Laden der Modellliste ist ein Fehler aufgetreten.",

  "stt.recognizing": "🎤 Erkenne Audio...",
  "stt.recognized": "🎤 Erkannt:\n{text}",
  "stt.not_configured":
    "🎤 Spracherkennung ist nicht konfiguriert.\n\nSetze STT_API_URL und STT_API_KEY in .env, um sie zu aktivieren.",
  "stt.error": "🔴 Audio konnte nicht erkannt werden: {error}",
  "stt.empty_result": "🎤 Keine Sprache in der Audionachricht erkannt.",
  "cmd.description.shell": "Execute a shell command on this PC",
  "cmd.description.ls": "List directory contents on this PC",
  "cmd.description.read": "Read a local file's contents",
  "cmd.description.tasks": "List your recent prompt tasks",
  "cmd.description.logs": "View system logs for a service",
  "cmd.description.health": "Check system health status",
  "cmd.description.journal": "View systemd journal errors",
  "cmd.description.sandbox": "Run command in bubblewrap sandbox",
  "cmd.description.cost": "Cost and token usage analytics",
  "cmd.description.export": "Export session as file",
  "cmd.description.messages": "Browse session history",
  "cmd.description.skills": "Browse available skills",
  "cmd.description.mcps": "Browse MCP servers",
  "cmd.description.models": "Browse and select models",
  "cmd.description.compact": "Compact session context to free up tokens",
  "cmd.description.steer": "Interrupt and redirect the agent",

  "export.error_no_session": "❌ No active session. Start a new session first.",
  "export.no_session": "❌ No active session to export.",
  "export.exporting": "📤 Exporting session...",
  "export.success": "✅ Session exported to {path}",
  "export.error": "🔴 Export failed: {error}",

  "fe.error_no_session": "❌ No active session. Start a new session first.",
  "fe.error_no_project": "❌ No active project. Select a project first.",
  "fe.empty_directory": "📭 Empty directory",
  "fe.select_hint": "Select a file to read, or back to go up",
  "fe.error_listing": "🔴 Failed to list directory: {error}",
  "fe.inactive_callback": "This file explorer is inactive",
  "fe.closed": "✅ File explorer closed",
  "fe.reading_file": "📖 Reading file...",
  "fe.error_reading": "🔴 Failed to read file: {error}",
  "fe.selected_path": "📄 Selected: {path}",

  "mcps.status.connected": "🟢 Connected",
  "mcps.status.disabled": "⚪ Disabled",
  "mcps.status.failed": "🔴 Failed",
  "mcps.status.needs_auth": "🔐 Needs Auth",
  "mcps.status.needs_client_registration": "📝 Needs Registration",
  "mcps.status.unknown": "❓ Unknown",
  "mcps.header": "🖥 MCP Servers",
  "mcps.button.disconnect": "Disconnect",
  "mcps.button.connect": "Connect",
  "mcps.button.cancel": "Cancel",
  "mcps.error_no_chat": "❌ Cannot connect MCP server: no active chat",
  "mcps.no_project": "❌ No active project. Select a project first.",
  "mcps.empty": "📭 No MCP servers configured",
  "mcps.hint": "💡 Connect to browse MCP servers",
  "mcps.error_load": "🔴 Failed to load MCP servers: {error}",
  "mcps.inactive_callback": "This MCP menu is inactive",
  "mcps.cancelled_callback": "Cancelled",
  "mcps.not_found": "❌ MCP server not found: {name}",
  "mcps.disconnecting": "🔄 Disconnecting {name}...",
  "mcps.disconnected": "✅ Disconnected {name}",
  "mcps.disconnect_error": "🔴 Failed to disconnect {name}: {error}",
  "mcps.connecting": "🔄 Connecting {name}...",
  "mcps.connected": "✅ Connected {name}",
  "mcps.connect_error": "🔴 Failed to connect {name}: {error}",

  "messages.header": "💬 Session Messages",
  "messages.button.fork": "Fork",
  "messages.button.revert": "Revert",
  "messages.button.prev": "⬅️ Prev",
  "messages.button.next": "Next ➡️",
  "messages.button.cancel": "Cancel",
  "messages.error_no_session": "❌ No active session. Start a new session first.",
  "messages.no_session": "❌ No active session.",
  "messages.no_project": "❌ No active project. Select a project first.",
  "messages.empty": "📭 No messages in this session",
  "messages.error_load": "🔴 Failed to load messages: {error}",
  "messages.inactive_callback": "This messages menu is inactive",
  "messages.cancelled_callback": "Cancelled",
  "messages.forking": "🔄 Forking session...",
  "messages.fork_error": "🔴 Failed to fork session: {error}",
  "messages.fork_success": "✅ Session forked",
  "messages.reverting": "🔄 Reverting to message...",
  "messages.revert_error": "🔴 Failed to revert: {error}",
  "messages.revert_success": "✅ Reverted to message",

  "skills.no_description": "No description",
  "skills.header": "🛠 Available Skills",
  "skills.button.prev": "⬅️ Prev",
  "skills.button.next": "Next ➡️",
  "skills.button.cancel": "Cancel",
  "skills.error_no_session": "❌ No active session. Start a new session first.",
  "skills.no_project": "❌ No active project. Select a project first.",
  "skills.empty": "📭 No skills available",
  "skills.hint": "💡 Activate a skill to use it",
  "skills.error_load": "🔴 Failed to load skills: {error}",
  "skills.inactive_callback": "This skills menu is inactive",
  "skills.cancelled_callback": "Cancelled",
  "skills.not_found": "❌ Skill not found: {name}",
  "skills.activating": "🔄 Activating {name}...",
  "skills.activation_notice": "✅ Skill {name} activated. It will be loaded for the next prompt.",
  "skills.no_session_warning": "⚠️ No active session. Activate after starting a session.",

  "steer.usage": "📖 Usage: /steer <message> — Interrupt and redirect the agent with your message",
  "steer.abort_failed": "🔴 Failed to abort current task: {error}",

  "ask_and_leave.usage": "📖 Usage: /ask_and_leave <question> — Ask in group and leave",
  "ask_and_leave.no_group": "❌ This command only works in groups",
  "ask_and_leave.sending": "📨 Sending question to group admins...",
  "ask_and_leave.success": "✅ Question sent to group admins",
  "ask_and_leave.error": "🔴 Failed to send question: {error}",
  "ask_and_leave.error.groups_only": "❌ This command only works in groups",
  "ask_and_leave.error.no_query": "❌ Please provide a question to ask",

  "llm.guard.blocked": "⛔️ Command blocked: {reason}",
  "llm.guard.command_blocked": "⛔️ This command is not allowed by the LLM guard",
  "llm.guard.not_allowed": "⛔️ Not allowed",
  "llm.guard.fallback_query": "💭 Fallback query triggered",
  "llm.guard.query_timeout": "⏰ Query timeout",
  "llm.guard.query_too_short": "⚠️ Query too short",
  "llm.guard.nothing_pending": "ℹ️ Nothing pending",
  "llm.guard.confirm_timeout": "⏰ Confirmation timeout",
  "llm.guard.cancelled": "Cancelled",
  "llm.guard.edit_prompt": "Edit prompt",
  "llm.guard.queue_failed": "Failed to queue command",

  "permission.denied.super_user_only": "⛔️ This action is restricted to super users only",

  "inline.cmd.button.generate": "Generate",
  "inline.cmd.button.edit": "Edit",
  "inline.cmd.suggestion.usage": "Usage: @{bot_username} <command>:<args>",
  "inline.cmd.error.query_too_short": "Query too short",
  "inline.cmd.error.callback_invalid": "Invalid callback",
  "inline.cmd.error.callback_expired": "Callback expired",
  "inline.cmd.error.resolution_failed": "Resolution failed",
  "inline.cmd.summarise.title": "Summarize",
  "inline.cmd.summarise.description": "Summarize the conversation",
  "inline.cmd.eli5.title": "Explain Like I'm 5",
  "inline.cmd.eli5.description": "Explain in simple terms",
  "inline.cmd.deep_research.title": "Deep Research",
  "inline.cmd.deep_research.description": "Research a topic thoroughly",
  "inline.cmd.steel_man.title": "Steel Man",
  "inline.cmd.steel_man.description": "Present the strongest argument for an opposing view",
  "inline.cmd.feynman.title": "Feynman",
  "inline.cmd.feynman.description": "Explain a concept as if teaching to a beginner",
  "inline.cmd.devils_advocate.title": "Devil's Advocate",
  "inline.cmd.devils_advocate.description": "Argue against the current position",

  "inline.thinking": "💭 Thinking...",

  "bot.working_on_it": "⏳ Working on it...",
  "bot.session_reset_to_global": "Session was reset to global default",

  "tts.enabled": "🔊 Text-zu-Sprache aktiviert",
  "tts.disabled": "🔇 Text-zu-Sprache deaktiviert",
  "tts.error": "❌ TTS-Fehler",
  "tts.failed": "❌ Audio-Antwort konnte nicht generiert werden.",
  "tts.not_configured": "⚠️ TTS ist nicht konfiguriert. Setzen Sie TTS_API_URL und TTS_API_KEY.",
  "tts.text_too_long": "⚠️ Text zu lang für TTS (maximal {max} Zeichen)",
  "cmd.description.tts": "Text-zu-Sprache für Antworten umschalten",
  "status.health.checking": "Checking...",
  "open.no_subfolders": "No subfolders",
  "open.subfolder_count": "{count} subfolder",
  "open.subfolders_count": "{count} subfolders",

  // === Tasks Command ===
  "tasks.no_user": "❌ Benutzer konnte nicht identifiziert werden.",
  "tasks.empty": "📋 Keine Aufgaben gefunden. Senden Sie eine Eingabe, um eine Aufgabe zu erstellen!",
  "tasks.header": "📋 <b>Ihre letzten Aufgaben</b>",
  "tasks.error": "❌ Aufgaben konnten nicht abgerufen werden.",

  // === Shell Command ===
  "shell.usage": "⚠️ Bitte geben Sie einen Befehl an.\nVerwendung: <code>/shell ls -la</code>",
  "shell.expired": "Befehl abgelaufen. Bitte erneut versuchen.",
  "shell.executing": "Wird ausgeführt...",
  "shell.cancelled": "Abgebrochen",
  "shell.cancelled_msg": "❌ Befehl vom Benutzer abgebrochen.",
  "shell.running": "⏳ <i>Lokale Ausführung: <code>{command}</code>...</i>",
  "shell.running_elapsed":
    "⏳ <i>Lokale Ausführung: <code>{command}</code>...\n⏱️ {elapsed} vergangen</i>",
  "shell.output": "💻 <b>Shell-Ausgabe</b> [{elapsed}]",
  "shell.output_part": "💻 <b>Shell-Ausgabe ({part}/{total})</b> [{elapsed}]",
  "shell.error": "❌ <b>Fehler:</b>\n<pre>{message}</pre>",

  // === Sandbox Command ===
  "sandbox.usage":
    "🔒 <b>Sandbox-Analysator</b>\n\nSkripte/URLs in einer isolierten Bubblewrap-Sandbox mit Sicherheitsanalyse ausführen.\n\nVerwendung:\n<code>/sandbox curl https://example.com/script.sh | sh</code>\n<code>/sandbox https://example.com/malware.sh</code>\n<code>/sandbox cat /etc/passwd</code>\n\nNetzwerk ist standardmäßig deaktiviert. Verwenden Sie /sandbox --network für Netzwerkzugriff.",
  "sandbox.no_command": "⚠️ Bitte geben Sie einen Befehl oder eine URL zur Analyse an.",
  "sandbox.no_bwrap":
    "❌ <b>bubblewrap ist nicht verfügbar</b>\n\nDieser Befehl erfordert bubblewrap (bwrap) auf dem System.\nInstallation: sudo apt install bubblewrap",
  "sandbox.running":
    "🔒 <i>Ausführung in Sandbox{network}: <code>{command}</code>...</i>",
  "sandbox.header": "🔒 <b>Sandbox-Analyse</b> [{elapsed}]",
  "sandbox.timed_out": "⏱️ <i>Zeitüberschreitung nach {seconds}s</i>",
  "sandbox.exit_code": "Exit-Code: {code}",
  "sandbox.output": "📤 <b>Ausgabe</b>",
  "sandbox.output_part": "📤 <b>Ausgabe ({part}/{total})</b>",
  "sandbox.stderr": "📕 <b>Stderr</b>",
  "sandbox.stderr_part": "📕 <b>Stderr ({part}/{total})</b>",
  "sandbox.error": "❌ <b>Sandbox-Fehler:</b>\n<pre>{message}</pre>",

  // === Read Command ===
  "read.usage":
    "⚠️ Bitte geben Sie einen Dateipfad an.\nVerwendung: <code>/read src/index.ts</code>",
  "read.reading": "📄 <i>Lesen: {file}...</i>",
  "read.header": "📄 <b>{file}:</b>",
  "read.header_part": "📄 <b>{file} (Teil {part}/{total}):</b>",
  "read.error": "❌ <b>Fehler beim Lesen der Datei:</b>\n<pre>{message}</pre>",

  // === Journal Command ===
  "journal.watch_started":
    "👀 <b>Journal-Überwachungsmodus gestartet</b>\n\nIch überwache neue Systemfehler und benachrichtige Sie.\n\nVerwenden Sie /journal, um aktuelle Fehler zu prüfen.",
  "journal.fetching": "📋 <i>Aktuelle Systemfehler werden abgerufen...</i>",
  "journal.error": "❌ <b>Fehler beim Abrufen des Journals:</b>\n<pre>{message}</pre>",

  // === Health Command ===
  "health.checking": "📊 Systemzustand wird überprüft...",
  "health.error": "❌ Systemzustand konnte nicht überprüft werden.",

  // === Cost Command ===
  "cost.no_chat": "❌ Chat konnte nicht identifiziert werden.",
  "cost.header": "💰 <b>Kosten- &amp; Nutzungsbericht</b>",
  "cost.current_session": "📊 <b>Aktuelle Sitzung:</b>",
  "cost.today": "📅 <b>Heute:</b>",
  "cost.week": "📆 <b>Diese Woche:</b>",
  "cost.by_model": "🏷️ <b>Nach Modell (Heute):</b>",
  "cost.error": "❌ Kostenbericht konnte nicht erstellt werden.",

  // === Git Commands ===
  "git.branch.checking": "🌿 Branches werden geprüft...",
  "git.branch.empty": "Keine Branches gefunden.",
  "git.branch.header": "🌿 <b>Git Branches</b>",
  "git.branch.header_part": "🌿 <b>Git Branches ({part}/{total})</b>",
  "git.branch.error": "❌ <b>Git Branch Fehler:</b>\n<pre>{message}</pre>",
  "git.commit.usage": "⚠️ Bitte geben Sie eine Commit-Nachricht an.\nVerwendung: <code>/commit Ihre Nachricht hier</code>",
  "git.commit.committing": "📝 Änderungen werden committet...",
  "git.commit.success": "Änderungen erfolgreich committet.",
  "git.commit.header": "📝 <b>Git Commit</b>",
  "git.commit.header_part": "📝 <b>Git Commit ({part}/{total})</b>",
  "git.commit.error": "❌ <b>Git Commit Fehler:</b>\n<pre>{message}</pre>",
  "git.diff.checking": "📊 Änderungen werden geprüft...",
  "git.diff.no_changes": "📊 Keine Änderungen. Working tree ist sauber.",
  "git.diff.header": "📊 <b>Git Diff</b>",
  "git.diff.header_part": "📊 <b>Git Diff ({part}/{total})</b>",
  "git.diff.staged_header": "📊 <b>Git Diff (Staged)</b>",
  "git.diff.staged_header_part": "📊 <b>Git Diff (Staged) ({part}/{total})</b>",
  "git.diff.error": "❌ <b>Git Diff Fehler:</b>\n<pre>{message}</pre>",
};
