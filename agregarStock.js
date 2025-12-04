// agregarStock.js
import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  // updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const contenedor = document.getElementById("contenedor-paneles");
const refrescarBtn = document.getElementById("refrescar-btn");
const agregarBtn = document.getElementById("agregar-stock");

// Lista de colecciones (igual que en stock.js)
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

// Mapeo a nombres amigables
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

// Estado guardado en memoria: { colección: { prod: cantidad, ... }, ... }
const estadoActual = {};

// Crear panel dinámico (sólo el tbody con data-collection)
function crearPanelParaAgregar(titulo, idTabla, nombreColeccion) {
  const panel = document.createElement("div");
  panel.className = "panel";

  const h2 = document.createElement("h2");
  h2.textContent = titulo;
  panel.appendChild(h2);

  const table = document.createElement("table");
  table.id = `tabla-${idTabla}`;
  table.innerHTML = `
    <thead>
      <tr>
        <th>Producto</th>
        <th style="text-align:right">Cantidad a Agregar</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  panel.appendChild(table);

  const tbody = table.querySelector("tbody");
  tbody.dataset.collection = nombreColeccion;

  contenedor.appendChild(panel);
  return tbody;
}

// Renderiza inputs (placeholder 0) para cada producto
function renderizarAgregarInputs(tablaBody, data) {
  tablaBody.innerHTML = "";
  if (!data || Object.keys(data).length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="2" style="text-align:center; color:#666;">Sin datos</td>`;
    tablaBody.appendChild(tr);
    return;
  }

  const productos = Object.keys(data).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  productos.forEach(prod => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${prod}</td>
      <td style="text-align:right">
        <input type="number" min="0" placeholder="0" data-key="${prod}">
      </td>
    `;
    tablaBody.appendChild(tr);
  });
}

// Cargar todos los stocks (doc id "Stock" por colección, como en stock.js)
async function cargarAgregarTodos() {
  try {
    contenedor.innerHTML = "";
    const tbodies = colecciones.map((col, idx) => {
      const idTabla = `${col}-${idx}`;
      const titulo = nombresColecciones[col] || col;
      const tbody = crearPanelParaAgregar(titulo, idTabla, col);
      return { col, tbody };
    });

    const promesas = tbodies.map(item => {
      const referencia = doc(db, item.col, "Stock");
      return getDoc(referencia)
        .then(snap => ({ col: item.col, tbody: item.tbody, snap }))
        .catch(err => ({ col: item.col, tbody: item.tbody, error: err }));
    });

    const resultados = await Promise.all(promesas);

    resultados.forEach(res => {
      if (res.error) {
        res.tbody.innerHTML = `<tr><td colspan="2" style="color:#c00; text-align:center;">Error al cargar</td></tr>`;
        console.error("Error en colección", res.col, res.error);
        return;
      }
      const data = res.snap.exists() ? res.snap.data() : {};
      // guardamos estado actual (si no existe, lo dejamos vacío)
      estadoActual[res.col] = { ...(data || {}) };
      renderizarAgregarInputs(res.tbody, estadoActual[res.col]);
    });

  } catch (e) {
    console.error(e);
    alert("Error al cargar los stocks");
  }
}

// Evento: agregar al stock (suma)
agregarBtn.addEventListener("click", async () => {
  try {
    agregarBtn.disabled = true;
    agregarBtn.textContent = "Agregando...";

    const operaciones = [];

    // por cada tbody tomar inputs y sumar al estadoActual
    contenedor.querySelectorAll("tbody").forEach(tbody => {
      const coleccion = tbody.dataset.collection;
      if (!coleccion) return;

      // clonamos estado para modificar
      const copia = { ...(estadoActual[coleccion] || {}) };

      // sumar valores de inputs
      tbody.querySelectorAll("input[data-key]").forEach(input => {
        const k = input.dataset.key;
        const agregar = Number(input.value) || 0;
        if (agregar > 0) {
          copia[k] = (Number(copia[k]) || 0) + agregar;
        }
      });

      // si no hubo cambios (todo 0) no hacemos petición
      const tieneCambios = Object.keys(copia).some(key => copia[key] !== (Number(estadoActual[coleccion]?.[key]) || 0));
      if (!tieneCambios) return;

      // guardamos la nueva versión localmente
      estadoActual[coleccion] = copia;

      // guardamos en Firestore con merge para no borrar otros campos
      const ref = doc(db, coleccion, "Stock");
      operaciones.push(setDoc(ref, copia, { merge: true }));
    });

    if (operaciones.length === 0) {
      alert("No hay cantidades para agregar (todos los campos están en 0).");
      return;
    }

    await Promise.all(operaciones);

    alert("Stock agregado correctamente ✅");

    // recargar para limpiar inputs y mostrar valores actualizados
    await cargarAgregarTodos();

  } catch (err) {
    console.error(err);
    alert("Error agregando stock ❌");
  } finally {
    agregarBtn.disabled = false;
    agregarBtn.textContent = "Agregar al Stock";
  }
});

refrescarBtn.addEventListener("click", cargarAgregarTodos);

// carga inicial
cargarAgregarTodos();
