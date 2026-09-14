// =============================================
//  AutoTurno - App con Firestore (entrada por nombre)
//  =============================================
const users = ['Mikel', 'Romina', 'Juani', 'Leire'];
const priorities = ['Mikel', 'Romina'];
const cars = {
    polo: { name: 'Volkswagen Polo', icon: '🚗' },
    fox: { name: 'Volkswagen Fox', icon: '🚙' }
};

let currentUser = null;
let reservations = [];
let bookingsLoading = true;

// ---------- Firebase init ----------
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ---------- DOM ----------
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const userDisplay = document.getElementById('user-display');
const listContainer = document.getElementById('reservation-list');
const emptyQueue = document.getElementById('empty-queue');
const syncStatus = document.getElementById('sync-status');

// Modal
const modal = document.getElementById('reservation-modal');
const closeModalBtn = document.getElementById('close-modal');
const confirmBtn = document.getElementById('confirm-reservation-btn');
const dateInput = document.getElementById('res-date');
const startTimeInput = document.getElementById('res-start');
const endTimeInput = document.getElementById('res-end');
const modalError = document.getElementById('modal-error');
const choiceAnyBtn = document.getElementById('choice-any');
const choiceSpecificBtn = document.getElementById('choice-specific');
const specificOptions = document.getElementById('specific-car-options');
const miniCarBtns = document.querySelectorAll('.mini-car-btn');

let wantAnyCar = true;
let specificCarKey = 'polo';

// ---------- Login ----------
usernameInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    loginBtn.disabled = !users.includes(val);
    loginError.style.display = 'none';
});

loginBtn.addEventListener('click', () => {
    const typedName = usernameInput.value.trim();
    if (!users.includes(typedName)) {
        loginError.textContent = "Ese nombre no está en la lista de la casa.";
        loginError.style.display = 'block';
        return;
    }
    currentUser = typedName;
    loginScreen.classList.remove('active');
    mainScreen.classList.add('active');
    userDisplay.textContent = currentUser;
    listenToReservations();
});

// ---------- Firestore: escuchar reservas en tiempo real ----------
function listenToReservations() {
    db.collection('reservations')
        .onSnapshot((snapshot) => {
            reservations = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    user: data.user,
                    car: data.car,
                    priority: data.priority === true,
                    start: data.start,
                    end: data.end,
                    created: data.created || 0
                };
            });
            bookingsLoading = false;
            syncStatus.textContent = '🟢 Sincronizado';
            syncStatus.classList.remove('syncing');
            render();
        }, (err) => {
            console.error('Firestore error:', err);
            syncStatus.textContent = '🔴 Sin conexión con la base';
            syncStatus.classList.add('syncing');
        });
}

// ---------- Modal ----------
function openModal(carKey) {
    if (carKey === 'any') {
        wantAnyCar = true;
    } else {
        wantAnyCar = false;
        specificCarKey = carKey;
    }
    updateChoiceUI();
    dateInput.valueAsDate = new Date();
    startTimeInput.value = "18:00";
    endTimeInput.value = "23:00";
    modalError.style.display = 'none';
    modal.classList.add('active');
}

function closeModal() {
    modal.classList.remove('active');
}

function updateChoiceUI() {
    if (wantAnyCar) {
        choiceAnyBtn.classList.add('active');
        choiceSpecificBtn.classList.remove('active');
        specificOptions.classList.add('hidden');
    } else {
        choiceAnyBtn.classList.remove('active');
        choiceSpecificBtn.classList.add('active');
        specificOptions.classList.remove('hidden');
        miniCarBtns.forEach(b => b.classList.toggle('active', b.dataset.car === specificCarKey));
    }
}

choiceAnyBtn.addEventListener('click', () => { wantAnyCar = true; updateChoiceUI(); });
choiceSpecificBtn.addEventListener('click', () => { wantAnyCar = false; updateChoiceUI(); });
miniCarBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        specificCarKey = btn.dataset.car;
        updateChoiceUI();
    });
});

// ---------- Lógica de reserva ----------
function toggleReservation(carKey) {
    if (carKey === 'any') {
        openModal('any');
        return;
    }
    const mine = reservations.find(r => r.user === currentUser && r.car === carKey);
    if (mine) {
        cancelReservation(mine);
        return;
    }
    openModal(carKey);
}

function cancelReservation(reservation) {
    db.collection('reservations').doc(reservation.id).delete()
        .catch(err => {
            console.error(err);
            alert('No se pudo cancelar. ¿Tenés conexión?');
        });
    // La UI se actualiza sola con el listener de Firestore
}

