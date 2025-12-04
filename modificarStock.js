// modificarStock.js
import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  // updateDoc, // no usamos updateDoc directamente por si falta doc
  setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const contenedor = document.getElementById("contenedor-paneles");
const refrescarBtn = document.getElementById("refrescar-btn");
const guardarBtn = document.getElementById("guardar-stock");

// Lista de colecciones (idéntica a la de stock.js)
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

// Mapeo nombre -> título amigable (igual que en stock.js)
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

// Mantener el estado actual de cada colección en memoria
const estadoColecciones = {}; // { "StockCarnicos": { prod1: 12, ... }, ... }

function crearPanelEditable(titulo, idTabla, nombreColeccion) {
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
        <th style="text-align:right">Cantidad</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  panel.appendChild(table);

  // guardamos referencia al atributo data-collection en el tbody para luego leer
  const tbody = table.querySelector("tbody");
  tbody.dataset.collection = nombreColeccion;

  contenedor.appendChild(panel);
  return tbody;
}

function renderizarInputs(tablaBody, data) {
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

    // input numérico con data-key para el producto
    tr.innerHTML = `
      <td>${prod}</td>
      <td style="text-align:right">
        <input type="number" min="0" value="${data[prod]}" data-key="${prod}">
      </td>
    `;
    tablaBody.appendChild(tr);
  });
}

async function cargarModificarTodos() {
  try {
    contenedor.innerHTML = "";
    // Crear paneles
    const tbodies = colecciones.map((col, idx) => {
      const idTabla = `${col}-${idx}`;
      const titulo = nombresColecciones[col] || col;
      const tbody = crearPanelEditable(titulo, idTabla, col);
      return { col, tbody };
    });

    // Solicitar todos los docs
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
        console.error("Error cargando colección", res.col, res.error);
        return;
      }
      const data = res.snap.exists() ? res.snap.data() : {};
      // almacenar estado
      estadoColecciones[res.col] = { ...(data || {}) };
      renderizarInputs(res.tbody, estadoColecciones[res.col]);
    });

  } catch (e) {
    console.error(e);
    alert("Error al cargar los stocks");
  }
}

// Guardar cambios: leer todos los inputs de cada tbody y enviar a Firestore
guardarBtn.addEventListener("click", async () => {
  try {
    guardarBtn.disabled = true;
    guardarBtn.textContent = "Guardando...";

    const operaciones = [];

    // para cada tbody dentro de contenedor
    contenedor.querySelectorAll("tbody").forEach(tbody => {
      const coleccion = tbody.dataset.collection;
      if (!coleccion) return;

      // construir objeto con los valores actuales
      const nuevoObjeto = {};
      tbody.querySelectorAll("input[data-key]").forEach(input => {
        const k = input.dataset.key;
        const v = Number(input.value) || 0;
        nuevoObjeto[k] = v;
      });

      // si no hay elementos no hacemos nada
      // usamos setDoc con merge true para no borrar otros campos
      const ref = doc(db, coleccion, "Stock");
      operaciones.push(setDoc(ref, nuevoObjeto, { merge: true }));
    });

    await Promise.all(operaciones);

    alert("Stock actualizado correctamente ✅");
    // recargar para reflejar cambios
    await cargarModificarTodos();

  } catch (err) {
    console.error(err);
    alert("Error guardando stock ❌");
  } finally {
    guardarBtn.disabled = false;
    guardarBtn.textContent = "Guardar Cambios";
  }
});

refrescarBtn.addEventListener("click", cargarModificarTodos);

// carga inicial
cargarModificarTodos();
