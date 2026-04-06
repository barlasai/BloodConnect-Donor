// These variables would be provided by the environment in a real scenario
const __app_id = 'blood-donation-app-v1';
const __firebase_config = JSON.stringify({
    apiKey: "YOUR_API_KEY", 
    authDomain: "YOUR_AUTH_DOMAIN", 
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET", 
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID", 
    appId: "YOUR_APP_ID"
});
const __initial_auth_token = undefined;

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- Firebase Initialization ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-blood-app';

// --- Anonymous Authentication ---
signInAnonymously(auth).catch((error) => console.error("Anonymous sign-in failed:", error));

// --- DOM Elements ---
const donorForm = document.getElementById('donor-form');
const formMessage = document.getElementById('form-message');
const contactForm = document.getElementById('contact-form');
const contactFormMessage = document.getElementById('contact-form-message');
const bloodStockContainer = document.getElementById('blood-stock');
const hospitalListContainer = document.getElementById('hospital-list');
const hospitalSearchInput = document.getElementById('hospital-search');
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');
const generateSloganBtn = document.getElementById('generate-slogan-btn');
const sloganOutput = document.getElementById('slogan-output');

// --- Gemini API Function ---
async function callGemini(prompt) {
    const apiKey = ""; // Leave empty, handled by environment
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Gemini API call failed:", error);
        return null;
    }
}


// --- Event Listeners ---
mobileMenuButton.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
        if (!mobileMenu.classList.contains('hidden')) mobileMenu.classList.add('hidden');
    });
});

donorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = donorForm.name.value;
    const email = donorForm.email.value;
    const phone = donorForm.phone.value;
    const bloodGroup = donorForm['blood-group'].value;

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
        formMessage.textContent = 'Please enter a valid 10-digit phone number.';
        formMessage.className = 'text-red-600';
        return;
    }
    
    formMessage.textContent = 'Registering...';
    formMessage.className = 'text-blue-600';
    
    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/donors`), { 
            name: name, 
            email: email, 
            phone: phone, 
            bloodGroup: bloodGroup, 
            location: "Surampalem", 
            registeredAt: new Date() 
        });

        formMessage.textContent = 'Generating a special thank you...';
        const prompt = `Write a short, heartfelt, and personalized thank you message for a new blood donor named ${name}. Their blood group is ${bloodGroup}. Mention the importance of their specific blood type in a positive way. Keep it under 50 words.`;
        const thankYouMessage = await callGemini(prompt);

        if (thankYouMessage) {
            formMessage.innerHTML = `<p class="text-green-600 text-lg">✨ ${thankYouMessage}</p>`;
        } else {
            formMessage.textContent = `Thank you, ${name}! You are a true hero.`;
            formMessage.className = 'text-green-600';
        }

        donorForm.reset();
        setTimeout(() => formMessage.innerHTML = '', 8000);

    } catch (error) {
        console.error("Error adding document: ", error);
        formMessage.textContent = 'Registration failed. Please try again later.';
        formMessage.className = 'text-red-600';
    }
});

contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = contactForm['contact-name'].value;
    const email = contactForm['contact-email'].value;
    const message = contactForm['contact-message'].value;
    contactFormMessage.textContent = 'Sending message...';
    contactFormMessage.className = 'text-blue-600';
    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/contacts`), { name, email, message, sentAt: new Date() });
        contactFormMessage.textContent = 'Message sent successfully! We will get back to you soon.';
        contactFormMessage.className = 'text-green-600';
        contactForm.reset();
        setTimeout(() => contactFormMessage.textContent = '', 5000);
    } catch (error) {
        console.error("Error sending message: ", error);
        contactFormMessage.textContent = 'Failed to send message. Please try again later.';
        contactFormMessage.className = 'text-red-600';
    }
});

generateSloganBtn.addEventListener('click', async () => {
    sloganOutput.innerHTML = '<p class="text-gray-500">✨ Generating inspiring slogans...</p>';
    const prompt = "Generate a list of 5 short, creative, and motivational slogans for a blood donation drive. Format them as a numbered list.";
    const slogans = await callGemini(prompt);
    if (slogans) {
        sloganOutput.innerHTML = slogans.replace(/\n/g, '<br>');
    } else {
        sloganOutput.innerHTML = '<p class="text-red-500">Could not generate slogans at this time. Please try again.</p>';
    }
});


