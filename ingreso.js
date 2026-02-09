import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  Timestamp,
  runTransaction,
  FieldPath,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const categorias = ["Ingrese categoría", "Remito", "Factura"];
const vendedores = ["Seleccione vendedor", "Betty", "Alberto", "Ariel", "Martín", "Depósito"];

const colecciones = [
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

// --- Referencias DOM ---
const formulario = document.getElementById("pedido-form");
const fechaNumericaInput = document.getElementById("fechaNumerica");
const categoriaSelect = document.getElementById("categoria");
const vendedorSelect = document.getElementById("vendedor");
const localidadInput = document.getElementById("localidad");
const nombreInput = document.getElementById("nombre");
const contenedorColecciones = document.getElementById("contenedor-colecciones");
const mensajeConfirmacion = document.getElementById("mensaje-confirmacion");
const stockModal = document.getElementById("stock-advertencia-modal");
const stockDetalle = document.getElementById("stock-detalle");
const btnForzarStock = document.getElementById("btn-forzar-stock");
const btnCancelarStock = document.getElementById("btn-cancelar-stock");
const clienteModal = document.getElementById("cliente-advertencia-modal");
const nombreClienteAdvertencia = document.getElementById(
  "nombre-cliente-advertencia",
);
const btnGuardarForzadoCliente = document.getElementById("btn-guardar-forzado");
const btnCancelarModalCliente = document.getElementById("btn-cancelar-modal");
const totalGeneralSpan = document.getElementById("total-general");
const localInput = document.getElementById("local");

// Desactivar validación nativa que bloquea el 0.5 cuando el step es 1
if (formulario) formulario.setAttribute("novalidate", "");

const datalistId = "clientes-datalist";
let datalistClientes =
  document.getElementById(datalistId) || document.createElement("datalist");
datalistClientes.id = datalistId;
document.body.appendChild(datalistClientes);
nombreInput.setAttribute("list", datalistId);

// --- Estado Global ---
const inputsPorColeccion = {};
let clientesCache = [];
let clientesInfo = {};
let preciosCache = {};

function fillSelect(select, options) {
  select.innerHTML = options
    .map(
      (opt) =>
        `<option value="${opt.includes("Ingrese") || opt.includes("Seleccione") ? "Ingrese valor" : opt}">${opt}</option>`,
    )
    .join("");
}
fillSelect(categoriaSelect, categorias);
fillSelect(vendedorSelect, vendedores);

async function cargarPrecios() {
  try {
    const docPrecio = await getDoc(doc(db, "Precios", "Precio"));
    if (docPrecio.exists()) {
      preciosCache = docPrecio.data();
    }
  } catch (error) {
    console.error("Error al cargar precios:", error);
  }
}

async function precargarClientes() {
  try {
    const snap = await getDocs(collection(db, "Clientes"));
    clientesCache = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    clientesInfo = {};
    clientesCache.forEach((c) => {
      clientesInfo[c.id] = c;
    });
  } catch (error) {
    console.error("Error cargando clientes:", error);
  }
}

function crearDatalist(id, input) {
  let dl = document.getElementById(id) || document.createElement("datalist");
  dl.id = id;
  document.body.appendChild(dl);
  input.setAttribute("list", id);
  return dl;
}

const datalistNombre = crearDatalist("clientes-nombre-dl", nombreInput);
const datalistLocal = crearDatalist("clientes-local-dl", localInput);

localInput.addEventListener("input", (e) => {
  const texto = e.target.value.toLowerCase().trim();
  datalistLocal.innerHTML = "";
  if (texto.length < 2) return;

  clientesCache
    .filter((c) => (c.Local || "").toLowerCase().includes(texto))
    .forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.Local;
      datalistLocal.appendChild(opt);
    });
});
localInput.addEventListener("change", () => {
  const cliente = clientesCache.find((c) => c.Local === localInput.value);
  if (!cliente) return;

  nombreInput.value = cliente.id;
  localidadInput.value = cliente.Localidad || "";
});

nombreInput.addEventListener("change", () => {
  const cliente = clientesCache.find((c) => c.id === nombreInput.value);
  if (!cliente) return;

  localInput.value = cliente.Local || "";
  localidadInput.value = cliente.Localidad || "";
});

nombreInput.addEventListener("input", (e) => {
  const texto = e.target.value.toLowerCase().trim();
  datalistNombre.innerHTML = "";
  if (texto.length < 2) return;

  clientesCache
    .filter((c) => c.id.toLowerCase().includes(texto))
    .forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      datalistNombre.appendChild(opt);
    });
});

