import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  writeBatch, // 🔹 Importamos Batch para guardado atómico
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const contenedor = document.getElementById("contenedor-paneles");
const refrescarBtn = document.getElementById("refrescar-btn");
const guardarBtn = document.getElementById("guardar-stock");

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
  StockSwift: "Swift",
};

/* ===================== RENDERIZADO ===================== */

function crearPanelEditable(titulo, nombreColeccion) {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>${titulo}</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Producto</th>
          <th>Cantidad</th>
        </tr>
      </thead>
      <tbody data-collection="${nombreColeccion}"></tbody>
    </table>
  `;
  contenedor.appendChild(panel);
  return panel.querySelector("tbody");
}

function renderizarInputs(tablaBody, data, idsData) {
  tablaBody.innerHTML = "";
  const productos = Object.keys(data).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  if (productos.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#666;">Sin datos</td></tr>`;
    return;
  }

  productos.forEach((prod) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idsData[prod] || "---"}</td>
      <td>${prod}</td>
      <td>
        <input type="number" min="0" value="${
          data[prod]
        }" data-key="${prod}" class="cantidad-input">
      </td>
    `;
    tablaBody.appendChild(tr);
  });
}

/* ===================== CARGA (PARALELA) ===================== */

async function cargarModificarTodos() {
  try {
    contenedor.innerHTML =
      "<p style='text-align:center;'>Cargando stock para edición...</p>";

    // Cargamos IDs y Stocks en paralelo
    const promesas = colecciones.map((col) => getDoc(doc(db, col, "Stock")));
    const promesaIDs = getDoc(doc(db, "idProductos", "idProducto"));

    const resultados = await Promise.all([...promesas, promesaIDs]);
    const idsData = resultados[resultados.length - 1].exists()
      ? resultados[resultados.length - 1].data()
      : {};

    contenedor.innerHTML = "";

    for (let i = 0; i < colecciones.length; i++) {
      const col = colecciones[i];
      const snap = resultados[i];
      const tbody = crearPanelEditable(nombresColecciones[col] || col, col);
      const data = snap.exists() ? snap.data() : {};
      renderizarInputs(tbody, data, idsData);
    }
  } catch (e) {
    console.error(e);
    alert("Error al cargar los stocks ❌");
  }
}

/* ===================== GUARDADO ATÓMICO (BATCH) ===================== */

guardarBtn.addEventListener("click", async () => {
  try {
    guardarBtn.disabled = true;
    guardarBtn.textContent = "Guardando en Batch...";

    // 1. Iniciamos el Batch
    const batch = writeBatch(db);
    let hayCambios = false;

    // 2. Recorremos los paneles para armar la actualización
    contenedor.querySelectorAll("tbody").forEach((tbody) => {
      const coleccion = tbody.dataset.collection;
      const nuevoObjeto = {};
      const inputs = tbody.querySelectorAll("input[data-key]");

      if (inputs.length > 0) {
        inputs.forEach((input) => {
          nuevoObjeto[input.dataset.key] = Number(input.value) || 0;
        });

        // Agregamos la operación al batch
        const docRef = doc(db, coleccion, "Stock");
        batch.set(docRef, nuevoObjeto); // Usamos set para sobrescribir el stock completo de esa col
        hayCambios = true;
      }
    });

    if (!hayCambios) {
      alert("No hay datos para guardar");
      return;
    }

    // 3. Ejecutamos el batch (una sola petición de red para todo)
    await batch.commit();

    alert("¡Stock actualizado correctamente en todas las categorías! ✅");
    await cargarModificarTodos(); // Recargamos para refrescar la vista
  } catch (err) {
    console.error("Error en batch:", err);
    alert("Error crítico al guardar. Comprueba tu conexión. ❌");
  } finally {
    guardarBtn.disabled = false;
    guardarBtn.textContent = "Guardar Cambios";
  }
});

refrescarBtn.addEventListener("click", cargarModificarTodos);
cargarModificarTodos();
