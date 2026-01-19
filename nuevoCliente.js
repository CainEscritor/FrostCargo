import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// --- Referencias UI ---
const formAgregar = document.getElementById("form-cliente");
const btnAgregar = document.getElementById("btn-agregar");
const mensajeAgregarDiv = document.getElementById("mensaje");
const cuitInput = document.getElementById("cuit");
const nombreInput = document.getElementById("nombre");
const direccionInput = document.getElementById("direccion");
const localInput = document.getElementById("local");
const localidadInput = document.getElementById("localidad");
const telefonoInput = document.getElementById("telefono");

const formHistorial = document.getElementById("form-historial");
const nombreClienteInput = document.getElementById("nombre-cliente-historial");
const btnBuscar = document.getElementById("btn-buscar-historial");
const filtroMesSelect = document.getElementById("filtro-mes");
const historialResultadoDiv = document.getElementById("historial-resultado");
const mensajeHistorialDiv = document.getElementById("mensaje-historial");

// Estado de la aplicación
let clientesParaAutocompletar = [];
let historialMemoria = {};

/* ===================== NAVEGACIÓN Y CARGA INICIAL ===================== */

// Optimización: Cargar clientes solo una vez y guardarlos en memoria
async function cargarListaClientes() {
  try {
    const snap = await getDocs(collection(db, "Clientes"));
    clientesParaAutocompletar = snap.docs
      .map((d) => d.data().Nombre)
      .filter((n) => n)
      .sort();
  } catch (e) {
    console.error("Error al cargar lista de clientes:", e);
  }
}

// Botón Modificar con manejo de errores robusto
const btnModificar =
  document.getElementById("btn-modificar") ||
  Array.from(document.querySelectorAll("button")).find((b) =>
    /modificar/i.test(b.textContent)
  );

if (btnModificar) {
  btnModificar.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "modificaCliente.html";
  });
}

/* ===================== AUTOCOMPLETADO OPTIMIZADO ===================== */

nombreClienteInput.addEventListener("input", () => {
  const valor = nombreClienteInput.value.trim().toLowerCase();

  // Limpiar lista anterior
  const listaExistente = document.getElementById("sugerencias-lista-historial");
  if (listaExistente) listaExistente.remove();

  if (!valor) return;

  const sugerencias = clientesParaAutocompletar
    .filter((c) => c.toLowerCase().includes(valor))
    .slice(0, 5);

  if (sugerencias.length === 0) return;

  const lista = document.createElement("ul");
  lista.id = "sugerencias-lista-historial";
  lista.className = "sugerencias-lista";

  sugerencias.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    li.onclick = () => {
      nombreClienteInput.value = s;
      lista.remove();
    };
    lista.appendChild(li);
  });

  nombreClienteInput.parentNode.appendChild(lista);
});

// Cerrar sugerencias al hacer clic fuera
document.addEventListener("click", (e) => {
  if (!nombreClienteInput.contains(e.target)) {
    const lista = document.getElementById("sugerencias-lista-historial");
    if (lista) lista.remove();
  }
});

/* ===================== AGREGAR CLIENTE (FORMATEO Y ENVÍO) ===================== */

// Formateo automático de CUIT (00-00000000-0)
cuitInput.addEventListener("input", (e) => {
  let val = e.target.value.replace(/\D/g, "").substring(0, 11);
  let formatted = val;
  if (val.length > 2) formatted = val.substring(0, 2) + "-" + val.substring(2);
  if (val.length > 10)
    formatted = formatted.substring(0, 11) + "-" + val.substring(10, 11);
  e.target.value = formatted;
});

