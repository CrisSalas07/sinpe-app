# SINPE JUNTAUCR — Web App

## 1. Context

- **What:** a web app that implements the *Prueba corta – SINPE JUNTAUCR* exercise from the Databases course (UCR Sede del Sur). It simulates clients, IBAN accounts, phone numbers, SINPE Móvil enrollments and money transfers.
- **Why:** it replaces a quiz to recover a grade (10 %). Due **November 9, 2026**.
- **Professor's rule:** *"Whatever you deliver as the prototype is the final result of the application."* The app must look and behave **exactly like the Figma prototype**. Do not add screens or features that are not in Figma, and do not omit any that are.
- **Developer:** Cristopher, a student coming from Spring Boot and Flutter. **Node.js/Express is new to him.** He wants to understand what is built, not just receive code.
- **Environment:** Windows Home, Node v24, npm 11, MySQL 8 (local). Project path: `C:\development\sinpe-app`.

### Database scripts (`db/`)
```
db/
├── 01_esquema_y_datos.sql      # tables + seed data (24 clients, 36 accounts, 38 phones)
├── 02_triggers.sql
├── 03_procedimientos.sql
├── 05_app_user.sql             # documentation only: CREATE USER sinpe_app + GRANT (example password)
├── 06_backfill_historial.sql   # one AFILIACION event per seed enrollment; idempotent; run as root
└── 07_detalle_transferencia.sql # ONLY for databases created before detalle was in 01: ALTER + new transfer SPs
```
- The folder was renamed from `BD/` to `db/` in Phase 1. `04_pruebas.sql` is omitted for now.
- **Fresh install order (as root): 01 → 02 → 03 → 05 → 06.** 01 already has `transferencia.detalle` and 03 already has the transfer procedures with `p_detalle`, so 07 is not needed. 06 is needed because the seed enrollments in 01 are inserted before the triggers in 02 exist.
- The database `sinpe_movil` is created and loaded (scripts 01–03 were run).
- The seed enrollments in 01 were inserted before the triggers in 02 existed, so `historial_afiliacion` starts empty until Cristopher runs `06_backfill_historial.sql` as root.
- The MySQL user **`sinpe_app`@`localhost`** (`GRANT SELECT, EXECUTE ON sinpe_movil.*`) is created by Cristopher as root, and `.env` connects with it. Do not ask him to run `05_app_user.sql` again.
- `GET /api/salud` was removed in Phase 1.

## 2. Working rules (MANDATORY)

1. **Work in phases** (section 11), in order, one at a time.
2. **At the end of every phase, STOP** and deliver the report (section 12). Do not continue until Cristopher says "continúa".
3. **Do not make decisions on your own.** If something is not defined here or in Figma, or there are two reasonable options, **ask first** and give a justified recommendation.
4. **Do not modify** existing files in `db/` without asking. Business logic lives in MySQL.
5. **Dependencies:** only those listed in section 3. Anything else requires asking first.
6. **Do not invent** screens, fields, texts or features beyond Figma. If Figma and this document disagree, ask.
7. **Language:**
   - Code, identifiers, comments, JSDoc, README, commit messages and `.env.example` go in **English**.
   - UI text goes in **Spanish**, exactly as in Figma.
   - Reports and questions to Cristopher go in **Spanish**.
   - Database object names stay as they are (Spanish).
8. Keep code **simple and readable**: small functions, no over-engineering, no magic.
9. **Version control:** run `git init` in Phase 1, then make at least one commit per phase using Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).

## 3. Stack (decided)

| Layer | Technology |
|---|---|
| Database | MySQL 8, schema `sinpe_movil` (already created from `db/`) |
| Backend | Node.js 24 + Express, ES modules |
| DB driver | `mysql2/promise` connection pool |
| Frontend | Plain HTML + CSS + JavaScript (no framework), served by Express from `public/` |
| Config | `.env` loaded with `node --env-file=.env` (no dotenv) |
| Run | `npm run dev` → `node --env-file=.env --watch src/server.js` |

