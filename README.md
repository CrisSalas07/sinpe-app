# SINPE JUNTAUCR

Aplicación web para el ejercicio _Prueba corta – SINPE JUNTAUCR_ del curso de Bases de Datos (UCR,
Sede del Sur). Simula clientes, cuentas IBAN, teléfonos, afiliaciones a SINPE Móvil y
transferencias sobre una base de datos MySQL donde **todas las reglas de negocio viven en
procedimientos almacenados y triggers**. La aplicación solo muestra datos y llama a esos
procedimientos.

## Contenido

1. [Funcionamiento general](#1-funcionamiento-general)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [Base de datos](#3-base-de-datos)
4. [Manual de instalación](#4-manual-de-instalación)
5. [Credenciales de prueba](#5-credenciales-de-prueba)
6. [Manual de usuario](#6-manual-de-usuario)
7. [Reglas de negocio](#7-reglas-de-negocio)
8. [Seguridad e integridad de datos](#8-seguridad-e-integridad-de-datos)
9. [Scripts y pruebas](#9-scripts-y-pruebas)
10. [Limitaciones conocidas](#10-limitaciones-conocidas)

---

## 1. Funcionamiento general

- **Una app, varios bancos.** En la vida real cada banco tiene su propia app. Aquí hay una sola,
  con un selector de **entidad financiera** en el inicio de sesión: BCR, BN, BP, BAC o Junta UCR. Todo lo que
  se ve y se hace queda limitado a la entidad elegida.
- **Dos roles:**
  - **Administrador** (personal del banco): registra clientes, cuentas y teléfonos, afilia
    teléfonos a SINPE Móvil y consulta informes. No transfiere dinero.
  - **Cliente**: ve sus cuentas, registra sus teléfonos, transfiere dinero (por SINPE Móvil o por
    IBAN) y consulta sus movimientos. No afilia teléfonos.
- **Una persona, varios bancos.** Una persona es única en el sistema (por su identificación), pero
  puede ser cliente de varias entidades, con un usuario distinto en cada una.
- **La base de datos manda.** Cada escritura pasa por un procedimiento almacenado que valida las
  reglas y usa transacciones. Si algo no se cumple, el procedimiento rechaza la operación con un
  mensaje (`SIGNAL`) y la app lo muestra tal cual en la alerta roja.

## 2. Estructura del proyecto

```
sinpe-app/
├── db/                         Scripts de MySQL (se cargan en orden)
│   ├── 01_esquema_y_datos.sql  Tablas y datos de prueba (borra y recrea la base)
│   ├── 02_triggers.sql         Triggers de validación y de auditoría
│   └── 03_procedimientos.sql   Procedimientos almacenados y el usuario sinpe_app
├── src/                        Servidor (Node.js + Express)
│   ├── server.js               Arranca el servidor HTTP
│   ├── app.js                  Middlewares, rutas y archivos estáticos
│   ├── config/                 Variables de entorno (env.js) y pool de MySQL (db.js)
│   ├── routes/                 Rutas por recurso (solo conectan ruta → controlador)
│   ├── controllers/            Leen la petición, validan y responden
│   ├── services/               Casos de uso (por ejemplo: transferir = CALL + leer comprobante)
│   ├── repositories/           Único lugar con SQL (SELECT y CALL sp_*)
│   ├── validators/             Validación de entradas (formatos, largos, campos permitidos)
│   ├── middlewares/            Sesión, roles, límite de intentos de login, manejo de errores
│   └── utils/                  Errores, hash de contraseñas, nombres, mysqldump/mysql
├── public/                     Frontend (HTML + CSS + JavaScript, sin framework)
│   ├── index.html              Inicio de sesión
│   ├── clients.html, accounts.html, phones.html, sinpe.html, reports.html, backups.html   Administrador
│   ├── home.html, my-phones.html, transfers.html, movements.html            Cliente
│   ├── css/                    tokens.css (colores del diseño) y app.css
│   └── js/                     Un archivo por página + api.js, dom.js, format.js, layout.js
├── scripts/hash-password.js    Genera el hash de la contraseña del administrador
├── test/                       Pruebas automáticas (node:test)
├── disenio/                    Capturas del prototipo de Figma (referencia)
└── .env.example                Plantilla de configuración
```

**Capas del servidor:** cada capa solo llama a la de abajo.

```
Petición HTTP → routes → controllers → services → repositories → MySQL (procedimientos y triggers)
```

**Tecnologías:** MySQL 8, Node.js 24, Express 5, `mysql2`, `express-session`, `helmet`,
`express-rate-limit`. El frontend es HTML, CSS y JavaScript sin frameworks.

## 3. Base de datos

Esquema `sinpe_movil`.

| Tabla                  | Qué guarda                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `cliente`              | Personas (únicas por identificación y por correo), estado ACTIVO / INACTIVO        |
| `entidad_financiera`   | Bancos: código (BCR…), código IBAN (152…), límite diario de SINPE Móvil            |
| `cliente_entidad`      | Una persona como cliente de un banco, con su usuario y el hash de su contraseña    |
| `moneda`               | Catálogo: CRC y USD                                                                |
| `cuenta_iban`          | Cuentas: cliente, banco, moneda, IBAN, saldo, estado (ACTIVA, INACTIVA, BLOQUEADA) |
| `telefono_cliente`     | Teléfonos: 8 dígitos, únicos en todo el sistema, un solo dueño                     |
| `afiliacion_sinpe`     | Afiliación vigente de un teléfono a una cuenta (máximo una por teléfono)           |
| `historial_afiliacion` | Eventos AFILIACION / DESAFILIACION (los escriben los triggers)                     |
| `transferencia`        | Movimientos: origen, destino, monto, tipo (SINPE_MOVIL / IBAN), fecha, detalle     |
| `transferencia_sinpe`  | Para SINPE Móvil: teléfono de origen (si tiene) y teléfono de destino              |

**Triggers (`02`):** validan la afiliación (cuenta ACTIVA, en colones y del mismo dueño), validan
las transferencias (monto positivo, cuentas distintas), impiden cambiar el dueño de un teléfono
afiliado, impiden registrar teléfonos a clientes inactivos y escriben el historial de afiliaciones.

**Procedimientos (`03`):**

| Procedimiento                 | Uso                                                                   |
| ----------------------------- | --------------------------------------------------------------------- |
| `sp_registrar_cliente`        | Registrar un cliente en una entidad, con usuario y contraseña         |
| `sp_registrar_cuenta`         | Abrir una cuenta IBAN (el IBAN debe ser del banco de la sesión)       |
| `sp_cambiar_estado_cuenta`    | Cambiar el estado de una cuenta (ACTIVA, INACTIVA, BLOQUEADA)         |
| `sp_registrar_telefono`       | Registrar un teléfono a un cliente de la entidad                      |
| `sp_cambiar_titular_telefono` | Cambiar el dueño de un teléfono (no si está afiliado)                 |
| `sp_afiliar_sinpe`            | Afiliar un teléfono a una cuenta                                      |
| `sp_desafiliar_sinpe`         | Quitar la afiliación (solo el banco que la tiene)                     |
| `sp_cambiar_cuenta_sinpe`     | Pasar la afiliación a otra cuenta (si falla, se conserva la original) |
| `sp_transferir_sinpe`         | Transferir de una cuenta propia a un número de teléfono               |
| `sp_transferir_iban`          | Transferir de una cuenta propia a una cuenta IBAN                     |
| `sp_consultar_movimientos`    | Movimientos y totales de una cuenta en un período                     |

**Usuario de la aplicación:** la app se conecta como `sinpe_app`, que solo tiene permisos `SELECT`
y `EXECUTE`. No puede hacer `INSERT`, `UPDATE` ni `DELETE`: toda escritura pasa obligatoriamente
por un procedimiento.

## 4. Manual de instalación

### Requisitos

- **MySQL 8** (con acceso como `root`)
- **Node.js 24** y **npm 11**

### Pasos

1. **Descargar el proyecto** y abrir una terminal en su carpeta.

2. **Crear la base de datos** como `root`, cargando los tres scripts **en orden y por separado**:

   ```sh
   mysql -u root -p --default-character-set=utf8mb4 < db/01_esquema_y_datos.sql
   mysql -u root -p --default-character-set=utf8mb4 < db/02_triggers.sql
   mysql -u root -p --default-character-set=utf8mb4 < db/03_procedimientos.sql
   ```

   - En **PowerShell** el símbolo `<` no funciona; use `cmd /c` en cada línea, por ejemplo:
     `cmd /c "mysql -u root -p --default-character-set=utf8mb4 < db\01_esquema_y_datos.sql"`.
   - `--default-character-set=utf8mb4` hace que las tildes de los mensajes se guarden bien.
   - No los encadene con `-e "source a; source b"`: por el `DELIMITER`, los procedimientos no se
     instalan.
   - `01` **borra y recrea la base**. Para volver a los datos de prueba, cargue de nuevo `01`, `02` y
     `03`. El usuario `sinpe_app` y su contraseña se conservan.

3. **Cambiar la contraseña de ejemplo** del usuario `sinpe_app` (viene en `03_procedimientos.sql`):

   ```sql
   ALTER USER 'sinpe_app'@'localhost' IDENTIFIED BY '<su contraseña>';
   ```

4. **Crear el archivo `.env`** a partir de la plantilla y completar cada valor:

   ```sh
   cp .env.example .env
   ```

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
   | `BACKUP_DB_USER`     | `root` (módulo Respaldos; vacío lo desactiva)         |
   | `BACKUP_DB_PASSWORD` | Contraseña de ese usuario de MySQL                    |
   | `MYSQL_BIN_DIR`      | `C:\Program Files\MySQL\MySQL Server 8.0\bin`       |
   | `BACKUP_DIR`         | `respaldos`                                           |

   Para generar `SESSION_SECRET`:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

5. **Instalar las dependencias:** `npm install`

6. **Definir la contraseña del administrador:** ejecute `npm run hash-password`, escriba la
   contraseña (para la demostración: `Juntaucr2026`) y pegue la línea `APP_PASSWORD_HASH=...` que
   imprime en el `.env`. Cada variable debe aparecer una sola vez.

7. **Iniciar:** `npm run dev` y abrir <http://localhost:3000>.

Si falta alguna variable, la app no arranca y dice cuál falta.

## 5. Credenciales de prueba

| Rol           | Entidad                   | Usuario            | Contraseña     |
| ------------- | ------------------------- | ------------------ | -------------- |
| Administrador | Cualquiera (la que elija) | `admin`            | `Juntaucr2026` |
| Cliente       | Donde tenga cuenta        | Ver la lista abajo | `Cliente2026`  |

El usuario de un cliente es **primer nombre + punto + primer apellido**, en minúsculas y sin
tildes. Solo puede entrar en las entidades donde tiene cuenta:

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

**Usuarios útiles para la demostración:**

- `leonardo.aguilar` (BCR): ve los botones de **casos de prueba** en Transferir.
- `jandany.moya` (BCR): cuenta 017 con ₡507 847, para probar el **límite diario** (₡200 000).
- `hugo.arauz` (BCR): solo tiene una cuenta en **dólares**.
- `ivan.altamirano` (BN y BCR): su número `8000-0002` está afiliado en el BN.
- **Junta UCR:** `ivan.altamirano` tiene `7000-0002` afiliado a su cuenta 038, así que se le puede
  enviar SINPE Móvil desde cualquier banco. El administrador puede afiliar `6000-0001` (de Leonardo,
  sin afiliar) a la cuenta 037, y con `hugo.arauz` reproducir "cuenta no válida" (039 USD).

## 6. Manual de usuario

### Iniciar sesión

1. Elija la **entidad financiera**, escriba el **usuario** y la **contraseña** y pulse **Entrar**.
2. El administrador llega a **Clientes** y el cliente a **Inicio**.
3. Si algo está mal, el mensaje es siempre el mismo ("Usuario o contraseña incorrectos para la
   entidad seleccionada"), sin decir qué dato falló. Después de 5 intentos fallidos, el acceso se
   bloquea 15 minutos.
4. La sesión se cierra sola tras **15 minutos sin actividad**, o con **Cerrar sesión**.

El encabezado muestra siempre la entidad, el rol y el usuario.

### Administrador

Menú: **Clientes · Cuentas IBAN · Teléfonos · SINPE Móvil · Informes · Respaldos**. Todas las listas tienen
estadísticas arriba y un buscador.

**Clientes**

- La lista muestra los clientes de la entidad con su usuario y cuántas cuentas y teléfonos tienen.
- **Registrar cliente:** identificación, nombres, apellidos, correo, **usuario** (3 a 50
  caracteres: minúsculas, números, punto o guion bajo) y **contraseña temporal** (mínimo 8
  caracteres). El cliente se crea ACTIVO. El usuario `admin` está reservado.
- Si la persona ya es cliente de **otro banco**, se agrega a este con su misma identificación. Los
  nombres y el correo escritos deben coincidir con los que ya tiene; si no, se rechaza con "Los
  datos no coinciden con la persona registrada con esa identificación".

**Cuentas IBAN**

- Lista agrupada por titular: pulse la flecha de una persona para ver sus cuentas, con saldo y
  estado.
- **Registrar cuenta:** titular (clientes activos), moneda, **IBAN**, saldo inicial y fecha de
  apertura. El botón **Generar** llena el siguiente IBAN libre del banco; también se puede escribir
  a mano. La entidad no se elige: es la de la sesión. La cuenta se crea ACTIVA.
- **Cambiar estado** (en cada cuenta, al desplegar al titular): ACTIVA, INACTIVA o BLOQUEADA. Una
  cuenta que no está ACTIVA **no envía ni recibe** transferencias y no se puede afiliar, pero sus
  afiliaciones a SINPE Móvil **se conservan** (los envíos a ese número fallan hasta reactivarla).
  Para pasar a INACTIVA el saldo debe ser cero; BLOQUEADA no lo exige.

**Teléfonos**

- Lista agrupada por titular: la flecha despliega sus números, si están afiliados y a qué cuenta
  (IBAN completo). Solo aparecen los teléfonos afiliados en este banco o sin afiliar.
- **Registrar teléfono:** titular y número de 8 dígitos. Registrar **no** afilia. Si el número ya
  es de ese cliente o de otra persona, se rechaza.
- **Editar** (en cada número): cambia el titular. No se permite si el teléfono está afiliado ("No
  se puede cambiar el titular de un teléfono afiliado"): primero hay que desafiliarlo.

**SINPE Móvil**

- Lista agrupada por titular de las afiliaciones de este banco, con las acciones de cada número.
- **Afiliar teléfono:** elija el teléfono y la cuenta. Los selects muestran todos los números y
  cuentas del banco con su estado, para que la base de datos sea la que rechaza las combinaciones
  inválidas: cuenta de otra persona, cuenta en dólares o bloqueada, número ya afiliado aquí ("Use
  Cambiar cuenta") o en otro banco ("Debe desafiliarse allá primero").
- **Cambiar de cuenta:** pasa el número a otra cuenta en una sola transacción; si la nueva no es
  válida, se conserva la afiliación original.
- **Desafiliar:** pide confirmación y deja el evento DESAFILIACION en el historial.

**Informes**

- **Afiliaciones de un teléfono:** historial de AFILIACION y DESAFILIACION en cuentas de este banco.
- **Teléfonos asociados a una cuenta:** números afiliados hoy a una cuenta.

**Respaldos** (Laboratorio Copia de Seguridad, ejercicio 3)

- **Respaldo automático programado:** elija la frecuencia (**Diario**, **Semanal** con el día de
  la semana o **Mensual** con el día del mes) y la **hora**. Al presionar **Guardar y activar** el
  respaldo queda programado de inmediato y el panel muestra la fecha del próximo. La programación
  se guarda y se vuelve a activar sola cuando el servidor arranca. En un mes con menos días (por
  ejemplo, día 31 en febrero) se respalda el último día del mes.
- **Respaldar ahora:** crea un respaldo en el momento.
- Cada respaldo ejecuta `mysqldump` con las mismas opciones del ejercicio 2
  (`--single-transaction --no-tablespaces --routines --triggers --events --set-gtid-purged=OFF`):
  estructura, datos, procedimientos, triggers y eventos.
- **Restaurar:** elija un archivo de la carpeta de respaldos o suba un `.sql` de su computadora
  (de `mysqldump` o de Workbench), marque la confirmación y presione **Restaurar**. Antes de
  restaurar se guarda un respaldo de seguridad de los datos actuales. Se rechaza un archivo que no
  sea un respaldo de MySQL o que tenga un `USE` o un `CREATE/DROP DATABASE` de otra base.
- **Archivos de respaldo** (con botón Descargar) e **Historial** de respaldos, restauraciones y
  cambios de programación, con su resultado.
- Requiere en el `.env`: `BACKUP_DB_USER` y `BACKUP_DB_PASSWORD` (por ejemplo `root`: el usuario
  `sinpe_app` no tiene permisos para respaldar ni restaurar), `MYSQL_BIN_DIR` (carpeta de
  `mysqldump.exe`) y `BACKUP_DIR` (carpeta de los respaldos, por defecto `respaldos/`).

### Cliente

Menú: **Inicio · Mis teléfonos · Transferir · Mis movimientos**.

**Inicio:** saludo, cantidad de cuentas, teléfonos y teléfonos afiliados; tarjetas de las cuentas
con saldo; los últimos 5 movimientos. Botones para Transferir, Registrar teléfono y Ver todos.

**Mis teléfonos:** sus números, si están afiliados y a qué cuenta (u "Otra entidad (BN)" si están
afiliados en otro banco). **Registrar teléfono** agrega un número propio; no lo afilia (eso lo hace
el banco).

**Transferir** (tres pasos: Datos → Revisión → Comprobante)

1. Elija la pestaña:
   - **Por teléfono (SINPE Móvil):** el dinero sale de **una de sus cuentas en colones** y llega a
     la cuenta que el destinatario tiene afiliada a su número, en cualquier banco.
   - **Por IBAN:** de una de sus cuentas a cualquier cuenta IBAN de la misma moneda. Si la cuenta
     de destino es de **otro banco**, aparece **Identificación del destinatario** y debe coincidir
     con el titular.
2. Al completar el número o el IBAN, la app muestra el **nombre y banco del destinatario**.
3. Escriba el **monto** (hasta 2 decimales) y, si quiere, un **detalle**. En SINPE Móvil se ve
   cuánto le queda disponible hoy de su límite diario.
4. **Revisar transferencia** muestra el resumen y el saldo que le quedaría. **Confirmar
   transferencia** la envía; los botones se bloquean mientras se procesa, así que no se envía dos
   veces.
5. El **comprobante** muestra el número de referencia (fecha + código del banco + consecutivo), el
   monto, el origen, el destino, la comisión (siempre ₡0) y los saldos de las dos cuentas antes y
   después, con el total de ambas, que se conserva (informe 6 del enunciado).
6. Si la base de datos rechaza la transferencia, la app vuelve a Datos con el mensaje y el campo en
   rojo.

**Casos de prueba** (solo para `leonardo.aguilar` en el BCR): botones que llenan el formulario con
los casos del enunciado: misma cuenta, permitida, otra moneda y saldo insuficiente.

**Mis movimientos:** elija la cuenta y el período (por defecto, el mes actual). La tabla muestra
fecha, tipo (Enviada / Recibida), contraparte y monto, con el total enviado y recibido del período.
Se actualiza al cambiar cualquier filtro.

## 7. Reglas de negocio

**Teléfonos y afiliación (SINPE Móvil)**

| Regla                                                                                       | Dónde                                            |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Un número tiene 8 dígitos, es único en el sistema y tiene un solo dueño                     | `UNIQUE` + `CHECK` + `sp_registrar_telefono`     |
| Registrar un teléfono no lo afilia                                                          | `sp_registrar_telefono`                          |
| Se afilia a una cuenta del mismo dueño, ACTIVA y en colones, del banco de la sesión         | `sp_afiliar_sinpe`, `trg_validar_afiliacion`     |
| Un número está afiliado a una sola cuenta en todo el sistema; una cuenta puede tener varios | `UNIQUE(id_telefono)`                            |
| Si está afiliado en otro banco, debe desafiliarse allá primero                              | `sp_afiliar_sinpe`                               |
| Solo el banco que tiene la afiliación puede quitarla o cambiarla                            | `sp_desafiliar_sinpe`, `sp_cambiar_cuenta_sinpe` |
| No se cambia el dueño de un teléfono afiliado                                               | `trg_telefono_validar_update`                    |
| Cada afiliación y desafiliación queda en el historial                                       | Triggers de auditoría                            |

**Transferencias**

| Regla                                                                                         | Dónde                                         |
| --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| La cuenta de origen es del cliente y del banco de la sesión, y está ACTIVA                    | `sp_transferir_sinpe`, `sp_transferir_iban`   |
| SINPE Móvil: solo en colones; el número de destino debe estar registrado y afiliado           | `sp_transferir_sinpe`                         |
| SINPE Móvil: límite diario por cuenta (₡200 000 en los datos de prueba)                       | `entidad_financiera.limite_diario_sinpe`      |
| IBAN: el destino existe, está ACTIVO y es de la misma moneda                                  | `sp_transferir_iban`                          |
| IBAN entre bancos distintos: la identificación del destinatario debe ser la del titular       | `sp_transferir_iban`                          |
| No a la misma cuenta, monto mayor que cero, saldo suficiente                                  | Procedimientos + `trg_transferencia_validar`  |
| Débito, crédito y registro en una sola transacción, con las cuentas bloqueadas (`FOR UPDATE`) | `sp_transferir_*`                             |
| Una cuenta INACTIVA o BLOQUEADA no envía ni recibe; INACTIVA exige saldo cero                 | `sp_cambiar_estado_cuenta`, `sp_transferir_*` |

Orden de validación de SINPE Móvil: origen del cliente → origen ACTIVO y en colones → número
registrado y afiliado → destino ACTIVO → cuentas distintas → monto positivo → límite diario →
saldo.

## 8. Seguridad e integridad de datos

- **Contraseñas:** solo se guarda su hash (scrypt con sal al azar) y se compara en tiempo
  constante. El mensaje de error de login es siempre el mismo y hay un límite de 5 intentos
  fallidos cada 15 minutos por IP.
- **Sesión:** cookie `httpOnly` y `sameSite=strict`, nueva sesión al entrar, cierre a los 15
  minutos sin actividad.
- **Permisos:** cada ruta exige sesión y rol. La entidad y el cliente salen **siempre de la
  sesión**; si una petición trae `entityId` o `clientId`, se rechaza.
- **Entradas:** el servidor valida cada dato (formatos, largos, fechas reales) y rechaza campos que
  no esperaba. El SQL usa siempre parámetros (`?`), nunca texto armado.
- **Pantalla:** los datos se insertan como texto (nunca `innerHTML`); política de seguridad de
  contenido estricta con `helmet`.
- **Errores:** el usuario nunca ve SQL ni detalles internos; los mensajes de los procedimientos se
  muestran tal cual.
- **Dinero:** nunca se usa como número decimal de JavaScript: viaja como texto y los cálculos de
  pantalla usan céntimos enteros.
- **Mínimo privilegio:** el usuario `sinpe_app` no puede escribir directamente en las tablas.
- **Respaldos:** solo el administrador entra al módulo. `mysqldump` y `mysql` se ejecutan sin
  consola y con lista de argumentos; la contraseña va en un archivo temporal, nunca en la línea
  de comandos. Los nombres de archivo no pueden salir de la carpeta de respaldos.

## 9. Scripts y pruebas

| Comando                 | Qué hace                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`           | Inicia el servidor con `.env` y lo reinicia al cambiar archivos                    |
| `npm test`              | Pruebas automáticas de `test/` (validadores, formato, roles, contraseñas, errores) |
| `npm run lint`          | Revisión de código con ESLint                                                      |
| `npm run format`        | Formato con Prettier                                                               |
| `npm run hash-password` | Genera el hash de la contraseña del administrador                                  |

## 10. Limitaciones conocidas

- **Sesiones en memoria:** se pierden al reiniciar el servidor. Sirve para esta demostración local.
- **Transferencias cruzadas simultáneas:** si A le envía a B y B a A en el mismo instante, MySQL
  puede cancelar una de las dos (no se mueve dinero) y basta con reintentarla.
- **Credenciales visibles en el login:** la pista de usuarios de prueba está a propósito para la
  demostración; debe quitarse antes de usar la app en otro lugar.
- **Búsqueda del destinatario:** un cliente puede consultar el nombre y el banco de un número o
  IBAN, como en el servicio real; esa consulta no tiene límite de intentos.
- **Sin comisión:** la comisión se muestra siempre en ₡0 (simplificación del prototipo).
- **Contraseña temporal:** no se obliga a cambiarla en el primer ingreso.
- **Respaldo automático:** solo corre mientras el servidor está encendido; si estaba apagado a la
  hora programada, ese respaldo no se recupera. La hora es la del servidor. Los respaldos no se
  borran solos.
