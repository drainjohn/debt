// Your Firebase config here
const firebaseConfig = {
  apiKey: "AIzaSyCC-7eMOVOXY-scwfWa2YJDQ-C9374Eefc",
  authDomain: "cookjohnhehe.firebaseapp.com",
  projectId: "cookjohnhehe",
  storageBucket: "cookjohnhehe.firebasestorage.app",
  messagingSenderId: "903207552070",
  appId: "1:903207552070:web:737ca50176d3a343f1f647"
};

firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();
const realtimeDB = firebase.database();

// Function to get the user's IP address (using a free API service)
async function getUserIP() {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
}

// Function to initialize the user session
async function initializeUserSession() {
    let ip;

    // Try to retrieve IP from localStorage first
    if (localStorage.getItem('userIP')) {
        ip = localStorage.getItem('userIP');
    } else {
        // If no IP in localStorage, fetch the user's IP
        ip = await getUserIP();
        localStorage.setItem('userIP', ip); // Store IP in localStorage for future sessions
    }

    const userRef = firestore.collection("users").doc(ip);

    const doc = await userRef.get();
    if (!doc.exists) {
        const userId = firestore.collection("users").doc().id;
        userRef.set({
            dateJoined: new Date(),
            debtAdded: 0,
            userId: userId
        });
    } else {
        await userRef.update({
            lastActive: new Date()
        });
    }

    return ip;
}


// Function to show the congratulatory effect
function showCongratulations() {
    const congratsElement = document.getElementById('congratulations');
    congratsElement.style.display = 'block';

    // Hide the congrats message after the animation ends
    setTimeout(() => {
        congratsElement.style.display = 'none';
    }, 3000); // Hide after 3 seconds
}

// Function to fetch and update debt progress
function updateDebtProgress() {
    const debtRef = realtimeDB.ref('debt');
    
    debtRef.on('value', snapshot => {
        const debtData = snapshot.val();
        const actualDebt = debtData.actualDebt;
        const paidDebt = debtData.paidDebt;

        // Calculate the percentage of debt paid
        const paidPercentage = (paidDebt / actualDebt) * 100;

        // Get the progress bar element
        const progressBar = document.querySelector('progress');

        // Update the progress bar value (this is how the progress bar will change)
        progressBar.value = paidPercentage;

        // Update the text below the progress bar
        const debtText = document.getElementById('debtText');
        debtText.innerText = `$${paidDebt} of $${actualDebt} sent to goddess`; // Display the actual paid debt and total debt
    });
}

async function addDebt(amount, message) {
    const ip = await initializeUserSession();
    //const userRef = firestore.collection('users').doc(ip);
    const userRef = firestore.collection('users').doc(await getUserIP());
    const debtRef = realtimeDB.ref('debt');

    // ✅ Check if the user is within the cooldown period
    const userDoc = await userRef.get();
    if (userDoc.exists) {
        const lastUpdated = userDoc.data().lastUpdated?.toDate(); // Convert Firestore Timestamp to Date object
        const now = new Date();

        if (lastUpdated && (now - lastUpdated) < 30 * 60 * 1000) { // Cooldown period of 30 minutes (30 minutes * 60 seconds * 1000 milliseconds)
            const timeLeft = Math.ceil((30 * 60 * 1000 - (now - lastUpdated)) / 60000); // Minutes left
            showCooldownNotification(timeLeft);
            return;
        }
    }

    // ✅ Hide the debt popup and add "adding debt" animation
    document.getElementById('debtPopup').style.display = 'none';
    const body = document.body;
    body.style.overflow = 'hidden'; // Disable scroll during animation
    body.classList.add('adding-debt'); // Add a class for loading state if necessary

    // ✅ Check if the custom input field is filled and use that value instead
    const customAmount = document.getElementById('customAmount').value;
    if (customAmount && customAmount > 0 && customAmount <= 1000) {
        amount = parseInt(customAmount);
    }

    // ✅ Update debt in Realtime Database (both actual and paid debt)
    await debtRef.update({
        actualDebt: firebase.database.ServerValue.increment(amount),
        paidDebt: firebase.database.ServerValue.increment(0) // Placeholder for actual payment
    });

    // ✅ Update the user's total debt added and last activity in Firestore
    await userRef.set(
        {
            debtAdded: firebase.firestore.FieldValue.increment(amount),
            lastMessage: message || "No message",
            lastAddedAmount: amount,
            lastUpdated: new Date()
        },
        { merge: true } // Ensure fields are merged without overwriting existing data
    );

    // ✅ Call the congrats effect after debt is added
    showCongratulations(amount);

    // ✅ Re-enable scroll after animation
    setTimeout(() => {
        body.style.overflow = 'auto';
        body.classList.remove('adding-debt'); // Remove the loading class
    }, 1000); // Delay to match the animation time

    // ✅ Update progress bar after adding debt
    updateDebtProgress();
}





