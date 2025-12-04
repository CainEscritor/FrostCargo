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

const pedidosContainer = document.getElementById("pedidosContainer");
const nombreInput = document.getElementById("nombreInput");
const fechaInput = document.getElementById("fechaInput");
const categoriaSelect = document.getElementById("categoriaSelect");
const localidadInput = document.getElementById("localidadInput");

let filtroNombre = "";
let filtroFecha = "";
let filtroCategoria = "Todos";
let filtroLocalidad = "";
let pedidoAbiertoId = null;

// ---------- CONSTANTES DE COLECCIONES ----------
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

// 💡 Función de normalización para búsquedas sin acentos/mayúsculas
function normalizar(str = "") {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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

// -------------------------------------------------------------------
// ## Borrar Pedido y Actualizar Stock 
// -------------------------------------------------------------------

async function borrarPedidoYActualizarStock(pedidoData, docId) {
  if (
    !confirm(
      "¿Seguro que querés borrar el pedido? Todos los artículos volverán al stock."
    )
  )
    return;

  try {
    // 1. Pre-cargar el stock actual de TODAS las colecciones
    const stockSnaps = await Promise.all(
      coleccionesStock.map(col => getDoc(doc(db, col, "Stock")))
    );
    const stocksData = {};
    stockSnaps.forEach((snap, index) => {
      stocksData[coleccionesStock[index]] = snap.data() || {};
    });

    // 2. Procesar los productos del pedido para preparar las actualizaciones
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
          }

          // Sumar la cantidad devuelta al stock
          updatesPorColeccion[coleccion][producto] = stockActual + cantidad;
        }
      }
    }
    
    // 3. Ejecutar las actualizaciones de stock en Firebase
    const updatePromises = [];
    for (const [col, updates] of Object.entries(updatesPorColeccion)) {
      if (Object.keys(updates).length > 0) {
        const ref = doc(db, col, "Stock");
        // Usamos setDoc con merge para actualizar solo los campos modificados
        updatePromises.push(setDoc(ref, updates, { merge: true }));
      }
    }
    
    await Promise.all(updatePromises);

    // 4. Borrar el pedido
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
    await deleteDoc(doc(db, "Pedidos", docId));
    pedidoAbiertoId = null;
    alert("Pedido marcado como entregado.");
  } catch (e) {
    alert("Error al borrar el pedido: " + e);
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
    if (!pedidoSnap.exists()) {
      alert("Pedido no encontrado ❌");
      return;
    }

    const data = pedidoSnap.data();
    
    // NEW: seleccionar la colección de precios según data.categoria
    function coleccionPreciosParaCategoria(categoria) {
      if (!categoria) return "PreciosExpress";
      const c = categoria.toString().toLowerCase().trim();

      const mapa = {
        "express": "PreciosExpress",
        "store": "PreciosStore",
        "gastronómico": "PreciosGastronomico",
        "gastronomico": "PreciosGastronomico",
        "franquicia": "PreciosFranquicia",
        "supermercados": "PreciosSupermercados",
        "supermercado": "PreciosSupermercados",
        "otro": "PreciosExpress",
        "remito": "PreciosExpress", // Asumiendo default para remito/factura
        "factura": "PreciosExpress",
        "ingrese categoría": "PreciosExpress"
      };
      return mapa[c] || "PreciosExpress"; 
    }

    const nombreColeccionPrecios = coleccionPreciosParaCategoria(data.categoria);

    // 1. Obtener referencias y datos necesarios para el PDF
    const preciosSnap = await getDoc(doc(db, "Precios", "Precio"));
    const preciosData = preciosSnap.exists() ? preciosSnap.data() : {};
    
    // 2. Clasificar artículos del pedido
    const productosPedidos = data.productos || {};
    const grupos = {};
    coleccionesStock.forEach(col => grupos[col] = []);

    // Llenar los grupos (ej. grupos["StockCarnicos"] = ["Asado", "Chorizo"])
   Object.keys(productosPedidos).forEach(key => {
      const detalle = productosPedidos[key];
      if (detalle && detalle.coleccion && detalle.producto) {
        const cantidad = detalle.cantidad || 0;
        if (cantidad > 0 && grupos.hasOwnProperty(detalle.coleccion)) {
          grupos[detalle.coleccion].push(detalle.producto);
        }
      }
    });

    // 3. Mostrar el modal de configuración
     mostrarModalRemito({
      pedidoId,
      data,
      preciosData,
      grupos: grupos,
      productosPedidos: productosPedidos
    });
  } catch (err) {
    console.error("Error inicializando PDF:", err);
    alert("Error inicializando PDF ❌ Revisa la consola.");
  }
};