// --- Firestore Real-time Data for Blood Stock ---
const stockCollectionPath = `artifacts/${appId}/public/data/bloodStock`;
const initializeBloodStock = async () => {
    const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    const stockCollectionRef = collection(db, stockCollectionPath);
    const snapshot = await getDocs(stockCollectionRef);
    if (snapshot.empty) {
        const batch = [];
        bloodGroups.forEach(group => {
            const docRef = doc(db, stockCollectionPath, group);
            batch.push(setDoc(docRef, { units: Math.floor(Math.random() * 20) + 5 }));
        });
        await Promise.all(batch);
    }
};

const renderBloodStock = (stockData) => {
    bloodStockContainer.innerHTML = '';
    const bloodGroupsOrder = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    bloodGroupsOrder.forEach(group => {
        const stock = stockData.find(s => s.id === group) || { units: 0 };
        const card = document.createElement('div');
        card.className = 'card-hover-effect text-center';
        card.innerHTML = `
            <div class="blood-drop">
                <div class="blood-drop-content">
                    <div class="text-3xl font-black text-blue-800">${group}</div>
                    <div class="text-sm text-gray-500 font-semibold mt-1">${stock.units} Units</div>
                </div>
            </div>
        `;
        bloodStockContainer.appendChild(card);
    });
};

const listenForStockUpdates = () => {
    const stockCollectionRef = collection(db, stockCollectionPath);
    onSnapshot(stockCollectionRef, (snapshot) => {
        const stockData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderBloodStock(stockData);
    }, (error) => {
        console.error("Error listening to blood stock updates:", error);
        bloodStockContainer.innerHTML = `<p class="col-span-full text-center text-red-500">Could not load blood stock data.</p>`;
    });
};

