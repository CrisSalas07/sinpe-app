# SINPE JUNTAUCR

A web app for the _Prueba corta – SINPE JUNTAUCR_ exercise (Databases course, UCR Sede del Sur).
It simulates clients, IBAN accounts, phone numbers, SINPE Móvil enrollments and money transfers on
top of a MySQL database where **all business rules live in stored procedures and triggers**.

In real life each bank has its own app. This simulation has one app with an **entity selector** at
login: the session is tied to that entity and every query and write is filtered by it. There are
two roles, **Administrador** and **Cliente**.

The UI follows the Figma prototype, in Spanish, with a single light theme.

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

   In PowerShell, which has no `<` redirection, wrap each line: `cmd /c "mysql -u root -p < db\01_esquema_y_datos.sql"`.
   Load each file on its own: chaining them with `-e "source a; source b"` leaves the procedures
   uninstalled because of `DELIMITER`.

   - `01` drops and creates the schema and loads the seed data (24 clients, 36 accounts, 38
     phones, 24 SINPE enrollments, 36 client logins) and the initial enrollment history.
   - `02` creates the triggers. `03` creates the stored procedures and the application user
     `sinpe_app`@`localhost` with `SELECT, EXECUTE` only.
   - To reinstall, run the three again. Data is recreated; `sinpe_app` and its password are kept.

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

5. **Set the administrator password:** `npm run hash-password`, type the password, and paste the
   printed `APP_PASSWORD_HASH=...` line into `.env`.

6. **Run:** `npm run dev` and open <http://localhost:3000>.

The app refuses to start, with a clear message, if any required variable is missing.

### Test credentials

| Role          | Entity                           | User                                                                | Password       |
| ------------- | -------------------------------- | ------------------------------------------------------------------- | -------------- |
| Administrador | Any (the one chosen)             | `admin`                                                             | `Juntaucr2026` |
| Cliente       | Each one where it has an account | First name + `.` + first surname, e.g. `leonardo.aguilar` (BCR, BP) | `Cliente2026`  |

The administrator password works once step 5 was done with it.

## npm scripts

| Script                  | What it does                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `npm run dev`           | Starts the server with `.env` and restarts it when files change                          |
| `npm test`              | Runs the `node:test` suites in `test/` (validators, formatting, roles, password hashing) |
| `npm run lint`          | ESLint                                                                                   |
| `npm run format`        | Prettier                                                                                 |
| `npm run hash-password` | Prints a scrypt hash for `APP_PASSWORD_HASH`                                             |

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
- `src/middlewares/`: session and role checks (`requireAuth`, `requireRole`), login rate limit, a
  single error handler.
- `public/`: plain HTML, CSS and ES modules served by Express, one page per menu section.
  Shared modules: `api.js` (fetch wrapper, 401 → login), `dom.js` (safe DOM builders),
  `format.js` (names, phones, IBAN, money), `layout.js` (per-role header, session and role check).

## Security

- **Authentication:** the administrator comes from `.env`; clients from `cliente_entidad`, one
  user per entity. Passwords are stored only as scrypt hashes with a random salt, created in Node
  (procedures only receive the hash) and compared with `crypto.timingSafeEqual`. scrypt always
  runs, even for unknown users, so the response time does not reveal them. Any failure gets one
  generic message, which never says if the user exists in another entity. Failed logins are
  rate-limited to 5 per 15 minutes per IP (successful ones do not count).
- **Authorization:** `requireRole` answers 403 on the routes of the other role. The entity and the
  client **always come from the session**: `entityId`, `bankId` and `clientId` are rejected in
  request bodies, and the procedures check that the origin account belongs to that client and
  entity. The page-level role check is only a convenience; the server protects the data.
- **Entity isolation:** an administrator only sees data of its entity. A phone enrolled in another
  entity shows that entity's code, never the IBAN.
- **Session:** `express-session`, cookie `httpOnly` + `sameSite=strict` (+ `secure` in
  production), new session id on login, destroyed on logout, 15-minute idle timeout.