**Allowed dependencies:**
- Runtime: `express`, `mysql2`, `express-session`, `helmet`, `express-rate-limit`.
- Dev: `eslint`, `prettier`.

## 4. Architecture — layers

```
HTTP request
  → routes/        wiring only: path + middlewares + controller
  → controllers/   read req, call validator, call service, send res (no SQL, no business rules)
  → services/      use-case orchestration (e.g. transfer = call SP + read receipt data)
  → repositories/  the ONLY place with SQL (SELECTs and CALL sp_*)
  → MySQL          business rules, transactions, triggers (source of truth)
```

- Each layer only calls the one below it. **No SQL outside `repositories/`.** **No `req`/`res` outside controllers and middlewares.**
- Validation lives in `validators/`, as pure functions that return clean data or throw `ValidationError`.
- Errors flow to a single error-handling middleware. **Express 5** forwards errors thrown by `async` handlers to it natively, so there is **no `asyncHandler`** and no try/catch boilerplate in every route.

### Target structure
```
src/
├── server.js                 # starts the HTTP server
├── app.js                    # builds the Express app (middlewares, routes, static)
├── config/
│   ├── env.js                # reads + validates required env vars at startup (fail fast)
│   └── db.js                 # mysql2 pool
├── middlewares/
│   ├── auth.js               # requireAuth: 401 if no session
│   ├── errorHandler.js       # maps errors to HTTP responses
│   └── rateLimit.js          # login limiter
├── validators/               # common.js + clients, accounts, phones, sinpe, transfers, reports, auth
├── routes/                   # *.routes.js per resource
├── controllers/              # *.controller.js
├── services/                 # *.service.js
├── repositories/             # *.repository.js
└── utils/
    ├── errors.js             # ValidationError, NotFoundError, BusinessError
    └── password.js           # scrypt hash/verify
scripts/
└── hash-password.js          # prints a hash for APP_PASSWORD_HASH
test/                         # node:test self-checks (npm test)
public/
├── index.html                # login
├── clients.html, accounts.html, phones.html, sinpe.html, transfers.html, reports.html
├── css/tokens.css, css/app.css
└── js/
    ├── theme.js              # classic script in <head>: applies the saved theme before paint
    ├── layout.js             # shared header, nav, theme toggle, logout, session check
    ├── api.js                # fetch wrapper, uniform error handling, 401 → login
    ├── format.js             # names, phones, IBAN, money
    ├── dom.js                # safe element builders (textContent only)
    └── <page>.js
db/                           # SQL scripts
README.md
.env.example
```
- One HTML page per menu section.
- Create forms ("Registrar …") are **separate views inside the same page**, as in Figma.
- "Desafiliar" and "Cambiar cuenta" are **modals**.

## 5. Security (MANDATORY)

**Authentication and session**
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Credentials come from `.env`: `APP_USER` and `APP_PASSWORD_HASH`.
  - The password is **never stored in plain text**. Hash it with Node's `crypto.scrypt` and a random salt (`scripts/hash-password.js`).
  - Compare with `crypto.timingSafeEqual`.
- Use `express-session` with:
  - `SESSION_SECRET` from `.env`;
  - a cookie with `httpOnly: true`, `sameSite: 'strict'`, `secure` in production;
  - `session.regenerate()` on login and `session.destroy()` on logout;
  - a **15-minute idle timeout** (rolling session), since this is a banking app.
  - The memory store is acceptable for this single-instance demo; say so in the README.
- `requireAuth` protects **every** `/api/*` route except login. The frontend redirects to the login page on 401.
- Login answers with a generic message on failure ("Usuario o contraseña incorrectos"). Never reveal which field was wrong.
- Rate-limit login with `express-rate-limit`: 5 **failed** attempts per 15 minutes per IP (`skipSuccessfulRequests: true`; successful logins do not count).