// --- Hospital Data & Search ---
const allHospitals = [
    // East Godavari
    { name: 'Govt. General Hospital (GGH)', location: 'Kakinada', needs: ['O+', 'B-'], phone: '9999911111', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=GGH+Kakinada', contactPerson: 'Mr. Ravi Kumar' },
    { name: 'Apollo Hospital', location: 'Kakinada', needs: ['A-', 'AB-'], phone: '9999944444', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=Apollo+Kakinada', contactPerson: 'Ms. Priya Sharma' },
    { name: 'Govt. General Hospital (GGH)', location: 'Rajahmundry', needs: ['O-', 'B+'], phone: '9999977777', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=GGH+Rajahmundry', contactPerson: 'Dr. Anil Prasad' },
    { name: 'GSL Medical College', location: 'Rajahmundry', needs: ['All Types'], phone: '9999988888', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=GSL+Rajahmundry', contactPerson: 'Mr. Suresh Varma' },
    { name: 'Area Hospital', location: 'Amalapuram', needs: ['A+', 'B+'], phone: '9988811111', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=Area+Hospital', contactPerson: 'Ms. Lakshmi' },
    { name: 'KIMS Hospital', location: 'Amalapuram', needs: ['O-', 'AB+'], phone: '9988822222', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=KIMS+Amalapuram', contactPerson: 'Mr. David Raju' },
    { name: 'Indian Red Cross Society', location: 'Kakinada', needs: ['All Types'], phone: '9999955555', image: 'https://placehold.co/600x400/ef4444/ffffff?text=Red+Cross', contactPerson: 'Blood Bank Incharge' },
    // West Godavari
    { name: 'District Hospital (GGH)', location: 'Eluru', needs: ['A+', 'O+'], phone: '9977711111', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=GGH+Eluru', contactPerson: 'Dr. Fatima Begum' },
    { name: 'Area Hospital', location: 'Bhimavaram', needs: ['B+', 'AB+'], phone: '9977722222', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=Area+Hospital', contactPerson: 'Mr. Srinivas' },
    { name: 'Area Hospital', location: 'Tadepalligudem', needs: ['O-', 'A-'], phone: '9977733333', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=Area+Hospital', contactPerson: 'Ms. Sunitha' },
    { name: 'Area Hospital', location: 'Tanuku', needs: ['All Types'], phone: '9977744444', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=Area+Hospital', contactPerson: 'Mr. Krishna Reddy' },
    { name: 'CHC', location: 'Polavaram', needs: ['B+', 'O+'], phone: '9977713131', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=CHC+Polavaram', contactPerson: 'Medical Officer' },
    // Visakhapatnam (Vizag)
    { name: 'King George Hospital (KGH)', location: 'Visakhapatnam', needs: ['All Types'], phone: '8888811111', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=KGH+Vizag', contactPerson: 'Dr. Rajeshwari' },
    { name: 'Apollo Hospitals, Ramnagar', location: 'Visakhapatnam', needs: ['O-', 'A-'], phone: '8888822222', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=Apollo+Vizag', contactPerson: 'Ms. Anita Desai' },
    { name: 'Care Hospitals', location: 'Visakhapatnam', needs: ['B+', 'AB+'], phone: '8888833333', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=Care+Vizag', contactPerson: 'Mr. Anand' },
    { name: 'SevenHills Hospital', location: 'Visakhapatnam', needs: ['A+', 'O+'], phone: '8888844444', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=SevenHills+Vizag', contactPerson: 'Mr. Peter Fernandes' },
    // Guntur
    { name: 'Govt. General Hospital (GGH)', location: 'Guntur', needs: ['All Types'], phone: '8888866666', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=GGH+Guntur', contactPerson: 'Chief Medical Officer' },
    { name: 'AIIMS Mangalagiri', location: 'Guntur', needs: ['O-', 'B-'], phone: '8888877777', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=AIIMS+Guntur', contactPerson: 'Blood Bank Coordinator' },
    // Vijayawada
    { name: 'Govt. General Hospital (Old)', location: 'Vijayawada', needs: ['All Types'], phone: '8888810101', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=GGH+Vijayawada', contactPerson: 'Dr. Mary Thomas' },
    { name: 'Manipal Hospitals', location: 'Vijayawada', needs: ['A-', 'B-'], phone: '8888812121', image: 'https://placehold.co/600x400/3b82f6/ffffff?text=Manipal+Vijayawada', contactPerson: 'Mr. Vikram Singh' },
];

const renderHospitals = (hospitalsToRender) => {
    hospitalListContainer.innerHTML = '';
    if (hospitalsToRender.length === 0) {
        hospitalListContainer.innerHTML = `<p class="col-span-full text-center text-gray-600">No hospitals found matching your search.</p>`;
        return;
    }
    hospitalsToRender.forEach(hospital => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-2xl flex flex-col justify-between card-hover-effect shadow-lg border border-gray-100 overflow-hidden';
        card.innerHTML = `
            <div>
                <img src="${hospital.image}" alt="${hospital.name}" class="w-full h-40 object-cover">
                <div class="p-6">
                    <h3 class="text-xl font-bold text-gray-900 mb-2">${hospital.name}</h3>
                    <p class="text-gray-500 mb-2 font-medium"><i class="fas fa-map-marker-alt mr-2 text-blue-600"></i>${hospital.location}</p>
                    <p class="text-gray-500 mb-4 font-medium"><i class="fas fa-user mr-2 text-blue-600"></i>Contact: ${hospital.contactPerson}</p>
                    <div class="mb-5">
                        <h4 class="font-semibold mb-2 text-gray-800">Urgent Needs:</h4>
                        <div class="flex flex-wrap gap-2">
                            ${hospital.needs.map(need => `<span class="bg-orange-100 text-orange-800 text-sm font-bold mr-2 px-3 py-1 rounded-full">${need}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-6 pt-0">
              <a href="tel:${hospital.phone}" class="bg-blue-700 text-white text-center px-6 py-3 rounded-full hover:bg-blue-800 transition-all duration-300 transform hover:scale-105 font-bold w-full block shadow-lg shadow-blue-200">
                  <i class="fas fa-phone-alt mr-2"></i>Contact Hospital
              </a>
            </div>
        `;
        hospitalListContainer.appendChild(card);
    });
};

hospitalSearchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredHospitals = allHospitals.filter(hospital => 
        hospital.name.toLowerCase().includes(searchTerm) || 
        hospital.location.toLowerCase().includes(searchTerm)
    );
    renderHospitals(filteredHospitals);
});

// --- Three.js 3D Background ---
const init3DBackground = () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bg-canvas'), alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const particles = new THREE.Group();
    const geometry = new THREE.TorusGeometry(0.7, 0.2, 16, 40);
    geometry.scale(1, 0.5, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, transparent: true, opacity: 0.7 });

    for (let i = 0; i < 150; i++) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const scale = Math.random() * 0.5 + 0.5;
        mesh.scale.set(scale, scale, scale);
        particles.add(mesh);
    }
    scene.add(particles);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    camera.position.z = 10;
    const clock = new THREE.Clock();

    const animate = () => {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();
        particles.rotation.x = elapsedTime * 0.05;
        particles.rotation.y = elapsedTime * 0.1;
        renderer.render(scene, camera);
    };

    const onWindowResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', onWindowResize, false);
    animate();
};

// --- Scroll Animations ---
const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
        }
    });
}, {
    threshold: 0.1
});

document.querySelectorAll('.animated-section').forEach((section) => {
    scrollObserver.observe(section);
});

// --- Initialize Page ---
initializeBloodStock().then(() => {
    listenForStockUpdates();
});
renderHospitals(allHospitals);
init3DBackground();
