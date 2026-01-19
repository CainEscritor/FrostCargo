import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const categorias = ["Ingrese categoría", "Remito", "Factura"];
const vendedores = ["Seleccione vendedor", "Betty", "Alberto", "Ariel"];
const coleccionesStock = [
  "StockCarnicos",
  "StockFrigorBalde",
  "StockFrigorImpulsivos",
  "StockFrigorPostres",
  "StockFrigorPotes",
  "StockGlupsGranel",
  "StockGlupsImpulsivos",
  "StockGudfud",
  "StockInal",
  "StockLambweston",
  "StockMexcal",
  "StockOrale",
  "StockPripan",
  "StockSwift",
];

const nombresColecciones = {
  StockCarnicos: "Cárnicos",
  StockFrigorBalde: "Frigor Baldes",
  StockFrigorImpulsivos: "Frigor Impulsivos",
  StockFrigorPostres: "Frigor Postres",
  StockFrigorPotes: "Frigor Potes",
  StockGlupsGranel: "Glups Granel",
  StockGlupsImpulsivos: "Glup Impulsivos",
  StockGudfud: "Gudfud",
  StockInal: "Inal",
  StockLambweston: "Lambweston",
  StockMexcal: "Mexcal",
  StockOrale: "Orale",
  StockPripan: "Pripan",
  StockSwift: "Swift",
};

const pedidoIdDisplay = document.getElementById("pedido-id-display");
const fechaInput = document.getElementById("fechaEntrega");
const categoriaSelect = document.getElementById("categoria");
const localidadInput = document.getElementById("localidad");
const vendedorSelect = document.getElementById("vendedor");
const contenedorColecciones = document.getElementById("contenedor-colecciones");
const mensajeConfirmacion = document.getElementById("mensaje-confirmacion");
const mensajeErrorValidacion = document.getElementById(
  "mensaje-error-validacion"
);

const stockModal = document.getElementById("stock-advertencia-modal");
const stockDetalle = document.getElementById("stock-detalle");
const btnForzarStock = document.getElementById("btn-forzar-stock");
const btnCancelarStock = document.getElementById("btn-cancelar-stock");

let pedidoId = null;
let pedidoOriginal = null;
let stocksActuales = {};
let productosEnEdicion = {};

function fillSelect(select, options) {
  select.innerHTML = options
    .map(
      (opt) =>
        `<option value="${
          opt.includes("Ingrese") || opt.includes("Seleccione")
            ? "Ingrese valor"
            : opt
        }">${opt}</option>`
    )
    .join("");
}

async function inicializar() {
  const params = new URLSearchParams(window.location.search);
  pedidoId = params.get("id");
  if (!pedidoId) {
    pedidoIdDisplay.textContent = "Error: ID no recibido";
    return;
  }

  fillSelect(categoriaSelect, categorias);
  fillSelect(vendedorSelect, vendedores);

  try {
    const pedidoSnap = await getDoc(doc(db, "Pedidos", pedidoId));
    if (!pedidoSnap.exists()) {
      pedidoIdDisplay.textContent = "Error: El pedido no existe";
      return;
    }

    pedidoOriginal = pedidoSnap.data();
    pedidoIdDisplay.textContent = `Modificando: ${pedidoId}`;
    fechaInput.value = pedidoOriginal.fechaEntrega || "";
    categoriaSelect.value = pedidoOriginal.categoria || "Ingrese valor";
    localidadInput.value = pedidoOriginal.Localidad || "";
    vendedorSelect.value = pedidoOriginal.Vendedor || "Ingrese valor";

    for (const col of coleccionesStock) {
      const sSnap = await getDoc(doc(db, col, "Stock"));
      const stockData = sSnap.exists() ? sSnap.data() : {};
      stocksActuales[col] = stockData;

      // CORRECCIÓN: Ordenar alfabéticamente las llaves del documento de stock
      productosEnEdicion[col] = Object.keys(stockData)
        .sort((a, b) => a.localeCompare(b)) // Orden alfabético robusto
        .map((prodName) => {
          const pedidoKey = `${col}::${prodName}`;
          const cantOriginal =
            pedidoOriginal.productos?.[pedidoKey]?.cantidad || 0;
          return {
            nombre: prodName,
            coleccion: col,
            cantidadActual: cantOriginal,
            cantidadOriginal: cantOriginal,
          };
        });
    }
    renderizarProductos();
  } catch (e) {
    console.error(e);
    pedidoIdDisplay.textContent = "Error al conectar con la base de datos";
  }
}

