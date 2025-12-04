import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  setDoc, // Necesario para la actualización de stock
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// -------------------------------------------------------------
// ## Nuevas Constantes de Colecciones
// -------------------------------------------------------------

const coleccionesStock = [
  "StockCarnicos", "StockFrigorBalde", "StockFrigorImpulsivos", "StockFrigorPostres",
  "StockFrigorPotes", "StockGlupsGranel", "StockGlupsImpulsivos", "StockGudfud",
  "StockInal", "StockLambweston", "StockMexcal", "StockOrale", "StockPripan", "StockSwift"
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
  StockSwift: "Swift"
};

const categorias = [
  "Ingrese valor",
  "Express",
  "Store",
  "Gastronómico",
  "Franquicia",
  "Supermercados",
  "Otro",
];
const recorridos = [
  "Ingrese valor",
  "Ruta 36/ Tan. y Ascasubi",
  "Heladerías Río 3",
  "Sudeste",
  "Otros",
];

// 🔹 Elementos del DOM
const pedidoIdDisplay = document.getElementById("pedido-id-display");
const diaSelect = document.getElementById("dia");
const numeroDiaSelect = document.getElementById("numeroDia");
const categoriaSelect = document.getElementById("categoria");
const recorridoSelect = document.getElementById("recorrido");
const contenedorColecciones = document.getElementById("contenedor-colecciones");

// 🔹 Variables de estado
let pedidoId = null;
let pedidoOriginal = null;

// Estructura de stock: { Coleccion: { NombreProducto: cantidadActual, ... } }
let stocksPorColeccion = {}; 
// Estructura de inputs: { Coleccion: [{ nombre: 'Prod', cantidad: 5, oldQty: 3 }, ...] }
let productosEnEdicion = {}; 

// 🔹 Funciones de utilidad (mostrarEstado)
function fillSelect(select, options) {
  select.innerHTML = options
    .map((opt) => `<option value="${opt}">${opt}</option>`)
    .join("");
}

function mostrarEstado(msg) {
  const snackbar = document.createElement("div");
  snackbar.textContent = msg.replace(/\n/g, " | ");
  snackbar.style.position = "fixed";
  snackbar.style.bottom = "20px";
  snackbar.style.left = "50%";
  snackbar.style.transform = "translateX(-50%)";
  snackbar.style.backgroundColor = msg.includes("❌")
    ? "red"
    : msg.includes("⚠️")
    ? "darkorange"
    : "#333";
  snackbar.style.color = "#fff";
  snackbar.style.padding = "12px 24px";
  snackbar.style.borderRadius = "8px";
  snackbar.style.zIndex = 1000;
  snackbar.style.opacity = 0;
  snackbar.style.transition = "opacity 0.3s";
  document.body.appendChild(snackbar);
  requestAnimationFrame(() => (snackbar.style.opacity = 1));
  setTimeout(() => {
    snackbar.style.opacity = 0;
    setTimeout(() => document.body.removeChild(snackbar), 300);
  }, 3000);
}

// -------------------------------------------------------------
// ## Carga de Datos y Productos
// -------------------------------------------------------------

async function cargarProductosYPedido() {
  const params = new URLSearchParams(window.location.search);
  pedidoId = params.get("id");

  if (!pedidoId) {
    mostrarEstado("ID de pedido no encontrado en la URL ❌");
    pedidoIdDisplay.textContent = "Error: ID no encontrado";
    return;
  }

  pedidoIdDisplay.textContent = `Modificando: ${pedidoId}`;

  try {
    // 1. Cargar Pedido Original
    const pedidoSnap = await getDoc(doc(db, "Pedidos", pedidoId));
    if (!pedidoSnap.exists()) {
      mostrarEstado(`Pedido "${pedidoId}" no existe ❌`);
      pedidoIdDisplay.textContent = "Error: Pedido no existe";
      return;
    }
    pedidoOriginal = pedidoSnap.data();

    // 2. Cargar Todos los Stocks de las 14 colecciones
    const stockPromises = coleccionesStock.map(col => getDoc(doc(db, col, "Stock")));
    const stockSnaps = await Promise.all(stockPromises);

    stocksPorColeccion = {};
    productosEnEdicion = {};

    stockSnaps.forEach((snap, index) => {
      const col = coleccionesStock[index];
      const stockData = snap.data() || {};
      stocksPorColeccion[col] = stockData;
      
      const productosPedido = pedidoOriginal.productos || {};
      const listaEdicion = [];

      // Recorrer todos los productos en stock
      Object.keys(stockData).sort().forEach(nombreProd => {
        // La clave en el pedido es "Coleccion::Producto"
        const pedidoKey = `${col}::${nombreProd}`;
        const detallePedido = productosPedido[pedidoKey] || {};
        const cantidadEnPedido = detallePedido.cantidad || 0;

        listaEdicion.push({
          nombre: nombreProd,
          coleccion: col,
          cantidad: cantidadEnPedido, // Cantidad actual en el input
          oldQty: cantidadEnPedido,   // Cantidad original del pedido (para calcular el delta)
        });
      });

      productosEnEdicion[col] = listaEdicion;
    });

    // 3. Rellenar Dropdowns y Campos Fijos
    fillSelect(categoriaSelect, categorias);
    fillSelect(recorridoSelect, recorridos);

    const dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
    const numerosDia = Array.from({ length: 31 }, (_, i) => String(i + 1));
    fillSelect(diaSelect, dias);
    fillSelect(numeroDiaSelect, numerosDia);

    const partesId = pedidoId.split(" ");
    const diaNum = partesId.length > 1 ? partesId[partesId.length - 1] : "";

    diaSelect.value = diaNum.split("-")[0] || dias[0];
    numeroDiaSelect.value = diaNum.split("-")[1] || numerosDia[0];

    categoriaSelect.value = pedidoOriginal.categoria || categorias[0];
    recorridoSelect.value = pedidoOriginal.recorrido || recorridos[0];

    renderProductos();

  } catch (e) {
    console.error("Error en la carga inicial:", e);
    mostrarEstado("Error al cargar productos o pedido ❌");
  }
}