// =========================================================================
// 💡 FUNCIÓN MODAL DE CONFIGURACIÓN (Remito Individual)
// =========================================================================

function mostrarModalRemito({ pedidoId, data, preciosData, grupos, productosPedidos }) {
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
    const ocultarPrecios = document.getElementById("ocultar-precios-check").checked;
    const descuentoPorcentaje = parseFloat(document.getElementById("porcentaje-input").value) || 0; // Ej: 10
    const descuentoEfectivo = parseFloat(document.getElementById("efectivo-input").value) || 0; // Ej: 100
    const observaciones = document.getElementById("observaciones-input").value.trim();

    modal.style.display = "none";

    _generarRemitoFinal({
      pedidoId,
      data,
      preciosData,
      grupos,
      productosPedidos,
      ocultarPrecios,
      descuentoPorcentaje, // porcentaje (no decimal)
      descuentoEfectivo,   // monto en pesos
      observaciones,
    });
  };
}

// =========================================================================
// 💡 FUNCIÓN REUTILIZABLE PARA DIBUJAR UN REMITO (Remito Individual)
// =========================================================================

async function drawRemito(docPDF, logoImg, tipoCopia, { data, preciosData, grupos, productosPedidos, ocultarPrecios, descuentoPorcentaje = 0, descuentoEfectivo = 0, observaciones, flete = 0 }) {
    const nombreCliente = data.Nombre || "-";
    const direccion = data.Direccion || "-";
    const localidad = data.Localidad || "-";
    const nombreLocal = data.Local || "-";

    const marginLeft = 10;
    const pageWidth = docPDF.internal.pageSize.getWidth();
    let y = 10;

    // --- ENCABEZADO FIJO ---
    docPDF.addImage(logoImg, "PNG", marginLeft, y, 50, 20);
    y += 25;

    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(10);
    docPDF.text("FROST CARGO SAS", marginLeft, y); y += 5;
    docPDF.text("Benjamin Franklin 1557", marginLeft, y); y += 5;
    docPDF.text("(5850) RIO TERCERO (Cba.) Tel: 3571-528075", marginLeft, y); y += 5;
    docPDF.setFontSize(8);
    docPDF.text("Responsable Inscripto", marginLeft, y); 

    y = 20;
    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(14);
    docPDF.text(`REMITO - COPIA ${tipoCopia}`, pageWidth - 10, y, { align: "right" });
    y += 8;

    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(9);
    docPDF.text("DOCUMENTO NO VALIDO COMO FACTURA", pageWidth - 10, y, { align: "right" });
    y += 7;

    const numeroRemito = data.NumeroRemito ?? 0;
    docPDF.text(`N° ${numeroRemito.toString().padStart(8, "0")}`, pageWidth - 10, y, { align: "right" });
    y += 7;
    docPDF.setFontSize(8);
    docPDF.text("CUIT: 30-71857453-2   Ing. Brutos: 280-703834", pageWidth - 10, y, { align: "right" });
    y += 5;
    docPDF.text("Fecha de Inicio Act.: 01/05/2010", pageWidth - 10, y, { align: "right" });
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

            docPDF.setFont("helvetica", "normal");
            docPDF.setFontSize(11);
            docPDF.text(
                `${total} - ${prod.charAt(0).toUpperCase() + prod.slice(1)}`,
                13,
                y
            );

            if (!ocultarPrecios) {
                docPDF.text(
                    `$${precioTotal.toFixed(2)}`,
                    pageWidth - 10,
                    y,
                    { align: "right" }
                );
            }

            y += rowSpacing;
            if (y > maxY) {
                docPDF.addPage();
                y = 20;
            }
        });

        y += 1;
        docPDF.setFont("helvetica", "bold");
        docPDF.setFontSize(10);
        docPDF.text(`Total unidades en ${titulo}: ${totalGrupo}`, 10, y);
        y += 8;
    }

    // --- GENERAR GRUPOS DINÁMICAMENTE ---
    coleccionesStock.forEach(col => {
      buildGrupoPDF(col, grupos[col]);
    });

    // --- TOTALES Y OPCIONALES ---
    y += 5;

    // Si ocultamos precios, mostramos como antes (total de unidades)
    const totalProductos = Object.values(productosPedidos).reduce((sum, item) => sum + (item.cantidad || 0), 0);

    if (!ocultarPrecios) {
        // Mostrar SUBTOTAL
        docPDF.setFont("helvetica", "normal");
        docPDF.setFontSize(10);
        docPDF.text(`SUBTOTAL: $${subtotal.toFixed(2)}`, pageWidth - 10, y, { align: "right" });
        y += 6;

        // Aplicar descuento porcentual (si existe)
        let descuentoPorcMonto = 0;
        if (descuentoPorcentaje && descuentoPorcentaje > 0) {
            descuentoPorcMonto = subtotal * (descuentoPorcentaje / 100);
            docPDF.text(`Descuento (${descuentoPorcentaje}%): - $${descuentoPorcMonto.toFixed(2)}`, pageWidth - 10, y, { align: "right" });
            y += 6;
        }

        // Aplicar descuento en efectivo (si existe)
        let descuentoEfectMonto = 0;
        if (descuentoEfectivo && descuentoEfectivo > 0) {
            descuentoEfectMonto = descuentoEfectivo;
            docPDF.text(`Descuento Efectivo: - $${descuentoEfectMonto.toFixed(2)}`, pageWidth - 10, y, { align: "right" });
            y += 6;
        }

        // Agregar Flete si existe
        if (flete > 0) {
            docPDF.text(`Flete/Transporte: $${flete.toFixed(2)}`, pageWidth - 10, y, { align: "right" });
            y += 6;
        }

        // Calcular total final (no menor a 0)
        let totalGeneral = subtotal - descuentoPorcMonto - descuentoEfectMonto + (flete || 0);
        if (totalGeneral < 0) totalGeneral = 0;

        docPDF.setFont("helvetica", "bold");
        docPDF.setFontSize(12);
        docPDF.text(`TOTAL FINAL: $${totalGeneral.toFixed(2)}`, pageWidth - 10, y, { align: "right" });
        y += 10;
    } else {
        // Si precios ocultos: sólo mostrar total de unidades como antes
        docPDF.setFont("helvetica", "bold");
        docPDF.setFontSize(12);
        docPDF.text(`TOTAL FINAL DE UNIDADES: ${totalProductos}`, pageWidth - 10, y, { align: "right" });
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
  descuentoPorcentaje = 0,
  descuentoEfectivo = 0,
  observaciones,
}) {
  const { jsPDF } = window.jspdf;
  const docPDF = new jsPDF({ format: "legal", unit: "mm" });

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  const logoImg = await loadImage("images/Grido_logo.png");

  // 1. Generar la copia ORIGINAL
  await drawRemito(docPDF, logoImg, "ORIGINAL", {
    pedidoId,
    data,
    preciosData,
    grupos,
    productosPedidos,
    ocultarPrecios,
    descuentoPorcentaje,
    descuentoEfectivo,
    observaciones,
    // si querés seguir usando 'flete' (monto), podés pasarlo aquí también:
    flete: 0
  });

  // 2. Agregar una nueva página para el DUPLICADO
  docPDF.addPage("legal", "portrait");

  // 3. Generar la copia DUPLICADO
  await drawRemito(docPDF, logoImg, "DUPLICADO", {
    pedidoId,
    data,
    preciosData,
    grupos,
    productosPedidos,
    ocultarPrecios,
    descuentoPorcentaje,
    descuentoEfectivo,
    observaciones,
    flete: 0
  });

  docPDF.save(`${pedidoId}.pdf`);
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

  const title = document.createElement("strong");
  title.textContent = `${data.categoria} - ${pedidoDoc.id}`;
  header.appendChild(title);

  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = pedidoAbiertoId === pedidoDoc.id ? "▲" : "▼";
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

    // Función asíncrona inmediata para cargar stock y renderizar detalles
    (async () => {
      // No necesitamos cargar todo el stock aquí, solo necesitamos los detalles del pedido
      // El mapeo de colecciones y productos ya está en `productosPedidos`
      
      const grupos = {};
      coleccionesStock.forEach(col => grupos[col] = []);

      // 2. Clasificar los productos pedidos por su colección
      articulosKeys.forEach(key => {
        const detalle = productosPedidos[key];
        // El key es Coleccion::Producto, pero el detalle ya tiene coleccion y producto
        if (detalle && detalle.coleccion && detalle.producto) {
          const cantidad = detalle.cantidad || 0;
          if (cantidad > 0 && grupos.hasOwnProperty(detalle.coleccion)) {
            grupos[detalle.coleccion].push({
              nombre: detalle.producto,
              cantidad: cantidad 
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
        const h3 = document.createElement("h3");
        h3.textContent = titulo;
        h3.style.backgroundColor = "#ddd";
        h3.style.padding = "4px";
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

      // Mostrar todos los grupos de stock
      coleccionesStock.forEach(col => buildGrupo(col, grupos[col]));
      
      // --- Botones de acción ---
      const botonesDiv = document.createElement("div");
      botonesDiv.style.display = "flex";
      botonesDiv.style.justifyContent = "space-around";
      botonesDiv.style.gap = "12px";
      botonesDiv.style.marginTop = "12px";

      const btnBorrar = document.createElement("button");
      btnBorrar.textContent = "❌ Borrar";
      btnBorrar.style.backgroundColor = "red";
      btnBorrar.style.color = "white";
      btnBorrar.style.padding = "8px 12px";
      btnBorrar.style.border = "none";
      btnBorrar.style.borderRadius = "4px";
      btnBorrar.onclick = () =>
        borrarPedidoYActualizarStock(data, pedidoDoc.id);
      botonesDiv.appendChild(btnBorrar);

      const btnEntregado = document.createElement("button");
      btnEntregado.textContent = "✅ Entregado";
      btnEntregado.style.backgroundColor = "green";
      btnEntregado.style.color = "white";
      btnEntregado.style.padding = "8px 12px";
      btnEntregado.style.border = "none";
      btnEntregado.style.borderRadius = "4px";
      btnEntregado.onclick = () => borrarPedidoSinStock(pedidoDoc.id);
      botonesDiv.appendChild(btnEntregado);

      const btnEditar = document.createElement("button");
      btnEditar.textContent = "✏️ Editar";
      btnEditar.style.backgroundColor = "orange";
      btnEditar.style.color = "white";
      btnEditar.style.padding = "8px 12px";
      btnEditar.style.border = "none";
      btnEditar.style.borderRadius = "4px";
      btnEditar.onclick = () => {
        window.location.href = `modificacion.html?id=${pedidoDoc.id}`;
      };
      botonesDiv.appendChild(btnEditar);

      const btnPDF = document.createElement("button");
      btnPDF.textContent = "📄 PDF";
      btnPDF.style.backgroundColor = "blue";
      btnPDF.style.color = "white";
      btnPDF.style.padding = "8px 12px";
      btnPDF.style.border = "none";
      btnPDF.style.borderRadius = "4px";
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
    resumen.style.marginTop = "6px";

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

  // 1. Acumular las cantidades de productos de todos los pedidos filtrados
  const articulosAcumulados = {}; 
  // Estructura: articulosAcumulados['Coleccion::Producto'] = { coleccion: '...', producto: '...', cantidad: X }

  pedidosFiltradosDocs.forEach(doc => {
    const data = doc.data();
    const productosPedidos = data.productos || {};
    
    Object.values(productosPedidos).forEach(detalle => {
      if (detalle && detalle.coleccion && detalle.producto) {
        const key = `${detalle.coleccion}::${detalle.producto}`;
        const cantidad = detalle.cantidad || 0;

        if (cantidad > 0) {
          if (!articulosAcumulados[key]) {
            articulosAcumulados[key] = {
              coleccion: detalle.coleccion,
              producto: detalle.producto,
              cantidad: 0,
            };
          }
          articulosAcumulados[key].cantidad += cantidad;
        }
      }
    });
  });

  if (Object.keys(articulosAcumulados).length === 0) {
    alert("No se encontraron artículos con las cantidades en los pedidos filtrados.");
    return;
  }

  // 2. Clasificar los artículos acumulados por grupo de stock
  const gruposAcumulados = {};
  coleccionesStock.forEach(col => gruposAcumulados[col] = []);

  Object.values(articulosAcumulados).forEach(item => {
    if (gruposAcumulados.hasOwnProperty(item.coleccion)) {
      gruposAcumulados[item.coleccion].push(item);
    }
  });

  // 3. Generar el PDF
  const { jsPDF } = window.jspdf;
  const docPDF = new jsPDF({ format: "a4", unit: "mm" });

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = reject;
    });
  const logoImg = await loadImage("images/Grido_logo.png");
  
  // Usamos una nueva función para dibujar el resumen
  await drawResumenPDF(docPDF, logoImg, gruposAcumulados, pedidosFiltradosDocs.length);

  // Generar nombre de archivo con filtro de fecha si aplica
  const nombreArchivo = filtroFecha ? `Resumen_Pedidos_${filtroFecha}.pdf` : `Resumen_Pedidos_Acumulado.pdf`;
  docPDF.save(nombreArchivo);

  alert("Resumen Acumulado de Artículos generado.");
}

// -------------------------------------------------------------------
// ## NUEVA FUNCIÓN: Dibujar el PDF de Resumen
// -------------------------------------------------------------------

async function drawResumenPDF(docPDF, logoImg, gruposAcumulados, numPedidos) {
  const marginLeft = 10;
  const pageWidth = docPDF.internal.pageSize.getWidth();
  let y = 10;
  const maxY = 280;

  // --- ENCABEZADO ---
  docPDF.addImage(logoImg, "PNG", marginLeft, y, 30, 12);
  docPDF.setFont("helvetica", "bold");
  docPDF.setFontSize(16);
  docPDF.text("RESUMEN ACUMULADO DE ARTÍCULOS", pageWidth - 10, y + 8, { align: "right" });
  y += 20;

  docPDF.setFont("helvetica", "normal");
  docPDF.setFontSize(10);
  const filtrosAplicados = [];
  if (filtroFecha) filtrosAplicados.push(`Fecha: ${filtroFecha}`);
  if (filtroNombre) filtrosAplicados.push(`Cliente/Nombre: ${filtroNombre}`);
  if (filtroCategoria !== "Todos") filtrosAplicados.push(`Categoría: ${filtroCategoria}`);
  if (filtroLocalidad) filtrosAplicados.push(`Localidad: ${filtroLocalidad}`);
  
  docPDF.text(`Pedidos analizados: ${numPedidos}`, marginLeft, y); y += 5;
  docPDF.text(`Filtros: ${filtrosAplicados.length > 0 ? filtrosAplicados.join(" | ") : "Ninguno"}`, marginLeft, y);
  y += 8;

  // Línea separadora
  docPDF.setLineWidth(0.5);
  docPDF.line(marginLeft, y, pageWidth - marginLeft, y);
  y += 5;
  
  docPDF.setFont("helvetica", "bold");
  docPDF.setFontSize(12);
  docPDF.text("CANTIDAD", 13, y);
  docPDF.text("PRODUCTO", 40, y);
  docPDF.text("COLECCIÓN", pageWidth - 40, y);
  y += 4;
  docPDF.line(marginLeft, y, pageWidth - marginLeft, y);
  y += 5;

  // --- DETALLE DE ARTÍCULOS ACUMULADOS ---
  const rowSpacing = 5;
  let totalGeneralUnidades = 0;

  // Iterar sobre las colecciones para mantener el orden de agrupamiento
  coleccionesStock.forEach(col => {
    const items = gruposAcumulados[col];
    if (!items || items.length === 0) return;

    // Ordenar alfabéticamente dentro de la colección
    items.sort((a, b) => a.producto.localeCompare(b.producto));

    // Título de la Colección/Grupo
    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(10);
    docPDF.text(nombresColecciones[col] || col, marginLeft, y);
    y += rowSpacing;

    docPDF.setFont("helvetica", "normal");
    docPDF.setFontSize(10);
    
    items.forEach(item => {
      totalGeneralUnidades += item.cantidad;

      docPDF.text(item.cantidad.toString(), 13, y);
      docPDF.text(item.producto.charAt(0).toUpperCase() + item.producto.slice(1), 40, y);
      // No repetir la colección aquí para ahorrar espacio, ya está como encabezado

      y += rowSpacing;
      // Control de página
      if (y > maxY) {
        docPDF.addPage();
        y = 20; // Reiniciar Y
        docPDF.setFont("helvetica", "bold");
        docPDF.setFontSize(12);
        docPDF.text("CANTIDAD", 13, y);
        docPDF.text("PRODUCTO", 40, y);
        docPDF.text("COLECCIÓN", pageWidth - 40, y);
        y += 4;
        docPDF.line(marginLeft, y, pageWidth - marginLeft, y);
        y += 5;
        // Repetir el título de grupo en nueva página (opcional)
        docPDF.setFont("helvetica", "bold");
        docPDF.setFontSize(10);
        docPDF.text(nombresColecciones[col] || col, marginLeft, y);
        y += rowSpacing;
        docPDF.setFont("helvetica", "normal");
        docPDF.setFontSize(10);
      }
    });
    y += 2;
    docPDF.line(marginLeft, y, pageWidth - marginLeft, y);
    y += 5;
  });

  // --- TOTAL FINAL ---
  y += 5;
  docPDF.setFont("helvetica", "bold");
  docPDF.setFontSize(14);
  docPDF.text(`TOTAL GENERAL DE UNIDADES: ${totalGeneralUnidades}`, pageWidth - 10, y, { align: "right" });
}

// -------------------------------------------------------------------
// ## Renderizar Pedidos - Lógica de Filtrado Actualizada
// -------------------------------------------------------------------

function renderPedidos() {
  const pedidosRef = collection(db, "Pedidos");
  const q = query(pedidosRef, orderBy("fechaRegistro", "desc"));

  onSnapshot(q, (snapshot) => {
    pedidosContainer.innerHTML = "";

    const normNombre = normalizar(filtroNombre);
    const normLocalidad = normalizar(filtroLocalidad);
    const filtroFechaValida = filtroFecha.trim();
    const filtroCategoriaValida = filtroCategoria;

    let pedidos = snapshot.docs.filter((doc) => {
      const data = doc.data();
      
      // 1. Filtrar por Nombre
      const nombrePedido = data.Nombre || "";
      const nombreOk = normNombre === "" || normalizar(nombrePedido).includes(normNombre);
      
      // 2. Filtrar por Fecha
      const fechaPedido = data.fechaEntrega || ""; // Asumiendo que 'fechaEntrega' tiene el formato 'YYYY-MM-DD'
      const fechaOk = filtroFechaValida === "" || fechaPedido === filtroFechaValida;
      
      // 3. Filtrar por Categoría
      const categoriaPedido = data.categoria || "";
      const categoriaOk =
        filtroCategoriaValida === "Todos" ||
        categoriaPedido === filtroCategoriaValida;
        
      // 4. Filtrar por Localidad
      const localidadPedido = data.Localidad || "";
      const localidadOk = normLocalidad === "" || normalizar(localidadPedido).includes(normLocalidad);

      return nombreOk && fechaOk && categoriaOk && localidadOk;
    });

    let pedidosFiltradosFinales = [...pedidos]; // Copia de los pedidos que pasaron los filtros

    if (pedidoAbiertoId) {
      const abiertoExiste = snapshot.docs.some(
        (doc) => doc.id === pedidoAbiertoId
      );
      if (abiertoExiste) {
          // Si hay un pedido abierto, solo muéstralo si pasa los filtros.
          const pedidoAbierto = pedidos.find(d => d.id === pedidoAbiertoId);
          pedidos = pedidoAbierto ? [pedidoAbierto] : [];
      } else {
          pedidoAbiertoId = null;
      }
    }

    if (!pedidosFiltradosFinales.length) {
      pedidosContainer.textContent = "No hay pedidos que coincidan con los filtros.";
      pedidosContainer.style.textAlign = "center";
      pedidosContainer.style.fontSize = "18px";
      return;
    }

    // Renderizar los pedidos (teniendo en cuenta el pedido abierto)
    pedidos.forEach((pedidoDoc) => {
      const data = pedidoDoc.data();
      const elemento = crearElementoPedido(pedidoDoc, data);
      pedidosContainer.appendChild(elemento);
    });
    
    // --- BOTÓN DE RESUMEN ACUMULADO AL FINAL DEL LISTADO ---
    const resumenBtnContainer = document.createElement("div");
    resumenBtnContainer.style.marginTop = "20px";
    resumenBtnContainer.style.textAlign = "center";
    
    const btnResumen = document.createElement("button");
    btnResumen.textContent = `📝 Generar Resumen Acumulado (${pedidosFiltradosFinales.length} pedidos)`;
    btnResumen.style.backgroundColor = "#ff9800"; // Naranja para distinguir
    btnResumen.style.color = "white";
    btnResumen.style.padding = "10px 15px";
    btnResumen.style.border = "none";
    btnResumen.style.borderRadius = "4px";
    btnResumen.style.cursor = "pointer";
    btnResumen.onclick = () => generarPDFAcumulado(pedidosFiltradosFinales);
    
    resumenBtnContainer.appendChild(btnResumen);
    pedidosContainer.appendChild(resumenBtnContainer);

  });
}

renderPedidos();