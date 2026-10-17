import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { firebaseConfig } from "/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const form = document.querySelector("form");
const loginBtn = document.getElementById("login");
let hideTimer;

function showMessage(message, divId, type = "error") {
    const messageDiv = document.getElementById(divId);
    clearTimeout(hideTimer);
    messageDiv.className = `messageDiv ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.display = "block";
    messageDiv.style.opacity = 1;
    hideTimer = setTimeout(() => {
        messageDiv.style.opacity = 0;
    }, 5000);
}

function getErrorMessage(code) {
    switch (code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Incorrect email or password";
        case "auth/invalid-email":
            return "Please enter a valid email address";
        case "auth/user-disabled":
            return "This account has been disabled";
        case "auth/too-many-requests":
            return "Too many attempts. Please try again later";
        case "auth/network-request-failed":
            return "Network error. Check your connection";
        default:
            return "Unable to log in. Please try again";
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    try {
        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password,
        );
        localStorage.setItem("loggedInUserId", userCredential.user.uid);
        showMessage("Login successful", "loginMessage", "success");
        setTimeout(() => {
            window.location.href = "/user/home.html";
        }, 800);
    } catch (error) {
        showMessage(getErrorMessage(error.code), "loginMessage", "error");
        loginBtn.disabled = false;
        loginBtn.textContent = "Login";
    }
});