let leaderboardFetched = false; // Flag to track if leaderboard has been fetched

document.getElementById('leaderboardButton').addEventListener('click', () => {
    document.getElementById('leaderboardPopup').style.display = 'flex';
    // Fetch leaderboard data only if it hasn't been fetched yet
    if (!leaderboardFetched) {
        fetchLeaderboard();
        leaderboardFetched = true; // Set the flag to true once it's fetched
    }
});


// Close Leaderboard Popup
document.getElementById('closeLeaderboard').addEventListener('click', () => {
    document.getElementById('leaderboardPopup').style.display = 'none';
});

// Fetch and Display Leaderboard with Editable Name for Current User
async function fetchLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboardContainer');
    leaderboardContainer.innerHTML = ''; // Clear previous leaderboard data

    // Get the current user's IP to identify them
    const ip = await getUserIP();
    const currentUserDoc = await firestore.collection('users').doc(ip).get();
    const currentUserId = currentUserDoc.data().userId;

    // Fetch users from Firestore, ordered by debtAdded
    const snapshot = await firestore.collection('users').orderBy('debtAdded', 'desc').get();

    let rank = 1;
    snapshot.forEach(doc => {
        const user = doc.data();
        const userId = user.userId || 'Unknown';
        const displayName = user.displayName || `Guest ${userId.slice(0, 6)}`;
        const lastActive = user.lastActive ? formatDate(user.lastActive.seconds) : 'N/A';
        const debtAdded = user.debtAdded || 0;

        let circleColorClass = '';
        if (rank === 1) circleColorClass = 'gold';
        else if (rank === 2) circleColorClass = 'silver';
        else if (rank === 3) circleColorClass = 'bronze';
    
        // Create leaderboard item
        const item = document.createElement('div');
        item.className = 'leaderboard-item';

        if (userId === currentUserId) {
          item.classList.add('current-user');
        }
    
        const userDetailsHTML = `
            <div class="rank-circle ${circleColorClass}">${rank}</div>
            <div class="user-details">
                <h3>
                    <div class="user-name-container">
                        <input type="text" class="name-input" id="nameInput-${userId}" style="display: none;" maxlength="20" />

                        <span class="user-name" id="userName-${userId}">${displayName}</span>
                        ${userId === currentUserId ? `
                            <span class="edit-icon" id="editIcon-${userId}">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                </svg>
                            </span>
                        ` : ''}
                    </div>
                    <input type="text" class="name-input" id="nameInput-${userId}" style="display: none;" maxlength="20" />
                </h3>
                <span>Active: ${lastActive}</span>
            </div>
            <div class="strong-container"><strong>$${debtAdded}</strong></div>
        `;

        item.innerHTML = userDetailsHTML;

        // Append the item to the leaderboard
        leaderboardContainer.appendChild(item);

        // Add event listeners for editing the name (only for the current user)
        if (userId === currentUserId) {
            setupNameEditing(userId);
        }

        rank++;
    });
}

