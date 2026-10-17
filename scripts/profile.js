import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
    getDatabase,
    ref,
    set,
    onValue,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";
import { firebaseConfig } from "/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const FIELDS = [
    "petname",
    "ownername",
    "species",
    "breed",
    "age",
    "gender",
    "weight",
    "pnumber",
    "address",
    "vaccines",
    "medicalhistory",
];

const form = document.getElementById("petform");
const saveBtn = document.getElementById("save-button");
const editBtn = document.getElementById("edit-button");
const detailsView = document.getElementById("pet-details-display");
const alertBox = document.querySelector(".alert");

let currentProfile = null;
let isEditing = false;
let stopListening = null;
let alertTimer;

function showAlert(message, type) {
    clearTimeout(alertTimer);
    alertBox.className = `alert ${type}`;
    alertBox.textContent = message;
    alertTimer = setTimeout(() => {
        alertBox.textContent = "";
    }, 3000);
}

function showForm() {
    form.hidden = false;
    detailsView.hidden = true;
}

function showDetails() {
    form.hidden = true;
    detailsView.hidden = false;
}

function renderDetails(profile) {
    FIELDS.forEach((field) => {
        const el = document.getElementById(`display-${field}`);
        const value = profile[field];
        el.textContent = value !== undefined && value !== "" ? value : "-";
    });
}

function fillForm(profile) {
    FIELDS.forEach((field) => {
        document.getElementById(field).value = profile[field] ?? "";
    });
}

function startListening(uid) {
    const profileRef = ref(db, `profiles/${uid}`);

    // Fires immediately, then again on every change (live updates, no reload)
    stopListening = onValue(
        profileRef,
        (snapshot) => {
            currentProfile = snapshot.exists() ? snapshot.val() : null;

            if (currentProfile) {
                renderDetails(currentProfile);
                // Don't pull the user out of the form while they are editing
                if (!isEditing) showDetails();
            } else {
                form.reset();
                showForm();
            }
        },
        (error) => {
            console.error("Error reading profile:", error);
            showAlert(
                "Could not load your profile. Please try again.",
                "error",
            );
            showForm();
        },
    );
}

onAuthStateChanged(auth, (user) => {
    if (stopListening) {
        stopListening();
        stopListening = null;
    }

    if (!user) {
        window.location.href = "/auth/login.html";
        return;
    }

    form.dataset.uid = user.uid;
    startListening(user.uid);
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const uid = form.dataset.uid;
    if (!uid) return;

    const profile = {};
    FIELDS.forEach((field) => {
        profile[field] = document.getElementById(field).value.trim();
    });
    profile.updatedAt = serverTimestamp();

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        await set(ref(db, `profiles/${uid}`), profile);
        isEditing = false;
        showDetails();
        showAlert("Your profile has been saved", "success");
    } catch (error) {
        console.error("Error saving profile:", error);
        showAlert("Could not save your profile. Please try again.", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save";
    }
});

editBtn.addEventListener("click", () => {
    if (currentProfile) fillForm(currentProfile);
    isEditing = true;
    showForm();
});