function crearPanelColeccion(nombreColeccion, titulo) {
  const panel = document.createElement("div");
  panel.className = "coleccion-panel panel";
  panel.style.padding = "20px";
  panel.innerHTML = `<h3 class="coleccion-titulo" style="cursor:pointer;">${titulo}</h3>`;
  const tbody = document.createElement("div");
  tbody.className = "coleccion-body";
  tbody.style.display = "none";
  const tituloEl = panel.querySelector(".coleccion-titulo");
  tituloEl.addEventListener("click", () => {
    if (tbody.querySelector(".fila.activo")) return;
    tbody.style.display = tbody.style.display === "none" ? "block" : "none";
  });
  panel.appendChild(tbody);
  contenedorColecciones.appendChild(panel);
  inputsPorColeccion[nombreColeccion] = tbody;
  return tbody;
}

function renderizarColeccion(tbody, data) {
  tbody.innerHTML = "";
  if (!data) return;
  Object.keys(data)
    .sort()
    .forEach((prod) => {
      const stockActual = data[prod] || 0;
      const precioUnitario = preciosCache[prod] || 0;

      const fila = document.createElement("div");
      fila.className = "fila";
      fila.dataset.key = prod;
      fila.innerHTML = `
      <div class="celda">
        <div style="font-weight: bold;">${prod}</div>
        <div style="font-size: 0.85rem; color: #666;">
          Stock: ${stockActual} | Precio: $${precioUnitario.toLocaleString()}
        </div>
      </div>
      <div style="width: 140px; text-align: right;">
        <input type="number" min="0" step="1" class="cantidad-input" value="0" data-precio="${precioUnitario}">
        <div class="subtotal-fila" style="font-size: 0.8rem; color: #2196f3; margin-top: 2px;">$0</div>
      </div>`;

      const input = fila.querySelector("input");
      const subtotalDisplay = fila.querySelector(".subtotal-fila");

      input.addEventListener("input", () => {
        let cant = Number(input.value);

        // Permitimos solo X.0 o X.5
        if (cant % 1 !== 0 && cant % 1 !== 0.5) {
          cant = Math.floor(cant) + 0.5;
          input.value = cant;
        }

        if (cant > 0) fila.classList.add("activo");
        else fila.classList.remove("activo");

        subtotalDisplay.innerText = `$${(cant * precioUnitario).toLocaleString()}`;
        actualizarTotalGeneral();
      });
      tbody.appendChild(fila);
    });
}

function actualizarTotalGeneral() {
  let total = 0;
  document.querySelectorAll(".cantidad-input").forEach((inp) => {
    total += Number(inp.value) * Number(inp.dataset.precio);
  });
  if (totalGeneralSpan) totalGeneralSpan.innerText = total.toLocaleString();
}

async function cargarTodosLosProductos() {
  contenedorColecciones.innerHTML = "";
  const promesas = colecciones.map(async (col) => {
    const tbody = crearPanelColeccion(col, nombresColecciones[col] || col);
    try {
      const snap = await getDoc(doc(db, col, "Stock"));
      renderizarColeccion(tbody, snap.exists() ? snap.data() : {});
    } catch (err) {
      tbody.innerHTML = `<p style="color:#c00">Error</p>`;
    }
  });
  await Promise.all(promesas);
  actualizarTotalGeneral();
}

