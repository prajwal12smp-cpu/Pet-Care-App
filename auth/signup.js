import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { firebaseConfig } from "/firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.querySelector("form");
const signUpBtn = document.getElementById("signup");
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
        case "auth/email-already-in-use":
            return "This email is already registered";
        case "auth/invalid-email":
            return "Please enter a valid email address";
        case "auth/weak-password":
            return "Password must be at least 6 characters";
        case "auth/network-request-failed":
            return "Network error. Check your connection";
        default:
            return "Unable to create account. Please try again";
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    signUpBtn.disabled = true;
    signUpBtn.textContent = "Creating account...";

    try {
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            email,
            password,
        );
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), { name, email });

        showMessage("Account created successfully", "signupMessage", "success");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 1000);
    } catch (error) {
        console.error("Signup error:", error);
        const message = error.code
            ? getErrorMessage(error.code)
            : "Unable to create account. Please try again";
        showMessage(message, "signupMessage", "error");
        signUpBtn.disabled = false;
        signUpBtn.textContent = "Sign Up";
    }
});