function setupNameEditing(userId) {
    const editIcon = document.getElementById(`editIcon-${userId}`);
    const userNameSpan = document.getElementById(`userName-${userId}`);
    const nameInput = document.getElementById(`nameInput-${userId}`);

    editIcon.addEventListener('click', () => {
        if (nameInput.style.display === 'none') {
            userNameSpan.style.display = 'none';
            nameInput.style.display = 'block';
            nameInput.value = userNameSpan.innerText;
            editIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            `;
            nameInput.focus();
        } else {
            saveNewName(userId, nameInput.value.trim());
            userNameSpan.innerText = nameInput.value.trim();
            userNameSpan.style.display = 'block';
            nameInput.style.display = 'none';
            editIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
            `;
        }
    });
}


// Save the New Name to Firestore
async function saveNewName(userId, newName) {
    const ip = await getUserIP();
    const userRef = firestore.collection('users').doc(ip);

    await userRef.update({
        displayName: newName,
        lastUpdated: new Date()
    });
}


// Function to format date as "10 June 2025, 12pm"
function formatDate(seconds) {
    const date = new Date(seconds * 1000); // Convert Firestore timestamp to JavaScript Date object

    const options = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };

    return date.toLocaleDateString('en-GB', options); // Use UK format (dd/mm/yyyy)
}

// Show Cooldown Notification
function showCooldownNotification(timeLeft) {
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.innerText = `Cooldown active! You can add more debt in ${timeLeft} minutes.`;
    document.body.appendChild(toast);

    // Show the toast
    toast.className = "show";

    // Hide the toast after 5 seconds
    setTimeout(() => {
        toast.className = toast.className.replace("show", "");
        toast.remove();
    }, 5000);
}

function updateSatisfactionLevel() {
    const satisfactionValue = document.getElementById('satisfactionValue');

    // Get selected preset amount
    const selectedOption = document.querySelector('.debt-option.selected');
    const presetAmount = selectedOption ? parseInt(selectedOption.getAttribute('data-amount')) : 0;

    // Get custom input amount
    const customAmount = parseInt(document.getElementById('customAmount').value) || 0;

    // Calculate the total debt amount
    const totalAmount = presetAmount + customAmount;

    // Determine satisfaction level based on total amount
    let satisfaction = 0;

    if (totalAmount <= 5) {
        satisfaction = 5;
    } else if (totalAmount <= 15) {
        satisfaction = 15;
    } else if (totalAmount <= 50) {
        satisfaction = 25;
    } else if (totalAmount <= 100) {
        satisfaction = 50;
    } else if (totalAmount <= 200) {
        satisfaction = 60;
    } else if (totalAmount <= 500) {
        satisfaction = 75;
    } else if (totalAmount <= 1000) {
        satisfaction = 90;
    } else if (totalAmount <= 1500) {
        satisfaction = 95;
    } else {
        satisfaction = 100; // Cap satisfaction at 100% for anything above 1500
    }

    // Update the satisfaction level display
    satisfactionValue.innerText = `${satisfaction}`;
}


// Function to enable or disable the Torture John button
function toggleTortureButton() {
    const customAmount = document.getElementById('customAmount').value;
    const selectedOption = document.querySelector('.debt-option.selected');
    
    // Enable button if a custom amount is valid or if a fixed option is selected
    const isCustomValid = customAmount && parseInt(customAmount) > 0 && parseInt(customAmount) <= 1000;
    if (isCustomValid || selectedOption) {
        document.getElementById('tortureButton').disabled = false;
        document.getElementById('tortureButton').style.backgroundColor = '#000';
        document.getElementById('tortureButton').style.color = '#fff';
        document.getElementById('tortureButton').style.cursor = 'pointer';
    } else {
        document.getElementById('tortureButton').disabled = true;
        document.getElementById('tortureButton').style.cursor = 'not-allowed';
    }
}

// Event listener for debt options (preset amounts)
document.querySelectorAll('.debt-option').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.debt-option').forEach(b => b.classList.remove('selected'));
        button.classList.add('selected');
        updateSatisfactionLevel(); // Update satisfaction based on the total amount
        updateTotalDebtAmount();   // Update the displayed total amount
        toggleTortureButton();     // Enable/disable the button
    });
});

