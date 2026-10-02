// =====================================================================
//  Appv2 - Panel de administracion
//  Solo entra la cuenta limberhuaychoquispe81.
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getDatabase, ref, get, query as rtdbQuery, orderByChild, equalTo,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const CONFIG = {
  apiKey: "AIzaSyBllFnph9kHinDJ693srOg_HCAxt9lS-hc",
  authDomain: "wabusines1-30b95.firebaseapp.com",
  databaseURL: "https://wabusines1-30b95-default-rtdb.firebaseio.com",
  projectId: "wabusines1-30b95",
  storageBucket: "wabusines1-30b95.firebasestorage.app",
  messagingSenderId: "251010975268",
  appId: "1:251010975268:web:6d9a27a504d1369d6bfab1",
  measurementId: "G-ZT03L8X61M"
};

// Correo del unico administrador. Cualquier otro cuenta entra pero
// se le cierra el panel de inmediato.
const ADMIN = "limberhuaychoquispe81";

const app = initializeApp(CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

/** Deja solo digitos, sin signos. */
function soloDigitos(v) {
  return (v || "").replace(/\D/g, "");
}

/** 6 digitos aleatorios con crypto. */
function generarCodigo() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1000000).padStart(6, "0");
}

function fechaBonita(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function aviso(texto, malo = false) {
  const el = document.getElementById("msgLogin");
  el.textContent = texto;
  el.style.color = malo ? "#B91C1C" : "#15803D";
}

// ---------------------------------------------------------------------
// Modo letra grande: 3 tamanos
// ---------------------------------------------------------------------

const TAMANOS = [
  { px: "18px", nombre: "normal" },
  { px: "21px", nombre: "grande" },
  { px: "25px", nombre: "muy grande" }
];
let indiceTamano = 0;

function aplicarTamano() {
  const t = TAMANOS[indiceTamano];
  document.documentElement.style.setProperty("--base", t.px);
  document.getElementById("btnTamano").textContent = "Letra: " + t.nombre;
  localStorage.setItem("appv2_tamano", indiceTamano);
}

document.getElementById("btnTamano").onclick = () => {
  indiceTamano = (indiceTamano + 1) % TAMANOS.length;
  aplicarTamano();
};

// ---------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------

document.getElementById("btnEntrar").onclick = async () => {
  const correo = document.getElementById("correo").value.trim();
  const clave = document.getElementById("clave").value;
  if (!correo || !clave) return aviso("Completa correo y contrasena.", true);

  try {
    const cred = await signInWithEmailAndPassword(auth, correo, clave);
    if (cred.user.email !== ADMIN) {
      await signOut(auth);
      return aviso("Esa cuenta no es administradora.", true);
    }
    aviso("Entrando...");
    abrirPanel(cred.user.email);
  } catch (e) {
    aviso("No se pudo entrar: " + e.message, true);
  }
};

document.getElementById("btnSalir").onclick = () => signOut(auth);

function abrirPanel(correo) {
  document.getElementById("login").classList.add("oculto");
  document.getElementById("panel").classList.remove("oculto");
  document.getElementById("miCorreo").textContent = correo;
  cargarTodo();
}

// Revisa la sesion actual al abrir la pagina.
onAuthStateChanged(auth, user => {
  if (!user) {
    document.getElementById("panel").classList.add("oculto");
    document.getElementById("login").classList.remove("oculto");
  } else if (user.email === ADMIN) {
    abrirPanel(user.email);
  } else {
    signOut(auth);
  }
});
// ---------------------------------------------------------------------
// 1. Generar codigo de verificacion
// ---------------------------------------------------------------------

document.getElementById("btnGenerar").onclick = async () => {
  const numero = soloDigitos(document.getElementById("numero").value);
  const nombre = document.getElementById("nombreNum").value.trim();

  if (numero.length < 8) return mostrar("Numero demasiado corto.", true);

  const codigo = generarCodigo();
  const expira = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  try {
    await setDoc(doc(db, "codigos", numero), {
      numero,
      codigo,
      nombre: nombre || null,
      expira: expira,
      intentos: 0,
      usado: false,
      creado: serverTimestamp()
    });

    await setDoc(doc(db, "numeros", numero), {
      numero,
      nombre: nombre || null,
      existe: true,
      verificado: false,
      creado: serverTimestamp(),
      actualizado: serverTimestamp()
    }, { merge: true });

    mostrar(`
      <div style="background:#DCFCE7;padding:16px;border-radius:10px">
        <strong style="font-size:1.05rem">Codigo generado</strong>
        <div class="codigo" style="margin:10px 0">${codigo}</div>
        <div class="info">
          Numero: +${numero}<br>
          Vence: ${expira.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}<br>
          Se puede usar una sola vez.
        </div>
        <button class="sec" style="margin-top:12px"
          onclick="copiar('${codigo}')">Copiar codigo</button>
      </div>`);
    cargarSolicitudes();
    cargarVerificados();
  } catch (e) {
    mostrar("Error: " + escapeHtml(e.message), true);
  }
};

function mostrar(html, esError = false) {
  const c = document.getElementById("resultado");
  c.innerHTML = esError
    ? `<div style="background:#FEE2E2;color:#991B1B;padding:12px;border-radius:8px">${html}</div>`
    : html;
}

window.copiar = function (texto) {
  navigator.clipboard.writeText(texto);
  alert("Codigo copiado: " + texto);
};

// ---------------------------------------------------------------------
// 2. Solicitudes pendientes
// ---------------------------------------------------------------------

async function cargarSolicitudes() {
  const cont = document.getElementById("tablaSolicitudes");
  try {
    const snap = await getDocs(collection(db, "solicitudes"));
    const filas = [];

    snap.forEach(s => {
      const d = s.data();
      if (d.estado === "atendido") return;
      filas.push(`
        <tr>
          <td>+${escapeHtml(d.numero || "?")}</td>
          <td>${escapeHtml(d.nombre || "-")}</td>
          <td>${escapeHtml(fechaBonita(d.creado))}</td>
          <td><span class="chip pend">pendiente</span></td>
          <td>
            <div class="acciones">
              <button class="sec" onclick="generarPara('${escapeHtml(d.numero || "")}','${escapeHtml(d.nombre || "")}')">Generar</button>
              <button class="peligro" onclick="atender('${s.id}')">Descartar</button>
            </div>
          </td>
        </tr>`);
    });

    cont.innerHTML = filas.length
      ? `<table><thead><tr>
          <th>Numero</th><th>Nombre</th><th>Fecha</th><th>Estado</th><th></th>
         </tr></thead><tbody>${filas.join("")}</tbody></table>`
      : '<div class="vacio">No hay solicitudes pendientes.</div>';
  } catch (e) {
    cont.innerHTML = `<div class="vacio">No se pudieron leer: ${escapeHtml(e.message)}</div>`;
  }
}

window.generarPara = function (numero, nombre) {
  document.getElementById("numero").value = numero;
  document.getElementById("nombreNum").value = nombre;
  document.getElementById("btnGenerar").click();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.atender = async function (id) {
  await setDoc(doc(db, "solicitudes", id), { estado: "atendido" }, { merge: true });
  cargarSolicitudes();
};
// ---------------------------------------------------------------------
// 3. Numeros verificados por la empresa
// ---------------------------------------------------------------------

document.getElementById("btnVerificar").onclick = async () => {
  const numero = soloDigitos(document.getElementById("numVerif").value);
  const nota = document.getElementById("notaVerif").value.trim();
  if (numero.length < 8) return;

  await setDoc(doc(db, "numeros", numero), {
    verificado: true,
    nota: nota || null,
    verificadoPor: ADMIN,
    actualizado: serverTimestamp()
  }, { merge: true });
  cargarVerificados();
};

document.getElementById("btnQuitarVerif").onclick = async () => {
  const numero = soloDigitos(document.getElementById("numVerif").value);
  if (numero.length < 8) return;

  await setDoc(doc(db, "numeros", numero), {
    verificado: false,
    actualizado: serverTimestamp()
  }, { merge: true });
  cargarVerificados();
};

async function cargarVerificados() {
  const cont = document.getElementById("tablaVerificados");
  try {
    const snap = await getDocs(collection(db, "numeros"));
    const filas = [];

    snap.forEach(s => {
      const d = s.data();
      filas.push(`
        <tr>
          <td>+${escapeHtml(d.numero || s.id)}</td>
          <td>${escapeHtml(d.nombre || "-")}</td>
          <td>${d.verificado
            ? '<span class="chip ok">verificado</span>'
            : '<span class="chip no">no verificado</span>'}</td>
          <td>${escapeHtml(d.nota || "-")}</td>
          <td class="acciones">
            <button class="peligro" onclick="borrarNumero('${s.id}')">Borrar</button>
          </td>
        </tr>`);
    });

    cont.innerHTML = filas.length
      ? `<table><thead><tr>
          <th>Numero</th><th>Nombre</th><th>Estado</th><th>Nota</th><th></th>
         </tr></thead><tbody>${filas.join("")}</tbody></table>`
      : '<div class="vacio">Todavia no hay numeros registrados.</div>';
  } catch (e) {
    cont.innerHTML = `<div class="vacio">${escapeHtml(e.message)}</div>`;
  }
}

window.borrarNumero = async function (id) {
  if (!confirm("Borrar el numero +" + id + "?")) return;
  await deleteDoc(doc(db, "numeros", id));
  cargarVerificados();
};
// CONTINUA_ADMIN_JS_2
// ---------------------------------------------------------------------
// 4. Mensajes del puente con vida de 7 dias
// ---------------------------------------------------------------------

const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;
let filtroActual = "pendientes";

// Activa el filtro pulsado.
document.querySelectorAll("[data-filtro]").forEach(b => {
  b.onclick = () => {
    filtroActual = b.dataset.filtro;
    document.querySelectorAll("[data-filtro]").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    cargarMensajes();
  };
});
document.querySelector('[data-filtro="pendientes"]').classList.add("on");

async function cargarMensajes() {
  const cont = document.getElementById("tablaMensajes");
  cont.innerHTML = '<div class="vacio">Cargando...</div>';

  const snap = await getDocs(collection(db, "mensajes"));
  const ahora = Date.now();
  const filas = [];

  snap.forEach(chat => {
    chat.forEach(m => {
      const d = m.val();
      const creado = d.creado?.toMillis?.() ?? d.creado ?? ahora;
      const expira = d.expira?.toMillis?.() ?? d.expira ?? creado + SIETE_DIAS;
      const vencido = ahora > expira;
      const entregado = !!d.leido;

      if (filtroActual === "pendientes" && (entregado || vencido)) return;
      if (filtroActual === "entregados" && !entregado) return;
      if (filtroActual === "vencidos" && !vencido) return;

      const estado = vencido
        ? '<span class="chip no">vencido</span>'
        : (entregado
          ? '<span class="chip ok">entregado</span>'
          : '<span class="chip pend">pendiente</span>');

      const faltan = Math.max(0, Math.ceil((expira - ahora) / 86400000));

      filas.push(`
        <tr>
          <td>${escapeHtml(chat.id)}</td>
          <td style="max-width:260px">${escapeHtml(d.texto || d.urlImagen || "(imagen)")}</td>
          <td>${escapeHtml(d.tipo || "texto")}</td>
          <td>${escapeHtml(fechaBonita(creado))}</td>
          <td>${estado}</td>
          <td>${vencido ? "caducado" : faltan + " dias"}</td>
          <td class="acciones">
            <button class="peligro" onclick="borrarMsg('${chat.id}','${m.key}')">Borrar</button>
          </td>
        </tr>`);
    });
  });

  cont.innerHTML = filas.length
    ? `<table><thead><tr>
        <th>Chat</th><th>Mensaje</th><th>Tipo</th><th>Creado</th>
        <th>Estado</th><th>Vence</th><th></th>
       </tr></thead><tbody>${filas.join("")}</tbody></table>`
    : '<div class="vacio">No hay mensajes en esta categoria.</div>';
}

window.borrarMsg = async function (chatId, msgId) {
  await deleteDoc(doc(db, "mensajes", chatId, msgId));
  cargarMensajes();
};

// ---------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------

function cargarTodo() {
  cargarSolicitudes();
  cargarVerificados();
  cargarMensajes();
}

// Restaura el tamano de letra elegido antes.
indiceTamano = parseInt(localStorage.getItem("appv2_tamano") || "0", 10);
aplicarTamano();