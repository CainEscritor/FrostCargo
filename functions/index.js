const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

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

exports.guardarHistorialStock = onSchedule(
  {
    schedule: "10 28 * * *",
    timeZone: "America/Argentina/Buenos_Aires",
  },
  async () => {
    const historial = {};

    for (const col of colecciones) {
      const snap = await db.doc(`${col}/Stock`).get();
      if (!snap.exists) continue;

      const data = snap.data();
      for (const producto in data) {
        historial[producto] = data[producto];
      }
    }

    const fecha = new Date()
      .toLocaleDateString("es-AR")
      .replace(/\//g, "-");

    await db.collection("HistorialStock").doc(fecha).set({
      fecha: admin.firestore.Timestamp.now(),
      stock: historial,
    });

    console.log("Historial guardado:", fecha);
  }
);
