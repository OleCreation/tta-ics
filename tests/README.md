# 🧪 Testsuite for Vakter fra TTA til kalender

Denne mappen inneholder den automatiserte testsuiten for **Vakter fra TTA til kalender**. Testsuiten kjører lynraskt (< 1 sekund) med Node.js sin innebygde testrunner (`node --test`), uten behov for tunge eksterne rammeverk.

---

## 🚀 Kjøre testene

### Kjør alle tester:
```bash
node --test tests/**/*.test.js
```
eller med npm:
```bash
npm.cmd test
```

### Kjør tester i watch-modus (kjører automatisk på nytt ved filendringer):
```bash
node --test --watch tests/**/*.test.js
```

---

## 🔒 Automatisk Pre-Push Sikring (Git Hook)

Prosjektet har en Git **`pre-push` hook** installert i `.git/hooks/pre-push`. 
Hver gang du kjører:
```bash
git push
```
vil testsuiten automatisk kjøres i forkant:
- **Hvis alle tester består**: Koden pushes som normalt til GitHub.
- **Hvis en test feiler**: Pushen avbrytes umiddelbart med feilmelding.

Dersom du cloner prosjektet på en ny maskin, kan du aktivere hooken med:
```bash
node tests/install-hook.js
```

---

## 📁 Teststruktur

| Testfil | Ansvarsområde |
|---|---|
| [`tests/parser.test.js`](parser.test.js) | Parsing av TTA-tekst, vakttyper (`V, X, H, R, B`), subkoder, filtrering av fraværskoder (`F, P, S`), ICS 2.0 RFC 5545-generering. |
| [`tests/calculator.test.js`](calculator.test.js) | HTA-satser, nattillegg (45 %), kveldstillegg (40 kr/t), helgetillegg (84 kr/t), overtid (50 % / 100 %), hjemmevakt, og alle norske helligdager/påske. |
| [`tests/rules.test.js`](rules.test.js) | AML § 10-8 hviletid etter overtid (< 8t alvorlig brudd, 8–11t normbrudd), overlappende vakter, og 7-dagers rullerende analyse. |
| [`tests/calendar.test.js`](calendar.test.js) | Lagring i `localStorage`, oppdatering av eksisterende vakter, sletting, samt backup og gjenoppretting. |
| [`tests/ui_theme_layout.test.js`](ui_theme_layout.test.js) | 2 temaer (`blue`, `dark`), kompakt (480px) vs dobbel bredde (960px), lagring av innstillinger, og HTML-struktur. |
| [`tests/integration.test.js`](integration.test.js) | Full ende-til-ende flyt fra innlimt råtekst til ferdig ICS og kalender. |
| [`tests/helpers/dom-mock.js`](helpers/dom-mock.js) | DOM/Browser-mock som kjører nettleserkoden trygt i et Node.js VM-miljø. |

---

## ➕ Slik skriver du tester for nye funksjoner (Features)

Når du legger til en ny funksjon i appen:

### 1. Opprett eller utvid en test
Bruk standard Node.js test-syntaks:
```javascript
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { loadAppContext } = require('./helpers/dom-mock');

describe('Navn på ny funksjon', () => {
    let ctx, dom;

    beforeEach(() => {
        const app = loadAppContext();
        ctx = app.context;
        dom = app.dom;
    });

    test('skal håndtere ny vakttype korrekt', () => {
        const resultat = ctx.beregnVaktInntekt('20260601T080000', '20260601T160000', 'NY_KODE', true);
        assert.equal(resultat.bruttoInntekt, 2400);
    });
});
```

### 2. Kjøre og verifisere
Kjør `node --test tests/**/*.test.js` og bekreft at testen består før du committer og pusher.

