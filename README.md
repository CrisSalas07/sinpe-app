# SINPE JUNTAUCR

Simulador web de **SINPE Móvil** y transferencias **IBAN** entre bancos costarricenses, construido
sobre MySQL con **todas las reglas de negocio en procedimientos almacenados y triggers**. El
servidor en Node.js solo valida entradas, controla sesiones y llama a esos procedimientos.

Proyecto del curso **Bases de Datos II** (Universidad de Costa Rica, Sede del Sur). Incluye el
módulo de **respaldo y restauración** del _Laboratorio Copia de Seguridad_.

![MySQL 8](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Node.js 24](https://img.shields.io/badge/Node.js-24-5FA04E?logo=nodedotjs&logoColor=white)
![Express 5](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Frontend sin frameworks](https://img.shields.io/badge/Frontend-HTML%20%2B%20CSS%20%2B%20JS-F7DF1E?logo=javascript&logoColor=black)
![Pruebas](https://img.shields.io/badge/pruebas-62%20correctas-2EA44F)

## Qué demuestra este proyecto

- **La base de datos manda.** 12 procedimientos almacenados y varios triggers validan cada
  operación, usan transacciones y bloquean filas (`FOR UPDATE`). Si una regla no se cumple, el
  procedimiento responde con `SIGNAL` y la app muestra ese mensaje tal cual.
- **Mínimo privilegio real.** La app se conecta con `sinpe_app`, que solo tiene `SELECT` y
  `EXECUTE`: no puede hacer `INSERT`, `UPDATE` ni `DELETE` directo en ninguna tabla.
- **Multibanco y multirol.** Una sola app para BCR, BN, BP, BAC y Junta UCR, con roles de
  **administrador** y **cliente**. La entidad y el cliente salen siempre de la sesión, nunca de la
  petición.
- **Dinero sin errores de redondeo.** Los montos viajan como texto y la pantalla calcula en
  céntimos enteros; débito, crédito y registro ocurren en una sola transacción.
- **Respaldo y restauración desde la app.** Respaldo automático programado (diario, semanal o
  mensual, con hora), restauración desde un archivo elegido o subido, respaldo de seguridad previo
  y reversión automática si la restauración falla.
- **Seguridad cuidada.** Contraseñas con scrypt, límite de intentos de login, cookies
  `httpOnly` + `sameSite=strict`, CSP estricta con `helmet`, SQL siempre parametrizado y datos
  insertados en pantalla como texto (nunca `innerHTML`).
- **Sin frameworks en el frontend.** HTML, CSS y JavaScript con módulos ES; colores de cada banco
  tomados de sus logos oficiales.

## Tecnologías

| Capa          | Tecnología                                                                         |
| ------------- | ---------------------------------------------------------------------------------- |
| Base de datos | MySQL 8: procedimientos almacenados, triggers, transacciones                       |
| Servidor      | Node.js 24, Express 5, `mysql2`, `express-session`, `helmet`, `express-rate-limit` |
| Frontend      | HTML, CSS y JavaScript (módulos ES), sin frameworks                                |
| Calidad       | `node:test` (62 pruebas), ESLint, Prettier                                         |

## Arquitectura

Cada capa del servidor solo llama a la de abajo:

```
Petición HTTP → routes → controllers → services → repositories → MySQL (procedimientos y triggers)
```

```
sinpe-app/
├── db/                         Scripts de MySQL (se cargan en orden)
│   ├── 01_esquema_y_datos.sql  Tablas y datos de prueba (borra y recrea la base)
│   ├── 02_triggers.sql         Triggers de validación y de auditoría
│   ├── 03_procedimientos.sql   Procedimientos almacenados y el usuario sinpe_app
│   └── 04_usuario_respaldos.sql  Usuario sinpe_backup del módulo Respaldos
├── src/                        Servidor (Node.js + Express)
│   ├── server.js               Arranca el servidor HTTP
│   ├── app.js                  Middlewares, rutas y archivos estáticos
│   ├── config/                 Variables de entorno y pool de MySQL
│   ├── routes/                 Rutas por recurso (solo conectan ruta → controlador)
│   ├── controllers/            Leen la petición, validan y responden
│   ├── services/               Casos de uso (por ejemplo: transferir = CALL + leer comprobante)
│   ├── repositories/           Único lugar con SQL (SELECT y CALL sp_*)
│   ├── validators/             Validación de entradas (formatos, largos, campos permitidos)
│   ├── middlewares/            Sesión, roles, límite de intentos de login, manejo de errores
│   └── utils/                  Errores, hash de contraseñas, nombres, mysqldump/mysql
├── public/                     Frontend: una página HTML y un módulo JS por pantalla
├── scripts/hash-password.js    Genera el hash de la contraseña del administrador
├── test/                       Pruebas automáticas (node:test)
└── .env.example                Plantilla de configuración
```

## Base de datos

Esquema `sinpe_movil`:

| Tabla                  | Qué guarda                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `cliente`              | Personas (únicas por identificación y por correo), estado ACTIVO / INACTIVO          |
| `entidad_financiera`   | Bancos: código (BCR…), código IBAN (152…), límite diario de SINPE Móvil              |
| `cliente_entidad`      | Una persona como cliente de un banco, con su usuario y el hash de su contraseña      |
| `moneda`               | Catálogo: CRC y USD                                                                  |
| `cuenta_iban`          | Cuentas: cliente, banco, moneda, IBAN, saldo, estado (ACTIVA, INACTIVA, BLOQUEADA)   |
| `telefono_cliente`     | Teléfonos: 8 dígitos, únicos en todo el sistema, un solo dueño                       |
| `afiliacion_sinpe`     | Afiliación vigente de un teléfono a una cuenta (máximo una por teléfono)             |
| `historial_afiliacion` | Eventos AFILIACION / DESAFILIACION (los escriben los triggers)                       |
| `transferencia`        | Movimientos: origen, destino, monto, tipo (SINPE_MOVIL / IBAN), fecha, detalle       |
| `transferencia_sinpe`  | Para SINPE Móvil: teléfono de origen (si tiene) y teléfono de destino                |
| `cuenta_matriculada`   | Cuentas de terceros que un cliente matriculó en un banco para transferirles por IBAN |

**Triggers (`02`):** validan la afiliación (cuenta ACTIVA, en colones y del mismo dueño), validan
las transferencias (monto positivo, cuentas distintas), impiden cambiar el dueño de un teléfono
afiliado, impiden registrar teléfonos a clientes inactivos y escriben el historial de afiliaciones.

<details>
<summary><b>Procedimientos almacenados (<code>03</code>)</b></summary>

| Procedimiento                 | Uso                                                                     |
| ----------------------------- | ----------------------------------------------------------------------- |
| `sp_registrar_cliente`        | Registrar un cliente en una entidad, con usuario y contraseña           |
| `sp_registrar_cuenta`         | Abrir una cuenta IBAN (el IBAN debe ser del banco de la sesión)         |
| `sp_cambiar_estado_cuenta`    | Cambiar el estado de una cuenta (ACTIVA, INACTIVA, BLOQUEADA)           |
| `sp_registrar_telefono`       | Registrar un teléfono a un cliente de la entidad                        |
| `sp_cambiar_titular_telefono` | Cambiar el dueño de un teléfono (no si está afiliado)                   |
| `sp_afiliar_sinpe`            | Afiliar un teléfono a una cuenta                                        |
| `sp_desafiliar_sinpe`         | Quitar la afiliación (solo el banco que la tiene)                       |
| `sp_cambiar_cuenta_sinpe`     | Pasar la afiliación a otra cuenta (si falla, se conserva la original)   |
| `sp_transferir_sinpe`         | Transferir de una cuenta propia a un número de teléfono                 |
| `sp_matricular_cuenta`        | Matricular una cuenta de tercero (requisito para transferirle por IBAN) |
| `sp_transferir_iban`          | Transferir de una cuenta propia a otra propia o a una matriculada       |
| `sp_consultar_movimientos`    | Movimientos y totales de una cuenta en un período                       |

</details>

<details>
<summary><b>Reglas de negocio y dónde se aplican</b></summary>

**Teléfonos y afiliación (SINPE Móvil)**

| Regla                                                                                       | Dónde                                            |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Un número tiene 8 dígitos, es único en el sistema y tiene un solo dueño                     | `UNIQUE` + `CHECK` + `sp_registrar_telefono`     |
| Registrar un teléfono no lo afilia                                                          | `sp_registrar_telefono`                          |
| Se afilia a una cuenta del mismo dueño, ACTIVA y en colones, del banco de la sesión         | `sp_afiliar_sinpe`, `trg_validar_afiliacion`     |
| Afilian y desafilian el administrador o el propio cliente (solo sus números y cuentas)      | `sp_afiliar_sinpe` + revisión del servidor       |
| Un número está afiliado a una sola cuenta en todo el sistema; una cuenta puede tener varios | `UNIQUE(id_telefono)`                            |
| Si está afiliado en otro banco, debe desafiliarse allá primero                              | `sp_afiliar_sinpe`                               |
| Solo el banco que tiene la afiliación puede quitarla o cambiarla                            | `sp_desafiliar_sinpe`, `sp_cambiar_cuenta_sinpe` |
| No se cambia el dueño de un teléfono afiliado                                               | `trg_telefono_validar_update`                    |
| Cada afiliación y desafiliación queda en el historial                                       | Triggers de auditoría                            |

**Transferencias**

| Regla                                                                                            | Dónde                                         |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| La cuenta de origen es del cliente y del banco de la sesión, y está ACTIVA                       | `sp_transferir_sinpe`, `sp_transferir_iban`   |
| SINPE Móvil: solo en colones; el número de destino debe estar registrado y afiliado              | `sp_transferir_sinpe`                         |
| SINPE Móvil: límite diario por cuenta (₡200 000 en los datos de prueba)                          | `entidad_financiera.limite_diario_sinpe`      |
| IBAN: el destino existe, está ACTIVO y es de la misma moneda                                     | `sp_transferir_iban`                          |
| IBAN a un tercero: la cuenta debe estar matriculada por el cliente en ese banco (las propias no) | `sp_transferir_iban`, `cuenta_matriculada`    |
| Matricular una cuenta de otro banco: la identificación debe ser la de su titular                 | `sp_matricular_cuenta`                        |
| No a la misma cuenta, monto mayor que cero, saldo suficiente                                     | Procedimientos + `trg_transferencia_validar`  |
| Débito, crédito y registro en una sola transacción, con las cuentas bloqueadas (`FOR UPDATE`)    | `sp_transferir_*`                             |
| Una cuenta INACTIVA o BLOQUEADA no envía ni recibe; INACTIVA exige saldo cero                    | `sp_cambiar_estado_cuenta`, `sp_transferir_*` |

Orden de validación de SINPE Móvil: origen del cliente → origen ACTIVO y en colones → número
registrado y afiliado → destino ACTIVO → cuentas distintas → monto positivo → límite diario →
saldo.

</details>

## Instalación

**Requisitos:** MySQL 8 (con acceso como `root`), Node.js 24 y npm 11.

1. **Clonar el proyecto:**

   ```sh
   git clone https://github.com/CrisSalas07/sinpe-app.git
   cd sinpe-app
   ```

2. **Crear la base de datos** como `root`, cargando los scripts **en orden y por separado**:

   ```sh
   mysql -u root -p --default-character-set=utf8mb4 < db/01_esquema_y_datos.sql
   mysql -u root -p --default-character-set=utf8mb4 < db/02_triggers.sql
   mysql -u root -p --default-character-set=utf8mb4 < db/03_procedimientos.sql
   mysql -u root -p < db/04_usuario_respaldos.sql
   ```

   - En **PowerShell** el símbolo `<` no funciona; use `cmd /c` en cada línea, por ejemplo:
     `cmd /c "mysql -u root -p --default-character-set=utf8mb4 < db\01_esquema_y_datos.sql"`.
   - `--default-character-set=utf8mb4` hace que las tildes de los mensajes se guarden bien.
   - No los encadene con `-e "source a; source b"`: por el `DELIMITER`, los procedimientos no se
     instalan.
   - `01` **borra y recrea la base**. Para volver a los datos de prueba, cargue de nuevo `01`, `02`
     y `03`. Los usuarios `sinpe_app` y `sinpe_backup` y sus contraseñas se conservan.
   - `04` se carga una sola vez: crea `sinpe_backup`, el usuario del módulo Respaldos, que solo
     puede trabajar sobre `sinpe_movil`.

3. **Cambiar las contraseñas de ejemplo** de los usuarios de MySQL:

   ```sql
   ALTER USER 'sinpe_app'@'localhost' IDENTIFIED BY '<su contraseña>';
   ALTER USER 'sinpe_backup'@'localhost' IDENTIFIED BY '<otra contraseña>';
   ```

4. **Crear el `.env`** a partir de la plantilla (`cp .env.example .env`) y completar cada valor:

   | Variable             | Valor                                                 |
   | -------------------- | ----------------------------------------------------- |
   | `NODE_ENV`           | `development`                                         |
   | `PORT`               | `3000`                                                |
   | `DB_HOST`, `DB_PORT` | `localhost`, `3306`                                   |
   | `DB_USER`            | `sinpe_app`                                           |
   | `DB_PASSWORD`        | La contraseña del paso 3                              |
   | `DB_NAME`            | `sinpe_movil`                                         |
   | `SESSION_SECRET`     | Al menos 32 caracteres al azar (ver el comando abajo) |
   | `APP_USER`           | `admin`                                               |
   | `APP_PASSWORD_HASH`  | Ver el paso 6                                         |
   | `BACKUP_DB_USER`     | `sinpe_backup` (módulo Respaldos; vacío lo desactiva) |
   | `BACKUP_DB_PASSWORD` | La contraseña de `sinpe_backup` del paso 3            |
   | `MYSQL_BIN_DIR`      | `C:\Program Files\MySQL\MySQL Server 8.0\bin`         |
   | `BACKUP_DIR`         | `respaldos`                                           |

   Para generar `SESSION_SECRET`:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

5. **Instalar las dependencias:** `npm install`

6. **Definir la contraseña del administrador:** ejecute `npm run hash-password`, escriba la
   contraseña (para la demostración: `Juntaucr2026`) y pegue la línea `APP_PASSWORD_HASH=...` que
   imprime en el `.env`.

7. **Iniciar:** `npm run dev` y abrir <http://localhost:3000>.

Si falta alguna variable, la app no arranca y dice cuál falta.

## Credenciales de prueba

| Rol           | Entidad                   | Usuario                              | Contraseña     |
| ------------- | ------------------------- | ------------------------------------ | -------------- |
| Administrador | Cualquiera (la que elija) | `admin`                              | `Juntaucr2026` |
| Cliente       | Donde tenga cuenta        | Por ejemplo `leonardo.aguilar` (BCR) | `Cliente2026`  |

El usuario de un cliente es **primer nombre + punto + primer apellido**, en minúsculas y sin
tildes. Solo puede entrar en las entidades donde tiene cuenta.

<details>
<summary><b>Todos los clientes de prueba y usuarios útiles para la demostración</b></summary>

| Entidad      | Clientes (cuenta)                                                                                                                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BCR**      | `leonardo.aguilar` (001), `cristopher.buso` (005), `dilan.gonzalez` (009), `john.marin` (013), `jandany.moya` (017), `steven.ramirez` (021), `hugo.arauz` (026 USD), `cristopher.mora` (030 USD), `ivan.altamirano` (033), `kendall.montero` (035), `scarlette.rosales` (036) |
| **BN**       | `ivan.altamirano` (002), `keity.chavarria` (006), `reiko.gonzalez` (010), `kendall.montero` (014), `astrid.munguia` (018), `scarlette.rosales` (022), `hugo.gurdian` (029 USD), `darlin.chaves` (034 BLOQUEADA)                                                               |
| **BP**       | `hugo.arauz` (003), `darlin.chaves` (007), `jefferson.granados` (011), `cristopher.mora` (015), `lucia.palacio` (019), `bayron.sanchez` (023), `leonardo.aguilar` (025 USD), `dilan.gonzalez` (028 USD), `steven.ramirez` (032 USD)                                           |
| **BAC**      | `hairon.azofeifa` (004), `mariela.chinchilla` (008), `hugo.gurdian` (012), `camila.mora` (016), `diego.pastran` (020), `diego.sanchez` (024), `keity.chavarria` (027 USD), `astrid.munguia` (031 USD)                                                                         |
| **JUNTAUCR** | `leonardo.aguilar` (037), `ivan.altamirano` (038), `hugo.arauz` (039 USD)                                                                                                                                                                                                     |

Las cuentas son en colones salvo que diga USD. Los IBAN siguen el formato `CR12` + `0` + código
del banco + número de cuenta en 14 dígitos; por ejemplo, la 001 del BCR es
`CR12015200000000000001`. La Junta UCR no tiene código IBAN propio en la vida real (usa cuentas en
el BN, el BCR y el BP), así que aquí usa el código ficticio **999**: su cuenta 037 es
`CR12099900000000000037`.

- `leonardo.aguilar` (BCR): ve los botones de **casos de prueba** en Transferir.
- `jandany.moya` (BCR): cuenta 017 con ₡507 847, para probar el **límite diario** (₡200 000).
- `hugo.arauz` (BCR): solo tiene una cuenta en **dólares**.
- `ivan.altamirano` (BN y BCR): su número `8000-0002` está afiliado en el BN.
- **Junta UCR:** `ivan.altamirano` tiene `7000-0002` afiliado a su cuenta 038, así que se le puede
  enviar SINPE Móvil desde cualquier banco. El administrador puede afiliar `6000-0001` (de Leonardo,
  sin afiliar) a la cuenta 037, y con `hugo.arauz` reproducir "cuenta no válida" (039 USD).

</details>

## Manual de usuario

**Iniciar sesión:** elija la **entidad financiera**, escriba el usuario y la contraseña y pulse
**Entrar**. El administrador llega a **Clientes** y el cliente a **Inicio**. El mensaje de error es
siempre el mismo, sin decir qué dato falló; tras 5 intentos fallidos el acceso se bloquea 15
minutos. La sesión se cierra sola tras 15 minutos sin actividad.

<details>
<summary><b>Administrador: Clientes · Cuentas IBAN · Teléfonos · SINPE Móvil · Informes · Respaldos</b></summary>

Todas las listas tienen estadísticas arriba y un buscador.

**Clientes**

- La lista muestra los clientes de la entidad con su usuario y cuántas cuentas y teléfonos tienen.
- **Registrar cliente:** identificación, nombres, apellidos, correo, **usuario** (3 a 50
  caracteres: minúsculas, números, punto o guion bajo) y **contraseña temporal** (mínimo 8
  caracteres). El cliente se crea ACTIVO. El usuario `admin` está reservado.
- Si la persona ya es cliente de **otro banco**, se agrega a este con su misma identificación. Los
  nombres y el correo escritos deben coincidir con los que ya tiene.

**Cuentas IBAN**

- Lista agrupada por titular: la flecha de cada persona despliega sus cuentas, con saldo y estado.
- **Registrar cuenta:** titular, moneda, **IBAN**, saldo inicial y fecha de apertura. **Generar**
  llena el siguiente IBAN libre del banco. La cuenta se crea ACTIVA en el banco de la sesión.
- **Cambiar estado:** ACTIVA, INACTIVA o BLOQUEADA. Una cuenta que no está ACTIVA no envía ni recibe
  transferencias y no se puede afiliar, pero conserva sus afiliaciones. INACTIVA exige saldo cero.

**Teléfonos**

- Lista agrupada por titular, con los números afiliados en este banco o sin afiliar.
- **Registrar teléfono:** titular y número de 8 dígitos. Registrar **no** afilia.
- **Editar:** cambia el titular, salvo que el teléfono esté afiliado.

**SINPE Móvil**

- **Afiliar teléfono:** elija el teléfono y la cuenta. Los selects muestran todos los números y
  cuentas con su estado, para que sea la base de datos la que rechaza las combinaciones inválidas.
- **Cambiar de cuenta:** pasa el número a otra cuenta en una sola transacción; si la nueva no es
  válida, se conserva la original.
- **Desafiliar:** pide confirmación y deja el evento en el historial.

**Informes:** historial de afiliaciones de un teléfono y teléfonos afiliados a una cuenta.

**Respaldos**

- **Respaldo automático programado:** **Diario**, **Semanal** (con el día) o **Mensual** (con el
  día del mes), a la **hora** elegida. **Guardar y activar** lo programa de inmediato y se vuelve a
  activar solo al arrancar el servidor. Un día 31 en un mes más corto se respalda el último día.
- **Respaldar ahora:** crea un respaldo en el momento con `mysqldump`
  (`--single-transaction --routines --triggers --events`).
- **Restaurar:** elija un archivo de la carpeta o suba un `.sql` (de `mysqldump` o Workbench),
  marque la confirmación y presione **Restaurar**. Antes se guarda un respaldo de seguridad; si la
  restauración falla a la mitad, la base vuelve sola a como estaba ("Se revirtió").
- Si la app estaba apagada a la hora de un respaldo automático, al arrancar hace uno de
  recuperación.
- **Archivos de respaldo** (con Descargar) e **Historial** de todas las operaciones.

</details>

<details>
<summary><b>Cliente: Inicio · Mis teléfonos · Transferir · Mis movimientos</b></summary>

**Inicio:** cuentas con saldo, teléfonos y los últimos 5 movimientos.

**Mis teléfonos:** sus números y a qué cuenta están afiliados (u "Otra entidad"). Puede registrar
números propios, **afiliarlos** a una de sus cuentas en colones y ACTIVAS de este banco, y
**desafiliarlos**.

**Transferir** (Datos → Revisión → Comprobante)

1. **Por teléfono (SINPE Móvil):** desde una de sus cuentas en colones a la cuenta afiliada al
   número, en cualquier banco. **Por IBAN:** a una cuenta propia o a una de un tercero
   **matriculada**, de la misma moneda. Si no está matriculada, aparece **Matricular cuenta**; si
   es de otro banco, se pide la identificación del titular.
2. La app muestra el **nombre y banco del destinatario** y, en SINPE Móvil, cuánto le queda del
   límite diario.
3. **Revisar** muestra el resumen y el saldo que quedaría; **Confirmar** la envía una sola vez.
4. El **comprobante** muestra la referencia, el monto, el origen, el destino y los saldos de las
   dos cuentas antes y después.

**Casos de prueba** (solo `leonardo.aguilar` en el BCR): botones que llenan el formulario con los
casos del enunciado.

**Mis movimientos:** filtra por cuenta y período, con el total enviado y recibido.

</details>

<details>
<summary><b>Restaurar la base desde consola (cuando la app no puede entrar)</b></summary>

Si la base `sinpe_movil` se borró o se dañó, la app no deja entrar y el módulo Respaldos no sirve.
Se restaura como `root` en PowerShell, desde la carpeta del proyecto. Los respaldos de la app no
traen `CREATE DATABASE`, así que primero se crea la base vacía:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS sinpe_movil CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
cmd /c "mysql -u root -p --comments --default-character-set=utf8mb4 sinpe_movil < respaldos\<archivo>.sql"
mysql -u root -p -e "USE sinpe_movil; SHOW TABLES; SHOW PROCEDURE STATUS WHERE Db='sinpe_movil';"
```

Luego reinicie la app. No hace falta recrear los usuarios: sus permisos están dados sobre
`sinpe_movil.*` y MySQL los conserva aunque la base se borre. Sin ningún respaldo, cargue de
nuevo `01`, `02` y `03` como en la instalación.

</details>

## Seguridad

- **Contraseñas:** solo se guarda su hash (scrypt con sal al azar) y se compara en tiempo
  constante. Límite de 5 intentos fallidos cada 15 minutos por IP.
- **Sesión:** cookie `httpOnly` y `sameSite=strict`, nueva sesión al entrar, cierre a los 15
  minutos sin actividad.
- **Permisos:** cada ruta exige sesión y rol. Si una petición trae `entityId` o `clientId`, se
  rechaza: esos datos salen siempre de la sesión.
- **Entradas:** el servidor valida cada dato (formatos, largos, fechas reales) y rechaza campos que
  no esperaba. El SQL usa siempre parámetros (`?`).
- **Pantalla:** los datos se insertan como texto (nunca `innerHTML`), con una política de seguridad
  de contenido estricta.
- **Errores:** el usuario nunca ve SQL ni detalles internos.
- **Respaldos:** solo el administrador entra al módulo. `mysqldump` y `mysql` se ejecutan sin
  consola y con lista de argumentos; la contraseña va en un archivo temporal, nunca en la línea de
  comandos. Restaurar se hace con `sinpe_backup`, que solo tiene permisos sobre `sinpe_movil`: si un
  archivo trae un `GRANT` o un `CREATE USER`, MySQL lo rechaza y la base se revierte.

## Scripts

| Comando                 | Qué hace                                                         |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run dev`           | Inicia el servidor con `.env` y lo reinicia al cambiar archivos  |
| `npm test`              | Pruebas automáticas (validadores, roles, contraseñas, respaldos) |
| `npm run lint`          | Revisión de código con ESLint                                    |
| `npm run format`        | Formato con Prettier                                             |
| `npm run hash-password` | Genera el hash de la contraseña del administrador                |

## Limitaciones conocidas

- **Sesiones en memoria:** se pierden al reiniciar el servidor; sirve para una demostración local.
- **Transferencias cruzadas simultáneas:** si A le envía a B y B a A en el mismo instante, MySQL
  puede cancelar una de las dos (no se mueve dinero) y basta con reintentarla.
- **Búsqueda del destinatario:** un cliente puede consultar el nombre y el banco de un número o
  IBAN, como en el servicio real; esa consulta no tiene límite de intentos.
- **Simplificaciones:** la comisión siempre es ₡0 y la contraseña temporal no se obliga a cambiar.
- **Respaldo automático:** solo corre mientras el servidor está encendido, usa la hora del servidor
  y los respaldos no se borran solos.
- **Restaurar no borra lo nuevo:** una tabla o un procedimiento creado después del respaldo sigue
  ahí. Con el esquema fijo de este proyecto no ocurre.

## Créditos

Proyecto académico del curso Bases de Datos II, Universidad de Costa Rica, Sede del Sur (2026).
Los nombres y colores de los bancos se usan solo con fines educativos; los datos son ficticios.
