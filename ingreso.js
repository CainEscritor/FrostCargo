import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const categorias = ["Ingrese categoría", "Remito", "Factura"];
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
  "StockSwift"
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
const fechaNumericaInput = document.getElementById("fechaNumerica");
const categoriaSelect = document.getElementById("categoria");
const localidadInput = document.getElementById("localidad");
const nombreInput = document.getElementById("nombre");
const inputContainer = nombreInput.closest(".input-container");
const contenedorColecciones = document.getElementById("contenedor-colecciones");
const clienteAdvertenciaModal = document.getElementById("cliente-advertencia-modal");
const nombreClienteAdvertencia = document.getElementById("nombre-cliente-advertencia");
const btnGuardarForzado = document.getElementById("btn-guardar-forzado");
const btnCancelarModal = document.getElementById("btn-cancelar-modal");
const stockAdvertenciaModal = document.getElementById("stock-advertencia-modal");
const stockAdvertenciaTitulo = document.getElementById("stock-advertencia-titulo");
const stockAdvertenciaMensaje = document.getElementById("stock-advertencia-mensaje");
const stockDetalleDiv = document.getElementById("stock-detalle");
const btnForzarStock = document.getElementById("btn-forzar-stock");
const btnCancelarStock = document.getElementById("btn-cancelar-stock");
let guardarForzado = false;
let forzarStock = false;

function fillSelect(select, options) {
  select.innerHTML = options
    .map((opt) => `<option value="${opt.startsWith('Ingrese') ? 'Ingrese valor' : opt}">${opt}</option>`)
    .join("");
}
fillSelect(categoriaSelect, categorias);

const stocksPorColeccion = {};
const inputsPorColeccion = {};
let clientes = [];
let clientesInfo = {};

function normalizar(str = "") {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function cargarClientes() {
  const snap = await getDocs(collection(db, "Clientes"));
  clientes = snap.docs.map((d) => d.id).sort((a,b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  clientesInfo = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    clientesInfo[d.id] = {
      Direccion: data.Direccion || "----",
      Local: data.Local || "----",
      Localidad: data.Localidad || "----"
    };
  });
}

function crearPanelColeccion(nombreColeccion, titulo) {
  const panel = document.createElement("div");
  panel.className = "coleccion-panel panel";
  const h3 = document.createElement("h3");
  h3.textContent = titulo;
  panel.appendChild(h3);
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
    const p = document.createElement("p");
    p.style.color = "#666";
    p.style.textAlign = "center";
    p.textContent = "Sin datos";
    tbody.appendChild(p);
    return;
  }
  const productos = Object.keys(data).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  productos.forEach((prod) => {
    const fila = document.createElement("div");
    fila.className = "fila";
    fila.dataset.key = prod;
    const celNombre = document.createElement("div");
    celNombre.className = "celda";
    celNombre.textContent = prod;
    const celInput = document.createElement("div");
    celInput.style.width = "120px";
    celInput.style.textAlign = "right";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.className = "cantidad-input";
    input.dataset.key = prod;
    input.value = 0;
    input.addEventListener("input", (e) => {
      const val = Number(e.target.value) || 0;
      if (val > 0) fila.classList.add("activo");
      else fila.classList.remove("activo");
    });
    celInput.appendChild(input);
    fila.appendChild(celNombre);
    fila.appendChild(celInput);
    tbody.appendChild(fila);
  });
}

async function cargarTodosLosProductos() {
  try {
    contenedorColecciones.innerHTML = "";
    colecciones.forEach((col) =>
      crearPanelColeccion(col, nombresColecciones[col] || col)
    );
    const promesas = colecciones.map(async (col) => {
      try {
        const snap = await getDoc(doc(db, col, "Stock"));
        const data = snap.exists() ? snap.data() : {};
        stocksPorColeccion[col] = { ...(data || {}) };
        renderizarColeccion(inputsPorColeccion[col], stocksPorColeccion[col]);
      } catch (err) {
        if (inputsPorColeccion[col]) inputsPorColeccion[col].innerHTML =
          `<p style="color:#c00;text-align:center">Error al cargar</p>`;
        stocksPorColeccion[col] = {};
      }
    });
    await Promise.all(promesas);
    await cargarClientes();
  } catch (e) {
    alert("Error al cargar productos y clientes");
  }
}

