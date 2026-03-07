# Smutje – Self-hosted Team Chat

A lightweight, self-hosted team chat for small crews. Built to run on minimal hardware (Hetzner CX22, 512 MB RAM).

**Smutje** (niederdeutsch für Schiffskoch) – ein schlanker, selbstgehosteter Team-Chat für kleine Teams. Läuft auf minimaler Hardware.

## Quickstart

```bash
git clone https://github.com/AndreasPelczer/Smutje.git
cd Smutje
cp .env.example .env
# Tokens in .env anpassen
docker-compose up -d
```

Chat öffnen: `http://localhost:3000`

## Architektur

```
┌──────────────────────────────────────────────┐
│                   Browser                    │
│           client/index.html                  │
│     (Vanilla JS, WebSocket, Jitsi API)       │
└──────────┬──────────────┬────────────────────┘
           │ HTTP/REST    │ WebSocket
           ▼              ▼
┌──────────────────────────────────────────────┐
│              server/index.js                 │
│         Express + ws auf Port 3000           │
├──────────────┬───────────────────────────────┤
│  auth.js     │         db.js                 │
│  Token-Auth  │   SQLite (better-sqlite3)     │
│  via X-Token │   users, channels, messages   │
└──────────────┴──────────┬────────────────────┘
                          │
                          ▼
                    smutje.db (SQLite)
```

## REST-Endpunkte

| Methode | Pfad                | Auth   | Beschreibung                  |
|---------|---------------------|--------|-------------------------------|
| POST    | `/login`            | Token  | Token prüfen, Name zurück     |
| GET     | `/channels`         | Token  | Alle Channels auflisten       |
| GET     | `/messages/:channel`| Token  | Letzte 50 Nachrichten         |

Header: `X-Token: <uuid>`

## WebSocket

Verbindung: `ws://host:3000/?token=<uuid>`

Nachrichten (JSON):
- `{ "type": "join", "channel": "küche" }` – Channel wechseln
- `{ "type": "message", "text": "Moin!" }` – Nachricht senden
- Server sendet: `{ "type": "message", "channel": "...", "user": "...", "text": "...", "ts": "..." }`

## Jitsi Video-Integration

Der Chat hat einen eingebauten **Video-Call-Button** in der Sidebar. Ein Klick öffnet ein Jitsi-Meet-Overlay direkt im Browser.

- Nutzt die öffentliche Instanz `meet.jit.si` (kein eigener Server nötig)
- Raum-Name wird automatisch aus dem Channel abgeleitet (`smutje-<channel>`)
- Alle im gleichen Channel sehen den gleichen Video-Raum
- Für eine eigene Jitsi-Instanz: Domain in `client/index.html` anpassen

## Umgebungsvariablen

Siehe `.env.example`:

```
PORT=3000
TOKEN_ANDREAS=<uuid>
TOKEN_MARCO=<uuid>
TOKEN_LEA=<uuid>
TOKEN_TONI=<uuid>
```

## Stack

- **Backend:** Node.js 20 + Express + ws
- **Datenbank:** SQLite via better-sqlite3
- **Frontend:** Vanilla HTML/CSS/JS (Single File)
- **Auth:** Token-basiert (UUID via X-Token Header)
- **Deployment:** Docker + docker-compose
- **Video:** Jitsi Meet (externe API)

## Lizenz

MIT
