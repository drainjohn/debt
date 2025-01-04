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

// Initialize user session
async function initializeUserSession() {
    const ip = await getUserIP();
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
    const userRef = firestore.collection('users').doc(ip);
    const debtRef = realtimeDB.ref('debt');

    // ✅ Check if the user is within the cooldown period
    const userDoc = await userRef.get();
    if (userDoc.exists) {
        const lastUpdated = userDoc.data().lastUpdated?.toDate(); // Convert Firestore Timestamp to Date object
        const now = new Date();

        if (lastUpdated && (now - lastUpdated) < 60 * 60 * 1000) {
            // Cooldown period of 1 hour (60 minutes * 60 seconds * 1000 milliseconds)
            const timeLeft = Math.ceil((60 * 60 * 1000 - (now - lastUpdated)) / 60000); // Minutes left
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


// Show Leaderboard Popup
document.getElementById('leaderboardButton').addEventListener('click', () => {
    document.getElementById('leaderboardPopup').style.display = 'flex';
    fetchLeaderboard();
});

// Close Leaderboard Popup
document.getElementById('closeLeaderboard').addEventListener('click', () => {
    document.getElementById('leaderboardPopup').style.display = 'none';
});

// Fetch and Display Leaderboard
async function fetchLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboardContainer');
    leaderboardContainer.innerHTML = ''; // Clear previous leaderboard data

    // Get current user's IP to identify them
    const ip = await getUserIP();
    const currentUserDoc = await firestore.collection('users').doc(ip).get();
    const currentUserId = currentUserDoc.data().userId;

    // Fetch users from Firestore, ordered by debtAdded
    const snapshot = await firestore.collection('users').orderBy('debtAdded', 'desc').limit(10).get();

    let rank = 1;
    snapshot.forEach(doc => {
        const user = doc.data();
        const userId = user.userId || 'Unknown';
        const displayName = userId.slice(0, 6); // Use first 6 characters for display
        const lastActive = user.lastActive ? formatDate(user.lastActive.seconds) : 'N/A';
        const debtAdded = user.debtAdded || 0;

        // Create leaderboard item
        const item = document.createElement('div');
        item.className = 'leaderboard-item';

        // Apply a different style for the current user
        if (userId === currentUserId) {
            item.classList.add('current-user');
        }

        item.innerHTML = `
            <div class="rank-circle">${rank}</div>
            <div class="user-details">
                <h3>Guest ${displayName}</h3>
                <span>Last Active: ${lastActive}</span>
            </div>
            <div class="strong-container"><strong>$${debtAdded}</strong></div>
        `;

        leaderboardContainer.appendChild(item);
        rank++;
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




function updateSatisfactionLevel(amount) {
    const satisfactionValue = document.getElementById('satisfactionValue');
    
    // Adjust satisfaction levels to make it more stingy
    let satisfaction = 0;
    
    if (amount <= 5) {
        satisfaction = 5;  // 5% satisfaction for $5
    } else if (amount <= 15) {
        satisfaction = 15;  // 15% satisfaction for $15
    } else if (amount <= 50) {
        satisfaction = 25;  // 25% satisfaction for $50
    } else if (amount <= 100) {
        satisfaction = 50;  // 50% satisfaction for $100
    } else if (amount <= 200) {
        satisfaction = 60;  // 60% satisfaction for $200
    } else if (amount <= 500) {
        satisfaction = 75;  // 75% satisfaction for $500
    } else if (amount <= 1000) {
        satisfaction = 90;  // 90% satisfaction for $1000
    }
    
    // Update the satisfaction level display
    satisfactionValue.innerText = satisfaction;
}

// Function to enable or disable the Torture John button
function toggleTortureButton() {
    const customAmount = document.getElementById('customAmount').value;
    const selectedOption = document.querySelector('.debt-option.selected');
    
    // Enable button if a custom amount is valid or if a fixed option is selected
    const isCustomValid = customAmount && parseInt(customAmount) > 0 && parseInt(customAmount) <= 1000;
    if (isCustomValid || selectedOption) {
        document.getElementById('tortureButton').disabled = false;
        document.getElementById('tortureButton').style.backgroundColor = '#fff';
        document.getElementById('tortureButton').style.cursor = 'pointer';
    } else {
        document.getElementById('tortureButton').disabled = true;
        document.getElementById('tortureButton').style.cursor = 'not-allowed';
    }
}

// Event listener for debt options (fixed amount options)
document.querySelectorAll('.debt-option').forEach(button => {
    button.addEventListener('click', () => {
        const amount = parseInt(button.getAttribute('data-amount'));
        updateSatisfactionLevel(amount); // Update satisfaction level based on selected amount

        // Highlight the selected debt option
        document.querySelectorAll('.debt-option').forEach(b => b.classList.remove('selected'));
        button.classList.add('selected');

        // Enable the button
        toggleTortureButton();
    });
});

// Event listener for custom debt amount
document.getElementById('customAmount').addEventListener('input', () => {
    const customAmount = parseInt(document.getElementById('customAmount').value);
    
    if (customAmount > 0 && customAmount <= 1000) {
        updateSatisfactionLevel(customAmount); // Update satisfaction level for custom amount
    }

    // Enable the button
    toggleTortureButton();
});

// Event listener for the "Torture John" button
document.getElementById('tortureButton').addEventListener('click', async () => {
    let customAmount = parseInt(document.getElementById('customAmount').value);
    
    // If no custom amount is entered, fall back to the selected amount
    if (!customAmount) {
        customAmount = 0;
    }
    
    const amount = customAmount || parseInt(document.querySelector('.debt-option.selected')?.getAttribute('data-amount')) || 0;
    
    if (amount > 0 && amount <= 1000) {
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

// Event Listeners (ensure that a debt option is selected, including custom)
document.getElementById('debtButton').addEventListener('click', () => {
    document.getElementById('debtPopup').style.display = 'flex';
});

document.getElementById('closePopup').addEventListener('click', () => {
    document.getElementById('debtPopup').style.display = 'none';
});

// Initialize on page load
window.onload = async function() {
    await initializeUserSession();
    updateDebtProgress();
};