**HTTP hardening**
- `helmet` with a strict CSP: `default-src 'self'`, plus Google Fonts for `style-src` and `font-src`. **No inline scripts and no inline event handlers.**
- `express.json({ limit: '10kb' })`. Disable `x-powered-by`.
- Only accept `Content-Type: application/json` on write endpoints.

**Input and output**
- **Server-side validation of every input**, before calling the database:
  - phone: `^[0-9]{8}$`
  - IBAN: `^CR[0-9]{20}$`
  - money: a string matching `^\d{1,13}(\.\d{1,2})?$` and greater than 0
  - dates: `YYYY-MM-DD`
  - email format
  - enums against allowed values
  - max lengths taken from the schema
- Reject unknown fields.
- Frontend validation is only for user experience, never trusted.
- **SQL only through placeholders** (`?`). Never concatenate strings into SQL.
- **XSS:** render data with `textContent` or DOM builders. **Never use `innerHTML` with data.**
- **Errors:**
  - never send stack traces, SQL or internal messages to the client;
  - log server-side without secrets or full personal data.

**Database user — least privilege**
- The app connects as the dedicated user `sinpe_app`, **not root**. Cristopher creates it as root (documented in `db/05_app_user.sql`):
  ```sql
  CREATE USER 'sinpe_app'@'localhost' IDENTIFIED BY '<password>';
  GRANT SELECT, EXECUTE ON sinpe_movil.* TO 'sinpe_app'@'localhost';
  ```
  - It has **no** `INSERT`, `UPDATE` or `DELETE`.
- This enforces at the database level that **every write goes through a stored procedure**. The procedures run as their DEFINER.
- `db/05_app_user.sql` **only documents** these statements, with a placeholder password. Do not ask Cristopher to run it again.

## 6. Data integrity (MANDATORY)

- Stored procedures own all writes, transactions, locking (`FOR UPDATE`) and business validation. The backend never reimplements or bypasses them.
- **Money is never handled as a JS float.**
  - Configure `mysql2` so `DECIMAL` arrives as a string (the default).
  - Send amounts as strings to the procedures.
  - The frontend preview ("saldo después") uses integer cents.
- Configure the pool with `dateStrings: true` to avoid timezone shifts.
- **Prevent double submits:** disable the submit or confirm button while a request is pending (critical for transfers).
- After every write, re-read the affected data from the database. Do not trust client-side state.

## 7. Database

### Stored procedures
| Procedure | Parameters | Screen |
|---|---|---|
| `sp_registrar_cliente` | identificacion, nombres, primer_apellido, segundo_apellido, correo, estado | 08 Registrar cliente |
| `sp_registrar_cuenta` | id_cliente, id_entidad, moneda, iban, saldo, fecha_apertura, estado | 09 Registrar cuenta |
| `sp_registrar_telefono` | identificacion, numero | 10 Registrar teléfono |
| `sp_cambiar_titular_telefono` | numero, identificacion_nueva | 10 Editar teléfono |
| `sp_afiliar_sinpe` | id_telefono, id_cuenta | 11 Afiliar |
| `sp_desafiliar_sinpe` | numero | 12 Desafiliar |
| `sp_cambiar_cuenta_sinpe` | id_telefono, id_cuenta_nueva | 13 Cambiar cuenta |
| `sp_transferir_sinpe` | numero_origen, numero_destino, monto, detalle (NULL allowed) | 07 Transfer by phone |
| `sp_transferir_iban` | iban_origen, iban_destino, monto, detalle (NULL allowed) | 07 Transfer by IBAN |
| `sp_consultar_movimientos` | iban, fecha_inicio, fecha_fin → **2 result sets** (movements with counterpart, totals) | 06 Reports |

Read `db/01_esquema_y_datos.sql` before writing any query.

### Error mapping (`middlewares/errorHandler.js`)
| Error | Response |
|---|---|
| `ValidationError` | 400 `{ "error": "<Spanish message>", "field": "<name>" }` |
| MySQL `sqlState === '45000'` (`SIGNAL`) | 400 `{ "error": err.sqlMessage }`. The UI shows it **as is** in the red **Alerta** box. Figma error texts are illustrative; the procedure's message is the real one. Do not change procedures to match Figma. |
| MySQL 1062 / 3819 / 1452 | 400 with a clear Spanish message |
| 401 / 404 | `{ "error": "..." }` |
| Anything else | 500 `{ "error": "Error interno" }` + server log |

