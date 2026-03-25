import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const contenedor = document.getElementById("contenedor-paneles");
const refrescarBtn = document.getElementById("refrescar-btn");
const abrirModalBtn = document.getElementById("listado-btn");

const modal = document.getElementById("modal-export");
const step1 = document.getElementById("step-1");
const step2 = document.getElementById("step-2");
const btnConCant = document.getElementById("btn-con-cant");
const btnSinCant = document.getElementById("btn-sin-cant");
const btnPdf = document.getElementById("btn-formato-pdf");
const btnExcel = document.getElementById("btn-formato-excel");
const btnCerrar = document.getElementById("btn-cerrar-modal");

let incluirStockGlobal = false;
let datosCache = null;

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

/* ===================== BUSCADOR (SE CREA SOLO) ===================== */

function crearBuscador() {
  if (document.getElementById("buscador")) return;

  const input = document.createElement("input");
  input.id = "buscador";
  input.placeholder = "🔍 Buscar producto...";
  input.style = `
    width:100%;
    max-width:1100px;
    margin:10px auto;
    padding:10px;
    border-radius:8px;
    border:1px solid #ccc;
    display:block;
  `;

  contenedor.parentElement.insertBefore(input, contenedor);

  input.addEventListener("input", () => {
    const texto = input.value.toLowerCase();

    document.querySelectorAll("tbody tr").forEach((fila) => {
      const producto = fila.children[1].textContent.toLowerCase();
      fila.style.display = producto.includes(texto) ? "" : "none";
    });
  });
}

/* ===================== OBTENER RESERVAS ===================== */

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

function crearPanel(titulo) {
  const panel = document.createElement("div");
  panel.className = "panel";

  panel.innerHTML = `
    <h2>${titulo}</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Producto</th>
          <th>Disponible</th>
          <th>Real</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  contenedor.appendChild(panel);
  return panel.querySelector("tbody");
}

async function cargarTodosLosStocks() {
  contenedor.innerHTML =
    "<p style='text-align:center; padding:20px;'>Cargando inventario...</p>";

  try {
    crearBuscador(); // 🔍 se crea automáticamente

    const reservas = await obtenerReservas();

    const promesasStock = colecciones.map((col) =>
      getDoc(doc(db, col, "Stock"))
    );
    const promesaIDs = getDoc(doc(db, "idProductos", "idProducto"));

    const resultados = await Promise.all([...promesasStock, promesaIDs]);

    const idsData = resultados[resultados.length - 1].exists()
      ? resultados[resultados.length - 1].data()
      : {};

    datosCache = {
      ids: idsData,
      stocks: {},
      reservas: reservas,
    };

    contenedor.innerHTML = "";

    for (let i = 0; i < colecciones.length; i++) {
      const col = colecciones[i];
      const snap = resultados[i];
      const data = snap.exists() ? snap.data() : {};

      datosCache.stocks[col] = data;

      const titulo = nombresColecciones[col] || col;
      const tbody = crearPanel(titulo);

      const productos = Object.keys(data).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );

      if (productos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Sin datos</td></tr>`;
      } else {
        productos.forEach((prod) => {
          const disponible = data[prod] || 0;
          const reservado = reservas[prod] || 0;
          const real = disponible + reservado;

          const tr = document.createElement("tr");

          const claseDisp = disponible < 0 ? "negativo" : "";
          const claseReal = real < 0 ? "negativo" : "";

          if (real < 0) {
            tr.style.background = "#fdecea"; // 🔴 fila completa en rojo suave
          }

          tr.innerHTML = `
            <td>${idsData[prod] || "---"}</td>
            <td>${prod}</td>
            <td class="${claseDisp}">${disponible}</td>
            <td class="${claseReal}">${real}</td>
          `;

          tbody.appendChild(tr);
        });
      }
    }
  } catch (e) {
    console.error(e);
    contenedor.innerHTML =
      "<p style='color:red; text-align:center;'>Error con Firebase</p>";
  }
}

/* ===================== MODAL ===================== */

abrirModalBtn.addEventListener("click", () => {
  if (!datosCache) return alert("Esperá a que cargue todo.");
  step1.classList.remove("hidden");
  step2.classList.add("hidden");
  modal.style.display = "flex";
});

btnCerrar.addEventListener("click", () => (modal.style.display = "none"));

btnConCant.addEventListener("click", () => {
  incluirStockGlobal = true;
  step1.classList.add("hidden");
  step2.classList.remove("hidden");
});

btnSinCant.addEventListener("click", () => {
  incluirStockGlobal = false;
  step1.classList.add("hidden");
  step2.classList.remove("hidden");
});

btnPdf.addEventListener("click", () => {
  modal.style.display = "none";
  generarPDF(incluirStockGlobal);
});

btnExcel.addEventListener("click", () => {
  modal.style.display = "none";
  generarExcel(incluirStockGlobal);
});

/* ===================== PDF ===================== */

function generarPDF(conCant) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  let y = 15;

  pdf.setFontSize(18).text("INVENTARIO FROST CARGO", 105, y, { align: "center" });
  y += 15;

  for (const col of colecciones) {
    const data = datosCache.stocks[col];
    if (!data) continue;

    const productos = Object.keys(data).sort();

    productos.forEach((prod) => {
      const disponible = data[prod] || 0;
      const reservado = datosCache.reservas[prod] || 0;
      const real = disponible + reservado;

      let linea = `${prod}`;
      if (conCant) linea += ` | Disp: ${disponible} | Real: ${real}`;

      pdf.text(linea, 10, y);
      y += 6;

      if (y > 280) {
        pdf.addPage();
        y = 20;
      }
    });
  }

  pdf.save("Stock_FrostCargo.pdf");
}

/* ===================== EXCEL ===================== */

function generarExcel(conCant) {
  const filas = [["CATEGORÍA", "ID", "PRODUCTO", "DISPONIBLE", "REAL"]];

  for (const col of colecciones) {
    const data = datosCache.stocks[col];
    if (!data) continue;

    Object.keys(data).forEach((prod) => {
      const disponible = data[prod] || 0;
      const reservado = datosCache.reservas[prod] || 0;
      const real = disponible + reservado;

      filas.push([
        nombresColecciones[col],
        datosCache.ids[prod] || "---",
        prod,
        disponible,
        real,
      ]);
    });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(filas);
  XLSX.utils.book_append_sheet(wb, ws, "Stock");
  XLSX.writeFile(wb, "Stock_FrostCargo.xlsx");
}

/* ===================== INIT ===================== */

refrescarBtn.addEventListener("click", cargarTodosLosStocks);
cargarTodosLosStocks();