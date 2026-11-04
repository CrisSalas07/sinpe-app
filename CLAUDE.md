# SINPE JUNTAUCR — Web App

## 1. Context

- **What:** a web app that implements the *Prueba corta – SINPE JUNTAUCR* exercise from the Databases course (UCR Sede del Sur). It simulates clients, IBAN accounts, phone numbers, SINPE Móvil enrollments and money transfers.
- **Why:** it replaces a quiz to recover a grade (10 %). Due **November 9, 2026**.
- **Professor's rule:** *"Whatever you deliver as the prototype is the final result of the application."* The app must look and behave **exactly like the Figma prototype**. Do not add screens or features that are not in Figma, and do not omit any that are.
- **Change spec v2 (`CAMBIOS.pdf`, Nov 3, 2026):** the professor asked for financial entities and roles. Its rules are transcribed into this document and **take priority over the `disenio/` PNGs**. Its decisions on entities, roles, SINPE rules and registration are closed: do not ask about them again. Section 13 lists what is still open.
- **Developer:** Cristopher, a student coming from Spring Boot and Flutter. **Node.js/Express is new to him.** He wants to understand what is built, not just receive code.
- **Environment:** Windows Home, Node v24, npm 11, MySQL 8 (local). Project path: `C:\development\sinpe-app`.

### Database scripts (`db/`)
```
db/
├── 01_esquema_y_datos.sql      # tables + seed data (24 clients, 36 accounts, 38 phones)
├── 02_triggers.sql
├── 03_procedimientos.sql        # procedures + the app user (CREATE USER IF NOT EXISTS sinpe_app + GRANT)
```
- The folder was renamed from `BD/` to `db/` in Phase 1. `04_pruebas.sql` is omitted for now.
- **Fresh install (as root): 01 → 02 → 03.** Nothing else is needed:
  - 01 has the full schema (including `transferencia.detalle`), the seed data, and one `AFILIACION` event in `historial_afiliacion` per seed enrollment (the triggers of 02 do not exist yet when 01 loads).
  - 03 has the latest procedures and creates the MySQL user `sinpe_app`@`localhost` with an example password that must be changed (and copied to `DB_PASSWORD` in `.env`).
- **Phase B changes 01, 02 and 03.** Since 01 starts with `DROP DATABASE`, applying them means reinstalling 01 → 02 → 03 (seed data is recreated). Tell Cristopher when to do it, and to repeat `ALTER USER` if he changed the `sinpe_app` password.
- `GET /api/salud` was removed in Phase 1.

## 2. Working rules (MANDATORY)

