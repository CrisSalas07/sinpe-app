# SINPE JUNTAUCR

A web app for the _Prueba corta – SINPE JUNTAUCR_ exercise (Databases course, UCR Sede del Sur).
It manages clients, IBAN accounts, phone numbers, SINPE Móvil enrollments and money transfers on
top of a MySQL database where **all business rules live in stored procedures and triggers**.

The UI follows the Figma prototype (exports in `disenio/`), in Spanish, with a light and a dark
theme.

## Requirements

- Node.js 24 (uses `--env-file` and `--watch`, no dotenv)
- npm 11
- MySQL 8

## Setup from scratch

1. **Create the database** as MySQL `root`, running the scripts in order:

   ```sh
   mysql -u root -p < db/01_esquema_y_datos.sql
   mysql -u root -p < db/02_triggers.sql
   mysql -u root -p < db/03_procedimientos.sql
   ```

   - `01` creates the schema, loads the seed data (24 clients, 36 accounts, 38 phones, 24 SINPE
     enrollments) and their initial enrollment history.
   - `02` creates the triggers. `03` creates the stored procedures and the application user
     `sinpe_app`@`localhost` with `SELECT, EXECUTE` only.

2. **Change the example password** of `sinpe_app` (set in `03_procedimientos.sql`):

   ```sql
   ALTER USER 'sinpe_app'@'localhost' IDENTIFIED BY '<your password>';
   ```

3. **Create `.env`** from the template and fill in every value:

   ```sh
   cp .env.example .env
   ```

   - `DB_PASSWORD`: the password from step 2.
   - `SESSION_SECRET`: at least 32 random characters, e.g.
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

4. **Install dependencies:** `npm install`

5. **Set the operator password:** `npm run hash-password`, type the password, and paste the
   printed `APP_PASSWORD_HASH=...` line into `.env`.

6. **Run:** `npm run dev` and open <http://localhost:3000>.

The app refuses to start, with a clear message, if any required variable is missing.

### Test credentials

User `admin`, password `Juntaucr2026` (the one shown on the login screen, as in the prototype),
once step 5 was done with that password.

## npm scripts

| Script                  | What it does                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`           | Starts the server with `.env` and restarts it when files change                         |
| `npm test`              | Runs the `node:test` suites in `test/` (validators, money formatting, password hashing) |
| `npm run lint`          | ESLint                                                                                  |
| `npm run format`        | Prettier                                                                                |
| `npm run hash-password` | Prints a scrypt hash for `APP_PASSWORD_HASH`                                            |

## Architecture

```
HTTP request
  → routes/        path + middlewares + controller
  → controllers/   read the request, validate, call the service, send the response
  → services/      use-case orchestration (e.g. transfer = CALL + read the receipt)
  → repositories/  the only place with SQL (SELECT and CALL sp_*)
  → MySQL          business rules, transactions and triggers (source of truth)