nombreInput.addEventListener("input", () => {
  const valor = nombreInput.value.trim();
  const valorNorm = normalizar(valor);
  let lista = document.getElementById("sugerencias-lista");
  if (lista) lista.remove();
  if (!valor) return;
  const sugerencias = clientes
    .filter((c) => normalizar(c).includes(valorNorm))
    .slice(0, 5);
  if (sugerencias.length === 0) return;
  lista = document.createElement("ul");
  lista.id = "sugerencias-lista";
  sugerencias.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    li.tabIndex = 0;
    li.addEventListener("click", () => {
      nombreInput.value = s;
      lista.remove();
      const clienteData = clientesInfo[s];
      if (clienteData && localidadInput) {
        localidadInput.value = clienteData.Localidad !== "----" ? clienteData.Localidad : "";
      }
      nombreInput.focus();
    });
    li.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        li.click();
      }
    });
    lista.appendChild(li);
  });
  const destino = inputContainer || nombreInput.parentNode;
  destino.appendChild(lista);
});

document.addEventListener("click", (e) => {
  if (e.target !== nombreInput && e.target.closest("#sugerencias-lista") === null) {
    const lista = document.getElementById("sugerencias-lista");
    if (lista) lista.remove();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const lista = document.getElementById("sugerencias-lista");
    if (lista) lista.remove();
  }
});

function verificarStock() {
  const problemas = [];
  for (const col of colecciones) {
    const stockObj = stocksPorColeccion[col] || {};
    const tbody = inputsPorColeccion[col];
    if (!tbody) continue;
    const filas = Array.from(tbody.querySelectorAll(".fila"));
    filas.forEach((fila) => {
      const key = fila.dataset.key;
      const input = fila.querySelector("input[data-key]");
      const pedir = Number(input?.value) || 0;
      if (pedir <= 0) return;
      const actual = Number(stockObj[key] ?? 0);
      const despues = actual - pedir;
      if (despues <= 0) {
        problemas.push({
          coleccion: col,
          producto: key,
          pedido: pedir,
          actual,
          despues,
        });
      }
    });
  }
  return problemas;
}

