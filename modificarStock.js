import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  writeBatch,
  collection,
  getDocs
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

/* ===================== RESERVAS (IGUAL QUE STOCK) ===================== */

async function obtenerReservas() {
  const reservas = {};

  const querySnapshot = await getDocs(collection(db, "Pedidos"));

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();

    if (!data.productos) return;

    Object.values(data.productos).forEach((prod) => {
      const nombre = prod.producto;
      const cantidad = prod.cantidad || 0;

      reservas[nombre] = (reservas[nombre] || 0) + cantidad;
    });
  });

  return reservas;
}

/* ===================== RENDER ===================== */

function crearPanelEditable(titulo, nombreColeccion) {
  const panel = document.createElement("div");
  panel.className = "panel";

  panel.innerHTML = `
    <h2>${titulo}</h2>
    <table>
      <thead>
        <tr>
          <th style="width:15%;">ID</th>
          <th style="width:45%; text-align:left;">Producto</th>
          <th style="width:20%; text-align:center;">Disponible</th>
          <th style="width:20%; text-align:center;">Real</th>
        </tr>
      </thead>
      <tbody data-collection="${nombreColeccion}"></tbody>
    </table>
  `;

  contenedor.appendChild(panel);
  return panel.querySelector("tbody");
}

function renderizarInputs(tablaBody, data, idsData, reservas = {}) {
  tablaBody.innerHTML = "";

  const productos = Object.keys(data).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  if (productos.length === 0) {
    tablaBody.innerHTML =
      `<tr><td colspan="4" style="text-align:center; color:#666;">Sin datos</td></tr>`;
    return;
  }

  productos.forEach((prod) => {
    const disponible = data[prod] || 0;
    const reservado = reservas[prod] || 0;

    const real = disponible + reservado;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td style="text-align:center;">${idsData[prod] || "---"}</td>

      <td style="text-align:left; font-weight:bold;">
        ${prod}
      </td>

      <td style="text-align:center;">
        <input 
          type="number" 
          min="0" 
          value="${disponible}" 
          data-key="${prod}" 
          class="cantidad-input"
          style="width:80px; text-align:center;"
        >
      </td>

      <td style="text-align:center; font-weight:bold; color:#333;">
        ${real}
      </td>
    `;

    tablaBody.appendChild(tr);
  });
}

/* ===================== CARGA ===================== */

async function cargarModificarTodos() {
  try {
    contenedor.innerHTML =
      "<p style='text-align:center;'>Cargando stock para edición...</p>";

    const promesas = colecciones.map((col) =>
      getDoc(doc(db, col, "Stock"))
    );

    const promesaIDs = getDoc(doc(db, "idProductos", "idProducto"));

    const resultados = await Promise.all([...promesas, promesaIDs]);

    const idsData = resultados[resultados.length - 1].exists()
      ? resultados[resultados.length - 1].data()
      : {};

    const reservas = await obtenerReservas();

    contenedor.innerHTML = "";

    for (let i = 0; i < colecciones.length; i++) {
      const col = colecciones[i];
      const snap = resultados[i];

      const data = snap.exists() ? snap.data() : {};

      const tbody = crearPanelEditable(
        nombresColecciones[col] || col,
        col
      );

      renderizarInputs(tbody, data, idsData, reservas);
    }

  } catch (e) {
    console.error(e);
    alert("Error al cargar los stocks ❌");
  }
}

/* ===================== GUARDADO ===================== */

guardarBtn.addEventListener("click", async () => {
  try {
    guardarBtn.disabled = true;
    guardarBtn.textContent = "Guardando...";

    const batch = writeBatch(db);
    let hayCambios = false;

    contenedor.querySelectorAll("tbody").forEach((tbody) => {
      const coleccion = tbody.dataset.collection;
      const nuevoObjeto = {};

      tbody.querySelectorAll("input[data-key]").forEach((input) => {
        nuevoObjeto[input.dataset.key] = Number(input.value) || 0;
      });

      const docRef = doc(db, coleccion, "Stock");

      batch.set(docRef, nuevoObjeto);
      hayCambios = true;
    });

    if (!hayCambios) {
      alert("No hay datos para guardar");
      return;
    }

    await batch.commit();

    alert("Stock actualizado correctamente ✅");
    await cargarModificarTodos();

  } catch (err) {
    console.error(err);
    alert("Error al guardar ❌");
  } finally {
    guardarBtn.disabled = false;
    guardarBtn.textContent = "Guardar Cambios";
  }
});

/* ===================== INIT ===================== */

refrescarBtn.addEventListener("click", cargarModificarTodos);
cargarModificarTodos();