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
  resumenBtnContainer.style.cssText =
    "margin: 20px 0; text-align: center; display: flex; flex-direction: column; gap: 10px;";

  // 🔶 BOTÓN RESUMEN GENERAL
  const btnResumen = document.createElement("button");
  btnResumen.textContent = `📝 GENERAR RESUMEN ACUMULADO (${pedidosFiltradosFinales.length})`;
  btnResumen.style.cssText =
    "background-color: #ff9800; color: white; padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;";

  btnResumen.onclick = () => generarPDFAcumulado(pedidosFiltradosFinales);

  // 🔵 BOTÓN SOLO REMITOS
  const btnRemitos = document.createElement("button");
  btnRemitos.textContent = "📄 PDF REMITOS FILTRADOS";
  btnRemitos.style.cssText =
    "background:#2196f3;color:white;padding:12px;border:none;border-radius:8px;font-weight:bold;";
  btnRemitos.onclick = () =>
    generarPDFRemitosFiltrados(pedidosFiltradosFinales);

  resumenBtnContainer.appendChild(btnRemitos);

  resumenBtnContainer.appendChild(btnResumen);
  resumenBtnContainer.appendChild(btnRemitos);
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

  // 📥 (Se mantiene por compatibilidad futura)
  const preciosSnap = await getDoc(doc(db, "Precios", "Precio"));
  const preciosData = preciosSnap.exists() ? preciosSnap.data() : {};

  // 🆔 🔹 LEER IDs DE PRODUCTOS (UNA SOLA VEZ)
  const idProductosSnap = await getDoc(doc(db, "idProductos", "idProducto"));
  const idProductosData = idProductosSnap.exists()
    ? idProductosSnap.data()
    : {};

  const productos = pedidoData.productos || {};
  const productosMap = {};
  let total = 0;

  // 🔁 MISMO cálculo que el PDF
  for (const detalle of Object.values(productos)) {
    if (!detalle || !detalle.producto) continue;

    const cantidad = Number(detalle.cantidad || 0);
    const precioUnitario = Number(detalle.precio || 0);

    if (cantidad > 0) {
      total += cantidad * precioUnitario;

      // 🔹 Obtener ID desde el documento idProductos/idProducto
      const idProducto = idProductosData[detalle.producto] || null;

      productosMap[detalle.producto] = {
        cantidad,
        precio: precioUnitario,
        id: idProducto,
      };
    }
  }

  // 💾 Guardar venta
  await setDoc(ventaRef, {
    fechaEntrega: pedidoData.fechaEntrega || "",
    cliente: pedidoData.Nombre || "", // Mantengo el nombre original del campo
    Localidad: pedidoData.Localidad || "",
    direccion: pedidoData.Direccion || "", // Mantengo el nombre original del campo
    tipoDocumento: pedidoData.categoria || "", // Mantengo el nombre original del campo
    NumeroRemito: pedidoData.NumeroRemito || "",
    total: Number(total.toFixed(2)), // EXACTAMENTE el mismo número del PDF
    productos: productosMap,
    Vendedor: pedidoData.Vendedor || "", // Campo agregado: Vendedor del pedido
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

window.generarPDFRemitos = function (pedidos) {
  if (!pedidos.length) {
    alert("No hay remitos para generar.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const docPDF = new jsPDF({ unit: "mm", format: "a4" });

  let y = 15;

  docPDF.setFontSize(16);
  docPDF.text("Resumen de Remitos", 105, y, { align: "center" });
  y += 8;

  docPDF.setFontSize(10);
  docPDF.text(`Generado: ${new Date().toLocaleDateString("es-AR")}`, 105, y, {
    align: "center",
  });
  y += 10;

  const filas = [];

  pedidos.forEach((pedidoDoc) => {
    const data = pedidoDoc.data();
    const productos = data.productos || {};

    Object.values(productos).forEach((detalle) => {
      if (!detalle || !detalle.producto || !detalle.cantidad) return;

      filas.push([
        data.fechaEntrega || "",
        data.Nombre || "",
        data.NumeroRemito || "",
        detalle.producto,
        detalle.cantidad,
      ]);
    });
  });

  if (!filas.length) {
    alert("Los remitos no tienen productos.");
    return;
  }

  docPDF.autoTable({
    startY: y,
    head: [["Fecha", "Cliente", "Remito", "Producto", "Cantidad"]],
    body: filas,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [33, 150, 243] },
  });

  docPDF.save(`Remitos_${new Date().toISOString().slice(0, 10)}.pdf`);
};

async function generarPDFRemitosFiltrados(pedidosFiltradosDocs) {
  if (!pedidosFiltradosDocs || pedidosFiltradosDocs.length === 0) {
    alert("No hay pedidos para generar remitos.");
    return;
  }

  // 🔹 NUEVO: Pre-cargar el stock actual de TODAS las colecciones
  const stockSnaps = await Promise.all(
    coleccionesStock.map((col) => getDoc(doc(db, col, "Stock"))),
  );
  const stocksData = {};
  stockSnaps.forEach((snap, index) => {
    stocksData[coleccionesStock[index]] = snap.data() || {};
  });

  // 🔹 NUEVO: Verificar conflictos de stock en todos los pedidos filtrados
  const conflictos = [];
  pedidosFiltradosDocs.forEach((pedidoDoc) => {
    const data = pedidoDoc.data();
    const nombreCliente = data.Nombre || "Sin nombre";
    const productosPedidos = data.productos || {};
    const articulosSinStock = [];

    Object.values(productosPedidos).forEach((detalle) => {
      if (detalle && detalle.coleccion && detalle.producto) {
        const stockActual =
          stocksData[detalle.coleccion]?.[detalle.producto] || 0;
        if (stockActual <= 0) {
          articulosSinStock.push(detalle.producto);
        }
      }
    });

    if (articulosSinStock.length > 0) {
      conflictos.push({
        cliente: nombreCliente,
        articulos: articulosSinStock,
        pedidoId: pedidoDoc.id,
      });
    }
  });

  if (conflictos.length > 0) {
    mostrarModalAdvertenciaStockFiltrados(conflictos);
    return; // No proceder con la generación del PDF
  }

  // 🔹 Continuar con la lógica original si no hay conflictos
  const { jsPDF } = window.jspdf;
  const docPDF = new jsPDF({ format: "legal", unit: "mm" });

  // 🔹 cargar IDs
  const idsSnap = await getDoc(doc(db, "idProductos", "idProducto"));
  const idsData = idsSnap.exists() ? idsSnap.data() : {};

  // 🔹 precios
  const preciosSnap = await getDoc(doc(db, "Precios", "Precio"));
  const preciosData = preciosSnap.exists() ? preciosSnap.data() : {};

  // 🔹 logo (empresa por defecto)
  const loadImage = (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });

  const empresaData = EMPRESAS["FROSTCARGO"]; // default
  let logoImg = await loadImage(empresaData.logo);
  if (!logoImg) logoImg = await loadImage("images/Grido_logo.png");

  let primeraPagina = true;

  for (const pedidoDoc of pedidosFiltradosDocs) {
    const data = pedidoDoc.data();
    const productosPedidos = data.productos || {};

    // 🔹 agrupar productos como ya usás
    const grupos = {};
    coleccionesStock.forEach((c) => (grupos[c] = []));

    Object.values(productosPedidos).forEach((detalle) => {
      if (detalle?.coleccion && detalle?.producto && detalle.cantidad > 0) {
        grupos[detalle.coleccion].push(detalle.producto);
      }
    });

    const options = {
      data,
      preciosData,
      grupos,
      productosPedidos,
      ocultarPrecios: false,
      descuentoPorcentaje: 0,
      descuentoEfectivo: 0,
      descuentoArticulosPorcentaje: 0,
      articulosSeleccionados: [],
      observaciones: "",
      idsData,
      empresaData,
      flete: 0,
    };

    if (!primeraPagina) docPDF.addPage("legal", "portrait");
    primeraPagina = false;

    await drawRemito(docPDF, logoImg, "ORIGINAL", options);
    docPDF.addPage("legal", "portrait");
    await drawRemito(docPDF, logoImg, "DUPLICADO", options);
  }

  docPDF.save(`Remitos_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// =========================================================================
// 💡 FUNCIÓN MODAL DE ADVERTENCIA DE STOCK PARA PEDIDOS FILTRADOS
// =========================================================================

function mostrarModalAdvertenciaStockFiltrados(conflictos) {
  let modal = document.getElementById("advertencia-stock-filtrados-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "advertencia-stock-filtrados-modal";

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
      width: "500px",
      maxHeight: "80vh",
      overflowY: "auto",
      boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
      fontFamily: "Arial, sans-serif",
      textAlign: "center",
    });

    modalContent.innerHTML = `
      <h2 style="color: #f44336;">⚠️ Artículos con Stock Insuficiente en Pedidos Filtrados</h2>
      <p>Los siguientes clientes tienen artículos con stock insuficiente (0 o negativo). Modificá los pedidos antes de generar los remitos:</p>
      <div id="lista-conflictos" style="text-align: left; margin: 20px 0;"></div>
      <button id="btn-cerrar-advertencia-filtrados" style="padding: 10px 20px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
        Cerrar
      </button>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Llenar la lista de conflictos
    const lista = document.getElementById("lista-conflictos");
    conflictos.forEach((conflicto) => {
      const clienteDiv = document.createElement("div");
      clienteDiv.style.marginBottom = "15px";
      clienteDiv.style.padding = "10px";
      clienteDiv.style.border = "1px solid #ddd";
      clienteDiv.style.borderRadius = "5px";

      const clienteTitle = document.createElement("h3");
      clienteTitle.textContent = conflicto.cliente;
      clienteTitle.style.margin = "0 0 10px 0";
      clienteTitle.style.color = "#333";
      clienteDiv.appendChild(clienteTitle);

      const articulosList = document.createElement("ul");
      articulosList.style.paddingLeft = "20px";
      conflicto.articulos.forEach((articulo) => {
        const li = document.createElement("li");
        li.textContent = articulo;
        articulosList.appendChild(li);
      });
      clienteDiv.appendChild(articulosList);

      const btnModificar = document.createElement("button");
      btnModificar.textContent = "✏️ Modificar Pedido";
      btnModificar.style.cssText =
        "padding: 8px 15px; background-color: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 10px;";
      btnModificar.onclick = () => {
        window.location.href = `modificacion.html?id=${conflicto.pedidoId}`;
      };
      clienteDiv.appendChild(btnModificar);

      lista.appendChild(clienteDiv);
    });

    // Evento para cerrar
    document.getElementById("btn-cerrar-advertencia-filtrados").onclick =
      () => {
        modal.style.display = "none";
      };

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  } else {
    // Si el modal ya existe, actualizar la lista y mostrar
    const lista = document.getElementById("lista-conflictos");
    lista.innerHTML = "";
    conflictos.forEach((conflicto) => {
      const clienteDiv = document.createElement("div");
      clienteDiv.style.marginBottom = "15px";
      clienteDiv.style.padding = "10px";
      clienteDiv.style.border = "1px solid #ddd";
      clienteDiv.style.borderRadius = "5px";

      const clienteTitle = document.createElement("h3");
      clienteTitle.textContent = conflicto.cliente;
      clienteTitle.style.margin = "0 0 10px 0";
      clienteTitle.style.color = "#333";
      clienteDiv.appendChild(clienteTitle);

      const articulosList = document.createElement("ul");
      articulosList.style.paddingLeft = "20px";
      conflicto.articulos.forEach((articulo) => {
        const li = document.createElement("li");
        li.textContent = articulo;
        articulosList.appendChild(li);
      });
      clienteDiv.appendChild(articulosList);

      const btnModificar = document.createElement("button");
      btnModificar.textContent = "✏️ Modificar Pedido";
      btnModificar.style.cssText =
        "padding: 8px 15px; background-color: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 10px;";
      btnModificar.onclick = () => {
        window.location.href = `modificacion.html?id=${conflicto.pedidoId}`;
      };
      clienteDiv.appendChild(btnModificar);

      lista.appendChild(clienteDiv);
    });
    modal.style.display = "flex";
  }
}

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

    const data = pedidoSnap.data();

    // 🔹 NUEVO: Pre-cargar el stock actual de TODAS las colecciones
    const stockSnaps = await Promise.all(
      coleccionesStock.map((col) => getDoc(doc(db, col, "Stock"))),
    );
    const stocksData = {};
    stockSnaps.forEach((snap, index) => {
      stocksData[coleccionesStock[index]] = snap.data() || {};
    });

    // 🔹 NUEVO: Verificar si algún artículo tiene stock <= 0
    const productosPedidos = data.productos || {};
    const articulosStockCero = [];
    const articulosStockNegativo = [];

    Object.values(productosPedidos).forEach((detalle) => {
      if (detalle && detalle.coleccion && detalle.producto) {
        const stockActual =
          stocksData[detalle.coleccion]?.[detalle.producto] ?? 0;

        if (stockActual < 0) {
          articulosStockNegativo.push(detalle.producto);
        } else if (stockActual === 0) {
          articulosStockCero.push(detalle.producto);
        }
      }
    });

    // 🔴 Si hay stock negativo → bloquear
    if (articulosStockNegativo.length > 0) {
      mostrarModalStockNegativo(articulosStockNegativo, pedidoId);
      return;
    }

    // 🟡 Si hay stock 0 → advertir pero permitir continuar
    if (articulosStockCero.length > 0) {
      await mostrarModalStockCero(articulosStockCero);
    }

    function mostrarModalStockNegativo(articulos, pedidoId) {
      let modal = document.createElement("div");

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
        width: "400px",
        maxHeight: "80vh",
        overflowY: "auto",
        boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
      });

      modalContent.innerHTML = `
    <h2 style="color:#f44336;">⛔ Stock Negativo Detectado</h2>
    <p>No se puede generar el PDF.</p>
    <ul style="text-align:left; margin:20px 0; padding-left:20px;">
      ${articulos.map((a) => `<li>${a}</li>`).join("")}
    </ul>
    <button id="btn-ir-editar" style="
      padding:10px 20px;
      background:#f44336;
      color:white;
      border:none;
      border-radius:4px;
      cursor:pointer;
      font-weight:bold;">
      ✏️ Modificar Pedido
    </button>
  `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      document.getElementById("btn-ir-editar").onclick = () => {
        window.location.href = `modificacion.html?id=${pedidoId}`;
      };

      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.remove();
      });
    }

    function mostrarModalStockCero(articulos) {
      return new Promise((resolve) => {
        let modal = document.createElement("div");

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
          width: "400px",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        });

        modalContent.innerHTML = `
      <h2 style="color:#ff9800;">⚠️ Stock en 0</h2>
      <p>Los siguientes artículos tienen stock 0:</p>
      <ul style="text-align:left; margin:20px 0; padding-left:20px;">
        ${articulos.map((a) => `<li>${a}</li>`).join("")}
      </ul>
      <div style="display:flex; justify-content:space-around;">
        <button id="btn-continuar" style="
          padding:10px 20px;
          background:#4CAF50;
          color:white;
          border:none;
          border-radius:4px;
          cursor:pointer;
          font-weight:bold;">
          📄 Generar Igual
        </button>

        <button id="btn-cancelar" style="
          padding:10px 20px;
          background:#2196f3;
          color:white;
          border:none;
          border-radius:4px;
          cursor:pointer;
          font-weight:bold;">
          Cancelar
        </button>
      </div>
    `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        document.getElementById("btn-continuar").onclick = () => {
          modal.remove();
          resolve();
        };

        document.getElementById("btn-cancelar").onclick = () => {
          modal.remove();
        };

        modal.addEventListener("click", (e) => {
          if (e.target === modal) modal.remove();
        });
      });
    }

    // NEW: seleccionar la colección de precios según data.categoria
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
// 💡 FUNCIÓN MODAL DE ADVERTENCIA DE STOCK
// =========================================================================