- **Every `/api/*` route except login and `GET /api/auth/entities` requires a session.**
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
- Money is never a JavaScript float: `DECIMAL` values travel as strings and the balance preview
  uses integer cents.
- `dateStrings: true` avoids time-zone shifts.
- Submit / confirm buttons are disabled while a request is pending (no double transfers).
- After every write the affected data is read again from the database.
- Transfer receipt: the `CALL` and `SELECT LAST_INSERT_ID()` run on the same connection. Like a
  real SINPE Móvil receipt it shows no balances, and a phone transfer never returns the IBAN
  behind the recipient's phone.

## Known limitations

- **In-memory session store:** sessions are lost when the server restarts and it only works with
  a single instance. Fine for this local demo; a shared store would be needed to deploy it.
- **Simultaneous opposite transfers:** each transfer locks its origin account first, so A → B and
  B → A at the same moment can deadlock. MySQL rolls one back: no money moves and that client sees
  "Error interno". Trying again works.
- **Password hint on the login screen:** the prototype shows the test credentials, and the app
  keeps them to match the prototype. This is an accepted risk for a local demo; remove that line
  before using the app anywhere else. The seed data also has one shared test password.
- **Conservation of the total:** the exercise asked to show it, but the receipt follows the real
  service and shows no balances. The procedures still guarantee it (both accounts change in one
  transaction); it can be checked by comparing the balances in Cuentas IBAN.
- **Recipient lookup:** a logged-in client can look up the name of a phone or IBAN, as in the real
  service, and that endpoint has no rate limit. It only returns the compact name and the entity.
- **No forced password change:** clients keep the temporary password, because the prototype has no
  such screen.
- **`secure` cookies behind a proxy:** in production the cookie is `secure`; if the app runs
  behind a reverse proxy, Express' `trust proxy` setting must also be configured.

## Screens

**Login:** entity selector, user and password. It redirects each role to its home page.

**Administrador** (menu: Clientes · Cuentas IBAN · Teléfonos · SINPE Móvil · Informes). It does not
transfer money or see client movements.

| Screen       | What it does                                                         | Database objects                                                                                                                                            |
| ------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clientes     | List, stats, search, register with username and temporary password   | `sp_registrar_cliente`, `cliente_entidad`                                                                                                                   |
| Cuentas IBAN | List, stats, search, register (the entity comes from the session)    | `sp_registrar_cuenta`                                                                                                                                       |
| Teléfonos    | List, stats, search, change owner. Clients register their own phones | `sp_cambiar_titular_telefono`, `trg_telefono_validar_update`                                                                                                |
| SINPE Móvil  | Enroll, unenroll, change account                                     | `sp_afiliar_sinpe`, `sp_desafiliar_sinpe`, `sp_cambiar_cuenta_sinpe`, `trg_validar_afiliacion`, `trg_historial_afiliacion`, `trg_afiliacion_auditar_delete` |
| Informes     | Enrollment history of a phone, phones enrolled to an account         | `historial_afiliacion`                                                                                                                                      |

**Cliente** (menu: Inicio · Mis teléfonos · Transferir · Mis movimientos). It does not enroll phones:
the administrator does.

| Screen          | What it does                                                                                 | Database objects                                                         |
| --------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Inicio          | Stats, accounts with balance, last 5 movements                                               | `cuenta_iban`, `transferencia`                                           |
| Mis teléfonos   | List, register (the owner comes from the session)                                            | `sp_registrar_telefono`, `trg_telefono_validar_insert`                   |
| Transferir      | From an own account, by phone or IBAN: data → review → receipt; test-case chips for Leonardo | `sp_transferir_sinpe`, `sp_transferir_iban`, `trg_transferencia_validar` |
| Mis movimientos | Movements of an own account in a period, with totals                                         | `sp_consultar_movimientos`                                               |

## SINPE Móvil rules

Based on how the real service works (BCCR, Banco Popular, BAC, Caja de ANDE):

