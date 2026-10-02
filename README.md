# Imagen.limber

Panel de administración y reglas de Firebase para **Appv2**.

---
---

# Appv2 — App de mensajería con Firebase

Proyecto de clase. App Android (Kotlin + Compose) + panel web de administración.

- **App Android:** `D:\App Android studio\2026\Appv2`
- **Panel web:** esta carpeta (`index.html` + `admin.js`)
- **Proyecto Firebase:** `wabusines1-30b95`

---

## Qué hace

1. **Registro e inicio de sesión por número de teléfono**, con un código
   de 6 dígitos.
2. Si el número **no tiene cuenta**, la app lo dice antes de dejar pasar.
3. **Mensajería real** número a número usando Firebase como puente.
4. Los mensajes se **borran de Firebase a los 7 días** y quedan guardados
   solo en el teléfono de cada quien.
5. **Imágenes** por medio de Cloud Storage.
6. **Modo letra grande** en los ajustes.
7. **Panel web** donde solo entra `limberhuaychoquispe81` para generar los
   códigos de verificación y decidir qué números están autorizados por la
   empresa.

---

## ⚠️ Avisos importantes antes de usar esto

### 1. Firebase está en modo prueba

Con las reglas abiertas (`allow read, write: if true`) **cualquier persona
con el link puede leer los códigos de verificación de todos los usuarios**.
Eso incluye a alguien que solo abra las herramientas del navegador.

Los archivos de reglas de esta carpeta ya traen las reglas correctas para
cerrar esto. Solo tienes que publicarlas:

```bash
firebase deploy --only firestore:rules,database,storage
```

### 2. Los códigos se guardan en texto plano

El panel necesita **mostrar** el código para que tú lo copies y lo envíes
por correo o WhatsApp. Eso obliga a que el código esté guardado tal cual.

Es aceptable para un proyecto de clase, pero **no subas esto a producción**:
en una app real el código nunca debe salir de tu servidor. Lo correcto es
Firebase Authentication con SMS, que ya hace eso y además es gratis para
probar.

### 3. Los SMS cuestan dinero

La verificación por SMS de Firebase **solo funciona en el plan Blaze (de
pago)**. En el plan gratuito no está disponible. Por eso este proyecto
manda el código a mano desde el panel: así no se gasta nada.

---

## Modelo de datos

### Firestore

| Ruta | Qué guarda |
|---|---|
| `numeros/{numero}` | Si el número existe, y si la empresa lo verificó |
| `codigos/{numero}` | El código de 6 dígitos, con vencimiento y usos |
| `solicitudes/{id}` | Peticiones de código que llegan desde la app |
| `usuarios/{uid}` | Perfil de cada persona |
| `mensajes/{chatId}/mensaje/{id}` | Mensajes del puente, con `expira` a 7 días |

### Realtime Database

| Ruta | Qué guarda |
|---|---|
| `usuarios/{uid}` | Número, nombre, foto, `verificadoPorEmpresa` |
| `estadoChats/{chatId}/{uid}` | Si está en línea y si está escribiendo |
| `mensajes/{chatId}/{mensajeId}` | Copia del puente con fecha de expiración |

---

## El flujo completo

**Registro**
1. La persona escribe su número.
2. La app mira `numeros/{numero}`.
   - Si no existe → *"Ese número no tiene cuenta"*.
   - Si existe → pide el código.
3. Crea un documento en `solicitudes` para avisarte.
4. Tú entras al panel, generas el código y se lo envías por correo o WhatsApp.
5. La persona lo escribe y queda verificada.

**Verificación de la empresa**
1. En el panel, sección 3, escribes el número y pulsas **Marcar verificado**.
2. Se guarda en `numeros/{numero}` con `verificado: true`.
3. La app muestra el distintivo verde de cuenta verificada.

**Mensajería**
1. Quien envía escribe en Firebase.
2. El mensaje lleva `expira` = ahora + 7 días.
3. Cuando el receptor lo lee, se borra de Firebase.
4. Cada quien lo guarda en su propio teléfono.

---

## Puesta en marcha

### Firebase

```bash
npm install -g firebase-tools
firebase login
firebase use wabusines1-30b95
firebase deploy --only firestore:rules,database,storage
```

### Crear la cuenta de administrador

No hace falta crear ninguna cuenta a mano.

1. En la consola de Firebase → **Authentication → Sign-in method**,
   activa el proveedor **Google**. Eso es todo.
2. Abre el panel y pulsa **Entrar con Google**.
3. Solo el correo **`limberhuaychoquispe81`** deja pasar. Cualquier otra
   cuenta entra en Firebase pero el panel se le cierra al instante
   mostrándole un aviso.

No se usa correo con contraseña en ningún momento, así que no hace falta
activar ese proveedor ni inventar una contraseña.

> Las reglas de Firebase siguen funcionando igual: al entrar con Google,
> el token ya trae el correo, así que
> `request.auth.token.email == 'limberhuaychoquispe81'` continúa
> protegiendo los datos. No hay que cambiar ningún archivo de reglas.

### Publicar el panel

```bash
firebase deploy --only hosting
```

O bien súbelo a GitHub Pages desde la rama `main`.

### La app Android

Abre `D:\App Android studio\2026\Appv2` en Android Studio y dale **Run**.
El `google-services.json` ya está dentro de la carpeta `app/`.

---

## Estructura del panel web

```
index.html          Estructura y estilos del panel
admin.js            Lógica: login, códigos, verificación, mensajes
firestore.rules     Reglas de Firestore
database.rules.json Reglas de Realtime Database
storage.rules       Reglas de Cloud Storage
```