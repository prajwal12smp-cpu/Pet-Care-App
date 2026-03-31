import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signOut} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: " ",
    authDomain: " ",
    projectId: " "
    storageBucket: " ",
    messagingSenderId: " ",
    appId: " "
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const auth= getAuth(app);

const logoutbtn=document.getElementById('logout-btn');

logoutbtn.addEventListener('click', (event)=>{
    event.preventDefault();
    localStorage.removeItem('loggedInUserId');
    signOut(auth)
    .then(()=>{
        window.location.href='/auth/login.html';
    })
    .catch((error)=>{
        console.error('error in logging out',error);
    })
})