function mostrarModalAdvertenciaStock(articulosSinStock, pedidoId) {
  let modal = document.getElementById("advertencia-stock-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "advertencia-stock-modal";

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
      width: "400px",
      maxHeight: "80vh",
      overflowY: "auto",
      boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
      fontFamily: "Arial, sans-serif",
      textAlign: "center",
    });

    modalContent.innerHTML = `
      <h2 style="color: #f44336;">⚠️ Artículos con Stock Insuficiente</h2>
      <p>Los siguientes artículos tienen stock insuficiente (0 o negativo) y no se puede generar el PDF:</p>
      <ul id="lista-articulos-sin-stock" style="text-align: left; margin: 20px 0; padding-left: 20px;"></ul>
      <p>Modificá el pedido para corregir el stock antes de generar el PDF.</p>
      <div style="display: flex; justify-content: space-around; margin-top: 20px;">
        <button id="btn-modificar-pedido" style="padding: 10px 20px; background-color: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          ✏️ Modificar Pedido
        </button>
        <button id="btn-cerrar-advertencia" style="padding: 10px 20px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          Cerrar
        </button>
      </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Llenar la lista de artículos
    const lista = document.getElementById("lista-articulos-sin-stock");
    articulosSinStock.forEach((articulo) => {
      const li = document.createElement("li");
      li.textContent = articulo;
      lista.appendChild(li);
    });

    // Eventos de botones
    document.getElementById("btn-modificar-pedido").onclick = () => {
      window.location.href = `modificacion.html?id=${pedidoId}`;
    };

    document.getElementById("btn-cerrar-advertencia").onclick = () => {
      modal.style.display = "none";
    };

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  } else {
    // Si el modal ya existe, actualizar la lista y mostrar
    const lista = document.getElementById("lista-articulos-sin-stock");
    lista.innerHTML = "";
    articulosSinStock.forEach((articulo) => {
      const li = document.createElement("li");
      li.textContent = articulo;
      lista.appendChild(li);
    });
    modal.style.display = "flex";
  }
}

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

      <div style="margin-bottom: 15px;">
        <label style="font-weight:bold; display:block; margin-bottom:5px;">
          Descuento por artículo
        </label>

        <div id="articulos-descuento"
           style="border:1px solid #ccc; border-radius:4px;
                  padding:8px; max-height:150px; overflow-y:auto;">
        </div>

        <label style="display:block; margin-top:10px; font-weight:bold;">
          Porcentaje de descuento por artículo
        </label>

        <input type="number" id="descuento-articulos-input"
          min="0" step="0.01"
          placeholder="Ej: 10"
          style="width:100%; margin-top:6px; padding:8px;
                 border:1px solid #ccc; border-radius:4px;">
      </div>

      <button id="generar-remito-final" style="width: 100%; padding: 10px; background-color: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Generar PDF
      </button>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

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
        parseFloat(document.getElementById("porcentaje-input").value) || 0;

      const descuentoEfectivo =
        parseFloat(document.getElementById("efectivo-input").value) || 0;

      const observaciones = document
        .getElementById("observaciones-input")
        .value.trim();

      const descuentoArticulosPorcentaje =
        parseFloat(
          document.getElementById("descuento-articulos-input").value,
        ) || 0;

      const modalContent = document.querySelector(
        "#configuracion-remito-modal > div",
      );

      const articulosSeleccionados = Array.from(
        modalContent.querySelectorAll(
          "#articulos-descuento input[type='checkbox']:checked",
        ),
      ).map((chk) => chk.value);

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
        empresaData,
        descuentoArticulosPorcentaje,
        articulosSeleccionados,
      });
    };

    // 👈 AGREGA AQUÍ (después de appendChild, para la creación inicial):
    document.getElementById("observaciones-input").value =
      data.Observaciones || "";

    cargarArticulosDescuento(productosPedidos);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  } else {
    // Resetear campos para reutilización
    document.getElementById("ocultar-precios-check").checked = false;
    document.getElementById("porcentaje-input").value = "";
    document.getElementById("efectivo-input").value = "";
    document.getElementById("observaciones-input").value = "";
    document.getElementById("descuento-articulos-input").value = "";
    cargarArticulosDescuento(productosPedidos);

    // 👈 AGREGA AQUÍ (después de cargarArticulosDescuento, para reutilización):
    document.getElementById("observaciones-input").value =
      data.Observaciones || "";

    modal.style.display = "flex";
  }

  // ... (resto de la función, sin cambios)
}

function cargarArticulosDescuento(productosPedidos) {
  const contenedor = document.getElementById("articulos-descuento");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  const articulosOrdenados = Object.values(productosPedidos)
    .filter((d) => d?.producto && d.cantidad > 0)
    .map((d) => d.producto)
    .sort((a, b) => a.localeCompare(b, "es"));

  articulosOrdenados.forEach((producto) => {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "8px";
    label.style.marginBottom = "4px";
    label.style.cursor = "pointer";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = producto;

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(producto));
    contenedor.appendChild(label);
  });
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
    descuentoArticulosPorcentaje = 0,
    articulosSeleccionados = [],
    observaciones,
    flete = 0,
    idsData,
    empresaData,
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
  docPDF.text(`NOTA DE PEDIDO - COPIA ${tipoCopia}`, pageWidth - 10, y, {
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
    const rowSpacing = 8;
    const maxY = 280;

    items.forEach((prod) => {
      const pedidoKey = `${nombreColeccion}::${prod}`;
      const detalle = productosPedidos[pedidoKey] || {};
      const cantidad = detalle.cantidad || 0;
      const total = cantidad;
      if (total === 0) return;

      totalGrupo += total;

      let precioUnitario = preciosData[prod] ?? 0;

      // 🔥 DESCUENTO SOLO A LOS ARTÍCULOS SELECCIONADOS
      if (
        descuentoArticulosPorcentaje > 0 &&
        articulosSeleccionados.includes(prod)
      ) {
        precioUnitario *= 1 - descuentoArticulosPorcentaje / 100;
      }

      const precioTotal = total * precioUnitario;
      subtotal += precioTotal;
      const idProducto = idsData[prod] || "SIN-ID";

      // Cantidad en negrita
      docPDF.setFont("helvetica", "bold");
      docPDF.setFontSize(11);
      docPDF.text(total.toString(), 13, y);

      // ID + Producto en normal
      docPDF.setFont("helvetica", "normal");
      docPDF.text(`-  ${prod.charAt(0).toUpperCase() + prod.slice(1)}`, 18, y);

      if (
        descuentoArticulosPorcentaje > 0 &&
        articulosSeleccionados.includes(prod)
      ) {
        docPDF.setFont("helvetica", "italic");
        docPDF.setFontSize(8);
        docPDF.setTextColor(120); // gris suave

        docPDF.text(
          `tiene ${descuentoArticulosPorcentaje}% de descuento`,
          22,
          y + 4,
        );

        docPDF.setTextColor(0);
      }

      if (!ocultarPrecios) {
        // 🔒 asegurar tamaño normal del precio
        docPDF.setFont("helvetica", "normal");
        docPDF.setFontSize(11);

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
  const pageHeight = docPDF.internal.pageSize.getHeight();
  const footerY = pageHeight - 25; // margen inferior seguro

  docPDF.setFont("helvetica", "normal");
  docPDF.setFontSize(8);

  docPDF.text("Recibí(mos) Conforme", 10, footerY);
  docPDF.text("Firma: ____________________", pageWidth - 70, footerY);
  docPDF.text("Aclaración: ________________", pageWidth - 70, footerY + 5);

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
  descuentoArticulosPorcentaje,
  articulosSeleccionados,
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
      descuentoArticulosPorcentaje,
      articulosSeleccionados,
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

      // Verificar si existe el campo "Observaciones" y mostrarlo si es así
      if (data.Observaciones) {
        const obsDiv = document.createElement("div");
        obsDiv.style.marginTop = "12px";
        obsDiv.style.padding = "8px";
        obsDiv.style.backgroundColor = "#ffc400"; // Color de fondo amarillo claro para destacar
        obsDiv.style.border = "1px solid #ecb100"; // Borde sutil
        obsDiv.style.borderRadius = "4px";
        obsDiv.style.fontSize = "16px";
        obsDiv.innerHTML = `<strong>Observaciones:</strong> ${data.Observaciones}`;
        detallesContainer.appendChild(obsDiv);
      }

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

  // Crear el contenedor del modal si no existe
  let modal = document.getElementById("modalSeleccionPedidos");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modalSeleccionPedidos";
    modal.style = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); display: flex; justify-content: center;
      align-items: center; z-index: 9999; font-family: sans-serif;
    `;
    document.body.appendChild(modal);
  }

  // Contenido del modal
  modal.innerHTML = `
    <div style="background: white; padding: 20px; border-radius: 8px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <h3 style="margin-top: 0;">Seleccionar Pedidos para el PDF</h3>
      <div style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
        <input type="checkbox" id="selectAllPedidos" checked> 
        <label for="selectAllPedidos"><strong>Seleccionar Todos</strong></label>
      </div>
      <div id="listaCheckboxes">
        ${pedidosFiltradosDocs.map((doc, index) => {
          const data = doc.data();
          const nombre = data.Nombre || "Sin nombre";
          const fecha = data.fecha || ""; 
          return `
            <div style="margin: 5px 0;">
              <input type="checkbox" class="pedido-check" value="${index}" checked id="p-${index}">
              <label for="p-2${index}">${nombre} <span style="color: #666; font-size: 0.85em;">${fecha}</span></label>
            </div>
          `;
        }).join('')}
      </div>
      <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
        <button id="btnCancelarModal" style="padding: 8px 15px; cursor: pointer;">Cancelar</button>
        <button id="btnConfirmarPDF" style="padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Generar PDF</button>
      </div>
    </div>
  `;

  // --- Lógica del Modal ---
  const selectAll = document.getElementById("selectAllPedidos");
  const checks = document.querySelectorAll(".pedido-check");

  // Switch de "Seleccionar todos"
  selectAll.addEventListener("change", (e) => {
    checks.forEach(cb => cb.checked = e.target.checked);
  });

  // Cerrar modal
  document.getElementById("btnCancelarModal").onclick = () => modal.remove();

  // Botón Confirmar
  document.getElementById("btnConfirmarPDF").onclick = async () => {
    const seleccionadosIdx = Array.from(checks)
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.value));

    if (seleccionadosIdx.length === 0) {
      alert("Debes seleccionar al menos un pedido.");
      return;
    }

    const pedidosSeleccionados = seleccionadosIdx.map(idx => pedidosFiltradosDocs[idx]);
    modal.remove(); // Cerramos el modal
    
    // Llamamos a la lógica real de procesamiento con los filtrados por el usuario
    await procesarYDescargarPDF(pedidosSeleccionados);
  };
}