async function guardarPedidoFinal() {
  const nombre = nombreInput.value.trim();
  const fechaNumerica = fechaNumericaInput.value;
  const categoria = categoriaSelect.value;
  const localidad = localidadInput.value.trim();
  const [year, month, day] = fechaNumerica.split("-");
  const fechaDocName = `${year}${month}${day}`;

  // 1. Obtener y preparar el número de remito (misma lógica)
  const remitoRef = doc(db, "NumeroRemito", "remito");
  const remitoSnap = await getDoc(remitoRef);
  let numeroRemito = remitoSnap.data()?.numero || 0;

  // 2. Modificación: Formatear y obtener los últimos 5 dígitos del remito
  const remitoFormateado = String(numeroRemito).padStart(5, '0');
  const ultimosCincoRemito = remitoFormateado.slice(-5);
  
  // 3. Modificación: Crear el nombre del documento con el número de remito
  // Formato: [Nombre Cliente] [AAAAMMDD] R[#####]
  const nombreDoc = `${nombre} ${fechaDocName} R${ultimosCincoRemito}`;
  
  let clienteData = clientesInfo[nombre] || { Direccion: "----", Local: "----", Localidad: localidad };
  if (clienteData.Localidad === "----") clienteData.Localidad = localidad;
  const clienteRef = doc(db, "Clientes", nombre);
  const clienteDocSnap = await getDoc(clienteRef);
  const productosPedidos = {};
  const historialUpdates = {};
  for (const col of colecciones) {
    const stockObj = stocksPorColeccion[col] || {};
    const tbody = inputsPorColeccion[col];
    if (!tbody) continue;
    const filas = Array.from(tbody.querySelectorAll(".fila"));
    filas.forEach((fila) => {
      const key = fila.dataset.key;
      const input = fila.querySelector("input[data-key]");
      const pedir = Number(input?.value) || 0;
      if (pedir <= 0) return;
      const pedidoKey = `${col}::${key}`;
      productosPedidos[pedidoKey] = { cantidad: pedir, coleccion: col, producto: key, checked: false };
      historialUpdates[key] = (historialUpdates[key] || 0) + pedir;
    });
  }
  const pedido = {
    Nombre: nombre,
    categoria,
    fechaEntrega: fechaNumerica,
    Localidad: clienteData.Localidad,
    fechaRegistro: Timestamp.now(),
    NumeroRemito: numeroRemito,
    Direccion: clienteData.Direccion,
    Local: clienteData.Local,
    productos: productosPedidos,
  };
  try {
    // Usa el nuevo nombre del documento que incluye el remito
    await setDoc(doc(db, "Pedidos", nombreDoc), pedido); 
    // Incrementa el número de remito para el próximo pedido
    await updateDoc(remitoRef, { numero: numeroRemito + 1 });
    const operaciones = [];
    for (const col of colecciones) {
      const stockObj = stocksPorColeccion[col] || {};
      const tbody = inputsPorColeccion[col];
      if (!tbody) continue;
      const nuevo = { ...stockObj };
      let huboCambio = false;
      Array.from(tbody.querySelectorAll(".fila")).forEach((fila) => {
        const key = fila.dataset.key;
        const input = fila.querySelector("input[data-key]");
        const pedir = Number(input?.value) || 0;
        if (pedir <= 0) return;
        const actual = Number(stockObj[key] || 0);
        nuevo[key] = actual - pedir;
        huboCambio = true;
      });
      if (huboCambio) operaciones.push(setDoc(doc(db, col, "Stock"), nuevo, { merge: true }));
    }
    const fechaActual = new Date();
    const mesAnio = `${fechaActual.getFullYear()}-${(fechaActual.getMonth() + 1).toString().padStart(2, "0")}`;
    if (clienteDocSnap.exists()) {
      const clienteActual = clienteDocSnap.data();
      const historialActual = clienteActual.historial || {};
      const updatesParaCliente = {};
      for (const [producto, cantidad] of Object.entries(historialUpdates)) {
        const actualMesProd = historialActual[mesAnio]?.[producto] || 0;
        updatesParaCliente[`historial.${mesAnio}.${producto}`] = actualMesProd + cantidad;
      }
      if (Object.keys(updatesParaCliente).length) operaciones.push(updateDoc(clienteRef, updatesParaCliente));
    } else {
      operaciones.push(setDoc(clienteRef, { Nombre: nombre, Direccion: clienteData.Direccion, Local: clienteData.Local, Localidad: clienteData.Localidad, historial: { [mesAnio]: historialUpdates } }, { merge: true }));
    }
    await Promise.all(operaciones);
    mostrarEstado(`Pedido "${nombreDoc}" guardado (Remito N° ${numeroRemito})`);
    nombreInput.value = "";
    fechaNumericaInput.value = "";
    categoriaSelect.value = categorias[0];
    localidadInput.value = "";
    guardarForzado = false;
    forzarStock = false;
    await cargarTodosLosProductos();
  } catch (e) {
    mostrarEstado("Error guardando pedido");
  }
}

