import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: " ",
    authDomain: " ",
    projectId: " ",
    storageBucket: " ",
    messagingSenderId: " ",
    appId: " "
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Use a listener to ensure the user is logged in before allowing a booking
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("appointment-form").addEventListener("submit", (e) => {
            e.preventDefault();

            const petName = document.getElementById("pet-name-book").value;
            const appointmentDate = document.getElementById("appointment-date").value;
            const appointmentTime = document.getElementById("appointment-time").value;
            const clinicName = document.getElementById("clinic-name").value;

            addDoc(collection(db, "appointments"), {
                userId: user.uid,
                petName: petName,
                date: appointmentDate,
                time: appointmentTime,
                clinic: clinicName,
                createdAt: serverTimestamp()
            })
            .then((docRef) => {
                document.getElementById("booking-status").textContent = `Appointment booked successfully! ID: ${docRef.id}`;
                document.getElementById("appointment-form").reset();
            })
            .catch((error) => {
                document.getElementById("booking-status").textContent = `Error booking appointment: ${error.message}`;
                console.error("Error adding document: ", error);
            });
        });
    } else {
        document.getElementById("booking-status").textContent = "Please log in to book an appointment.";
        // Optionally disable the form if the user is not logged in
        document.getElementById("appointment-form").style.display = 'none';
    }
});
