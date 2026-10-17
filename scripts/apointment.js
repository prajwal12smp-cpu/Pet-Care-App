import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import {
    getAuth,
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { firebaseConfig } from "/firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const form = document.querySelector(".appointment-form");
const submitBtn = form.querySelector("button[type='submit']");

// Status message element (created here so no HTML change is needed)
const status = document.createElement("p");
status.className = "booking-status";
form.after(status);

function setStatus(message, type) {
    status.textContent = message;
    status.className = `booking-status ${type}`;
}

// Prevent picking a past date
document.getElementById("appointmentDate").min = new Date()
    .toISOString()
    .split("T")[0];

let currentUser = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (!user) {
        setStatus("Please log in to book an appointment.", "error");
        submitBtn.disabled = true;
    } else {
        status.textContent = "";
        submitBtn.disabled = false;
    }
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) return;

    const petName = document.getElementById("petName").value.trim();
    const contactInfo = document.getElementById("contactInfo").value.trim();
    const date = document.getElementById("appointmentDate").value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Scheduling...";

    try {
        await addDoc(collection(db, "appointments"), {
            userId: currentUser.uid,
            petName,
            contactInfo,
            date,
            createdAt: serverTimestamp(),
        });
        setStatus("Appointment booked successfully!", "success");
        form.reset();
    } catch (error) {
        console.error("Error booking appointment:", error);
        setStatus("Could not book the appointment. Please try again.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Schedule Now";
    }
});