### Receipt number
`sp_transferir_*` does not return the id. Run the `CALL` and then `SELECT LAST_INSERT_ID()` on the **same connection** (`pool.getConnection()`, release it in `finally`). The receipt is shown as `TR-<id>`.

### Receipt balances
The procedures do not return balances. On the **same connection**, after the `CALL`, read the balances of both accounts and compute the "before" values **in SQL** (origin: `saldo + monto`, destination: `saldo - monto`) so DECIMAL stays exact. Reading the balances before the `CALL` was rejected because it is not locked and could be stale under concurrency.

### Stored procedure messages
Several `SIGNAL` messages have no accents (e.g. "La cuenta no esta activa"). Leave them as they are and show them as is.

## 8. Design (Figma)

- **File:** https://www.figma.com/design/DkZWf1Lxnci8VDY7sUhaby/JUNTAUCR-%C2%B7-SINPE-M%C3%B3vil--prototipo---copia-
- **fileKey:** `DkZWf1Lxnci8VDY7sUhaby`
- The Figma MCP call limit (Starter plan) was reached in Phase 0. **From Phase 2 on, use the PNG exports in `disenio/`** (one file per frame, named after the frame). Do not call the Figma MCP.
- Figma uses sample data. The app shows **real data** from the database.

### Screens (light mode; node-id)
| Screen | node-id |
|---|---|
| Components (tags, chip, buttons) | 2:29 |
| 01 Login | 3:268 |
| 02 Clientes | 3:2 |
| 03 Cuentas IBAN | 3:140 |
| 04 Teléfonos | 4:13 |
| 05 SINPE Móvil | 4:121 |
| 06 Historial e informes | 4:228 |
| 07 Transferencia · 1 Datos / 2 Revisión / 3 Comprobante | 5:28 / 5:150 / 5:258 |
| 07 Error (misma cuenta) | 5:365 |
| 07 Phone errors: saldo insuficiente / no afiliado / monto inválido | 2005:760 / 2005:879 / 2005:999 |
| 07 Transfer by IBAN · 1 Datos | 2005:285 |
| 07 IBAN errors: misma cuenta / moneda distinta / cuenta bloqueada | 2005:402 / 2005:521 / 2005:640 |
| 08 Registrar cliente / Error | 2003:112 / 2003:262 |
| 09 Registrar cuenta IBAN / Error | 2003:414 / 2003:576 |
| 10 Registrar teléfono / Error / Editar teléfono · Error | 2003:740 / 2003:869 / 2003:1000 |
| 11 Afiliar / Éxito / Errors (ya afiliado, cuenta no válida, titularidad) | 2004:126 / 2004:257 / 2004:390, 2004:523, 2004:656 |
| 12 Desafiliar · Confirmación (modal) | 2004:789 |
| 13 Cambiar cuenta (modal) / Error | 2004:915 / 2004:1048 |
| Dark · 01 Login / 02 Clientes / 06 Historial | 7:71 / 7:102 / 7:583 |

Only light-mode PNGs were exported (`disenio/`). The dark theme has no PNGs: build it from the dark tokens below; it **applies to the whole app** through CSS variables.

