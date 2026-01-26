import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  Timestamp,
  query,
  orderBy,
  startAt,
  endAt,
  limit,
  runTransaction,
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
  "nombre-cliente-advertencia"
);
const btnGuardarForzadoCliente = document.getElementById("btn-guardar-forzado");
const btnCancelarModalCliente = document.getElementById("btn-cancelar-modal");

const datalistId = "clientes-datalist";
let datalistClientes =
  document.getElementById(datalistId) || document.createElement("datalist");
datalistClientes.id = datalistId;
document.body.appendChild(datalistClientes);
nombreInput.setAttribute("list", datalistId);

const stocksPorColeccion = {};
const inputsPorColeccion = {};
let clientesInfo = {};
let timeoutBusqueda = null;

// --- Inicialización ---
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
fillSelect(categoriaSelect, categorias);
fillSelect(vendedorSelect, vendedores);

// --- Búsqueda de Clientes ---
nombreInput.addEventListener("input", (e) => {
  const textoBusqueda = e.target.value.toLowerCase().trim(); // Convertimos a minúsculas
  clearTimeout(timeoutBusqueda);

  if (textoBusqueda.length < 2) {
    datalistClientes.innerHTML = "";
    return;
  }

  timeoutBusqueda = setTimeout(async () => {
    try {
      // Nota: Si tienes miles de clientes, lo ideal es cargar la lista 
      // de nombres una sola vez al inicio para ahorrar lecturas.
      const q = query(collection(db, "Clientes"));
      const snap = await getDocs(q);
      
      datalistClientes.innerHTML = "";
      
      snap.forEach((d) => {
        const id = d.id; // El nombre del cliente es el ID según tu código
        const idMinusculas = id.toLowerCase();
        const data = d.data();

        // AQUÍ LA MAGIA: comprobamos si el texto está incluido en cualquier parte
        if (idMinusculas.includes(textoBusqueda)) {
          const option = document.createElement("option");
          option.value = id;
          datalistClientes.appendChild(option);
          
          clientesInfo[id] = {
            Direccion: data.Direccion || "----",
            Local: data.Local || "----",
            Localidad: data.Localidad || "----",
          };
        }
      });
    } catch (error) {
      console.error("Error buscando clientes:", error);
    }
  }, 300);
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
  panel.innerHTML = `<h3>${titulo}</h3>`;
  const tbody = document.createElement("div");
  tbody.className = "coleccion-body";
  tbody.dataset.collection = nombreColeccion;
  panel.appendChild(tbody);
  contenedorColecciones.appendChild(panel);
  inputsPorColeccion[nombreColeccion] = tbody;
  return tbody;
}

function renderizarColeccion(tbody, data) {
  tbody.innerHTML = "";
  if (!data || Object.keys(data).length === 0) {
    tbody.innerHTML = `<p style="color:#666;text-align:center">Sin datos</p>`;
    return;
  }

  // CORRECCIÓN: Ordenar alfabéticamente las llaves (nombres de productos)
  Object.keys(data)
    .sort((a, b) => a.localeCompare(b))
    .forEach((prod) => {
      const fila = document.createElement("div");
      fila.className = "fila";
      fila.dataset.key = prod;
      fila.innerHTML = `
      <div class="celda">${prod}</div>
      <div style="width: 120px; text-align: right;">
        <input type="number" min="0" class="cantidad-input" data-key="${prod}" value="0">
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
      const data = snap.exists() ? snap.data() : {};
      stocksPorColeccion[col] = data;
      renderizarColeccion(tbody, data);
    } catch (err) {
      tbody.innerHTML = `<p style="color:#c00;text-align:center">Error</p>`;
    }
  });
  await Promise.all(promesas);
}

// --- FUNCIÓN GUARDAR ---
async function guardarPedidoFinal(forzarStock = false, forzarCliente = false) {
  const nombre = nombreInput.value.trim();
  const productosSeleccionados = [];

  for (const col of colecciones) {
    const tbody = inputsPorColeccion[col];
    if (!tbody) continue;
    tbody.querySelectorAll(".fila.activo").forEach((fila) => {
      const key = fila.dataset.key;
      const cantidad = Number(fila.querySelector("input").value);
      if (cantidad > 0) productosSeleccionados.push({ col, key, cantidad });
    });
  }

  if (
    !nombre ||
    categoriaSelect.value === "Ingrese valor" ||
    productosSeleccionados.length === 0
  ) {
    alert("Complete el nombre, la categoría y al menos un producto.");
    return;
  }

  if (!clientesInfo[nombre] && !forzarCliente) {
    nombreClienteAdvertencia.innerText = nombre;
    clienteModal.style.display = "flex";
    return;
  }

  if (!forzarStock) {
    let criticos = [];
    for (const colId of [
      ...new Set(productosSeleccionados.map((p) => p.col)),
    ]) {
      const snap = await getDoc(doc(db, colId, "Stock"));
      const data = snap.data() || {};
      productosSeleccionados
        .filter((p) => p.col === colId)
        .forEach((p) => {
          const actual = data[p.key] || 0;
          if (actual - p.cantidad < 0) {
            criticos.push(
              `${p.key} (Stock: ${actual}, Quedaría: ${actual - p.cantidad})`
            );
          }
        });
    }

    if (criticos.length > 0) {
      stockDetalle.innerHTML = `<ul>${criticos
        .map((i) => `<li>${i}</li>`)
        .join("")}</ul>`;
      document.getElementById("stock-advertencia-titulo").innerText =
        "⚠️ Stock Insuficiente";
      btnForzarStock.style.display = "block";
      stockModal.style.display = "flex";
      return;
    }
  }

  try {
    await runTransaction(db, async (transaction) => {
      const remitoRef = doc(db, "NumeroRemito", "remito");
      const remitoSnap = await transaction.get(remitoRef);
      const num = remitoSnap.data()?.numero || 0;
      const idPedido = `${nombre} R${String(num).padStart(5, "0")}`;

      const productosPedidos = {};
      const coleccionesUnicas = [
        ...new Set(productosSeleccionados.map((p) => p.col)),
      ];
      const stockSnaps = {};

      for (const cid of coleccionesUnicas) {
        stockSnaps[cid] = await transaction.get(doc(db, cid, "Stock"));
      }

      for (const item of productosSeleccionados) {
        const data = stockSnaps[item.col].data() || {};
        const nuevoStock = (data[item.key] || 0) - item.cantidad;
        transaction.update(doc(db, item.col, "Stock"), {
          [item.key]: nuevoStock,
        });
        productosPedidos[`${item.col}::${item.key}`] = {
          cantidad: item.cantidad,
          producto: item.key,
          coleccion: item.col,
          checked: false,
        };
      }

      const clienteData = clientesInfo[nombre] || {};
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

    stockModal.style.display = "none";
    clienteModal.style.display = "none";
    mensajeConfirmacion.style.display = "block";
    setTimeout(() => {
      mensajeConfirmacion.style.display = "none";
    }, 3000);

    document.getElementById("pedido-form").reset();
    document
      .querySelectorAll(".fila")
      .forEach((f) => f.classList.remove("activo"));
    await cargarTodosLosProductos();
  } catch (e) {
    console.error(e);
    alert("Error al guardar el pedido.");
  }
}

// --- EVENTOS ---
document.getElementById("pedido-form").addEventListener("submit", (e) => {
  e.preventDefault();
  guardarPedidoFinal(false, false);
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

cargarTodosLosProductos();
