const API_URL = 'http://localhost:8000/api';
const getToken = () => localStorage.getItem('token');

// ── LOGIN ─────────────────────────────────────────────────────
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    btn.textContent = 'Signing in...';
    btn.disabled = true;

    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.user.role);
        localStorage.setItem('name', data.user.name);
        showToast('Welcome back, ' + data.user.name + '! 👋');
        setTimeout(() => {
          if (data.user.role === 'donor') {
            window.location.href = "donor.html";
          } else {
            window.location.href = "receiver.html";
          }
        }, 800);
      } else {
        showToast(data.message, 'error');
        btn.textContent = 'Sign In';
        btn.disabled = false;
      }
    } catch (err) {
      showToast('Cannot connect to server!', 'error');
      btn.textContent = 'Sign In';
      btn.disabled = false;
    }
  });
}

// ── REGISTER ──────────────────────────────────────────────────
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const btn = registerForm.querySelector('button[type="submit"]');
    btn.textContent = 'Creating account...';
    btn.disabled = true;

    const name = document.getElementById("registerName").value;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;
    let role = document.getElementById("registerRole").value;
    if (role === "receiver") role = "recipient";

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      const data = await res.json();

      if (data.success) {
        showToast('Account created! Please sign in. 🎉');
        setTimeout(() => window.location.href = "index.html", 1200);
      } else {
        showToast(data.message, 'error');
        btn.textContent = 'Create Account';
        btn.disabled = false;
      }
    } catch (err) {
      showToast('Cannot connect to server!', 'error');
      btn.textContent = 'Create Account';
      btn.disabled = false;
    }
  });
}

// ── DONOR: POST FOOD ──────────────────────────────────────────
const foodForm = document.getElementById("foodForm");
if (foodForm) {
  foodForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const btn = foodForm.querySelector('button[type="submit"]');
    btn.textContent = 'Posting...';
    btn.disabled = true;

    const title = document.getElementById("foodName").value;
    const quantity = document.getElementById("quantity").value;
    const expiresAt = document.getElementById("expiry").value;
    const address = document.getElementById("address").value;

    const mapFrame = document.getElementById("mapFrame");
    if (mapFrame) {
      mapFrame.src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(`${API_URL}/listings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({
            title,
            quantity: { value: Number(quantity), unit: 'servings' },
            expiresAt,
            pickup: { address },
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Food posted! Nearby recipients notified 🍱');
          setTimeout(() => {
            foodForm.reset();
            const preview = document.getElementById("preview");
            if (preview) { preview.style.display = 'none'; }
            btn.textContent = 'Share Food';
            btn.disabled = false;
          }, 1500);
        } else {
          showToast(data.message, 'error');
          btn.textContent = 'Share Food';
          btn.disabled = false;
        }
      } catch (err) {
        showToast('Cannot connect to server!', 'error');
        btn.textContent = 'Share Food';
        btn.disabled = false;
      }
    }, () => {
      showToast('Please allow location access!', 'error');
      btn.textContent = 'Share Food';
      btn.disabled = false;
    });
  });
}

// ── RECEIVER: LOAD NEARBY FOOD ────────────────────────────────
const foodCards = document.getElementById("foodCards");
if (foodCards) {
  foodCards.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Finding food near you...</p></div>`;

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    try {
      const res = await fetch(`${API_URL}/listings/nearby?lat=${lat}&lng=${lng}&radius=10000`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();

      if (data.success && data.listings.length > 0) {
        foodCards.innerHTML = '';
        data.listings.forEach((listing, i) => {
          const card = document.createElement('div');
          card.className = 'food-card';
          card.style.animationDelay = `${i * 0.1}s`;
          const timeLeft = getTimeLeft(listing.expiresAt);
          card.innerHTML = `
            <div class="card-badge">${listing.category || 'food'}</div>
            <h3 class="card-title">${listing.title}</h3>
            <div class="card-meta">
              <span>🍽️ ${listing.quantity.value} ${listing.quantity.unit}</span>
              <span>⏰ ${timeLeft}</span>
            </div>
            <div class="card-address">📍 ${listing.pickup.address}</div>
            <div class="card-donor">Posted by ${listing.donor.name}</div>
            <button class="claim-btn" onclick="claimFood('${listing._id}', this)">Request Pickup</button>
          `;
          foodCards.appendChild(card);
        });

        const first = data.listings[0];
        const mapFrame = document.getElementById("mapFrame");
        if (mapFrame) {
          mapFrame.src = `https://maps.google.com/maps?q=${encodeURIComponent(first.pickup.address)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
        }
      } else {
        foodCards.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🌱</div>
            <h3>No food nearby right now</h3>
            <p>Check back soon — donors are always posting!</p>
          </div>`;
      }
    } catch (err) {
      foodCards.innerHTML = `<div class="empty-state"><p>Error loading listings. Is backend running?</p></div>`;
    }
  }, () => {
    foodCards.innerHTML = `<div class="empty-state"><p>Please allow location access to see nearby food.</p></div>`;
  });
}

// ── CLAIM FOOD ────────────────────────────────────────────────
async function claimFood(listingId, btn) {
  btn.textContent = 'Requesting...';
  btn.disabled = true;
  try {
    const res = await fetch(`${API_URL}/listings/${listingId}/claim`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Food claimed! Contact donor for pickup 🎉');
      btn.textContent = '✓ Claimed';
      btn.style.background = '#2d6a4f';
    } else {
      showToast(data.message, 'error');
      btn.textContent = 'Request Pickup';
      btn.disabled = false;
    }
  } catch (err) {
    showToast('Error claiming food.', 'error');
    btn.textContent = 'Request Pickup';
    btn.disabled = false;
  }
}

// ── IMAGE PREVIEW ─────────────────────────────────────────────
const imageUpload = document.getElementById("imageUpload");
if (imageUpload) {
  imageUpload.addEventListener("change", function () {
    const file = this.files[0];
    const preview = document.getElementById("preview");
    if (file && preview) {
      const reader = new FileReader();
      reader.onload = function () {
        preview.src = reader.result;
        preview.style.display = "block";
      }
      reader.readAsDataURL(file);
    }
  });
}

// ── HELPERS ───────────────────────────────────────────────────
function getTimeLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff < 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── LOGOUT ────────────────────────────────────────────────────
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });
}

// ── SHOW USERNAME ─────────────────────────────────────────────
const userNameEl = document.getElementById("userName");
if (userNameEl) {
  userNameEl.textContent = localStorage.getItem('name') || 'User';
}