document.getElementById('customAmount').addEventListener('input', () => {
    let customAmount = parseInt(document.getElementById('customAmount').value) || 0;

    // Prevent typing numbers above 2000
    if (customAmount > 2000) {
        document.getElementById('customAmount').value = 2000;
        customAmount = 2000;
    }

    updateSatisfactionLevel(); // Update satisfaction based on the total amount
    updateTotalDebtAmount();   // Update the displayed total amount
    toggleTortureButton();     // Enable/disable the button
});

document.getElementById('customAmount').addEventListener('input', () => {
    const customAmountInput = document.getElementById('customAmount');
    let customAmount = parseInt(customAmountInput.value) || 0;

    // ✅ Limit the input to a maximum of 2000
    if (customAmount > 2000) {
        customAmountInput.value = 2000;
        customAmount = 2000;
    }

    updateSatisfactionLevel(customAmount);
    updateTotalDebtAmount(); // Update total debt amount
    toggleTortureButton(); // Enable/disable the Torture button
});


// Event listener for the "Torture John" button
document.getElementById('tortureButton').addEventListener('click', async () => {
    let customAmount = parseInt(document.getElementById('customAmount').value);
    
    // If no custom amount is entered, fall back to the selected amount
    if (!customAmount) {
        customAmount = 0;
    }
    
    const amount = customAmount || parseInt(document.querySelector('.debt-option.selected')?.getAttribute('data-amount')) || 0;
    
    if (amount > 0 && amount <= 3000) {
        const message = document.getElementById('messageInput').value;
        await addDebt(amount, message); // Add debt
        document.getElementById('debtPopup').style.display = 'none';
        showCongratulations(amount); // Show a congratulatory effect
    } else {
        alert('Please select a valid debt amount');
    }
});

// Function to show a congratulatory effect
function showCongratulations(amount) {
    const congratulations = document.createElement('div');
    congratulations.id = 'congratulations';
    congratulations.innerText = `Goddess is satisfied with $${amount} added!`;
    document.body.appendChild(congratulations);
    setTimeout(() => {
        congratulations.remove();
    }, 3000);
}

function updateTotalDebtAmount() {
    const selectedOption = document.querySelector('.debt-option.selected');
    const customAmount = parseInt(document.getElementById('customAmount').value) || 0;

    // Get the amount from the selected option (if any)
    const optionAmount = selectedOption ? parseInt(selectedOption.getAttribute('data-amount')) : 0;

    // Calculate the total debt amount
    const totalDebt = optionAmount + customAmount;

    // Format the total debt amount with commas and update the display
    document.getElementById('totalDebtAmount').innerText = `$${totalDebt.toLocaleString()}`;
}


document.querySelectorAll('.debt-option').forEach(button => {
    button.addEventListener('click', () => {
        updateSatisfactionLevel(parseInt(button.getAttribute('data-amount')));
        document.querySelectorAll('.debt-option').forEach(b => b.classList.remove('selected'));
        button.classList.add('selected');
        updateTotalDebtAmount(); // Call the function to update total debt amount
        toggleTortureButton();
    });
});

document.getElementById('customAmount').addEventListener('input', () => {
    updateSatisfactionLevel(parseInt(document.getElementById('customAmount').value) || 0);
    updateTotalDebtAmount(); // Call the function to update total debt amount
    toggleTortureButton();
});


// Event Listeners (ensure that a debt option is selected, including custom)
document.getElementById('debtButton').addEventListener('click', () => {
    document.getElementById('debtPopup').style.display = 'flex';
    document.getElementById('debtPopup').style.alignItems = 'center';
    document.getElementById('debtPopup').style.justifyContent = 'center';
});

document.getElementById('closePopup').addEventListener('click', () => {
    document.getElementById('debtPopup').style.display = 'none';
});

// Initialize on page load
window.onload = async function() {
    await initializeUserSession();
    updateDebtProgress();
};