async function guardarPedidoFinal(forzarStock = false, forzarCliente = false) {
  const nombre = nombreInput.value.trim();
  const productosSeleccionados = [];

  for (const col of colecciones) {
    const tbody = inputsPorColeccion[col];
    if (!tbody) continue;
    tbody.querySelectorAll(".fila.activo").forEach((fila) => {
      const input = fila.querySelector("input");
      const cantidad = Number(input.value);
      if (cantidad > 0)
        productosSeleccionados.push({
          col,
          key: fila.dataset.key,
          cantidad,
          precio: Number(input.dataset.precio),
        });
    });
  }

  if (
    !nombre ||
    categoriaSelect.value === "Ingrese valor" ||
    productosSeleccionados.length === 0
  ) {
    alert("Complete los campos obligatorios.");
    return;
  }

  if (!clientesInfo[nombre] && !forzarCliente) {
    nombreClienteAdvertencia.innerText = nombre;
    clienteModal.style.display = "flex";
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      const remitoRef = doc(db, "NumeroRemito", "remito");
      const remitoSnap = await transaction.get(remitoRef);
      const num = remitoSnap.data()?.numero || 0;

      const unicasCols = [...new Set(productosSeleccionados.map((p) => p.col))];
      const stockSnaps = {};
      for (const cid of unicasCols) {
        stockSnaps[cid] = await transaction.get(doc(db, cid, "Stock"));
      }

      const criticos = [];
      const productosPedidos = {};
      let totalCalculado = 0;

      for (const p of productosSeleccionados) {
        const actualStock = Number(stockSnaps[p.col].data()?.[p.key] || 0);
        const final = actualStock - p.cantidad;

        if (final < 0 && !forzarStock) {
          criticos.push(`${p.key} (Stock: ${actualStock}, Quedaría: ${final})`);
        }

        productosPedidos[`${p.col}::${p.key}`] = {
          cantidad: p.cantidad,
          producto: p.key,
          coleccion: p.col,
          precio: p.precio,
          subtotal: p.cantidad * p.precio,
          checked: false,
        };
        totalCalculado += p.cantidad * p.precio;
      }

      if (criticos.length > 0) throw { isStockError: true, list: criticos };

      productosSeleccionados.forEach((p) => {
        const actual = Number(stockSnaps[p.col].data()[p.key] || 0);
        transaction.update(
          doc(db, p.col, "Stock"),
          new FieldPath(p.key),
          actual - p.cantidad,
        );
      });

      const clienteData = clientesInfo[nombre] || {};
      const idPedido = `${nombre} R${String(num).padStart(5, "0")}`;

      transaction.set(doc(db, "Pedidos", idPedido), {
        Nombre: nombre,
        Localidad: localidadInput.value,
        Vendedor: vendedorSelect.value,
        categoria: categoriaSelect.value,
        fechaEntrega: fechaNumericaInput.value,
        fechaRegistro: Timestamp.now(),
        NumeroRemito: num,
        productos: productosPedidos,
        totalPedido: totalCalculado,
        Direccion: clienteData.Direccion || "",
        Local: clienteData.Local || "",
      });

      transaction.update(remitoRef, { numero: num + 1 });
    });

    stockModal.style.display = "none";
    clienteModal.style.display = "none";
    mensajeConfirmacion.style.display = "block";
    setTimeout(() => (mensajeConfirmacion.style.display = "none"), 3000);

    formulario.reset();
    document.querySelectorAll(".fila").forEach((f) => {
      f.classList.remove("activo");
      const sub = f.querySelector(".subtotal-fila");
      if (sub) sub.innerText = "$0";
    });

    await cargarTodosLosProductos();
  } catch (e) {
    if (e.isStockError) {
      stockDetalle.innerHTML = `<ul>${e.list.map((i) => `<li>${i}</li>`).join("")}</ul>`;
      btnForzarStock.style.display = "block";
      stockModal.style.display = "flex";
    } else {
      console.error(e);
      alert("Error en la transacción.");
    }
  }
}

formulario.addEventListener("submit", (e) => {
  e.preventDefault();
  guardarPedidoFinal();
});

btnGuardarForzadoCliente.onclick = () => {
  clienteModal.style.display = "none";
  guardarPedidoFinal(false, true);
};
btnCancelarModalCliente.onclick = () => {
  clienteModal.style.display = "none";
};
btnForzarStock.onclick = () => {
  stockModal.style.display = "none";
  guardarPedidoFinal(true, true);
};
btnCancelarStock.onclick = () => {
  stockModal.style.display = "none";
};

async function iniciar() {
  await cargarPrecios();
  await precargarClientes();
  await cargarTodosLosProductos();
}
// --- Lógica del Buscador de Productos ---
const buscadorInput = document.getElementById("buscador-productos");
const btnLimpiarBusqueda = document.getElementById("btn-limpiar-busqueda");

function restaurarEstadoPaneles() {
  document.querySelectorAll(".coleccion-panel").forEach((panel) => {
    const cuerpo = panel.querySelector(".coleccion-body");
    const tieneActivos = cuerpo.querySelectorAll(".fila.activo").length > 0;

    // Mostrar todo
    panel.style.display = "block";
    cuerpo.querySelectorAll(".fila").forEach((f) => (f.style.display = "flex"));

    // Abrir solo si tiene productos pedidos
    cuerpo.style.display = tieneActivos ? "block" : "none";
  });
}

buscadorInput.addEventListener("input", (e) => {
  const termino = e.target.value.toLowerCase().trim();
  const paneles = document.querySelectorAll(".coleccion-panel");

  // 🔁 Si no hay búsqueda → restaurar estado original
  if (termino === "") {
    restaurarEstadoPaneles();
    return;
  }

  paneles.forEach((panel) => {
    const cuerpo = panel.querySelector(".coleccion-body");
    const filas = cuerpo.querySelectorAll(".fila");

    // 👉 Abrimos el body para poder evaluar coincidencias
    cuerpo.style.display = "block";

    let hayCoincidencias = false;

    filas.forEach((fila) => {
      const nombreProducto = fila.dataset.key.toLowerCase();

      if (
        nombreProducto.includes(termino) ||
        fila.classList.contains("activo")
      ) {
        fila.style.display = "flex";
        hayCoincidencias = true;
      } else {
        fila.style.display = "none";
      }
    });

    // Mostrar u ocultar el panel completo
    panel.style.display = hayCoincidencias ? "block" : "none";
  });
});

// ❌ Botón limpiar
btnLimpiarBusqueda.addEventListener("click", () => {
  buscadorInput.value = "";
  restaurarEstadoPaneles();
  buscadorInput.focus();
});

iniciar();
