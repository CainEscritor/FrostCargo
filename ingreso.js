import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  Timestamp,
  runTransaction,
  FieldPath,
  query,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const categorias = ["Ingrese categoría", "Remito", "Factura"];
const vendedores = ["Seleccione vendedor", "Betty", "Alberto", "Ariel"];

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

const datalistId = "clientes-datalist";
let datalistClientes =
  document.getElementById(datalistId) || document.createElement("datalist");
datalistClientes.id = datalistId;
document.body.appendChild(datalistClientes);
nombreInput.setAttribute("list", datalistId);

// --- Estado Global (Caché) ---
const inputsPorColeccion = {};
let clientesCache = []; // Caché para ahorrar lecturas en Blaze
let clientesInfo = {};

// --- Inicialización ---
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

// --- Búsqueda de Clientes (Optimizada para Blaze) ---
async function precargarClientes() {
  try {
    const snap = await getDocs(collection(db, "Clientes"));
    clientesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log("Caché de clientes lista.");
  } catch (error) {
    console.error("Error cargando clientes:", error);
  }
}

nombreInput.addEventListener("input", (e) => {
  const texto = e.target.value.toLowerCase().trim();
  datalistClientes.innerHTML = "";
  if (texto.length < 2) return;

  // Filtrado local en memoria (0 costo de lectura)
  const filtrados = clientesCache.filter((c) =>
    c.id.toLowerCase().includes(texto),
  );

  filtrados.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.id;
    datalistClientes.appendChild(option);
    clientesInfo[c.id] = {
      Direccion: c.Direccion || "----",
      Local: c.Local || "----",
      Localidad: c.Localidad || "----",
    };
  });
});

nombreInput.addEventListener("change", (e) => {
  const data = clientesInfo[e.target.value.trim()];
  if (data) localidadInput.value = data.Localidad;
});

// --- Renderizado de Productos ---
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
      const fila = document.createElement("div");
      fila.className = "fila";
      fila.dataset.key = prod;
      fila.innerHTML = `
      <div class="celda">${prod}</div>
      <div style="width: 120px; text-align: right;">
        <input type="number" min="0" class="cantidad-input" value="0">
      </div>`;
      const input = fila.querySelector("input");
      input.addEventListener("input", () => {
        if (Number(input.value) > 0) fila.classList.add("activo");
        else fila.classList.remove("activo");
      });
      tbody.appendChild(fila);
    });
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
}

// --- FUNCIÓN GUARDAR (Transaccional y Atómica) ---
async function guardarPedidoFinal(forzarStock = false, forzarCliente = false) {
  const nombre = nombreInput.value.trim();
  const productosSeleccionados = [];

  for (const col of colecciones) {
    const tbody = inputsPorColeccion[col];
    if (!tbody) continue;
    tbody.querySelectorAll(".fila.activo").forEach((fila) => {
      const cantidad = Number(fila.querySelector("input").value);
      if (cantidad > 0)
        productosSeleccionados.push({ col, key: fila.dataset.key, cantidad });
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

  // Validación de cliente con el caché local
  if (!clientesInfo[nombre] && !forzarCliente) {
    nombreClienteAdvertencia.innerText = nombre;
    clienteModal.style.display = "flex";
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Obtener Remito
      const remitoRef = doc(db, "NumeroRemito", "remito");
      const remitoSnap = await transaction.get(remitoRef);
      const num = remitoSnap.data()?.numero || 0;

      // 2. Obtener Stocks
      const unicasCols = [...new Set(productosSeleccionados.map((p) => p.col))];
      const stockSnaps = {};
      for (const cid of unicasCols) {
        stockSnaps[cid] = await transaction.get(doc(db, cid, "Stock"));
      }

      const criticos = [];
      const productosPedidos = {};

      // 3. Validar Stock dentro de la transacción
      for (const p of productosSeleccionados) {
        const actual = stockSnaps[p.col].data()?.[p.key] || 0;
        const final = actual - p.cantidad;
        if (final < 0 && !forzarStock) {
          criticos.push(`${p.key} (Stock: ${actual}, Quedaría: ${final})`);
        }
        productosPedidos[`${p.col}::${p.key}`] = {
          cantidad: p.cantidad,
          producto: p.key,
          coleccion: p.col,
          checked: false,
        };
      }

      if (criticos.length > 0) {
        throw { isStockError: true, list: criticos };
      }

      // 4. Aplicar Updates
      productosSeleccionados.forEach((p) => {
        const actual = stockSnaps[p.col].data()[p.key] || 0;
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
        Direccion: clienteData.Direccion || "",
        Local: clienteData.Local || "",
      });

      transaction.update(remitoRef, { numero: num + 1 });
    });

    // Éxito
    stockModal.style.display = "none";
    clienteModal.style.display = "none";
    mensajeConfirmacion.style.display = "block";
    setTimeout(() => (mensajeConfirmacion.style.display = "none"), 3000);
    document.getElementById("pedido-form").reset();
    document
      .querySelectorAll(".fila")
      .forEach((f) => f.classList.remove("activo"));
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

// --- Eventos ---
document.getElementById("pedido-form").addEventListener("submit", (e) => {
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

// --- Inicio de App ---
async function iniciar() {
  await precargarClientes();
  await cargarTodosLosProductos();
}
iniciar();