document.getElementById("pedido-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = nombreInput.value.trim();
  const fechaNumerica = fechaNumericaInput.value;
  const categoria = categoriaSelect.value;
  const localidad = localidadInput.value.trim();
  const camposFaltantes = [];
  if (!nombre) camposFaltantes.push("Nombre del cliente");
  if (!fechaNumerica) camposFaltantes.push("Fecha numérica");
  if (categoria === "Ingrese categoría" || categoria === "Ingrese valor") camposFaltantes.push("Categoría");
  if (!localidad) camposFaltantes.push("Localidad");
  if (camposFaltantes.length > 0) {
    stockAdvertenciaTitulo.textContent = "⚠️ Campos Faltantes";
    stockAdvertenciaMensaje.innerHTML = `Por favor completa: <ul>${camposFaltantes.map((c) => `<li>${c}</li>`).join("")}</ul>`;
    stockDetalleDiv.style.display = "none";
    btnForzarStock.style.display = "none";
    btnCancelarStock.textContent = "Aceptar";
    stockAdvertenciaModal.style.display = "flex";
    return;
  }
  let totalPedidos = 0;
  for (const col of colecciones) {
    const tbody = inputsPorColeccion[col];
    if (!tbody) continue;
    Array.from(tbody.querySelectorAll("input[data-key]")).forEach((inp) => (totalPedidos += Number(inp.value) || 0));
  }
  if (totalPedidos === 0) {
    mostrarEstado("Debe pedir al menos un producto");
    return;
  }
  if (!forzarStock) {
    const problemas = verificarStock();
    if (problemas.length > 0) {
      stockAdvertenciaTitulo.textContent = "⚠️ Stock insuficiente";
      stockAdvertenciaMensaje.textContent = "Los siguientes productos quedarán con stock igual o menor a cero. ¿Desea continuar?";
      stockDetalleDiv.style.display = "block";
      stockDetalleDiv.innerHTML = problemas.map((p) => `<p><strong>${nombresColecciones[p.coleccion] || p.coleccion} → ${p.producto}</strong>: Actual ${p.actual}, Pedido ${p.pedido}, Final <span style="color:${p.despues <= 0 ? "red" : "orange"}">${p.despues}</span></p>`).join("");
      btnForzarStock.style.display = "inline-block";
      btnForzarStock.textContent = "Forzar guardado (aceptar stock negativo/cero)";
      btnCancelarStock.textContent = "Cancelar (Editar pedido)";
      stockAdvertenciaModal.style.display = "flex";
      return;
    }
  }
  const clienteExiste = clientes.includes(nombre);
  if (!clienteExiste && !guardarForzado) {
    nombreClienteAdvertencia.textContent = nombre;
    clienteAdvertenciaModal.style.display = "flex";
    return;
  }
  await guardarPedidoFinal();
});

btnGuardarForzado.addEventListener("click", () => {
  clienteAdvertenciaModal.style.display = "none";
  guardarForzado = true;
  document.getElementById("pedido-form").dispatchEvent(new Event("submit"));
});
btnCancelarModal.addEventListener("click", () => {
  clienteAdvertenciaModal.style.display = "none";
  guardarForzado = false;
});
btnForzarStock.addEventListener("click", () => {
  stockAdvertenciaModal.style.display = "none";
  forzarStock = true;
  document.getElementById("pedido-form").dispatchEvent(new Event("submit"));
});
btnCancelarStock.addEventListener("click", () => {
  stockAdvertenciaModal.style.display = "none";
  forzarStock = false;
});

function mostrarEstado(msg) {
  const snackbar = document.createElement("div");
  snackbar.textContent = msg;
  snackbar.style.position = "fixed";
  snackbar.style.bottom = "24px";
  snackbar.style.left = "50%";
  snackbar.style.transform = "translateX(-50%)";
  snackbar.style.background = "#222";
  snackbar.style.color = "#fff";
  snackbar.style.padding = "10px 14px";
  snackbar.style.borderRadius = "8px";
  snackbar.style.zIndex = 5000;
  snackbar.style.opacity = "0";
  snackbar.style.transition = "opacity .2s";
  document.body.appendChild(snackbar);
  requestAnimationFrame(() => (snackbar.style.opacity = "1"));
  setTimeout(() => {
    snackbar.style.opacity = "0";
    setTimeout(() => snackbar.remove(), 250);
  }, 2500);
}

cargarTodosLosProductos();