// -------------------------------------------------------------
// ## Renderizado y Lógica de Inputs (Adaptado)
// -------------------------------------------------------------

function renderProductos() {
  contenedorColecciones.innerHTML = "";

  coleccionesStock.forEach(col => {
    const productos = productosEnEdicion[col] || [];
    const titulo = nombresColecciones[col] || col;

    const panel = document.createElement("div");
    panel.className = "coleccion-panel panel";

    const h3 = document.createElement("h3");
    h3.textContent = titulo;
    panel.appendChild(h3);

    const tbody = document.createElement("div");
    tbody.className = "coleccion-body";
    tbody.dataset.collection = col;
    
    if (productos.length === 0) {
      tbody.innerHTML = `<p style="text-align: center; color: #666;">Sin productos en Stock</p>`;
    }

    productos.forEach((prod, index) => {
      const fila = document.createElement("div");
      fila.className = `fila ${prod.cantidad > 0 ? 'activo' : ''}`;

      const celNombre = document.createElement("div");
      celNombre.className = "celda";
      celNombre.textContent = prod.nombre;

      const celInput = document.createElement("div");
      celInput.style.width = "100px";
      celInput.style.textAlign = "right";

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.className = "cantidad-input";
      // Usamos el índice dentro del array de edición para referencia
      input.dataset.index = index; 
      input.dataset.collection = col;
      input.value = prod.cantidad;

      input.addEventListener("input", (e) => {
        const val = parseInt(e.target.value) || 0;
        const idx = parseInt(e.target.dataset.index);
        const inputCol = e.target.dataset.collection;
        
        // Actualizar el estado en memoria
        if (productosEnEdicion[inputCol] && productosEnEdicion[inputCol][idx]) {
          productosEnEdicion[inputCol][idx].cantidad = val;
        }

        if (val > 0) fila.classList.add("activo"); else fila.classList.remove("activo");
      });

      celInput.appendChild(input);
      fila.appendChild(celNombre);
      fila.appendChild(celInput);
      tbody.appendChild(fila);
    });

    panel.appendChild(tbody);
    contenedorColecciones.appendChild(panel);
  });
}

// -------------------------------------------------------------
// ## Simulación y Validación de Stock (Adaptado)
// -------------------------------------------------------------

// Función central que simula el ajuste de stock para todas las colecciones
function simularAjusteStockGeneral() {
  const advertencias = [];
  
  for (const col of coleccionesStock) {
    const productos = productosEnEdicion[col] || [];
    const stockOriginal = stocksPorColeccion[col] || {};
    const stockName = nombresColecciones[col] || col;

    for (const p of productos) {
      const oldQty = p.oldQty; // Cantidad original que tenía el pedido
      const newQty = p.cantidad; // Nueva cantidad que se pide

      // Delta: (Viejo - Nuevo). Positivo = se devuelve al stock. Negativo = se saca más.
      const delta = oldQty - newQty; 

      if (delta < 0) {
        // Solo si se está SACANDO más de lo que se devuelve
        const stockActual = stockOriginal[p.nombre] || 0;
        const nuevoStock = stockActual + delta; // delta es negativo

        if (nuevoStock < 0) {
          advertencias.push(
            `Stock Negativo: ${stockName} - ${p.nombre} quedará en ${nuevoStock} ❌`
          );
        } else if (nuevoStock === 0) {
          advertencias.push(
            `Stock Agotado: ${stockName} - ${p.nombre} queda en 0 ⚠️`
          );
        }
      }
    }
  }

  // En este nuevo esquema, no existe la complejidad de Fraccionados/Impulsivos
  // por lo que se elimina la lógica de simularAjusteFraccionados.

  return advertencias;
}