function renderizarProductos() {
  contenedorColecciones.innerHTML = "";
  coleccionesStock.forEach((col) => {
    const panel = document.createElement("div");
    panel.className = "coleccion-panel";
    panel.innerHTML = `<h3>${nombresColecciones[col]}</h3>`;

    // Aquí recorremos la lista que ya guardamos ordenada en inicializar()
    productosEnEdicion[col].forEach((p) => {
      const fila = document.createElement("div");
      fila.className = `fila ${p.cantidadActual > 0 ? "activo" : ""}`;
      fila.innerHTML = `<span>${p.nombre}</span><input type="number" min="0" value="${p.cantidadActual}" class="cantidad-input">`;
      fila.querySelector("input").oninput = (e) => {
        p.cantidadActual = parseInt(e.target.value) || 0;
        fila.classList.toggle("activo", p.cantidadActual > 0);
      };
      panel.appendChild(fila);
    });
    contenedorColecciones.appendChild(panel);
  });
}

async function ejecutarGuardado(forzar = false) {
  let valid = true;
  categoriaSelect.classList.remove("input-error");
  vendedorSelect.classList.remove("input-error");

  if (categoriaSelect.value === "Ingrese valor") {
    categoriaSelect.classList.add("input-error");
    valid = false;
  }
  if (vendedorSelect.value === "Ingrese valor") {
    vendedorSelect.classList.add("input-error");
    valid = false;
  }

  if (!valid) {
    mensajeErrorValidacion.style.display = "block";
    setTimeout(() => (mensajeErrorValidacion.style.display = "none"), 3000);
    return;
  }

  let criticos = [];
  const batchUpdatesStock = {};
  const nuevosProductosPedido = {};

  for (const col of coleccionesStock) {
    const stockRef = stocksActuales[col];
    const updates = { ...stockRef };
    productosEnEdicion[col].forEach((p) => {
      const delta = p.cantidadOriginal - p.cantidadActual;
      const nuevoStockVal = (stockRef[p.nombre] || 0) + delta;

      if (delta !== 0) updates[p.nombre] = nuevoStockVal;
      if (nuevoStockVal < 0)
        criticos.push(
          `${p.nombre} (Stock: ${
            stockRef[p.nombre] || 0
          }, Quedaría: ${nuevoStockVal})`
        );

      if (p.cantidadActual > 0) {
        nuevosProductosPedido[`${col}::${p.nombre}`] = {
          cantidad: p.cantidadActual,
          producto: p.nombre,
          coleccion: col,
          checked: false,
        };
      }
    });
    batchUpdatesStock[col] = updates;
  }

  if (criticos.length > 0 && !forzar) {
    stockDetalle.innerHTML = `<ul>${criticos
      .map((i) => `<li>${i}</li>`)
      .join("")}</ul>`;
    stockModal.style.display = "flex";
    return;
  }

  try {
    await updateDoc(doc(db, "Pedidos", pedidoId), {
      fechaEntrega: fechaInput.value,
      categoria: categoriaSelect.value,
      Localidad: localidadInput.value,
      Vendedor: vendedorSelect.value,
      fechaModificacion: Timestamp.now(),
      productos: nuevosProductosPedido,
    });

    for (const col of coleccionesStock) {
      await setDoc(doc(db, col, "Stock"), batchUpdatesStock[col]);
    }

    stockModal.style.display = "none";
    mensajeConfirmacion.style.display = "block";
    setTimeout(() => {
      window.location.href = "pedidos.html";
    }, 2000);
  } catch (e) {
    console.error(e);
    alert("Error al intentar actualizar el pedido. Reintente.");
  }
}

document.getElementById("pedido-form").onsubmit = (e) => {
  e.preventDefault();
  ejecutarGuardado(false);
};

btnForzarStock.onclick = () => ejecutarGuardado(true);
btnCancelarStock.onclick = () => (stockModal.style.display = "none");

inicializar();