```

- `src/validators/`: pure functions that return clean data or throw `ValidationError`.
- `src/middlewares/`: session check (`requireAuth`), login rate limit, a single error handler.
- `public/`: plain HTML, CSS and ES modules served by Express, one page per menu section.
  Shared modules: `api.js` (fetch wrapper, 401 → login), `dom.js` (safe DOM builders),
  `format.js` (names, phones, IBAN, money), `layout.js` (header, theme, logout), `theme.js`.

## Security

- **Authentication:** one operator account from `.env`. The password is stored only as a
  scrypt hash with a random salt and compared with `crypto.timingSafeEqual`. Failed logins get a
  generic message and are rate-limited to 5 per 15 minutes per IP (successful ones do not count).
- **Session:** `express-session`, cookie `httpOnly` + `sameSite=strict` (+ `secure` in
  production), new session id on login, destroyed on logout, 15-minute idle timeout.
- **Every `/api/*` route except login requires a session.**
- **HTTP hardening:** `helmet` with a strict CSP (`script-src 'self'`, no inline scripts or
  handlers; Google Fonts allowed for styles and fonts), `x-powered-by` disabled, 10 kB JSON body
  limit, write requests must be `application/json`.
- **Input:** every body and query parameter is validated on the server (formats, lengths from
  the schema, enums, real calendar dates) and unknown fields are rejected.
- **SQL:** placeholders only; SQL exists only in `src/repositories/`.
- **XSS:** data is inserted with `textContent` / DOM builders, never `innerHTML`.
- **Errors:** clients never see stacks or SQL. Messages from the procedures (`SIGNAL 45000`) are
  shown as they are. Server logs omit SQL text and parameter values.
- **Least privilege:** the app connects as `sinpe_app`, which cannot `INSERT`, `UPDATE` or
  `DELETE`. Every write goes through a stored procedure running with its definer's rights.

## Data integrity

- Stored procedures own all writes, transactions and locking (`FOR UPDATE` in transfers).
  The backend never reimplements or bypasses them.
- Money is never a JavaScript float: `DECIMAL` values travel as strings, the balance preview and
  the conserved total use integer cents.
- `dateStrings: true` avoids time-zone shifts.
- Submit / confirm buttons are disabled while a request is pending (no double transfers).
- After every write the affected data is read again from the database.
- Transfer receipt: the `CALL` and `SELECT LAST_INSERT_ID()` run on the same connection; the
  "before" balances are computed in SQL from the stored "after" balances.

## Known limitations

- **In-memory session store:** sessions are lost when the server restarts and it only works with
  a single instance. Fine for this local demo; a shared store would be needed to deploy it.
- **Receipt with simultaneous transfers:** if two transfers on the same accounts are confirmed at
  the same time, the money is always correct (both accounts are locked with `FOR UPDATE` inside a
  transaction), but a receipt's "after" balances are read right after its `CALL` without a lock,
  so they may already include the other transfer.
- **Password hint on the login screen:** the prototype shows "Usuario de prueba: admin ·
  Juntaucr2026", and the app keeps it to match the prototype. This is an accepted risk for a local
  demo; remove that line before using the app anywhere else.
- **`secure` cookies behind a proxy:** in production the cookie is `secure`; if the app runs
  behind a reverse proxy, Express' `trust proxy` setting must also be configured.

## Screens

| Screen               | What it does                                                                                                  | Database objects                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login                | Operator sign-in                                                                                              | —                                                                                                                                                           |
| Clientes             | List, stats, search, register                                                                                 | `sp_registrar_cliente`                                                                                                                                      |
| Cuentas IBAN         | List, stats, search, register                                                                                 | `sp_registrar_cuenta`                                                                                                                                       |
| Teléfonos            | List, stats, search, register, change owner                                                                   | `sp_registrar_telefono`, `sp_cambiar_titular_telefono`, `trg_telefono_validar_insert`, `trg_telefono_validar_update`                                        |
| SINPE Móvil          | Enroll, unenroll, change account                                                                              | `sp_afiliar_sinpe`, `sp_desafiliar_sinpe`, `sp_cambiar_cuenta_sinpe`, `trg_validar_afiliacion`, `trg_historial_afiliacion`, `trg_afiliacion_auditar_delete` |
| Transferencias       | By phone or IBAN: data → review → receipt; test-case chips                                                    | `sp_transferir_sinpe`, `sp_transferir_iban`, `trg_transferencia_validar`                                                                                    |
| Historial e informes | Movements of an account in a period with totals, enrollment history of a phone, phones enrolled to an account | `sp_consultar_movimientos`, `historial_afiliacion`                                                                                                          |

## Requirements coverage

Business rules from the assignment:

| Rule                                                          | Enforced in the database                                      | Visible in the app                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| 1. A client can have several accounts and phones              | `id_cliente` FK in `cuenta_iban` and `telefono_cliente`       | Clientes (Cuentas and Teléfonos columns)             |
| 2. A phone is unique, has 8 digits and one owner              | `UNIQUE` + `CHECK` + `sp_registrar_telefono`                  | Registrar teléfono · Error                           |
| 3. Registering a phone is not enrolling it                    | `sp_registrar_telefono` only inserts the phone                | Teléfonos ("No afiliado")                            |
| 4. An account's phones belong to the same owner               | `trg_validar_afiliacion`                                      | Afiliar · Error (titularidad)                        |
| 5. At most one active enrollment per phone                    | `UNIQUE(id_telefono)` + `sp_afiliar_sinpe`                    | Afiliar · Error (ya afiliado)                        |
| 6. Only ACTIVE accounts in CRC can be enrolled                | `trg_validar_afiliacion`                                      | Afiliar · Error (cuenta no válida)                   |
| 7. No transfers to the same account                           | `trg_transferencia_validar` + `sp_transferir_iban`            | "Misma cuenta" errors (by phone and by IBAN)         |
| 8. Active accounts, amount > 0, enough balance, same currency | `sp_transferir_*` + `trg_transferencia_validar`               | Balance, amount, currency and blocked-account errors |
| 9. Historical evidence and rollback                           | Audit triggers + `EXIT HANDLER` / `ROLLBACK`                  | Historial · Cambiar cuenta · Error                   |
| 10. Changing a phone's owner without breaking enrollments     | `trg_telefono_validar_update` + `sp_cambiar_titular_telefono` | Editar teléfono · Error                              |

Queries and reports from the assignment:

| Report                                      | Visible in the app                             |
| ------------------------------------------- | ---------------------------------------------- |
| 1. Phones per client and which are enrolled | Teléfonos                                      |
| 2. Phones of an IBAN account                | Historial → "Teléfonos asociados a una cuenta" |
| 3. Enrollment history of a phone            | Historial → "Afiliaciones de un teléfono"      |
| 4. Sent and received transfers              | Historial → "Movimientos de una cuenta"        |
| 5. Totals in a date range                   | Historial → period totals                      |
| 6. Balances and conservation of the total   | Comprobante ("Total entre ambas cuentas")      |
