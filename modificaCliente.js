import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  limit,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// --- ELEMENTOS DEL DOM ---
const formBuscar = document.getElementById("form-buscar-cliente");
const nombreClienteBuscarInput = document.getElementById("nombre-cliente-buscar");
const btnBuscar = document.getElementById("btn-buscar");
const mensajeBusquedaDiv = document.getElementById("mensaje-busqueda");
const formModifica = document.getElementById("form-modifica-cliente");
const btnGuardar = document.getElementById("btn-guardar-cambios");
const mensajeModificacionDiv = document.getElementById("mensaje-modificacion");

// Campos del Formulario
const nombreInput = document.getElementById("nombre");
const direccionInput = document.getElementById("direccion");
const cuitInput = document.getElementById("cuit");
const localInput = document.getElementById("local");
const localidadInput = document.getElementById("localidad");
const telefonoInput = document.getElementById("telefono");

// Variable para recordar el nombre original antes de la edición
let clienteOriginalId = null;

// ----------------------------------------------------------------------
// 1. AUTOCOMPLETADO (Para encontrar al cliente rápidamente)
// ----------------------------------------------------------------------
nombreClienteBuscarInput.addEventListener("input", async () => {
  const valor = nombreClienteBuscarInput.value.trim().toUpperCase();
  if (valor.length < 3) {
    removerListaSugerencias();
    return;
  }

  try {
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
// 2. BUSCAR Y CARGAR DATOS
// ----------------------------------------------------------------------
async function buscarYMostrarCliente() {
  const nombreBusqueda = nombreClienteBuscarInput.value.trim().toUpperCase();
  mensajeBusquedaDiv.textContent = "";
  formModifica.style.display = "none";

  if (!nombreBusqueda) return;

  btnBuscar.disabled = true;
  btnBuscar.textContent = "Buscando...";

  try {
    const clienteRef = doc(db, "Clientes", nombreBusqueda);
    const clienteSnap = await getDoc(clienteRef);

    if (!clienteSnap.exists()) {
      mensajeBusquedaDiv.textContent = "El cliente no existe.";
      mensajeBusquedaDiv.style.color = "orange";
      return;
    }

    const data = clienteSnap.data();
    
    // Cargamos los campos en el formulario
    nombreInput.value = data.Nombre || "";
    direccionInput.value = data.Direccion || "";
    cuitInput.value = data.CUIT || "";
    localInput.value = data.Local || "";
    localidadInput.value = data.Localidad || "";
    telefonoInput.value = data.Telefono || "";

    // IMPORTANTE: Guardamos el ID actual para saber cuál borrar si se cambia el nombre
    clienteOriginalId = nombreBusqueda; 
    
    formModifica.style.display = "flex";
    mensajeBusquedaDiv.textContent = "Cliente cargado.";
    mensajeBusquedaDiv.style.color = "green";

  } catch (error) {
    mensajeBusquedaDiv.textContent = "Error de conexión.";
    console.error(error);
  } finally {
    btnBuscar.disabled = false;
    btnBuscar.textContent = "Cargar Datos";
  }
}

formBuscar.addEventListener("submit", (e) => {
  e.preventDefault();
  buscarYMostrarCliente();
});

// ----------------------------------------------------------------------
// 3. GUARDAR CAMBIOS (Lógica de Renombrado)
// ----------------------------------------------------------------------
formModifica.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nuevoNombre = nombreInput.value.trim().toUpperCase();
  const datosActualizados = {
    Nombre: nuevoNombre,
    Direccion: direccionInput.value.trim().toUpperCase(),
    CUIT: cuitInput.value.trim(),
    Local: localInput.value.trim().toUpperCase(),
    Localidad: localidadInput.value.trim().toUpperCase(),
    Telefono: telefonoInput.value.trim(),
  };

  btnGuardar.disabled = true;
  btnGuardar.textContent = "Procesando...";

  try {
    // Si el nombre cambió, el documento de la imagen (ID) debe cambiar
    if (nuevoNombre !== clienteOriginalId) {
      
      // Verificamos si ya existe alguien con el nuevo nombre para no pisarlo
      const nuevoDocRef = doc(db, "Clientes", nuevoNombre);
      const existeNuevo = await getDoc(nuevoDocRef);

      if (existeNuevo.exists()) {
        alert("¡Error! Ya existe un cliente llamado " + nuevoNombre);
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar Cambios";
        return;
      }

      // 1. Crear el nuevo documento con el ID nuevo
      await setDoc(nuevoDocRef, datosActualizados);

      // 2. Eliminar el documento antiguo (el que tenía el nombre viejo)
      await deleteDoc(doc(db, "Clientes", clienteOriginalId));
      
      mensajeModificacionDiv.textContent = "Nombre cambiado y datos actualizados. ✅";
    } else {
      // Si el nombre es igual, solo actualizamos los campos
      await setDoc(doc(db, "Clientes", clienteOriginalId), datosActualizados, { merge: true });
      mensajeModificacionDiv.textContent = "Datos actualizados correctamente. ✅";
    }

    mensajeModificacionDiv.style.color = "green";
    
    // Recargamos para limpiar todo y evitar confusiones de IDs
    setTimeout(() => location.reload(), 2000);

  } catch (error) {
    mensajeModificacionDiv.textContent = "Error al guardar cambios.";
    mensajeModificacionDiv.style.color = "red";
    console.error(error);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = "Guardar Cambios";
  }
});