The login footer "Usuario de prueba: admin · Juntaucr2026" is kept as in Figma (Cristopher's decision: fidelity to the prototype; demo app; documented as an accepted risk in the README).

### Tokens (from Figma variables)
| Variable | Light | Dark |
|---|---|---|
| `--bg` | #f4eeff | #1e2040 |
| `--surf` | #ffffff | #2a2d55 |
| `--ink` | #2a2d4f | #f4eeff |
| `--mut` | #5a5f8f | #a6b1e1 |
| `--line` | #dcd6f7 | #424874 |
| `--acc` | #424874 | #a6b1e1 |
| `--accInk` | #ffffff | #1e2040 |
| `--ok` / `--okbg` | #157a4a / #ddf3e8 | #59d69b / #12362a |
| `--bad` / `--badbg` | #b3261e / #fbe4e0 | #ff9a8f / #402430 |
| `--warn` / `--warnbg` | #424874 / #dcd6f7 | #dcd6f7 / #343868 |

- **Fonts (Google Fonts):**
  - **Bricolage Grotesque Bold:** page titles (38), stat values and account-card amounts.
  - Section titles ("Listado", "Movimientos de una cuenta", "Transferencia registrada", modal titles): **Instrument Sans Bold** ~19, as the PNGs show.
  - **The Figma PNGs win over this document.** When they disagree, follow the PNG and fix this document.
  - Body: **Instrument Sans** (15 body, 13/12 secondary; Medium and SemiBold for labels and buttons).
  - IBAN and codes: **Roboto Mono Medium 13**.
- **Radii:** cards 14, account cards 12, buttons and alerts 10, inputs 9, chips 20.
- **Layout:**
  - 125 px header: brand on the left, 6-item nav, theme button, "Operador JUNTAUCR", "Cerrar sesión".
  - Content centered at **1040 px**; forms use a **760 px** column.
- **Status tags:**
  - ok = Activo / Activa / Afiliado / AFILIACION
  - neutral = Inactivo / Inactiva / currency / Enviada
  - error = Bloqueada / Sin afiliar / DESAFILIACION

### Display formatting (`format.js`)
- **Names:** the database stores them in UPPERCASE. Show them in Title Case.
  - Compact: "Leonardo Aguilar" (first name + first surname).
  - Selects: full name, "Leonardo Antonio Aguilar Berrocal".
- **Phones:** stored as `80000001`, shown as `8000-0001`. Input fields take digits only.
- **IBAN:** full or short (`CR00 …001`) **exactly where the Figma uses each one**.
  - Full: the Cuentas IBAN table, account cards, inputs, the Afiliar account select.
  - Short: the SINPE table, the Historial selects and tables, row summaries such as "8000-0001 · Leonardo Aguilar · CR00 …001".
- **Dates:** "Fecha de apertura" (Registrar cuenta) and Historial "Desde"/"Hasta" use the **native `<input type="date">`** (Cristopher's decision). It shows the date in the browser's locale format (e.g. 30/10/2026) instead of the Figma's 2026-11-09; that difference is accepted. The API always sends and receives `YYYY-MM-DD`.
- **Selects of clients for new records** (e.g. Titular in Registrar cuenta) list only ACTIVO clients; the stored procedure remains the final validation.
- **Money:**
  - CRC: `₡ 123 991`, with a space as thousands separator and no decimals when they are ,00.
  - USD: `$ 377,00`.

## 9. Screen → API map

| Screen | Endpoints |
|---|---|
| Login | `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` |
| 02 Clientes | `GET /api/clients` (with account and phone counts) · `GET /api/clients/stats` (total, active, with accounts) · `POST /api/clients` |
| 03 Cuentas | `GET /api/accounts` · `GET /api/accounts/stats` (total, active, in CRC) · `POST /api/accounts` · `GET /api/catalogs/banks` · `GET /api/catalogs/currencies` |
| 04 Teléfonos | `GET /api/phones` (enrolled flag + account) · `GET /api/phones/stats` (total, enrolled, not enrolled) · `POST /api/phones` · `PUT /api/phones/:number/owner` |
| 05 SINPE | `GET /api/sinpe` · `GET /api/sinpe/stats` (enrolled, not enrolled, events) · `POST /api/sinpe` · `DELETE /api/sinpe/:number` · `PUT /api/sinpe/:phoneId/account` · `GET /api/sinpe/unenrolled-phones` · `GET /api/clients/:id/eligible-accounts` (ACTIVA + CRC, same owner) |
| 07 Transferencias | `POST /api/transfers/sinpe` · `POST /api/transfers/iban` → return the receipt id and the before/after balances of both accounts |
| 06 Historial | `GET /api/reports/movements?iban=&from=&to=` · `GET /api/reports/enrollment-history?number=` · `GET /api/reports/account-phones?iban=` |

**Transfer detail ("Detalle (opcional)"):**
- `transferencia.detalle VARCHAR(100) NULL` is in `01`. `sp_transferir_sinpe` and `sp_transferir_iban` in `03` take a 4th parameter `p_detalle` (pass NULL when empty). `db/07_detalle_transferencia.sql` upgrades databases created before this change; Cristopher runs it once as root before Phase 7.
- Show the detail in Revisión, Comprobante and Historial only where the Figma has a place for it.

**Transfer flow:**
- **Step 1 → 2 (Revisión)** is frontend-only: it shows the data and the "saldo del origen después".
- **"Confirmar"** calls the backend, with the button disabled while the request is pending.
- **Comprobante:** shows before → after for both accounts and the conserved total.
- **"Casos de prueba del enunciado" chips** are buttons that **prefill the form**. Update their labels to real data:
  - 8000-0001 → 7000-0001 (rechazada, misma cuenta)
  - 8000-0001 → 8000-0002 (permitida)
  - IBAN 001 → IBAN 025 (otra moneda)
  - 8000-0011 → 8000-0002 for ₡100 000 (saldo insuficiente)

## 10. Environment variables (`.env.example`, committed without real values)
```
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=sinpe_app
DB_PASSWORD=
DB_NAME=sinpe_movil
SESSION_SECRET=
APP_USER=admin
APP_PASSWORD_HASH=
```
`config/env.js` must stop the app at startup with a clear message if any of these is missing.

## 11. Phases

0. **Review.** Read this document, `db/` and Figma. Verify that `npm run dev` and `/api/salud` work. Report your understanding and questions. **No code.**
1. **Backend foundation and security.**
   - `git init`, ESLint + Prettier.
   - Layered skeleton; `config/env.js`; error classes and `errorHandler`.
   - `helmet`, session, `requireAuth`, rate limit.
   - `scripts/hash-password.js` and the `auth` endpoints.
   - Move `src/db.js` to `src/config/db.js`; split `src/server.js` into `app.js` and `server.js`.
   - `db/05_app_user.sql` (documentation only; the user already exists), `.env.example`.
   - Remove `/api/salud` or protect it.
2. **Visual foundation.** `tokens.css`, `app.css` with every component, `layout.js`, `api.js`, `format.js`, `dom.js`, and the login page working end to end.
3. **Clientes:** list, stats, search, register and its error.
4. **Cuentas IBAN:** list, stats, search, register and its errors.
5. **Teléfonos:** list, stats, register, change owner and their errors.
6. **SINPE Móvil:** list, enroll (success and errors), unenroll modal, change account modal (and error).
7. **Transferencias:** by phone and by IBAN, the 3 steps, every error, and the test-case chips.
8. **Historial e informes:** movements by period with totals, enrollment history of a phone, phones of an account.
9. **Dark theme, polish and docs.**
   - Theme toggle saved in `localStorage` (done in Phase 3: `js/theme.js` applies it in `<head>` before paint).
   - Screen-by-screen check against Figma.
   - Security self-review against sections 5 and 6.
   - `README.md` in English: setup (fresh DB install order 01 → 02 → 03 → 05 → 06), scripts, architecture, security notes.

## 12. Phase report format (in Spanish)

```
## Reporte · Fase N — <nombre>
### Qué hice
### Archivos tocados
- creado / modificado: ruta — para qué
### Por qué (decisiones y alternativas descartadas)
### Seguridad e integridad (qué se protegió en esta fase)
### Conceptos nuevos (explicados simple, para alguien que viene de Spring Boot)
### Cómo probarlo (pasos exactos, URL, datos de prueba)
### Diferencias con el Figma y dudas pendientes
```
After the report, **wait** for Cristopher to say "continúa".
