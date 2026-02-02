import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  writeBatch,
  deleteField,
  FieldPath
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* ================= CONFIG ================= */

const colecciones = [
  "StockCarnicos","StockFrigorBalde","StockFrigorImpulsivos","StockFrigorPostres",
  "StockFrigorPotes","StockGlupsGranel","StockGlupsImpulsivos","StockGudfud",
  "StockInal","StockLambweston","StockMexcal","StockOrale","StockPripan","StockSwift"
];

const nombresEtiquetas = {
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
  StockSwift: "Swift"
};

/* ================= DOM ================= */

const selectOrigen = document.getElementById("cat-origen");
const selectProdOrigen = document.getElementById("nom-origen");
const selectDestino = document.getElementById("cat-destino");
const inputNomNuevo = document.getElementById("nom-nuevo");
const inputIdNuevo = document.getElementById("id-nuevo");

/* ================= DATA ================= */

let datosStockActual = {};
let catalogoIDs = {};

/* ================= INIT ================= */

async function inicializar() {
  colecciones.forEach(col => {
    selectOrigen.add(new Option(nombresEtiquetas[col], col));
    selectDestino.add(new Option(nombresEtiquetas[col], col));
  });

  const snapIDs = await getDoc(doc(db, "idProductos", "idProducto"));
  if (snapIDs.exists()) catalogoIDs = snapIDs.data();
}

/* ================= CARGAR PRODUCTOS ================= */

selectOrigen.onchange = async () => {
  const col = selectOrigen.value;
  selectProdOrigen.innerHTML = "<option>Cargando...</option>";

  const snap = await getDoc(doc(db, col, "Stock"));
  selectProdOrigen.innerHTML = '<option disabled selected>Seleccione producto...</option>';

  if (snap.exists()) {
    datosStockActual = snap.data();
    Object.keys(datosStockActual).sort().forEach(p => {
      selectProdOrigen.add(new Option(p, p));
    });
  }
};

/* ================= AUTOCOMPLETAR ================= */

selectProdOrigen.onchange = () => {
  const nombre = selectProdOrigen.value;
  selectDestino.value = selectOrigen.value;
  inputNomNuevo.value = nombre;
  inputIdNuevo.value = catalogoIDs[nombre] || "";
};

/* ================= MODIFICAR ================= */

document.getElementById("btn-ejecutar").onclick = async () => {
  const catOri = selectOrigen.value;
  const catDes = selectDestino.value;

  const nomOri = selectProdOrigen.value;
  const nomNue = inputNomNuevo.value.trim();
  const idNue = inputIdNuevo.value.trim();

  if (!nomOri || !nomNue || !idNue) return alert("Faltan datos");

  const stockValor = datosStockActual[nomOri];

  const refStockOri = doc(db, catOri, "Stock");
  const refStockDes = doc(db, catDes, "Stock");
  const refIDs = doc(db, "idProductos", "idProducto");

  const batch = writeBatch(db);

  // 🔥 BORRAR PRODUCTO VIEJO (CON FieldPath)
  batch.update(refStockOri, new FieldPath(nomOri), deleteField());
  batch.update(refIDs, new FieldPath(nomOri), deleteField());

  // 🔥 CREAR PRODUCTO NUEVO
  batch.set(refStockDes, { [nomNue]: stockValor }, { merge: true });
  batch.set(refIDs, { [nomNue]: idNue }, { merge: true });

  await batch.commit();

  alert("Producto modificado");
  location.reload();
};

inicializar();

