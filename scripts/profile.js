const firebaseConfig = {
  apiKey: " ",
  authDomain: " ",
  databaseURL: " ",
  projectId: " ",
  storageBucket: " ",
  messagingSenderId: " ",
  appId: " "
};

firebase.initializeApp(firebaseConfig);

// Reference messages collection
var messagesRef = firebase.database().ref('messages');

// Listen for form submit
document.getElementById('petform').addEventListener('submit', submitForm);

// Submit form
function submitForm(e){
  e.preventDefault();

  // Get values
  var petname = getInputVal('petname');
  var ownername = getInputVal('ownername');
  var species = getInputVal('species');
  var age = getInputVal('age');
  var gender = getInputVal('gender');
  var weight = getInputVal('weight');
  var address = getInputVal('address');
  var pnumber = getInputVal('pnumber');
  var breed = getInputVal('breed');
  var vaccines = getInputVal('vaccines');
  var medicalhistory = getInputVal('medicalhistory');

  // Save message
  saveMessage(petname, ownername, species, age, gender, weight, address, pnumber, breed, vaccines, medicalhistory);

  // Show alert
  document.querySelector('.alert').style.display = 'block';

  // Hide alert after 3 seconds
  setTimeout(function(){
    document.querySelector('.alert').style.display = 'none';
  },3000);

  // Clear form
  document.getElementById('contactForm').reset();
}

// Function to get get form values
function getInputVal(id){
  return document.getElementById(id).value;
}

// Save message to firebase
function saveMessage(petname, ownername, species, age, gender, weight, address, pnumber, breed, vaccines, medicalhistory){
  var newMessageRef = messagesRef.push();
  newMessageRef.set({
    petname: petname,
    ownername:ownername,
    species:species,
    age:age,
    gender:gender,
    weight:weight,
    address:address,
    pnumber:pnumber,
    breed:breed,
    vaccines:vaccines,
    medicalhistory:medicalhistory
  });
}

// Add a listener to handle page load and display the data
window.addEventListener('load', displayPetProfile);

// This function will fetch the pet data from Firebase and display it
function displayPetProfile() {
    // We are assuming there's only one pet profile per user for simplicity.
    // In a real app, you would fetch data for the currently logged-in user.
    messagesRef.limitToLast(1).on('value', snapshot => {
        const petDetailsDisplay = document.getElementById('pet-details-display');
        const petForm = document.getElementById('petform');
        
        if (snapshot.exists()) {
            const petData = Object.values(snapshot.val())[0];
            
            // Populate the display section with the fetched data
            document.getElementById('display-petname').textContent = petData.petname;
            document.getElementById('display-ownername').textContent = petData.ownername;
            document.getElementById('display-species').textContent = petData.species;
            document.getElementById('display-age').textContent = petData.age;
            document.getElementById('display-gender').textContent = petData.gender;
            document.getElementById('display-weight').textContent = petData.weight;
            document.getElementById('display-address').textContent = petData.address;
            document.getElementById('display-pnumber').textContent = petData.pnumber;
            document.getElementById('display-breed').textContent = petData.breed;
            document.getElementById('display-vaccines').textContent = petData.vaccines;
            document.getElementById('display-medicalhistory').textContent = petData.medicalhistory;
            
            // Show the display section and hide the form
            petDetailsDisplay.style.display = 'block';
            petForm.style.display = 'none';
        } else {
            // No data exists, show the form to allow the user to create a profile
            petDetailsDisplay.style.display = 'none';
            petForm.style.display = 'block';
        }
    });
}

// Event listener for the "Edit Profile" button
document.getElementById('edit-button').addEventListener('click', function() {
    // Show the form and hide the display section
    document.getElementById('petform').style.display = 'block';
    document.getElementById('pet-details-display').style.display = 'none';
});