formAgregar.addEventListener("submit", async (e) => {
  e.preventDefault();

  const datos = {
    Nombre: nombreInput.value.trim(),
    Direccion: direccionInput.value.trim(),
    CUIT: cuitInput.value.trim(),
    Local: localInput.value.trim(),
    Localidad: localidadInput.value.trim(),
    Telefono: telefonoInput.value.trim(),
  };

  // Validación rápida
  if (Object.values(datos).some((x) => !x)) {
    mensajeAgregarDiv.textContent = "❌ Todos los campos son obligatorios";
    mensajeAgregarDiv.style.color = "red";
    return;
  }

  btnAgregar.disabled = true;
  btnAgregar.innerHTML = "Guardando...";

  try {
    // En Blaze, setDoc con merge es eficiente para crear/actualizar
    await setDoc(doc(db, "Clientes", datos.Nombre), datos, { merge: true });

    mensajeAgregarDiv.textContent = `✅ Cliente '${datos.Nombre}' guardado`;
    mensajeAgregarDiv.style.color = "green";
    formAgregar.reset();
    cargarListaClientes(); // Actualizar memoria para el buscador
  } catch (error) {
    mensajeAgregarDiv.textContent = "Error: " + error.message;
    console.error(error);
  } finally {
    btnAgregar.disabled = false;
    btnAgregar.textContent = "Agregar Cliente";
  }
});

/* ===================== HISTORIAL (FILTRADO EN MEMORIA) ===================== */

async function buscarHistorial() {
  const nombre = nombreClienteInput.value.trim();
  if (!nombre) return;

  btnBuscar.disabled = true;
  btnBuscar.textContent = "Buscando...";
  historialResultadoDiv.innerHTML = "";

  try {
    const snap = await getDoc(doc(db, "Clientes", nombre));

    if (!snap.exists()) {
      mensajeHistorialDiv.textContent = "Cliente no encontrado 🔍";
      return;
    }

    const data = snap.data();
    historialMemoria = data.historial || {};

    if (Object.keys(historialMemoria).length === 0) {
      historialResultadoDiv.innerHTML = "<p>Sin pedidos registrados.</p>";
      filtroMesSelect.disabled = true;
      return;
    }

    // Llenar selector de meses
    filtroMesSelect.innerHTML =
      '<option value="todos">Todos los meses (Total acumulado)</option>';
    const meses = Object.keys(historialMemoria).sort().reverse();
    meses.forEach((mes) => {
      const [y, m] = mes.split("-");
      const opt = document.createElement("option");
      opt.value = mes;
      opt.textContent = new Date(y, m - 1).toLocaleString("es-AR", {
        month: "long",
        year: "numeric",
      });
      filtroMesSelect.appendChild(opt);
    });

    filtroMesSelect.disabled = false;
    mostrarDatosFiltrados("todos");
  } catch (e) {
    console.error(e);
    mensajeHistorialDiv.textContent = "Error al cargar historial";
  } finally {
    btnBuscar.disabled = false;
    btnBuscar.textContent = "Buscar Historial";
  }
}

function mostrarDatosFiltrados(mes) {
  let acumulado = {};

  if (mes === "todos") {
    // Sumar todos los productos de todos los meses
    Object.values(historialMemoria).forEach((productos) => {
      for (const [prod, cant] of Object.entries(productos)) {
        acumulado[prod] = (acumulado[prod] || 0) + cant;
      }
    });
  } else {
    acumulado = historialMemoria[mes] || {};
  }

  renderizarHTMLHistorial(acumulado);
}

function renderizarHTMLHistorial(datos) {
  const entradas = Object.entries(datos);
  if (entradas.length === 0) {
    historialResultadoDiv.innerHTML = "<p>No hay datos.</p>";
    return;
  }

  const html = entradas
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([p, c]) => `
      <div class="historial-item">
        <strong>${p}:</strong> <span>${c}</span>
      </div>
    `
    )
    .join("");

  historialResultadoDiv.innerHTML = `<div class="historial-lista">${html}</div>`;
}

// Eventos de Historial
formHistorial.onsubmit = (e) => {
  e.preventDefault();
  buscarHistorial();
};
filtroMesSelect.onchange = (e) => mostrarDatosFiltrados(e.target.value);

// Iniciar
cargarListaClientes();
