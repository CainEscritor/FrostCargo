// stock.js
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const contenedor = document.getElementById("contenedor-paneles");
const refrescarBtn = document.getElementById("refrescar-btn");

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

// Mapeo de nombre de colección -> título a mostrar
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

function crearPanel(titulo, idTabla) {
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
        <th>Cantidad</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  panel.appendChild(table);
  contenedor.appendChild(panel);
  return table.querySelector("tbody");
}

function renderizarTabla(tablaBody, data) {
  tablaBody.innerHTML = "";
  if (!data || Object.keys(data).length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="2" style="text-align:center; color:#666;">Sin datos</td>`;
    tablaBody.appendChild(tr);
    return;
  }
  const productos = Object.keys(data);
  productos.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  productos.forEach(prod => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${prod}</td><td>${data[prod]}</td>`;
    tablaBody.appendChild(tr);
  });
}

async function cargarTodosLosStocks() {
  try {
    contenedor.innerHTML = "";
    const tbodies = colecciones.map((col, idx) => {
      const idTabla = `${col}-${idx}`;
      // usar el nombre mapeado si existe, sino usar el nombre de la colección
      const titulo = nombresColecciones[col] || col;
      const tbody = crearPanel(titulo, idTabla);
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
        return;
      }
      const data = res.snap.exists() ? res.snap.data() : {};
      renderizarTabla(res.tbody, data);
    });
  } catch (e) {
    console.error(e);
    alert("Error al cargar los stocks");
  }
}

refrescarBtn.addEventListener("click", cargarTodosLosStocks);
cargarTodosLosStocks();
