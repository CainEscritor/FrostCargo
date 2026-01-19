import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  writeBatch, // 🔹 Importante para el guardado atómico
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const contenedor = document.getElementById("contenedor-paneles");
const agregarBtn = document.getElementById("agregar-stock");

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

let estadoActual = {}; // Guardaremos el stock base para sumar sobre él

/* ===================== RENDERIZADO ===================== */

function crearPanel(titulo, col) {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <h2>${titulo}</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Producto</th>
          <th>Cantidad a agregar</th>
        </tr>
      </thead>
      <tbody data-col="${col}"></tbody>
    </table>
  `;
  contenedor.appendChild(panel);
  return panel.querySelector("tbody");
}

function renderizarTabla(tbody, data, idsData) {
  tbody.innerHTML = "";
  const productos = Object.keys(data).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  productos.forEach((prod) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idsData[prod] || "---"}</td>
      <td>${prod}</td>
      <td>
        <input type="number" min="0" placeholder="0" data-prod="${prod}" />
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ===================== CARGA PARALELA (BLAZE-FRIENDLY) ===================== */

async function cargarAgregarStock() {
  try {
    contenedor.innerHTML =
      "<p style='text-align:center;'>Cargando base de datos...</p>";

    // Lanzamos todas las peticiones al mismo tiempo
    const promesasStock = colecciones.map((col) =>
      getDoc(doc(db, col, "Stock"))
    );
    const promesaIDs = getDoc(doc(db, "idProductos", "idProducto"));

    const resultados = await Promise.all([...promesasStock, promesaIDs]);
    const idsData = resultados[resultados.length - 1].exists()
      ? resultados[resultados.length - 1].data()
      : {};

    contenedor.innerHTML = "";
    estadoActual = {}; // Limpiamos estado anterior

    for (let i = 0; i < colecciones.length; i++) {
      const col = colecciones[i];
      const snap = resultados[i];
      const data = snap.exists() ? snap.data() : {};

      estadoActual[col] = data; // Guardamos el stock actual en memoria

      const tbody = crearPanel(nombresColecciones[col] || col, col);
      renderizarTabla(tbody, data, idsData);
    }
  } catch (e) {
    console.error(e);
    alert("Error al cargar datos. Comprueba tu conexión.");
  }
}

/* ===================== GUARDADO ATÓMICO (BATCH) ===================== */

agregarBtn.addEventListener("click", async () => {
  try {
    agregarBtn.disabled = true;
    agregarBtn.textContent = "Procesando ingreso...";

    const batch = writeBatch(db);
    let hayCambios = false;

    // Recorremos los TBODY de la interfaz
    document.querySelectorAll("tbody").forEach((tbody) => {
      const col = tbody.dataset.col;
      const stockBase = { ...estadoActual[col] };
      let colModificada = false;

      // Buscamos inputs con valor > 0
      tbody.querySelectorAll("input").forEach((input) => {
        const prod = input.dataset.prod;
        const cantidadASumar = Number(input.value) || 0;

        if (cantidadASumar > 0) {
          stockBase[prod] = (stockBase[prod] || 0) + cantidadASumar;
          colModificada = true;
          hayCambios = true;
        }
      });

      // Si hubo cambios en esta colección, la añadimos al Batch
      if (colModificada) {
        const docRef = doc(db, col, "Stock");
        batch.set(docRef, stockBase);
      }
    });

    if (!hayCambios) {
      alert("No has ingresado ninguna cantidad.");
      agregarBtn.disabled = false;
      agregarBtn.textContent = "Cargar Productos";
      return;
    }

    // Ejecutamos todas las sumas en una sola transacción
    await batch.commit();

    alert("¡Ingreso de mercadería registrado con éxito! ✅");
    await cargarAgregarStock(); // Refrescar stock actual
  } catch (error) {
    console.error("Error en ingreso de stock:", error);
    alert("Hubo un error al guardar los datos ❌");
  } finally {
    agregarBtn.disabled = false;
    agregarBtn.textContent = "Cargar Productos";
  }
});

cargarAgregarStock();
