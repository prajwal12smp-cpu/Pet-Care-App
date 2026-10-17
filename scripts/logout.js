import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { firebaseConfig } from "/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const logoutBtn = document.querySelector(".logout-btn, #logout-btn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        logoutBtn.disabled = true;

        try {
            await signOut(auth);
            localStorage.removeItem("loggedInUserId");
            window.location.href = "/auth/login.html";
        } catch (error) {
            console.error("Error logging out:", error);
            logoutBtn.disabled = false;
            alert("Could not log out. Please try again.");
        }
    });
}
