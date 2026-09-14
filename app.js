const users = ['Mikel', 'Romina', 'Juani', 'Leire'];
const priorities = ['Mikel', 'Romina'];
const cars = {
    polo: { name: 'Volkswagen Polo', status: 'Libre', reservedBy: null, icon: '🚗' },
    fox: { name: 'Volkswagen Fox', status: 'Libre', reservedBy: null, icon: '🚙' }
};

let currentUser = null;
let reservations = [
    // { user: 'Juani', car: 'polo', priority: false, timestamp: Date.now() }
];

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const userDisplay = document.getElementById('user-display');
const listContainer = document.getElementById('reservation-list');
const emptyQueue = document.getElementById('empty-queue');

usernameInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    loginBtn.disabled = !users.includes(val);
});

loginBtn.addEventListener('click', () => {
    currentUser = usernameInput.value.trim();
    loginScreen.classList.remove('active');
    mainScreen.classList.add('active');
    userDisplay.textContent = currentUser;
    render();
});

function toggleReservation(carKey) {
    const car = cars[carKey];
    
    if (car.reservedBy === currentUser) {
        // Liberar auto
        car.status = 'Libre';
        car.reservedBy = null;
        reservations = reservations.filter(r => r.user !== currentUser || r.car !== carKey);
    } else if (!reservations.find(r => r.user === currentUser && r.car === carKey)) {
        // Reservar auto
        const isPriority = priorities.includes(currentUser);
        reservations.push({ user: currentUser, car: carKey, priority: isPriority, timestamp: Date.now() });
        reservations.sort((a, b) => (b.priority - a.priority) || (a.timestamp - b.timestamp));
        
        if (!car.reservedBy) {
            assignNext(carKey);
        }
    }
    render();
}

function assignNext(carKey) {
    const nextInLine = reservations.find(r => r.car === carKey && !cars[carKey].reservedBy);
    if (nextInLine) {
        cars[carKey].status = 'Ocupado';
        cars[carKey].reservedBy = nextInLine.user;
    }
}

function render() {
    // Update Car Cards
    Object.keys(cars).forEach(key => {
        const car = cars[key];
        const statusEl = document.getElementById(`${key}-status`);
        const detailsEl = document.getElementById(`${key}-details`);
        const btn = document.getElementById(`${key}-btn`);

        statusEl.textContent = car.status;
        statusEl.className = `status ${car.reservedBy ? 'occupied' : ''}`;
        detailsEl.textContent = car.reservedBy ? `Reservado por: ${car.reservedBy}` : 'Disponible para uso inmediato';
        
        if (car.reservedBy === currentUser) {
            btn.textContent = 'Liberar Auto';
            btn.style.background = 'var(--warning)';
            btn.style.color = 'black';
        } else if (car.reservedBy) {
            btn.textContent = 'No disponible';
            btn.disabled = true;
            btn.style.background = 'var(--border)';
        } else {
            btn.textContent = 'Reservar';
            btn.style.background = 'var(--accent)';
            btn.style.color = 'white';
            btn.disabled = false;
        }
    });

    // Update Reservation List
    const carReservations = reservations; // Show all
    listContainer.innerHTML = '';
    
    if (carReservations.length === 0) {
        emptyQueue.style.display = 'block';
    } else {
        emptyQueue.style.display = 'none';
        carReservations.forEach(r => {
            const li = document.createElement('li');
            const prioLabel = r.priority ? '<span class="priority">⭐ PRIORIDAD</span>' : '';
            li.innerHTML = `
                <div>${prioLabel} ${r.user} <small style="color:var(--text-muted)">para ${cars[r.car].name}</small></div>
                <div>${new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            `;
            listContainer.appendChild(li);
        });
    }
}

// Initialize
Object.keys(cars).forEach(key => {
    document.getElementById(`${key}-btn`).addEventListener('click', () => toggleReservation(key));
});