// -------------------------------------------------------------
// ## Guardar Modificación con Bloqueo (Adaptado)
// -------------------------------------------------------------

document.getElementById("pedido-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!pedidoId || !pedidoOriginal) {
    mostrarEstado("No se pudo cargar el pedido original ❌");
    return;
  }

  const categoria = categoriaSelect.value;
  const recorrido = recorridoSelect.value;

  if (categoria === "Ingrese valor" || recorrido === "Ingrese valor") {
    mostrarEstado("Completa Categoría y Recorrido ❌");
    return;
  }

  // Contar el total de productos pedidos
  let totalPedidos = 0;
  let productosParaPedido = {};

  for (const col of coleccionesStock) {
    (productosEnEdicion[col] || []).forEach(p => {
      if (p.cantidad > 0) {
        totalPedidos += p.cantidad;
        // Formato para guardar en el sub-objeto 'productos' del pedido
        const pedidoKey = `${p.coleccion}::${p.nombre}`;
        productosParaPedido[pedidoKey] = {
          cantidad: p.cantidad,
          coleccion: p.coleccion,
          producto: p.nombre,
          checked: false 
        };
      }
    });
  }

  if (totalPedidos === 0) {
    mostrarEstado("Debe pedir al menos un producto ❌");
    return;
  }

  // 1. Simular los ajustes de stock
  let advertenciasStock = simularAjusteStockGeneral();

  // 2. Revisar Advertencias y Bloquear/Confirmar (MISMA LÓGICA)
  if (advertenciasStock.length > 0) {
    const stockNegativoEncontrado = advertenciasStock.some((msg) =>
      msg.includes("Stock Negativo")
    );

    let mensaje = stockNegativoEncontrado
      ? "🚨 ERROR DE STOCK. La operación resultará en stock negativo y ha sido CANCELADA. Corrige el pedido. 🚨"
      : "⚠️ ADVERTENCIA DE STOCK. La operación agotará el stock de uno o más productos. ¿Deseas continuar con el pedido y dejar el stock en cero? ⚠️";

    mensaje += "\n\nProblemas encontrados:\n" + advertenciasStock.join("\n");

    if (stockNegativoEncontrado) {
      mostrarEstado(mensaje);
      return; // Detener la ejecución
    }

    if (!confirm(mensaje)) {
      mostrarEstado("Modificación cancelada por el usuario. 🛑");
      return; // Detener la ejecución
    }
  }

  // 3. Si no hay problemas o el usuario confirmó, proceder con la actualización real.
  try {
    // a) Actualizar el documento del Pedido (con el nuevo formato 'productos')
    const pedidoActualizado = {
      categoria,
      recorrido,
      fechaModificacion: Timestamp.now(),
      productos: productosParaPedido // Usamos la estructura mapeada
    };
    await updateDoc(doc(db, "Pedidos", pedidoId), pedidoActualizado);

    // b) Preparar la actualización REAL del Stock para CADA colección
    const updatePromises = [];

    for (const col of coleccionesStock) {
      const productos = productosEnEdicion[col] || [];
      const stockOriginal = stocksPorColeccion[col] || {};
      const updates = {};
      
      for (const p of productos) {
        const oldQty = p.oldQty; 
        const newQty = p.cantidad; 
        const delta = oldQty - newQty;

        if (delta !== 0) {
          // El nuevo valor del stock es el stock original + el delta (diferencia)
          updates[p.nombre] = (stockOriginal[p.nombre] || 0) + delta;
        }
      }

      if (Object.keys(updates).length) {
        // Usamos setDoc con merge para actualizar solo los productos de esta colección
        // y crear el documento si no existe (aunque ya debería existir 'Stock')
        const docRef = doc(db, col, "Stock");
        updatePromises.push(setDoc(docRef, updates, { merge: true }));
      }
    }

    // Ejecutar todas las actualizaciones de stock en paralelo
    await Promise.all(updatePromises);
    
    // La lógica de Fraccionados/Impulsivos se elimina ya que ahora son colecciones separadas.

    mostrarEstado(`✅ Pedido "${pedidoId}" actualizado`);
    setTimeout(() => {
      window.location.href = "pedidos.html";
    }, 1500);
  } catch (e) {
    console.error("Error actualizando pedido o stock:", e);
    mostrarEstado("Error actualizando pedido ❌");
  }
});

// 🔹 Iniciar la carga
cargarProductosYPedido();