function confirmReservation() {
    const date = dateInput.value;
    const start = startTimeInput.value;
    const end = endTimeInput.value;

    if (!date || !start || !end) {
        modalError.textContent = "Completá todos los campos.";
        modalError.style.display = 'block';
        return;
    }
    if (start >= end) {
        modalError.textContent = "La hora de fin tiene que ser mayor a la de inicio.";
        modalError.style.display = 'block';
        return;
    }

    const newStart = new Date(`${date}T${start}`);
    const newEnd = new Date(`${date}T${end}`);

    // Elegir auto si es "me da lo mismo"
    let targetCar = specificCarKey;
    if (wantAnyCar) {
        const freeCars = Object.keys(cars).filter(carKey => {
            const overlap = reservations.find(r => r.car === carKey && isOverlapping(r, newStart, newEnd));
            return !overlap;
        });
        if (freeCars.length === 0) {
            modalError.textContent = "No hay ningún auto libre en ese horario. Elegí otro.";
            modalError.style.display = 'block';
            return;
        }
        targetCar = freeCars[0];
    } else {
        const overlap = reservations.find(r => r.car === targetCar && isOverlapping(r, newStart, newEnd));
        if (overlap) {
            modalError.textContent = `${cars[targetCar].name} ya está ocupado ese horario por ${overlap.user}.`;
            modalError.style.display = 'block';
            return;
        }
    }

    // No podés tener 2 reservas tuyas que se crucen
    const myOverlap = reservations.find(r => r.user === currentUser && isOverlapping(r, newStart, newEnd));
    if (myOverlap) {
        modalError.textContent = `Ya tenés una reserva que se cruza el ${formatDay(myOverlap.start)} (${cars[myOverlap.car].name}).`;
        modalError.style.display = 'block';
        return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Reservando...';

    db.collection('reservations').add({
        user: currentUser,
        car: targetCar,
        priority: priorities.includes(currentUser),
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
        created: Date.now()
    })
    .then(() => {
        closeModal();
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Reserva';
    })
    .catch((err) => {
        console.error(err);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Reserva';
        modalError.textContent = 'No se pudo guardar la reserva. ¿Tenés conexión?';
        modalError.style.display = 'block';
    });
}

function isOverlapping(r, newStart, newEnd) {
    const rStart = new Date(r.start);
    const rEnd = new Date(r.end);
    return (newStart < rEnd && newEnd > rStart);
}

function formatDay(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------- Render ----------
function render() {
    const now = new Date();

    // Tarjetas de autos
    Object.keys(cars).forEach(key => {
        const statusEl = document.getElementById(`${key}-status`);
        const detailsEl = document.getElementById(`${key}-details`);
        const btn = document.getElementById(`${key}-btn`);

        const activeRes = reservations.find(r => r.car === key && new Date(r.end) > now);
        const mine = reservations.find(r => r.user === currentUser && r.car === key);

        if (activeRes) {
            statusEl.textContent = 'Ocupado';
            statusEl.className = 'status occupied';
            detailsEl.innerHTML = `Reservado por: <strong>${activeRes.user}</strong><br>${formatDay(activeRes.start)} ${formatTime(activeRes.start)} - ${formatTime(activeRes.end)}`;
        } else {
            statusEl.textContent = 'Libre';
            statusEl.className = 'status';
            detailsEl.textContent = 'Disponible para reserva';
        }

        if (mine) {
            btn.textContent = 'Cancelar Reserva';
            btn.style.background = 'var(--danger)';
            btn.style.color = 'white';
            btn.disabled = false;
        } else {
            btn.textContent = 'Reservar';
            btn.style.background = 'var(--accent)';
            btn.style.color = 'white';
            btn.disabled = false;
        }
    });

    // Tarjeta "Me da lo mismo"
    const anyFree = Object.keys(cars).filter(k => !reservations.find(r => r.car === k && new Date(r.end) > now)).length;
    const anyStatusEl = document.getElementById('any-status');
    anyStatusEl.textContent = anyFree > 0 ? `${anyFree} auto${anyFree > 1 ? 's' : ''} libre${anyFree > 1 ? 's' : ''}` : 'Sin autos libres';
    anyStatusEl.className = 'status' + (anyFree === 0 ? ' occupied' : '');

    // Lista
    listContainer.innerHTML = '';
    const upcoming = reservations
        .filter(r => new Date(r.end) > now)
        .sort((a, b) => (b.priority - a.priority) || (new Date(a.start) - new Date(b.start)));

    if (upcoming.length === 0) {
        emptyQueue.style.display = bookingsLoading ? 'none' : 'block';
        if (!bookingsLoading) {
            emptyQueue.textContent = 'No hay reservas. ¡Sacá turno primero!';
        }
    } else {
        emptyQueue.style.display = 'none';
        upcoming.forEach(r => {
            const li = document.createElement('li');
            const prioLabel = r.priority ? '<span class="priority">⭐ PRIORIDAD</span>' : '';
            li.innerHTML = `
                <div class="li-content">
                    <div class="li-user">${prioLabel} ${r.user}</div>
                    <div class="li-details">${cars[r.car].icon} ${cars[r.car].name} <small>${formatDay(r.start)}</small></div>
                </div>
                <div class="li-time">${formatTime(r.start)} - ${formatTime(r.end)}</div>
            `;
            listContainer.appendChild(li);
        });
    }
}

// ---------- Inicialización ----------
Object.keys(cars).forEach(key => {
    document.getElementById(`${key}-btn`).addEventListener('click', () => toggleReservation(key));
});
document.getElementById('any-btn').addEventListener('click', () => toggleReservation('any'));
closeModalBtn.addEventListener('click', closeModal);
confirmBtn.addEventListener('click', confirmReservation);