| Rule                                                                                           | Where                                                           |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Enrollment happens in the entity of the account, which must be ACTIVA, in CRC and of the owner | `sp_afiliar_sinpe`, `trg_validar_afiliacion`                    |
| A number is linked to one account in the whole system; an account can have several numbers     | `UNIQUE(id_telefono)`, `sp_afiliar_sinpe`                       |
| Enrolled in another bank: it must be unenrolled there first                                    | `sp_afiliar_sinpe`                                              |
| Only the entity holding the enrollment can unenroll it or change its account                   | `sp_desafiliar_sinpe`, `sp_cambiar_cuenta_sinpe`                |
| The sender picks an own account and types the number; the destination can be in any entity     | `sp_transferir_sinpe`                                           |
| The app shows the name of the recipient before confirming                                      | `GET /api/transfers/recipient`                                  |
| Daily limit per account and entity (₡200 000 in the seed data)                                 | `entidad_financiera.limite_diario_sinpe`, `sp_transferir_sinpe` |
| The IBAN carries the entity code (`CR` + 2 digits + `0` + 3-digit code + 14 digits)            | `entidad_financiera.codigo_iban`, `sp_registrar_cuenta`         |

Transfer validations run in this order inside the procedure: the origin belongs to the client and
entity of the session; it is ACTIVA and in CRC; the number is registered and enrolled; the
destination is ACTIVA; they are different accounts; the amount is positive; the daily limit; the
balance.

## Requirements coverage

Business rules from the assignment:

| Rule                                                          | Enforced in the database                                      | Visible in the app                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| 1. A client can have several accounts and phones              | `id_cliente` FK in `cuenta_iban` and `telefono_cliente`       | Clientes (Cuentas and Teléfonos columns)             |
| 2. A phone is unique, has 8 digits and one owner              | `UNIQUE` + `CHECK` + `sp_registrar_telefono`                  | Mis teléfonos · Registrar teléfono · Error           |
| 3. Registering a phone is not enrolling it                    | `sp_registrar_telefono` only inserts the phone                | Teléfonos ("No afiliado")                            |
| 4. An account's phones belong to the same owner               | `trg_validar_afiliacion`                                      | Afiliar · Error (titularidad)                        |
| 5. At most one active enrollment per phone                    | `UNIQUE(id_telefono)` + `sp_afiliar_sinpe`                    | Afiliar · Error (ya afiliado)                        |
| 6. Only ACTIVE accounts in CRC can be enrolled                | `trg_validar_afiliacion`                                      | Afiliar · Error (cuenta no válida)                   |
| 7. No transfers to the same account                           | `trg_transferencia_validar` + `sp_transferir_iban`            | "Misma cuenta" errors (by phone and by IBAN)         |
| 8. Active accounts, amount > 0, enough balance, same currency | `sp_transferir_*` + `trg_transferencia_validar`               | Balance, amount, currency and blocked-account errors |
| 9. Historical evidence and rollback                           | Audit triggers + `EXIT HANDLER` / `ROLLBACK`                  | Informes · Cambiar cuenta · Error                    |
| 10. Changing a phone's owner without breaking enrollments     | `trg_telefono_validar_update` + `sp_cambiar_titular_telefono` | Editar teléfono · Error                              |

Queries and reports from the assignment:

| Report                                      | Visible in the app                                |
| ------------------------------------------- | ------------------------------------------------- |
| 1. Phones per client and which are enrolled | Teléfonos (administrator), Mis teléfonos (client) |
| 2. Phones of an IBAN account                | Informes → "Teléfonos asociados a una cuenta"     |
| 3. Enrollment history of a phone            | Informes → "Afiliaciones de un teléfono"          |
| 4. Sent and received transfers              | Mis movimientos                                   |
| 5. Totals in a date range                   | Mis movimientos → period totals                   |
| 6. Balances and conservation of the total   | Cuentas IBAN (administrator), Inicio (client)     |
