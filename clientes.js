import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  limit,
  startAfter,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// --- DOM ---
const tbody = document.querySelector("#tabla-clientes tbody");
const refrescarBtn = document.getElementById("refrescar-btn");
const contenedorPanel = document.getElementById("contenedor-clientes");

// Crear el botón "Ver más" dinámicamente para no tocar el HTML
const verMasBtn = document.createElement("button");
verMasBtn.id = "ver-mas-btn";
verMasBtn.textContent = "Cargar más clientes";
verMasBtn.style.cssText =
  "display:none; margin: 20px auto; padding: 10px 20px; background: #2196f3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;";
// Insertarlo antes del botón de volver
document.querySelector(".btn-volver-container").before(verMasBtn);

const inputsFiltro = {
  nombre: document.getElementById("filtro-nombre"),
  local: document.getElementById("filtro-local"),
  cuit: document.getElementById("filtro-cuit"),
  direccion: document.getElementById("filtro-direccion"),
  localidad: document.getElementById("filtro-localidad"),
  telefono: document.getElementById("filtro-telefono"),
};

// --- ESTADO ---
let todosLosClientes = [];
let ultimoDocVisible = null;
const CANTIDAD_POR_PAGINA = 50;

/**
 * Carga inicial
 */
async function cargarClientes() {
  ultimoDocVisible = null;
  todosLosClientes = [];
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Cargando clientes...</td></tr>`;
  await obtenerDatos();
}

/**
 * Trae datos de Firebase (Blaze-friendly)
 */
async function obtenerDatos() {
  try {
    const colRef = collection(db, "Clientes");
    let q;

    // NOTA: Quitamos el orderBy("Nombre") para que NO te pida crear índices.
    // Firebase por defecto ordena por el ID del documento.
    if (ultimoDocVisible) {
      q = query(
        colRef,
        startAfter(ultimoDocVisible),
        limit(CANTIDAD_POR_PAGINA)
      );
    } else {
      q = query(colRef, limit(CANTIDAD_POR_PAGINA));
    }

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty && !ultimoDocVisible) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay clientes en la base de datos.</td></tr>`;
      verMasBtn.style.display = "none";
      return;
    }

    ultimoDocVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

    querySnapshot.forEach((doc) => {
      todosLosClientes.push({ id: doc.id, ...doc.data() });
    });

    // Ocultar botón si ya no hay más
    if (querySnapshot.docs.length < CANTIDAD_POR_PAGINA) {
      verMasBtn.style.display = "none";
    } else {
      verMasBtn.style.display = "block";
    }

    aplicarFiltrosYOrden();
  } catch (error) {
    console.error("Error obteniendo datos:", error);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Error: ${error.message}</td></tr>`;
  }
}

/**
 * Filtra y Ordena en el navegador (GRATIS)
 */
function aplicarFiltrosYOrden() {
  const filtros = {
    nombre: inputsFiltro.nombre.value.toLowerCase(),
    local: inputsFiltro.local.value.toLowerCase(),
    cuit: inputsFiltro.cuit.value.toLowerCase(),
    direccion: inputsFiltro.direccion.value.toLowerCase(),
    localidad: inputsFiltro.localidad.value.toLowerCase(),
    telefono: inputsFiltro.telefono.value.toLowerCase(),
  };

  // 1. Filtrar
  let resultado = todosLosClientes.filter((c) => {
    return (
      (c.Nombre || "").toLowerCase().includes(filtros.nombre) &&
      (c.Local || "").toLowerCase().includes(filtros.local) &&
      (c.CUIT || "").toLowerCase().includes(filtros.cuit) &&
      (c.Direccion || "").toLowerCase().includes(filtros.direccion) &&
      (c.Localidad || "").toLowerCase().includes(filtros.localidad) &&
      (c.Telefono || "").toLowerCase().includes(filtros.telefono)
    );
  });

  // 2. Ordenar Alfabéticamente (Lo hacemos aquí para evitar el índice de Firebase)
  resultado.sort((a, b) => (a.Nombre || "").localeCompare(b.Nombre || ""));

  renderizarTabla(resultado);
}

function renderizarTabla(lista) {
  tbody.innerHTML = "";
  lista.forEach((data) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td><strong>${data.Nombre || "S/N"}</strong></td>
            <td>${data.Local || "-"}</td>
            <td>${data.CUIT || "-"}</td>
            <td>${data.Direccion || "-"}</td>
            <td>${data.Localidad || "-"}</td>
            <td>${data.Telefono || "-"}</td>
        `;
    tbody.appendChild(tr);
  });
}

// --- LISTENERS ---
Object.values(inputsFiltro).forEach((input) => {
  input.addEventListener("input", aplicarFiltrosYOrden);
});

refrescarBtn.addEventListener("click", cargarClientes);

verMasBtn.addEventListener("click", async () => {
  verMasBtn.disabled = true;
  verMasBtn.textContent = "Cargando...";
  await obtenerDatos();
  verMasBtn.disabled = false;
  verMasBtn.textContent = "Cargar más clientes";
});

// Arrancar al cargar la página
document.addEventListener("DOMContentLoaded", cargarClientes);