async function procesarYDescargarPDF(pedidosFinales) {
  // 1. Acumular cantidades (Tu lógica original intacta)
  const articulosAcumulados = {};

  pedidosFinales.forEach((doc) => {
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
              clientes: [],
            };
          }
          articulosAcumulados[key].cantidad += cantidad;
          articulosAcumulados[key].clientes.push(`${nombreCliente} (${cantidad})`);
        }
      }
    });
  });

  // --- El resto de tu código original (Verificación de stock, IDs, jsPDF) ---
  // [AQUÍ VA TODO EL BLOQUE QUE TENÍAS DESDE LA CARGA DE STOCK HASTA EL PDF.SAVE]
  
  // 🔹 NUEVO: Pre-cargar el stock actual de TODAS las colecciones
  const stockSnaps = await Promise.all(
    coleccionesStock.map((col) => getDoc(doc(db, col, "Stock"))),
  );
  const stocksData = {};
  stockSnaps.forEach((snap, index) => {
    stocksData[coleccionesStock[index]] = snap.data() || {};
  });

  Object.values(articulosAcumulados).forEach((item) => {
    const stockActual = stocksData[item.coleccion]?.[item.producto] || 0;    
    if (stockActual < 0) { // <--- Cambiado de <= a <
      item.coleccion = "ARTICULOS CON STOCK NEGATIVO"; 
    }
  });

  const gruposAcumulados = {};
  coleccionesStock.forEach((col) => (gruposAcumulados[col] = []));
  gruposAcumulados["ARTICULOS CON STOCK NEGATIVO"] = [];

  Object.values(articulosAcumulados).forEach((item) => {
    if (gruposAcumulados.hasOwnProperty(item.coleccion)) {
      gruposAcumulados[item.coleccion].push(item);
    }
  });

  // Generar el PDF
  const { jsPDF } = window.jspdf;
  const docPDF = new jsPDF({ format: "a4", unit: "mm" });
  const idsSnap = await getDoc(doc(db, "idProductos", "idProducto"));
  const idsData = idsSnap.exists() ? idsSnap.data() : {};

  // Función interna para cargar imagen
  const loadImage = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = reject;
  });

  try {
    const logoImg = await loadImage("images/Grido_logo.png");
    await drawResumenPDF(docPDF, logoImg, gruposAcumulados, pedidosFinales.length, idsData);
    const nombreArchivo = `Resumen_Pedidos_${filtroFecha || 'Seleccion'}.pdf`;
    docPDF.save(nombreArchivo);
  } catch (error) {
    console.error("Error:", error);
    alert("Error al generar el PDF.");
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

  // 🔹 CAMBIO: Iterar sobre todas las claves de gruposAcumulados (incluyendo la nueva categoría)
  Object.keys(gruposAcumulados).forEach((col) => {
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

      // --- Lista de Clientes en Horizontal ---
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
  y += 10;
  if (y > maxY - 20) { // Verificamos si hay espacio para el total y las firmas
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

  // --- SECCIÓN DE FIRMAS ---
  y += 30; // Espacio para que puedan firmar arriba de la línea

  // Si después del total el espacio es muy reducido, saltamos de página para las firmas
  if (y > maxY) {
    docPDF.addPage();
    y = 40; 
  }

  const anchoFirma = 60;
  const centroIzquierda = (pageWidth / 4) - (anchoFirma / 2);
  const centroDerecha = (3 * pageWidth / 4) - (anchoFirma / 2);

  docPDF.setLineWidth(0.5);
  docPDF.setFontSize(10);
  docPDF.setFont("helvetica", "bold");

  // Firma 1: RECEPCIONÓ
  docPDF.line(centroIzquierda, y, centroIzquierda + anchoFirma, y); // Línea
  docPDF.text("RECEPCIONÓ", centroIzquierda + (anchoFirma / 2), y + 5, { align: "center" });

  // Firma 2: RECIBIÓ
  docPDF.line(centroDerecha, y, centroDerecha + anchoFirma, y); // Línea
  docPDF.text("RECIBIÓ", centroDerecha + (anchoFirma / 2), y + 5, { align: "center" });
}


