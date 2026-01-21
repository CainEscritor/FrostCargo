import { db } from "./firebase.js";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// --- VARIABLES GLOBALES ---
let pedidosGlobales = []; // Copia local para filtrado rápido sin costo de lectura

// 1. INICIALIZAR EL LISTENER PRINCIPAL (Una sola vez)
function iniciarEscuchaPedidos() {
  const pedidosRef = collection(db, "Pedidos");
  const q = query(pedidosRef, orderBy("fechaRegistro", "desc"));

  onSnapshot(q, (snapshot) => {
    pedidosGlobales = snapshot.docs;
    renderPedidos();
  });
}

// 2. FUNCIÓN DE RENDERIZADO OPTIMIZADA (Filtra en memoria)
function renderPedidos() {
  pedidosContainer.innerHTML = "";

  const normNombre = normalizar(filtroNombre);
  const normLocalidad = normalizar(filtroLocalidad);
  const filtroFechaValida = filtroFecha.trim();

  let pedidosFiltrados = pedidosGlobales.filter((doc) => {
    const data = doc.data();
    return (
      (normNombre === "" ||
        normalizar(data.Nombre || "").includes(normNombre)) &&
      (filtroFechaValida === "" ||
        (data.fechaEntrega || "") === filtroFechaValida) &&
      (filtroCategoria === "Todos" ||
        (data.categoria || "") === filtroCategoria) &&
      (normLocalidad === "" ||
        normalizar(data.Localidad || "").includes(normLocalidad)) &&
      (filtroVendedor === "Todos" || (data.Vendedor || "") === filtroVendedor)
    );
  });

  // 🔹 Limitar a 10 pedidos solo cuando NO hay filtros activos
  let pedidosBase = pedidosFiltrados;

  if (!hayFiltrosActivos() && !pedidoAbiertoId) {
    pedidosBase = pedidosFiltrados.slice(0, 10);
  }

  const pedidosAMostrar = pedidoAbiertoId
    ? pedidosFiltrados.filter((d) => d.id === pedidoAbiertoId)
    : pedidosBase;

  if (!pedidosFiltrados.length) {
    pedidosContainer.innerHTML = `<p style="text-align:center;">No hay pedidos que coincidan.</p>`;
    return;
  }

  pedidosAMostrar.forEach((pedidoDoc) => {
    const elemento = crearElementoPedido(pedidoDoc, pedidoDoc.data());
    pedidosContainer.appendChild(elemento);
  });

  renderBotonResumen(pedidosFiltrados);
}

// 4. HELPER PARA CARGAR IMÁGENES
let cacheLogo = null;
function cargarImagenLogo(src) {
  if (cacheLogo) return Promise.resolve(cacheLogo);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      cacheLogo = img;
      resolve(img);
    };
    img.onerror = reject;
  });
}

// 5. BOTÓN DE RESUMEN
function renderBotonResumen(pedidosFiltradosFinales) {
  const resumenBtnContainer = document.createElement("div");
  resumenBtnContainer.style.cssText = "margin: 20px 0; text-align: center;";

  const btnResumen = document.createElement("button");
  btnResumen.textContent = `📝 Generar Resumen Acumulado (${pedidosFiltradosFinales.length})`;
  btnResumen.style.cssText =
    "background-color: #ff9800; color: white; padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;";

  btnResumen.onclick = () => generarPDFAcumulado(pedidosFiltradosFinales);

  resumenBtnContainer.appendChild(btnResumen);
  pedidosContainer.appendChild(resumenBtnContainer);
}

// 🟣 DOM (ANTES DE ARRANCAR FIREBASE)
const pedidosContainer = document.getElementById("pedidosContainer");
const nombreInput = document.getElementById("nombreInput");
const fechaInput = document.getElementById("fechaInput");
const categoriaSelect = document.getElementById("categoriaSelect");
const localidadInput = document.getElementById("localidadInput");
const vendedorSelect = document.getElementById("vendedorSelect");

// 🔵 INICIO CORRECTO DE LA APP
document.addEventListener("DOMContentLoaded", () => {
  iniciarEscuchaPedidos();
});

let filtroNombre = "";
let filtroFecha = "";
let filtroCategoria = "Todos";
let filtroLocalidad = "";
let filtroVendedor = "Todos";
let pedidoAbiertoId = null;

// ---------- CONSTANTES DE COLECCIONES ----------
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
  StockCarnicos: "Productos Extras",
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