1. **Work in phases** (section 11), in order, one at a time.
2. **At the end of every phase, STOP** and deliver the report (section 12). Do not continue until Cristopher says "continúa".
3. **Do not make decisions on your own.** If something is not defined here or in Figma, or there are two reasonable options, **ask first** and give a justified recommendation.
4. **`db/01`, `02` and `03` may be modified** to implement the change spec (authorized by `CAMBIOS.pdf`). Any other change to `db/` requires asking. Business logic lives in MySQL.
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
│   ├── auth.js               # requireAuth: 401 if no session · requireRole: 403 if wrong role
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
├── index.html                # login with entity selector
├── clients.html, accounts.html, phones.html, sinpe.html, reports.html    # ADMIN
├── home.html, my-phones.html, transfers.html, movements.html             # CLIENTE
├── css/tokens.css, css/app.css
└── js/
    ├── layout.js             # shared header, per-role nav, logout, session + role check
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
- **Afiliar / Cambiar cuenta selects are NOT filtered by business rule** (Cristopher's decision), **only by the session entity**: they list every phone of the entity's clients and every account of the entity, so every error screen (ya afiliado, cuenta no válida, titularidad, Cambiar cuenta · Error) can be reproduced and the database triggers/procedures are the ones that reject invalid combinations.
  - Help texts describe the rule, not a filter: Teléfono "El teléfono no debe tener una afiliación vigente."; Cuenta / Nueva cuenta "Debe ser del mismo titular del teléfono, ACTIVA y en CRC.".
  - Options show their state so a rejection is understandable: phones "80000001 · Leonardo Aguilar · afiliado" (or "no afiliado"), accounts "CR00 …034 · BN · CRC · BLOQUEADA". After a successful "Afiliar" the view stays on the form with the green alert (11 Éxito).
- "Editar teléfono" is reached from an **"Editar" chip in each row** of the Teléfonos table (Cristopher's decision: the Figma table has no entry point). Its view is `#editar/<number>`.

## 5. Security (MANDATORY)

**Authentication and session**
- `GET /api/auth/entities` (public, returns `[{ id, code, name }]` for the login selector), `POST /api/auth/login` (`{ entityId, username, password }`), `POST /api/auth/logout`, `GET /api/auth/me`.
- Two roles, stored in `req.session.user = { role, entityId, entityCode, entityName, clientId, username, displayName }` (`clientId` is null for the admin); `/api/auth/me` returns that object:
  - **ADMIN:** if `username === APP_USER`, verify against `APP_PASSWORD_HASH` (`.env`). Same user for every entity: it administers the entity chosen at login.
  - **CLIENTE:** otherwise look up `cliente_entidad` by `(entityId, usuario)` and verify its `password_hash`. An INACTIVO client cannot log in.
  - **Always run scrypt, even if the user does not exist**, so response time does not reveal it.
  - The password is **never stored in plain text**. Hash it with Node's `crypto.scrypt` and a random salt (`scripts/hash-password.js`).
  - Compare with `crypto.timingSafeEqual`.
- Use `express-session` with:
  - `SESSION_SECRET` from `.env`;
  - a cookie with `httpOnly: true`, `sameSite: 'strict'`, `secure` in production;
  - `session.regenerate()` on login and `session.destroy()` on logout;
  - a **15-minute idle timeout** (rolling session), since this is a banking app.
  - The memory store is acceptable for this single-instance demo; say so in the README.
- `requireAuth` protects **every** `/api/*` route except login and `/api/auth/entities`. The frontend redirects to the login page on 401.
- `requireRole('ADMIN' | 'CLIENTE')` answers 403 "No tiene permiso para esta accion".
- **`entityId`, `bankId` and `clientId` are never accepted from the HTTP client on protected routes.** They always come from the session, and every query and write is filtered by them.
- Login answers with one generic message on any failure: "Usuario o contraseña incorrectos para la entidad seleccionada". Never reveal which field was wrong or whether the user exists in another entity. The Figma's more specific message is wrong and must not be used.
- Client passwords are hashed in Node with `utils/password.js`; stored procedures only receive the hash.
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
- The app connects as the dedicated user `sinpe_app`, **not root**. It is created at the end of `db/03_procedimientos.sql`:
  ```sql
  CREATE USER IF NOT EXISTS 'sinpe_app'@'localhost' IDENTIFIED BY '<example password: change it>';
  GRANT SELECT, EXECUTE ON sinpe_movil.* TO 'sinpe_app'@'localhost';
  ```
  - It has **no** `INSERT`, `UPDATE` or `DELETE`.
- This enforces at the database level that **every write goes through a stored procedure**. The procedures run as their DEFINER.

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
The entity and the client always come from the session.

| Procedure | Parameters | Rules |
|---|---|---|
| `sp_registrar_cliente` | p_id_entidad, p_identificacion, p_nombres, p_primer_apellido, p_segundo_apellido, p_correo, p_usuario, p_password_hash | No status (ACTIVO by default). Creates the person if new, then adds the `cliente_entidad` row. Errors: "El cliente ya esta registrado en esta entidad", username taken, "El correo ya pertenece a otro cliente". One transaction with rollback. |
| `sp_registrar_cuenta` | p_id_entidad, p_id_cliente, p_moneda, p_iban, p_saldo, p_fecha_apertura | No status (ACTIVA). "El cliente no pertenece a esta entidad". "El IBAN no corresponde a esta entidad" if `SUBSTRING(iban, 5, 4) <> CONCAT('0', codigo_iban)`. |
| `sp_registrar_telefono` | p_id_cliente, p_numero | The owner is the session client. Format and duplicate checks stay. |
| `sp_cambiar_titular_telefono` | p_id_entidad + current params | Current and new owner must be clients of the entity. The enrolled-phone trigger stays. |
| `sp_afiliar_sinpe` | p_id_entidad, p_id_telefono, p_id_cuenta | Enrollment rules below. |
| `sp_desafiliar_sinpe` | p_id_entidad, p_numero | Enrollment rules below. |
| `sp_cambiar_cuenta_sinpe` | p_id_entidad, p_id_telefono, p_id_cuenta_nueva | Validations move inside the transaction. On failure the original enrollment is kept. |
| `sp_transferir_sinpe` | p_id_entidad, p_id_cliente, p_iban_origen, p_numero_destino, p_monto, p_detalle (NULL allowed) | Transfer rules below, `FOR UPDATE` on both accounts, same transaction as before. |
| `sp_transferir_iban` | p_id_entidad, p_id_cliente, p_iban_origen, p_iban_destino, p_monto, p_detalle (NULL allowed) | Transfer rules below. |
| `sp_consultar_movimientos` | p_id_cliente, p_id_entidad, iban, fecha_inicio, fecha_fin → **2 result sets** (movements with counterpart, totals) | "La cuenta no pertenece al cliente" if the account is not the client's in that entity. |

The triggers of `02` stay. New `SIGNAL` messages go without accents, like the current ones.

### Schema changes (01)
```
entidad_financiera:
  + codigo_iban          CHAR(3) NOT NULL UNIQUE           -- BCR 152, BN 151, BP 161, BAC 102
  + limite_diario_sinpe  DECIMAL(15,2) NOT NULL DEFAULT 200000.00   -- value pending, see section 13

NEW TABLE cliente_entidad                 -- the person as a client of an entity + credentials
  id_cliente      INT NOT NULL  FK cliente
  id_entidad      INT NOT NULL  FK entidad_financiera
  usuario         VARCHAR(50) NOT NULL
  password_hash   VARCHAR(255) NOT NULL   -- utils/password.js format
  fecha_registro  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  PRIMARY KEY (id_cliente, id_entidad)
  UNIQUE (id_entidad, usuario)

transferencia_sinpe.id_telefono_origen → becomes NULL-able
```
A person is unique system-wide (by identification); what varies is their relationship with each entity, with a different user in each one.

### Seed data (01)
- Regenerate the 36 IBANs: `CONCAT('CR12', '0', codigo_iban, LPAD(n, 14, '0'))`, where n is the current account number (1 to 36). Account 001 of BCR becomes `CR12015200000000000001`.
- One `cliente_entidad` row per (client, entity) pair where the client has at least one account.
- Username: first given name + "." + first surname, lowercase, no accents (`leonardo.aguilar`, `ivan.altamirano`, `cristopher.buso`, `cristopher.mora`).
- Password `Cliente2026` for all: generate **one** hash with `utils/password.js` and paste it as a literal in the SQL.
- BCR must have data for every error: USD accounts 026 and 030 (cuenta no válida); Leonardo (BCR 001) can send to Iván (BN).

### SINPE Móvil rules (real-world, researched)
**Afiliar (admin), in this order:**
1. The phone must belong to a client of the session entity.
2. The account must be of the session entity, same owner as the phone, ACTIVA and CRC (`trg_validar_afiliacion` already validates this).
3. Enrolled in **this** entity: "El telefono ya esta afiliado en esta entidad. Use Cambiar cuenta."
4. Enrolled in **another** entity: "El telefono ya esta afiliado en otra entidad (<código>). Debe desafiliarse alla primero."

**Desafiliar / Cambiar cuenta (admin):** only the entity holding the current enrollment. Otherwise: "El telefono esta afiliado en otra entidad; solo esa entidad puede modificarlo". The new account must also be of the session entity.

**Transfer by SINPE Móvil (client). Validations, in this order, all inside the procedure:**
1. The origin account exists, belongs to the session client and the session entity; otherwise rejected (protects against request tampering).
2. Origin is ACTIVA and CRC.
3. The destination number is registered and enrolled, in any entity.
4. The destination account is ACTIVA.
5. Origin and destination are different accounts.
6. Amount > 0.
7. **Daily limit:** today's SINPE sends from that account + the amount cannot exceed the entity limit: "El monto supera su limite diario de SINPE Movil".
8. Sufficient balance.

The client does **not** need their own enrolled phone to send. If the origin account has an enrolled phone, it is stored in `transferencia_sinpe.id_telefono_origen`; otherwise NULL.

**Transfer by IBAN (client):** origin validated as in point 1. Destination is any ACTIVA IBAN of any entity, same currency.

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

- **File (new):** https://www.figma.com/design/fgx8ouqAkboYmjeRG4SmGE (sections Acceso, Rol administrador A01–A10, Rol cliente C01–C05).
- **fileKey:** `fgx8ouqAkboYmjeRG4SmGE`
- **`disenio/` PNGs are outdated** until they are replaced with exports of the new Figma. Meanwhile, if an image and this document disagree, **this document wins**. Do not call the Figma MCP without asking: the Starter plan call limit was reached in Phase 0.
- Figma uses sample data. The app shows **real data** from the database.

### Screens
| Screen | Page | Role | Notes |
|---|---|---|---|
| 00 Login | `index.html` | public | "Entidad financiera" select above Usuario, BCR selected by default. Hint: "Administrador: admin · Juntaucr2026 · Cliente: leonardo.aguilar · Cliente2026". After login, redirect by role. |
| A01–A02 Clientes | `clients.html` | ADMIN | Column "Registro" → "Usuario". Form without Estado, with the "Credenciales de acceso" section (Usuario, Contraseña temporal). |
| A03–A04 Cuentas IBAN | `accounts.html` | ADMIN | No "Entidad" column. In the form the entity is read-only (from the session) and there is no Estado field. |
| A05 Teléfonos | `phones.html` | ADMIN | Read-only: no "Registrar teléfono" button. Keeps the "Editar" chip per row (change owner). |
| A06–A09 SINPE Móvil | `sinpe.html` | ADMIN | As before, filtered by entity, with the rules of section 7. |
| A10 Informes | `reports.html` | ADMIN | Only "Afiliaciones de un teléfono" and "Teléfonos asociados a una cuenta". |
| C01 Inicio | `home.html` | CLIENTE | "Hola, <nombre>", stats (cuentas, teléfonos, afiliados), account cards with balance, last 5 movements, buttons Transferir / Registrar teléfono / Ver todos. |
| C02–C03 Mis teléfonos | `my-phones.html` | CLIENTE | Table Número · SINPE Móvil · Cuenta afiliada · Registrado. Registrar teléfono form with read-only owner taken from the session. |
| C04 Transferencia | `transfers.html` | CLIENTE | 3-step flow and every error. |
| C05 Mis movimientos | `movements.html` | CLIENTE | The former "Movimientos de una cuenta" section, limited to the client's accounts in the entity. |

**Menus:** ADMIN: Clientes · Cuentas IBAN · Teléfonos · SINPE Móvil · Informes. CLIENTE: Inicio · Mis teléfonos · Transferir · Mis movimientos.
**What each role cannot do:** the admin does not transfer money or see client movements; the client does not enroll phones.

**Texts:** "Clientes registrados en esta entidad." · "Cuentas de los clientes de esta entidad, en colones o dólares." · Transferir: "Envíe dinero desde una de sus cuentas a un teléfono SINPE Móvil o a una cuenta IBAN."

**There is only a light theme.**

### Tokens (from Figma variables)
| Variable | Value |
|---|---|
| `--bg` | #f4eeff |
| `--surf` | #ffffff |
| `--ink` | #2a2d4f |
| `--mut` | #5a5f8f |
| `--line` | #dcd6f7 |
| `--acc` | #424874 |
| `--accInk` | #ffffff |
| `--ok` / `--okbg` | #157a4a / #ddf3e8 |
| `--bad` / `--badbg` | #b3261e / #fbe4e0 |
| `--warn` / `--warnbg` | #424874 / #dcd6f7 |

- **Fonts (Google Fonts):**
  - **Bricolage Grotesque Bold:** page titles (38), stat values and account-card amounts.
  - Section titles ("Listado", "Movimientos de una cuenta", "Transferencia registrada", modal titles): **Instrument Sans Bold** ~19, as the PNGs show.
  - **The Figma PNGs win over this document.** When they disagree, follow the PNG and fix this document.
  - Body: **Instrument Sans** (15 body, 13/12 secondary; Medium and SemiBold for labels and buttons).
  - IBAN and codes: **Roboto Mono Medium 13**.
- **Radii:** cards 14, account cards 12, buttons and alerts 10, inputs 9, chips 20.
- **Layout:**
  - 125 px header: brand on the left, per-role nav; on the right an entity pill ("Banco de Costa Rica (BCR)"), a role tag ("Administrador" / "Cliente"), the user (compact name for clients) and "Cerrar sesión".
  - Content centered at **1040 px**; forms use a **760 px** column.
- **Status tags:**
  - ok = Activo / Activa / Afiliado / AFILIACION
  - neutral = Inactivo / Inactiva / currency / Enviada / No afiliado (Teléfonos table, as in the PNG)
  - error = Bloqueada / DESAFILIACION / Sin afiliar (transfer "Hacia" card)

### Display formatting (`format.js`)
- **Names:** the database stores them in UPPERCASE. Show them in Title Case.
  - Compact: "Leonardo Aguilar" (first name + first surname).
  - Selects: full name, "Leonardo Antonio Aguilar Berrocal".
- **Phones:** stored as `80000001`, shown as `8000-0001`. Input fields take digits only.
- **IBAN:** full or short (`CR00 …001`) **exactly where the Figma uses each one**.
  - Full: the Cuentas IBAN table, account cards, inputs, the Registrar cuenta form.
  - Short: the SINPE table, the Afiliar / Cambiar cuenta account selects, the Informes and Mis movimientos selects and tables, row summaries such as "8000-0001 · Leonardo Aguilar · CR00 …001".
  - Tail only (`…001`): the "Cuenta afiliada" column of the Teléfonos table; "—" when not enrolled.
- **Dates:** "Fecha de apertura" (Registrar cuenta) and Mis movimientos "Desde"/"Hasta" use the **native `<input type="date">`** (Cristopher's decision). It shows the date in the browser's locale format (e.g. 30/10/2026) instead of the Figma's 2026-11-09; that difference is accepted. The API always sends and receives `YYYY-MM-DD`.
- **Selects of clients that receive something** (Titular in Registrar cuenta, Nuevo titular in Editar teléfono) list only ACTIVO clients of the session entity; the stored procedure / trigger remains the final validation.
- **Money:**
  - CRC: `₡ 123 991`, with a space as thousands separator and no decimals when they are ,00.
  - USD: `$ 377,00`.

## 9. Screen → API map

| Role | Endpoints |
|---|---|
| Public | `GET /api/auth/entities` · `POST /api/auth/login` |
| Any session | `POST /api/auth/logout` · `GET /api/auth/me` |
| ADMIN | `GET /api/clients` (with account and phone counts) · `GET /api/clients/stats` · `POST /api/clients` · `GET /api/accounts` · `GET /api/accounts/stats` · `POST /api/accounts` · `GET /api/catalogs/currencies` · `GET /api/phones` · `GET /api/phones/stats` · `PUT /api/phones/:number/owner` (**no POST**) · all of `/api/sinpe` (`GET`, `GET /stats`, `POST`, `DELETE /:number`, `PUT /:phoneId/account`) · `GET /api/reports/enrollment-history?number=` · `GET /api/reports/account-phones?iban=` |
| CLIENTE | `GET /api/me/summary` · `GET /api/me/accounts` · `GET /api/me/recent-movements` (last 5) · `GET /api/me/movements?iban=&from=&to=` · `GET /api/me/phones` · `POST /api/me/phones` · `POST /api/transfers/sinpe` · `POST /api/transfers/iban` · `GET /api/transfers/recipient?number=` or `?iban=` · `GET /api/transfers/limit?iban=` (`limit`, `usedToday`, `available`) |

- Every ADMIN query is filtered by the session entity (`WHERE … id_entidad = ?`).
- `recipient` returns **only** the compact name and the entity: no balance, status or third-party identification.
- Each movements report reloads when its inputs change (the Figma has no "Consultar" button); the period defaults to the current month.
- Validators: no `status` in clients and accounts, no `bankId` in accounts, `username` and `password` in clients, `originIban` instead of `originNumber` in the SINPE transfer, `entityId` in login.
- `transfers.service.js`: the message → field map includes the new messages (daily limit → `amount`, destination not enrolled → `destinationNumber`, etc.).

**Registrar cliente (admin):**
- Instead of Estado, the gray note "El cliente se crea con estado ACTIVO en <entidad>."
- "Credenciales de acceso" section: Usuario (unique per entity, 3–50 characters `[a-z0-9._]`) and Contraseña temporal (min 8 characters, help "El cliente la usará para iniciar sesión."). No forced password change on first login: it is not in the Figma.

**Registrar cuenta (admin):**
- Instead of Estado, the note "La cuenta se crea con estado ACTIVA."
- "Entidad financiera" is read-only. The Titular select lists only ACTIVO clients of the entity.
- IBAN help: "22 caracteres: CR + 2 dígitos + 0152 (código BCR) + 14 dígitos." (with the session entity's code).

**Transfer detail ("Detalle (opcional)"):**
- `transferencia.detalle VARCHAR(100) NULL` is in `01`. Pass NULL when empty.
- Revisión and Comprobante show a "Detalle" row **only when the user wrote a detail** (Cristopher's decision); with an empty detail they look exactly like the Figma. **Mis movimientos does not show it** (Cristopher's decision: the Figma table has no natural place, and `sp_consultar_movimientos` does not return it).

**Known limitation (for the README):** with two transfers confirmed at the same time on the same accounts, the money is always correct (the procedures lock both accounts with `FOR UPDATE` and run in a transaction). Only the receipt can be affected: its "after" balances are read right after the `CALL` without a lock, so they may already include the other transfer, and the "before" values (after ∓ amount) would be off by that amount.

**Transfer flow:**
- **Origin select:** "Cuenta de origen" uses `/api/me/accounts` in both tabs (only CRC accounts in "Por teléfono"), format "CR12 …001 · Ahorros colones · ₡ 123 991". Below it: "Teléfono de destino", "Monto", "Detalle (opcional)".
- **Recipient:** after 8 digits of phone (or 22 characters of IBAN) show "Destinatario: <nombre compacto> · <entidad>". A number without SINPE Móvil shows the error on the field.
- **Monto help:** "Disponible hoy: ₡ X de su límite diario."
- **Step 1 → 2 (Revisión)** is frontend-only: it checks **formats only** (destination 8 digits / IBAN pattern, amount `^\d{1,13}(\.\d{1,2})?$` and > 0 with the Figma text "El monto debe ser mayor que cero.") and shows "Cuenta de origen", "Destino: 8000-0002 · Iván Altamirano (BN)", "Monto", "Saldo del origen después" (integer cents), "Tipo" and "Comisión: ₡ 0" (always 0 in the simulation).
- **"Confirmar"** calls the backend, with both buttons disabled while the request is pending. **Business rules are checked only by the database** (Cristopher's decision): if the procedure rejects the transfer, the app goes back to step 1 · Datos and shows the SP message in the red alert, with the field marked when it is unambiguous.
- **"Desde" card:** the client's own account. **"Hacia" card:** the recipient from `/recipient`.
- **Comprobante:** shows before → after for both accounts and the conserved total (see section 13, open decision 1).
- **Test-case chips** are buttons that **prefill the form**. They are hidden unless the session user is `leonardo.aguilar` (BCR):
  - misma cuenta: 001 → 7000-0001
  - permitida: 001 → 8000-0002 (BN)
  - otra moneda: IBAN 001 → IBAN 025 (USD)
  - saldo insuficiente: 001 → 8000-0002 for ₡150 000
  - límite diario: see section 13, open decision 2

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

Phases 0–9 built v1 and are finished. **The change spec is implemented in phases A–F** (rules 1 and 2 apply: one at a time, stop and report after each).

A. Update this document and remove the dark theme.
B. Database: schema, seed data, procedures (section 7). Explain to Cristopher how to reinstall.
C. Login with entity and roles, session, `requireRole`, per-role header, page protection (`initLayout(activePage, role)` calls `/api/auth/me` and, if the role does not match the page, redirects to `/clients.html` or `/home.html`).
D. Admin screens filtered by entity (clients with credentials, accounts, phones, SINPE, reports).
E. Client screens (Inicio, Mis teléfonos, Transferir, Mis movimientos).
F. Tests, lint, README (screen and rule tables), security review, manual test of every error in BCR and in another entity.

### Finished v1 phases (history)

0. **Review.** Read this document, `db/` and Figma. Verify that `npm run dev` and `/api/salud` work. Report your understanding and questions. **No code.**
1. **Backend foundation and security.**
   - `git init`, ESLint + Prettier.
   - Layered skeleton; `config/env.js`; error classes and `errorHandler`.
   - `helmet`, session, `requireAuth`, rate limit.
   - `scripts/hash-password.js` and the `auth` endpoints.
   - Move `src/db.js` to `src/config/db.js`; split `src/server.js` into `app.js` and `server.js`.
   - `.env.example` (the app user itself is created in `db/03_procedimientos.sql`).
   - Remove `/api/salud` or protect it.
2. **Visual foundation.** `tokens.css`, `app.css` with every component, `layout.js`, `api.js`, `format.js`, `dom.js`, and the login page working end to end.
3. **Clientes:** list, stats, search, register and its error.
4. **Cuentas IBAN:** list, stats, search, register and its errors.
5. **Teléfonos:** list, stats, register, change owner and their errors.
6. **SINPE Móvil:** list, enroll (success and errors), unenroll modal, change account modal (and error).
7. **Transferencias:** by phone and by IBAN, the 3 steps, every error, and the test-case chips.
8. **Historial e informes:** movements by period with totals, enrollment history of a phone, phones of an account.
9. **Polish and docs.** (The dark theme built here was removed in Phase A.)
   - Screen-by-screen check against Figma.
   - Security self-review against sections 5 and 6.
   - `README.md` in English: setup (fresh DB install order 01 → 02 → 03), scripts, architecture, security notes.

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

## 13. Open decisions (ask before implementing)

1. **Destination balances in the receipt.** It shows the destination account's before/after and "Total entre ambas cuentas". A real app would not show a third party's balance, but the exercise requires proving conservation of the total. Spec recommendation: keep it as in the Figma, mention it in the README, and do not show that balance in the "Hacia" card.
2. **Daily limit value.** Proposed ₡200 000 for every entity (BCR lets the client configure up to ₡500 000).
3. **`disenio/` images.** Replace with exports of the new Figma when they are ready.

**To fix in the Figma, not in the code:** the "usuario de otra entidad" login error (must be generic); the help "Se cambia en el primer ingreso" (must be "El cliente la usará para iniciar sesión."); and what the Figma lacks, defined here instead: entity selector, status notes, "Cuenta de origen", daily limit error, "ya afiliado en otra entidad" text.
