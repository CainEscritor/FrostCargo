import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  deleteDoc, // 🔹 Añadido para poder renombrar
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// DOM
const formBuscar = document.getElementById("form-buscar-cliente");
const nombreClienteBuscarInput = document.getElementById(
  "nombre-cliente-buscar"
);
const btnBuscar = document.getElementById("btn-buscar");
const mensajeBusquedaDiv = document.getElementById("mensaje-busqueda");
const panelModificacion = document.getElementById("panel-modificacion");

const formModifica = document.getElementById("form-modifica-cliente");
const btnGuardar = document.getElementById("btn-guardar-cambios");
const mensajeModificacionDiv = document.getElementById("mensaje-modificacion");

const nombreInput = document.getElementById("nombre");
const direccionInput = document.getElementById("direccion");
const cuitInput = document.getElementById("cuit");
const localInput = document.getElementById("local");
const localidadInput = document.getElementById("localidad");
const telefonoInput = document.getElementById("telefono");

// Variables de estado
let clienteOriginalId = null;

// ----------------------------------------------------------------------
// AUTOCOMPLETADO OPTIMIZADO PARA MILES DE CLIENTES (Blaze-Friendly)
// ----------------------------------------------------------------------

nombreClienteBuscarInput.addEventListener("input", async () => {
  const valor = nombreClienteBuscarInput.value.trim();

  // Solo busca si escribió al menos 3 letras (Ahorra lecturas innecesarias)
  if (valor.length < 3) {
    removerListaSugerencias();
    return;
  }

  try {
    // Búsqueda por rango: Busca nombres que empiecen con lo escrito
    // El caracter '\uf8ff' es un truco de Firestore para buscar prefijos
    const q = query(
      collection(db, "Clientes"),
      where("Nombre", ">=", valor),
      where("Nombre", "<=", valor + "\uf8ff"),
      limit(10)
    );

    const snap = await getDocs(q);
    const sugerencias = snap.docs.map((d) => d.data().Nombre);

    renderizarSugerencias(sugerencias);
  } catch (e) {
    console.error("Error en sugerencias:", e);
  }
});

function renderizarSugerencias(sugerencias) {
  removerListaSugerencias();
  if (sugerencias.length === 0) return;

  const lista = document.createElement("ul");
  lista.id = "sugerencias-lista-modifica";
  lista.classList.add("sugerencias-lista");

  sugerencias.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    li.addEventListener("click", () => {
      nombreClienteBuscarInput.value = s;
      removerListaSugerencias();
    });
    lista.appendChild(li);
  });

  nombreClienteBuscarInput.parentNode.appendChild(lista);
}

function removerListaSugerencias() {
  const lista = document.getElementById("sugerencias-lista-modifica");
  if (lista) lista.remove();
}

// ----------------------------------------------------------------------
// LÓGICA DE BÚSQUEDA POR ID
// ----------------------------------------------------------------------

async function buscarYMostrarCliente() {
  const nombreBusqueda = nombreClienteBuscarInput.value.trim();
  mensajeBusquedaDiv.textContent = "";
  formModifica.style.display = "none";

  if (!nombreBusqueda) return;

  btnBuscar.disabled = true;
  btnBuscar.textContent = "Buscando...";

  try {
    // En tu DB el ID es el Nombre
    const clienteRef = doc(db, "Clientes", nombreBusqueda);
    const clienteSnap = await getDoc(clienteRef);

    if (!clienteSnap.exists()) {
      mensajeBusquedaDiv.textContent = "Cliente no encontrado.";
      mensajeBusquedaDiv.style.color = "orange";
      return;
    }

    const data = clienteSnap.data();
    nombreInput.value = data.Nombre || "";
    direccionInput.value = data.Direccion || "";
    cuitInput.value = data.CUIT || "";
    localInput.value = data.Local || "";
    localidadInput.value = data.Localidad || "";
    telefonoInput.value = data.Telefono || "";

    clienteOriginalId = nombreBusqueda;
    formModifica.style.display = "flex";
    mensajeBusquedaDiv.textContent = "Datos cargados correctamente.";
    mensajeBusquedaDiv.style.color = "green";

    aplicarFormatoCuit(cuitInput);
  } catch (error) {
    mensajeBusquedaDiv.textContent = "Error al buscar cliente.";
    console.error(error);
  } finally {
    btnBuscar.disabled = false;
    btnBuscar.textContent = "Cargar Datos del Cliente";
  }
}

formBuscar.addEventListener("submit", (e) => {
  e.preventDefault();
  buscarYMostrarCliente();
});

// ----------------------------------------------------------------------
// GUARDADO CON LÓGICA DE RENOMBRE (Crucial para IDs basados en Nombre)
// ----------------------------------------------------------------------

formModifica.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nuevoNombre = nombreInput.value.trim();
  const datos = {
    Nombre: nuevoNombre,
    Direccion: direccionInput.value.trim(),
    CUIT: cuitInput.value.trim(),
    Local: localInput.value.trim(),
    Localidad: localidadInput.value.trim(),
    Telefono: telefonoInput.value.trim(),
  };

  btnGuardar.disabled = true;
  btnGuardar.textContent = "Guardando...";

  try {
    // Si el usuario cambió el nombre, el ID del documento debe cambiar
    if (nuevoNombre !== clienteOriginalId) {
      // 1. Crear documento nuevo con el nuevo ID
      await setDoc(doc(db, "Clientes", nuevoNombre), datos);
      // 2. Borrar el documento viejo
      await deleteDoc(doc(db, "Clientes", clienteOriginalId));
    } else {
      // Actualización normal
      await setDoc(doc(db, "Clientes", clienteOriginalId), datos, {
        merge: true,
      });
    }

    mensajeModificacionDiv.textContent = "Cambios guardados con éxito. ✅";
    mensajeModificacionDiv.style.color = "green";
    setTimeout(() => location.reload(), 1500); // Recargar para limpiar estado
  } catch (error) {
    mensajeModificacionDiv.textContent = "Error al guardar cambios.";
    console.error(error);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = "Guardar Cambios";
  }
});

// Helper de CUIT
function aplicarFormatoCuit(el) {
  let v = el.value.replace(/\D/g, "").substring(0, 11);
  let f = "";
  if (v.length > 0) f = v.substring(0, 2);
  if (v.length > 2) f += "-" + v.substring(2, 10);
  if (v.length > 10) f += "-" + v.substring(10, 11);
  el.value = f;
}
cuitInput.addEventListener("input", (e) => aplicarFormatoCuit(e.target));