// 💡 Función de normalización para búsquedas sin acentos/mayúsculas
function normalizar(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// 🔹 Eventos de cambio de filtro
nombreInput.addEventListener("input", () => {
  filtroNombre = nombreInput.value;
  renderPedidos();
});

fechaInput.addEventListener("input", () => {
  filtroFecha = fechaInput.value;
  renderPedidos();
});

categoriaSelect.addEventListener("change", () => {
  filtroCategoria = categoriaSelect.value;
  renderPedidos();
});

localidadInput.addEventListener("input", () => {
  filtroLocalidad = localidadInput.value;
  renderPedidos();
});

vendedorSelect.addEventListener("change", () => {
  filtroVendedor = vendedorSelect.value;
  renderPedidos();
});

// -------------------------------------------------------------------
// ## Borrar Pedido y Actualizar Stock
// -------------------------------------------------------------------

async function borrarPedidoYActualizarStock(pedidoData, docId) {
  if (
    !confirm(
      "¿Seguro que querés borrar el pedido? Todos los artículos volverán al stock.",
    )
  )
    return;

  try {
    // 1. Pre-cargar el stock actual de TODAS las colecciones
    const stockSnaps = await Promise.all(
      coleccionesStock.map((col) => getDoc(doc(db, col, "Stock"))),
    );
    const stocksData = {};
    stockSnaps.forEach((snap, index) => {
      stocksData[coleccionesStock[index]] = snap.data() || {};
    }); // 2. Procesar los productos del pedido para preparar las actualizaciones

    const productosPedidos = pedidoData.productos || {};
    const updatesPorColeccion = {};

    for (const [pedidoKey, detalle] of Object.entries(productosPedidos)) {
      if (typeof detalle === "object") {
        const coleccion = detalle.coleccion;
        const producto = detalle.producto;
        const cantidad = detalle.cantidad || 0;

        if (coleccion && producto && cantidad > 0) {
          const stockActual = stocksData[coleccion]?.[producto] || 0;
          if (!updatesPorColeccion[coleccion]) {
            updatesPorColeccion[coleccion] = {};
          } // Sumar la cantidad devuelta al stock

          updatesPorColeccion[coleccion][producto] = stockActual + cantidad;
        }
      }
    } // 3. Ejecutar las actualizaciones de stock en Firebase
    const updatePromises = [];
    for (const [col, updates] of Object.entries(updatesPorColeccion)) {
      if (Object.keys(updates).length > 0) {
        const ref = doc(db, col, "Stock"); // Usamos setDoc con merge para actualizar solo los campos modificados
        updatePromises.push(setDoc(ref, updates, { merge: true }));
      }
    }
    await Promise.all(updatePromises); // 4. Borrar el pedido

    await deleteDoc(doc(db, "Pedidos", docId));

    pedidoAbiertoId = null;
    alert("Pedido borrado y stock actualizado.");
  } catch (e) {
    alert("Error al borrar/actualizar stock: " + e);
    console.error(e);
  }
}

async function borrarPedidoSinStock(docId) {
  if (!confirm("¿Confirmás que el pedido fue entregado?")) return;

  try {
    const pedidoRef = doc(db, "Pedidos", docId);
    const pedidoSnap = await getDoc(pedidoRef);

    if (!pedidoSnap.exists()) {
      alert("Pedido no encontrado");
      return;
    }

    const pedidoData = pedidoSnap.data();

    // 👉 Guardar historial del cliente
    await guardarHistorialCliente(pedidoData);
    await guardarVenta(docId, pedidoData);

    // 👉 Borrar pedido
    await deleteDoc(pedidoRef);

    pedidoAbiertoId = null;
    alert("Pedido entregado y guardado en historial del cliente.");
  } catch (e) {
    console.error(e);
    alert("Error al confirmar el pedido: " + e);
  }
}

async function guardarHistorialCliente(pedidoData) {
  try {
    const nombreCliente = pedidoData.Nombre;
    if (!nombreCliente) return;

    const fecha = new Date();
    const periodo = `${fecha.getFullYear()}-${String(
      fecha.getMonth() + 1,
    ).padStart(2, "0")}`;

    const clienteRef = doc(db, "Clientes", nombreCliente);
    const clienteSnap = await getDoc(clienteRef);

    if (!clienteSnap.exists()) return;

    const clienteData = clienteSnap.data();
    const historialActual = clienteData.historial || {};
    const historialPeriodo = historialActual[periodo] || {};

    const productos = pedidoData.productos || {};

    Object.values(productos).forEach((detalle) => {
      if (!detalle || !detalle.producto) return;

      const producto = detalle.producto;
      const cantidad = detalle.cantidad || 0;

      if (cantidad > 0) {
        historialPeriodo[producto] =
          (historialPeriodo[producto] || 0) + cantidad;
      }
    });

    await updateDoc(clienteRef, {
      [`historial.${periodo}`]: historialPeriodo,
    });
  } catch (err) {
    console.error("Error guardando historial:", err);
  }
}

async function guardarVenta(pedidoId, pedidoData) {
  // 📄 Documento con el mismo ID que el pedido
  const ventaRef = doc(db, "Ventas", pedidoId);

  // 📅 Fecha en formato dd/mm/aaaa
  //const fechaEntrega = new Date().toLocaleDateString("es-AR");

  // 🔹 Determinar colección de precios (MISMA lógica que el PDF)
  function coleccionPreciosParaCategoria(categoria) {
    if (!categoria) return "PreciosExpress";
    const c = categoria.toString().toLowerCase().trim();

    const mapa = {
      express: "PreciosExpress",
      store: "PreciosStore",
      gastronómico: "PreciosGastronomico",
      gastronomico: "PreciosGastronomico",
      franquicia: "PreciosFranquicia",
      supermercados: "PreciosSupermercados",
      supermercado: "PreciosSupermercados",
      factura: "PreciosExpress",
      remito: "PreciosExpress",
    };
    return mapa[c] || "PreciosExpress";
  }

  const nombreColeccionPrecios = coleccionPreciosParaCategoria(
    pedidoData.categoria,
  );

  // 📥 Leer precios reales
  const preciosSnap = await getDoc(doc(db, "Precios", "Precio"));
  const preciosData = preciosSnap.exists() ? preciosSnap.data() : {};

  const productos = pedidoData.productos || {};
  const productosMap = {};
  let total = 0;

  // 🔁 MISMO cálculo que el PDF
  Object.values(productos).forEach((detalle) => {
    if (!detalle || !detalle.producto) return;

    const cantidad = detalle.cantidad || 0;
    const precioUnitario = preciosData[detalle.producto] || 0;

    if (cantidad > 0) {
      total += cantidad * precioUnitario;
      productosMap[detalle.producto] = cantidad;
    }
  });

  // 💾 Guardar venta
  await setDoc(ventaRef, {
    fechaEntrega: pedidoData.fechaEntrega || "",
    cliente: pedidoData.Nombre || "",
    Localidad: pedidoData.Localidad || "",
    direccion: pedidoData.Direccion || "",
    tipoDocumento: pedidoData.categoria || "", // factura / remito
    NumeroRemito: pedidoData.NumeroRemito || "",
    total: Number(total.toFixed(2)), // EXACTAMENTE el mismo número del PDF
    productos: productosMap,
  });
}

const EMPRESAS = {
  FROSTCARGO: {
    nombre: "FROST CARGO SAS",
    cuit: "30-71857453-2",
    inicioAct: "01/05/2010",
    logo: "images/Grido_logo.png",
    logoAncho: 50, // Ancho estándar
    logoAlto: 20,
  },
  BAEZA: {
    nombre: "DISTRIBUIDORA BAEZA S.R.L.",
    cuit: "30-70915630-2",
    inicioAct: "30/06/2004",
    logo: "images/baeza.jpg",
    logoAncho: 30, // <-- Aquí lo hacemos más angosto
    logoAlto: 20,
  },
};

// -------------------------------------------------------------------
// ## Generar PDF (Remito Individual)
// -------------------------------------------------------------------

// 🔹 Generar PDF
window.generarPDF = async function (pedidoId) {
  try {
    const pedidoRef = doc(db, "Pedidos", pedidoId);
    const pedidoSnap = await getDoc(pedidoRef);
    const { jsPDF } = window.jspdf;
    const docPDF = new jsPDF({ format: "a4", unit: "mm" });

    const idsSnap = await getDoc(doc(db, "idProductos", "idProducto"));
    const idsData = idsSnap.exists() ? idsSnap.data() : {};
    if (!pedidoSnap.exists()) {
      alert("Pedido no encontrado ❌");
      return;
    }

    const data = pedidoSnap.data(); // NEW: seleccionar la colección de precios según data.categoria
    function coleccionPreciosParaCategoria(categoria) {
      if (!categoria) return "PreciosExpress";
      const c = categoria.toString().toLowerCase().trim();

      const mapa = {
        express: "PreciosExpress",
        store: "PreciosStore",
        gastronómico: "PreciosGastronomico",
        gastronomico: "PreciosGastronomico",
        franquicia: "PreciosFranquicia",
        supermercados: "PreciosSupermercados",
        supermercado: "PreciosSupermercados",
        otro: "PreciosExpress",
        remito: "PreciosExpress", // Asumiendo default para remito/factura
        factura: "PreciosExpress",
        "ingrese categoría": "PreciosExpress",
      };
      return mapa[c] || "PreciosExpress";
    }

    const nombreColeccionPrecios = coleccionPreciosParaCategoria(
      data.categoria,
    ); // 1. Obtener referencias y datos necesarios para el PDF

    const preciosSnap = await getDoc(doc(db, "Precios", "Precio"));
    const preciosData = preciosSnap.exists() ? preciosSnap.data() : {}; // 2. Clasificar artículos del pedido
    const productosPedidos = data.productos || {};
    const grupos = {};
    coleccionesStock.forEach((col) => (grupos[col] = [])); // Llenar los grupos (ej. grupos["StockCarnicos"] = ["Asado", "Chorizo"])

    Object.keys(productosPedidos).forEach((key) => {
      const detalle = productosPedidos[key];
      if (detalle && detalle.coleccion && detalle.producto) {
        const cantidad = detalle.cantidad || 0;
        if (cantidad > 0 && grupos.hasOwnProperty(detalle.coleccion)) {
          grupos[detalle.coleccion].push(detalle.producto);
        }
      }
    }); // 3. Mostrar el modal de configuración

    mostrarModalRemito({
      pedidoId,
      data,
      preciosData,
      grupos: grupos,
      productosPedidos: productosPedidos,
      idsData,
    });
  } catch (err) {
    console.error("Error inicializando PDF:", err);
    alert("Error inicializando PDF ❌ Revisa la consola.");
  }
};

// =========================================================================
// 💡 FUNCIÓN MODAL DE CONFIGURACIÓN (Remito Individual)
// =========================================================================

function mostrarModalRemito({
  pedidoId,
  data,
  preciosData,
  grupos,
  productosPedidos,
  idsData,
}) {
  let modal = document.getElementById("configuracion-remito-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "configuracion-remito-modal";

    Object.assign(modal.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
    });

    const modalContent = document.createElement("div");
    Object.assign(modalContent.style, {
      background: "#fff",
      padding: "25px",
      borderRadius: "10px",
      width: "380px",
      maxHeight: "90vh",
      overflowY: "auto",
      boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
      fontFamily: "Arial, sans-serif",
    });

    modalContent.innerHTML = `
      <h2>Opciones de Remito</h2>

      <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
        <label style="font-weight: bold; display: block; margin-bottom: 8px;">Seleccionar Empresa:</label>
        <label style="margin-right: 15px; cursor:pointer;">
          <input type="radio" name="empresa-select" value="FROSTCARGO" checked> Frost Cargo
        </label>
        <label style="cursor:pointer;">
          <input type="radio" name="empresa-select" value="BAEZA"> Baeza
        </label>
      </div>

      <div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
        <label style="display: block; margin-bottom: 8px;">
          <input type="checkbox" id="ocultar-precios-check" /> 
          Ocultar Precios en Remito
        </label>
      </div>

      <div style="margin-bottom: 12px;">
        <label for="porcentaje-input" style="display: block; margin-bottom: 5px; font-weight: bold;">Descuento (%)</label>
        <input type="number" id="porcentaje-input" value="" min="0" step="0.01" placeholder="Ej: 10 para 10%" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
        <small style="display:block;margin-top:6px;color:#666;">Ingresá un porcentaje a descontar del subtotal. Dejá vacío o 0 si no aplicar.</small>
      </div>

      <div style="margin-bottom: 12px;">
        <label for="efectivo-input" style="display: block; margin-bottom: 5px; font-weight: bold;">Descuento en efectivo ($)</label>
        <input type="number" id="efectivo-input" value="" min="0" step="0.01" placeholder="Ej: 100" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
        <small style="display:block;margin-top:6px;color:#666;">Se resta del subtotal después del descuento porcentual.</small>
      </div>

      <div style="margin-bottom: 20px;">
        <label for="observaciones-input" style="display: block; margin-bottom: 5px; font-weight: bold;">Observaciones</label>
        <textarea id="observaciones-input" rows="3" placeholder="Notas, condiciones de entrega, etc." style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; resize: vertical; font-size: 14px;"></textarea>
      </div>

      <button id="generar-remito-final" style="width: 100%; padding: 10px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Generar PDF con Opciones
      </button>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  } else {
    document.getElementById("ocultar-precios-check").checked = false;
    document.getElementById("porcentaje-input").value = "";
    document.getElementById("efectivo-input").value = "";
    document.getElementById("observaciones-input").value = "";
    modal.style.display = "flex";
  }

  const generarBtn = document.getElementById("generar-remito-final");
  generarBtn.onclick = () => {
    const empresaSeleccionada = document.querySelector(
      'input[name="empresa-select"]:checked',
    ).value;
    const empresaData = EMPRESAS[empresaSeleccionada];
    const ocultarPrecios = document.getElementById(
      "ocultar-precios-check",
    ).checked;
    const descuentoPorcentaje =
      parseFloat(document.getElementById("porcentaje-input").value) || 0; // Ej: 10
    const descuentoEfectivo =
      parseFloat(document.getElementById("efectivo-input").value) || 0; // Ej: 100
    const observaciones = document
      .getElementById("observaciones-input")
      .value.trim();

    modal.style.display = "none";

    _generarRemitoFinal({
      pedidoId,
      data,
      preciosData,
      grupos,
      productosPedidos,
      ocultarPrecios,
      descuentoPorcentaje,
      descuentoEfectivo,
      observaciones,
      idsData,
      empresaData, // <--- Pasamos los datos de la empresa elegida
    });
  };
}

// =========================================================================
// 💡 FUNCIÓN REUTILIZABLE PARA DIBUJAR UN REMITO (Remito Individual)
// =========================================================================

async function drawRemito(
  docPDF,
  logoImg,
  tipoCopia,
  {
    data,
    preciosData,
    grupos,
    productosPedidos,
    ocultarPrecios,
    descuentoPorcentaje = 0,
    descuentoEfectivo = 0,
    observaciones,
    flete = 0,
    idsData,
    empresaData, // <--- Recibimos el objeto de la empresa
  },
) {
  const nombreCliente = data.Nombre || "-";
  const direccion = data.Direccion || "-";
  const localidad = data.Localidad || "-";
  const nombreLocal = data.Local || "-";

  const marginLeft = 10;
  const pageWidth = docPDF.internal.pageSize.getWidth();
  let y = 10;

  // --- ENCABEZADO FIJO ---
  if (logoImg) {
    // Si la empresa tiene ancho definido lo usa, sino usa 50 (estándar)
    const ancho = empresaData.logoAncho || 50;
    // Si la empresa tiene alto definido lo usa, sino usa 20 (estándar)
    const alto = empresaData.logoAlto || 20;

    docPDF.addImage(logoImg, "JPEG", marginLeft, y, ancho, alto);
  } else {
    // Si no hay logo, ponemos el nombre de la empresa como texto
    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(12);
    docPDF.text(empresaData.nombre, marginLeft, y + 10);
  }
  y += 25;

  docPDF.setFont("helvetica", "normal");
  docPDF.setFontSize(10);
  docPDF.text(empresaData.nombre, marginLeft, y); // DINÁMICO
  y += 5;
  docPDF.text("Benjamin Franklin 1557", marginLeft, y);
  y += 5;
  docPDF.text("(5850) RIO TERCERO (Cba.) Tel: 3571-528075", marginLeft, y);
  y += 5;
  docPDF.setFontSize(8);
  docPDF.text("Responsable Inscripto", marginLeft, y);

  y = 20;
  docPDF.setFont("helvetica", "bold");
  docPDF.setFontSize(14);
  docPDF.text(`REMITO - COPIA ${tipoCopia}`, pageWidth - 10, y, {
    align: "right",
  });
  y += 8;

  docPDF.setFont("helvetica", "normal");
  docPDF.setFontSize(9);
  docPDF.text("DOCUMENTO NO VALIDO COMO FACTURA", pageWidth - 10, y, {
    align: "right",
  });
  y += 7;

  const numeroRemito = data.NumeroRemito ?? 0;
  docPDF.text(
    `N° ${numeroRemito.toString().padStart(8, "0")}`,
    pageWidth - 10,
    y,
    { align: "right" },
  );
  y = 44; // Ajustar según necesites
  docPDF.setFontSize(8);
  docPDF.text(
    `CUIT: ${empresaData.cuit}   Ing. Brutos: 280-703834`, // DINÁMICO
    pageWidth - 10,
    y,
    { align: "right" },
  );
  y += 5;
  docPDF.text(
    `Fecha de Inicio Act.: ${empresaData.inicioAct}`,
    pageWidth - 10,
    y,
    {
      // DINÁMICO
      align: "right",
    },
  );
  y += 3;

  // Línea separadora
  docPDF.setLineWidth(0.5);
  docPDF.line(marginLeft, y, pageWidth - marginLeft, y);
  y += 5;

  // --- DATOS DEL CLIENTE ---
  docPDF.setFont("helvetica", "normal");
  docPDF.setFontSize(13);
  docPDF.text(`${nombreCliente} (${nombreLocal})`, 10, y);
  y += 5;
  docPDF.text(`${direccion}, ${localidad}`, 10, y);
  y += 10;

  let subtotal = 0; // acumulador de precios antes de descuentos
  // --- FUNCIÓN PARA CONSTRUIR CADA GRUPO ---
  function buildGrupoPDF(nombreColeccion, items) {
    if (!items.length) return;
    items.sort((a, b) => a.localeCompare(b));

    const titulo = nombresColecciones[nombreColeccion] || nombreColeccion;

    // Título del grupo
    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(13);
    docPDF.text(titulo, 10, y);

    const textWidth = docPDF.getTextWidth(titulo);
    docPDF.setLineWidth(0.5);
    docPDF.line(10, y + 1, 10 + textWidth, y + 1);

    y += 7;
    let totalGrupo = 0;
    const rowSpacing = 5;
    const maxY = 280;

    items.forEach((prod) => {
      const pedidoKey = `${nombreColeccion}::${prod}`;
      const detalle = productosPedidos[pedidoKey] || {};
      const cantidad = detalle.cantidad || 0;
      const total = cantidad;
      if (total === 0) return;

      totalGrupo += total;

      const precioUnitario = preciosData[prod] ?? 0;
      const precioTotal = total * precioUnitario;

      // Acumular en subtotal (si tenemos precios)
      subtotal += precioTotal;

      const idProducto = idsData[prod] || "SIN-ID";

      // Cantidad en negrita
      docPDF.setFont("helvetica", "bold");
      docPDF.setFontSize(11);
      docPDF.text(total.toString(), 13, y);

      // ID + Producto en normal
      docPDF.setFont("helvetica", "normal");
      docPDF.text(`-  ${prod.charAt(0).toUpperCase() + prod.slice(1)}`, 18, y);

      if (!ocultarPrecios) {
        docPDF.text(`$${precioTotal.toFixed(2)}`, pageWidth - 10, y, {
          align: "right",
        });
      }

      y += rowSpacing;
      if (y > maxY) {
        docPDF.addPage();
        y = 20;
      }
    });
  }
  // --- GENERAR GRUPOS DINÁMICAMENTE ---
  coleccionesStock.forEach((col) => {
    buildGrupoPDF(col, grupos[col]);
  });

  // --- TOTALES Y OPCIONALES ---
  y += 5;

  // Si ocultamos precios, mostramos como antes (total de unidades)
  const totalProductos = Object.values(productosPedidos).reduce(
    (sum, item) => sum + (item.cantidad || 0),
    0,
  );

  if (!ocultarPrecios) {
    // Mostrar SUBTOTAL
    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(10);
    docPDF.text(`SUBTOTAL: $${subtotal.toFixed(2)}`, pageWidth - 10, y, {
      align: "right",
    });
    y += 6;

    // Aplicar descuento porcentual (si existe)
    let descuentoPorcMonto = 0;
    if (descuentoPorcentaje && descuentoPorcentaje > 0) {
      descuentoPorcMonto = subtotal * (descuentoPorcentaje / 100);
      docPDF.text(
        `Descuento (${descuentoPorcentaje}%): - $${descuentoPorcMonto.toFixed(
          2,
        )}`,
        pageWidth - 10,
        y,
        { align: "right" },
      );
      y += 6;
    }

    // Aplicar descuento en efectivo (si existe)
    let descuentoEfectMonto = 0;
    if (descuentoEfectivo && descuentoEfectivo > 0) {
      descuentoEfectMonto = descuentoEfectivo;
      docPDF.text(
        `Descuento Efectivo: - $${descuentoEfectMonto.toFixed(2)}`,
        pageWidth - 10,
        y,
        { align: "right" },
      );
      y += 6;
    }

    // Agregar Flete si existe
    if (flete > 0) {
      docPDF.text(`Flete/Transporte: $${flete.toFixed(2)}`, pageWidth - 10, y, {
        align: "right",
      });
      y += 6;
    }

    // Calcular total final (no menor a 0)
    let totalGeneral =
      subtotal - descuentoPorcMonto - descuentoEfectMonto + (flete || 0);
    if (totalGeneral < 0) totalGeneral = 0;

    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(12);
    docPDF.text(`TOTAL FINAL: $${totalGeneral.toFixed(2)}`, pageWidth - 10, y, {
      align: "right",
    });
    y += 10;
  } else {
    // Si precios ocultos: sólo mostrar total de unidades como antes
    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(12);
    docPDF.text(
      `TOTAL FINAL DE UNIDADES: ${totalProductos}`,
      pageWidth - 10,
      y,
      { align: "right" },
    );
    y += 10;
  }

  // --- PIE DE PÁGINA (FIRMAS) ---
  docPDF.setFont("helvetica", "normal");
  docPDF.setFontSize(8);
  docPDF.text("Recibí(mos) Conforme", 10, y);
  docPDF.text("Firma: ____________________", 160, y);
  y += 5;
  docPDF.text("Aclaración: ________________", 160, y);
  y += 5;

  // Observaciones
  if (observaciones) {
    if (y > 290) {
      docPDF.addPage();
      y = 20;
    }
    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(11);
    docPDF.text(`Observaciones: ${observaciones}`, 10, y);
  }
}

// =========================================================================
// 💡 FUNCIÓN DE GENERACIÓN FINAL DE PDF (Remito Individual - CORE LOGIC)
// =========================================================================

async function _generarRemitoFinal({
  pedidoId,
  data,
  preciosData,
  grupos,
  productosPedidos,
  ocultarPrecios,
  descuentoPorcentaje,
  descuentoEfectivo,
  observaciones,
  idsData,
  empresaData,
}) {
  try {
    const { jsPDF } = window.jspdf;
    const docPDF = new jsPDF({ format: "legal", unit: "mm" });

    const loadImage = (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => {
          console.error("No se pudo cargar el logo en: " + src);
          resolve(null); // Resolvemos con null para que el código siga
        };
      });

    console.log("🧠 Empresa seleccionada:", empresaData);

    // Intentamos cargar el logo de la empresa elegida
    let logoImg = await loadImage(empresaData.logo);

    // Si no cargó (null), intentamos cargar el logo por defecto (Grido)
    if (!logoImg) {
      console.warn(
        `⚠️ No se encontró el logo en ${empresaData.logo}. Usando logo por defecto.`,
      );
      logoImg = await loadImage("images/Grido_logo.png");
    }

    const options = {
      pedidoId,
      data,
      preciosData,
      grupos,
      productosPedidos,
      ocultarPrecios,
      descuentoPorcentaje,
      descuentoEfectivo,
      observaciones,
      idsData,
      empresaData,
      flete: 0,
    };

    // Si después de todo no hay logo (archivo de Grido también falta),
    // pasamos una imagen vacía o manejamos el error para que al menos imprima el texto
    await drawRemito(docPDF, logoImg, "ORIGINAL", options);
    docPDF.addPage("legal", "portrait");
    await drawRemito(docPDF, logoImg, "DUPLICADO", options);

    docPDF.save(`${empresaData.nombre}_${pedidoId}.pdf`);
  } catch (err) {
    console.error("❌ ERROR CRÍTICO GENERANDO PDF:", err);
    alert("❌ Error al generar el PDF. Revisa la consola para más detalles.");
  }
}

function hayFiltrosActivos() {
  return (
    filtroNombre.trim() !== "" ||
    filtroFecha.trim() !== "" ||
    filtroCategoria !== "Todos" ||
    filtroLocalidad.trim() !== "" ||
    filtroVendedor !== "Todos"
  );
}

// -------------------------------------------------------------------
// ## Crear Elemento Pedido
// -------------------------------------------------------------------

function crearElementoPedido(pedidoDoc, data) {
  const container = document.createElement("div");
  container.className = "panel";
  container.style.marginBottom = "12px";
  container.style.padding = "12px";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";

  // --- CAMBIO AQUÍ: Formateamos el encabezado con Cliente, Localidad y Fecha ---
  const title = document.createElement("div"); // Cambiado a div para manejar mejor el layout
  title.style.display = "flex";
  title.style.flexDirection = "column"; // Nombre arriba, datos abajo

  const nombreCliente = data.Nombre || "Sin Nombre";
  const localidad = data.Localidad || "Sin Localidad";
  const fechaEntrega = data.fechaEntrega || "Sin Fecha";

  title.innerHTML = `
    <strong style="font-size: 1.1em;">${nombreCliente}</strong>
    <span style="font-size: 0.85em; color: #555;">
      📍 ${localidad} | 📅 ${fechaEntrega}
    </span>
  `;
  header.appendChild(title);

  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = pedidoAbiertoId === pedidoDoc.id ? "▲" : "▼";
  toggleBtn.style.padding = "8px 12px"; // Un poco más de área de clic
  toggleBtn.style.backgroundColor = "#007bff";
  toggleBtn.style.color = "white";
  toggleBtn.style.border = "none";
  toggleBtn.style.borderRadius = "4px";

  toggleBtn.addEventListener("click", () => {
    pedidoAbiertoId = pedidoAbiertoId === pedidoDoc.id ? null : pedidoDoc.id;
    renderPedidos();
  });
  header.appendChild(toggleBtn);
  container.appendChild(header);

  if (pedidoAbiertoId === pedidoDoc.id) {
    const productosPedidos = data.productos || {};
    const articulosKeys = Object.keys(productosPedidos);
    const detallesContainer = document.createElement("div");
    detallesContainer.style.marginTop = "12px";

    (async () => {
      const grupos = {};
      coleccionesStock.forEach((col) => (grupos[col] = []));

      articulosKeys.forEach((key) => {
        const detalle = productosPedidos[key];
        if (detalle && detalle.coleccion && detalle.producto) {
          const cantidad = detalle.cantidad || 0;
          if (cantidad > 0 && grupos.hasOwnProperty(detalle.coleccion)) {
            grupos[detalle.coleccion].push({
              nombre: detalle.producto,
              cantidad: cantidad,
            });
          }
        }
      });

      function buildGrupo(nombreColeccion, items) {
        if (!items.length) return;
        items.sort((a, b) => a.nombre.localeCompare(b.nombre));

        const titulo = nombresColecciones[nombreColeccion] || nombreColeccion;
        const groupDiv = document.createElement("div");
        groupDiv.style.textAlign = "center";
        groupDiv.style.marginBottom = "10px";

        const h3 = document.createElement("h3");
        h3.textContent = titulo;
        h3.style.backgroundColor = "#eee";
        h3.style.padding = "6px";
        h3.style.borderRadius = "4px";
        h3.style.fontSize = "16px";
        groupDiv.appendChild(h3);

        items.forEach((item) => {
          const itemDiv = document.createElement("div");
          itemDiv.style.padding = "6px 0";
          itemDiv.style.fontSize = "18px";
          itemDiv.textContent = `${item.nombre} (${item.cantidad})`;
          groupDiv.appendChild(itemDiv);
        });

        detallesContainer.appendChild(groupDiv);
      }

      coleccionesStock.forEach((col) => buildGrupo(col, grupos[col]));

      const botonesDiv = document.createElement("div");
      botonesDiv.style.display = "flex";
      botonesDiv.style.justifyContent = "space-around";
      botonesDiv.style.flexWrap = "wrap"; // Por si la pantalla es chica
      botonesDiv.style.gap = "12px";
      botonesDiv.style.marginTop = "16px";

      const btnStyle =
        "padding: 10px 14px; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: bold;";

      const btnBorrar = document.createElement("button");
      btnBorrar.textContent = "❌ Borrar";
      btnBorrar.style.cssText = btnStyle + "background-color: #f44336;";
      btnBorrar.onclick = () =>
        borrarPedidoYActualizarStock(data, pedidoDoc.id);
      botonesDiv.appendChild(btnBorrar);

      const btnEntregado = document.createElement("button");
      btnEntregado.textContent = "✅ Entregado";
      btnEntregado.style.cssText = btnStyle + "background-color: #4CAF50;";
      btnEntregado.onclick = () => borrarPedidoSinStock(pedidoDoc.id);
      botonesDiv.appendChild(btnEntregado);

      const btnEditar = document.createElement("button");
      btnEditar.textContent = "✏️ Editar";
      btnEditar.style.cssText = btnStyle + "background-color: #ff9800;";
      btnEditar.onclick = () => {
        window.location.href = `modificacion.html?id=${pedidoDoc.id}`;
      };
      botonesDiv.appendChild(btnEditar);

      const btnPDF = document.createElement("button");
      btnPDF.textContent = "📄 PDF";
      btnPDF.style.cssText = btnStyle + "background-color: #2196F3;";
      btnPDF.onclick = () => window.generarPDF(pedidoDoc.id);
      botonesDiv.appendChild(btnPDF);

      detallesContainer.appendChild(botonesDiv);
    })();

    container.appendChild(detallesContainer);
  } else {
    const productosPedidos = data.productos || {};
    let totalUnidades = 0;
    Object.values(productosPedidos).forEach((detalle) => {
      totalUnidades += detalle.cantidad || 0;
    });

    const resumen = document.createElement("div");
    resumen.style.textAlign = "center";
    resumen.style.fontSize = "16px";
    resumen.style.marginTop = "8px";
    resumen.style.color = "#666";
    resumen.textContent = `${totalUnidades} artículos`;
    container.appendChild(resumen);
  }

  return container;
}

// -------------------------------------------------------------------
// ## NUEVA FUNCIÓN: Generar PDF Acumulado
// -------------------------------------------------------------------

async function generarPDFAcumulado(pedidosFiltradosDocs) {
  if (!pedidosFiltradosDocs || pedidosFiltradosDocs.length === 0) {
    alert("No hay pedidos para generar el resumen.");
    return;
  }

  // 1. Acumular cantidades y nombres de clientes
  const articulosAcumulados = {};

  pedidosFiltradosDocs.forEach((doc) => {
    const data = doc.data();
    const nombreCliente = data.Nombre || "Sin nombre";
    const productosPedidos = data.productos || {};

    Object.values(productosPedidos).forEach((detalle) => {
      if (detalle && detalle.coleccion && detalle.producto) {
        const key = `${detalle.coleccion}::${detalle.producto}`;
        const cantidad = detalle.cantidad || 0;

        if (cantidad > 0) {
          if (!articulosAcumulados[key]) {
            articulosAcumulados[key] = {
              coleccion: detalle.coleccion,
              producto: detalle.producto,
              cantidad: 0,
              clientes: [], // Guardaremos los nombres de los clientes aquí
            };
          }
          articulosAcumulados[key].cantidad += cantidad;
          // Guardamos el cliente y cuánto pidió de este producto específico
          articulosAcumulados[key].clientes.push(
            `${nombreCliente} (${cantidad})`,
          );
        }
      }
    });
  });

  if (Object.keys(articulosAcumulados).length === 0) {
    alert(
      "No se encontraron artículos con las cantidades en los pedidos filtrados.",
    );
    return;
  }

  // 2. Clasificar los artículos acumulados por grupo de stock
  const gruposAcumulados = {};
  coleccionesStock.forEach((col) => (gruposAcumulados[col] = []));

  Object.values(articulosAcumulados).forEach((item) => {
    if (gruposAcumulados.hasOwnProperty(item.coleccion)) {
      gruposAcumulados[item.coleccion].push(item);
    }
  });

  // 3. Generar el PDF
  const { jsPDF } = window.jspdf;
  const docPDF = new jsPDF({ format: "a4", unit: "mm" });

  // 🔹 Cargar IDs de productos (FALTABA ESTO)
  const idsSnap = await getDoc(doc(db, "idProductos", "idProducto"));
  const idsData = idsSnap.exists() ? idsSnap.data() : {};

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = reject;
    });

  try {
    const logoImg = await loadImage("images/Grido_logo.png");

    await drawResumenPDF(
      docPDF,
      logoImg,
      gruposAcumulados,
      pedidosFiltradosDocs.length,
      idsData,
    );

    const nombreArchivo = filtroFecha
      ? `Resumen_Pedidos_${filtroFecha}.pdf`
      : `Resumen_Pedidos_Acumulado.pdf`;

    docPDF.save(nombreArchivo);
    alert("Resumen Acumulado de Artículos generado.");
  } catch (error) {
    console.error("Error generando PDF:", error);
    alert("Error al cargar el logo o generar el PDF.");
  }
}

// -------------------------------------------------------------------
// ## FUNCIÓN: Dibujar el PDF de Resumen
// -------------------------------------------------------------------
async function drawResumenPDF(
  docPDF,
  logoImg,
  gruposAcumulados,
  numPedidos,
  idsData,
) {
  const marginLeft = 10;
  const pageWidth = docPDF.internal.pageSize.getWidth();
  let y = 10;
  const maxY = 275;

  // --- ENCABEZADO ---
  docPDF.addImage(logoImg, "PNG", marginLeft, y, 30, 12);
  docPDF.setFont("helvetica", "bold");
  docPDF.setFontSize(16);
  docPDF.text("RESUMEN DE PRODUCTOS POR CLIENTE", pageWidth - 10, y + 8, {
    align: "right",
  });
  y += 20;

  docPDF.setFont("helvetica", "normal");
  docPDF.setFontSize(10);
  const filtrosAplicados = [];
  if (filtroFecha) filtrosAplicados.push(`Fecha: ${filtroFecha}`);
  if (filtroNombre) filtrosAplicados.push(`Cliente: ${filtroNombre}`);
  if (filtroCategoria !== "Todos")
    filtrosAplicados.push(`Cat: ${filtroCategoria}`);
  if (filtroLocalidad) filtrosAplicados.push(`Loc: ${filtroLocalidad}`);

  docPDF.text(`Pedidos analizados: ${numPedidos}`, marginLeft, y);
  y += 5;
  docPDF.text(
    `Filtros: ${
      filtrosAplicados.length > 0 ? filtrosAplicados.join(" | ") : "Ninguno"
    }`,
    marginLeft,
    y,
  );
  y += 8;

  // Encabezados de tabla
  docPDF.setLineWidth(0.4);
  docPDF.line(marginLeft, y, pageWidth - marginLeft, y);
  y += 5;
  docPDF.setFont("helvetica", "bold");
  docPDF.text("CANT.", 13, y);
  docPDF.text("PRODUCTO / CLIENTES QUE PIDIERON", 40, y);
  docPDF.text("COLECCIÓN", pageWidth - 40, y);
  y += 4;
  docPDF.line(marginLeft, y, pageWidth - marginLeft, y);
  y += 6;

  let totalGeneralUnidades = 0;

  // Iterar sobre colecciones
  coleccionesStock.forEach((col) => {
    const items = gruposAcumulados[col];
    if (!items || items.length === 0) return;

    items.sort((a, b) => a.producto.localeCompare(b.producto));

    // Título de la Colección
    if (y > maxY - 10) {
      docPDF.addPage();
      y = 20;
    }
    docPDF.setFont("helvetica", "bold");
    docPDF.setFillColor(245, 245, 245);
    docPDF.rect(marginLeft, y - 4, pageWidth - marginLeft * 2, 6, "F");
    docPDF.text(nombresColecciones[col] || col, marginLeft + 2, y);
    y += 8;

    items.forEach((item) => {
      totalGeneralUnidades += item.cantidad;

      // Verificar espacio antes del producto
      if (y > maxY - 10) {
        docPDF.addPage();
        y = 20;
      }

      // Dibujar Producto y Cantidad Total
      docPDF.setFont("helvetica", "bold");
      docPDF.setFontSize(10);
      docPDF.text(item.cantidad.toString(), 13, y);

      const idProducto = idsData[item.producto] || "SIN-ID";

      // ID normal
      docPDF.setFont("helvetica", "normal");
      docPDF.text(` - ${idProducto} - `, 18, y);

      // Producto en negrita
      docPDF.setFont("helvetica", "bold");
      docPDF.text(
        item.producto.toUpperCase(),
        18 + docPDF.getTextWidth(` - ${idProducto} - `),
        y,
      );

      y += 5;

      // --- CAMBIO AQUÍ: Lista de Clientes en Horizontal ---
      docPDF.setFont("helvetica", "italic");
      docPDF.setFontSize(9);
      docPDF.setTextColor(70, 70, 70);

      // Unimos los clientes con un guion y usamos splitTextToSize para que no se salgan de la hoja
      const listaClientesHorizontal = item.clientes.join(" - ");
      const lineasTexto = docPDF.splitTextToSize(
        listaClientesHorizontal,
        pageWidth - 55,
      );

      docPDF.text(lineasTexto, 45, y);

      // Calculamos cuánto espacio ocupó el bloque de texto horizontal para ajustar la 'y'
      y += lineasTexto.length * 4.5 + 2;

      docPDF.setTextColor(0, 0, 0); // Reset a negro
      y += 1; // Espacio entre bloques de productos
    });
    y += 2;
  });

  // --- TOTAL FINAL ---
  y += 5;
  if (y > maxY) {
    docPDF.addPage();
    y = 20;
  }
  docPDF.setFont("helvetica", "bold");
  docPDF.setFontSize(13);
  docPDF.text(
    `TOTAL GENERAL DE UNIDADES: ${totalGeneralUnidades}`,
    pageWidth - 10,
    y,
    { align: "right" },
  );
}
