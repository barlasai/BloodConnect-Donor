# BloodConnect - Blood Donation Platform

A comprehensive web platform for blood donation management, featuring donor registration, hospital connectivity, real-time blood stock tracking, and an integrated phishing awareness demo.

## Features

- **Donor Registration**: Easy online registration for blood donors
- **Blood Stock Tracking**: Real-time monitoring of blood availability by type
- **Hospital Directory**: Searchable list of participating hospitals
- **Testimonials**: Community stories and success cases
- **Gallery**: Photo gallery of donation events
- **Contact Form**: Direct communication with the platform administrators
- **Phishing Awareness Demo**: Interactive chat application to educate users about phishing attempts
- **Responsive Design**: Mobile-friendly interface using Tailwind CSS
- **3D Animations**: Engaging Three.js background animations

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Icons**: Font Awesome
- **Animations**: Three.js for 3D effects, CSS animations
- **Backend**: Firebase (Firestore, Authentication)
- **AI Integration**: Google Gemini API for slogan generation
- **React**: Used in the phishing demo component

## Project Structure

```
blood/
├── blood.html          # Main blood donation platform page
├── copy.html           # Alternative/backup version of the main page
├── vs.html             # Another version/variant of the page
├── script.js           # Main JavaScript file with Firebase integration
├── style.css           # Additional custom styles
├── pishing.js          # React component for phishing awareness demo
├── event               # HTML snippet for gallery section
└── README.md           # This file
```

## Setup Instructions

1. **Clone or Download** the project files to your local machine.

2. **Firebase Configuration**:
   - Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Enable Firestore Database and Authentication
   - Copy your Firebase config and replace the placeholder in `script.js`:
     ```javascript
     const firebaseConfig = {
         apiKey: "YOUR_API_KEY",
         authDomain: "YOUR_AUTH_DOMAIN",
         projectId: "YOUR_PROJECT_ID",
         storageBucket: "YOUR_STORAGE_BUCKET",
         messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
         appId: "YOUR_APP_ID"
     };
     ```

3. **Gemini API Setup** (for slogan generation):
   - Obtain an API key from Google AI Studio
   - Add the API key to the `callGemini` function in `script.js`

4. **Open in Browser**:
   - Open `blood.html` in a modern web browser
   - The application will run locally with Firebase backend

## Usage

- **Navigation**: Use the header navigation to explore different sections
- **Donor Registration**: Fill out the registration form in the "Become a Donor" section
- **Blood Availability**: Check current blood stock levels
- **Hospital Search**: Use the search functionality to find nearby hospitals
- **Contact**: Use the contact form to get in touch
- **Phishing Demo**: Access the interactive demo to learn about phishing detection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Security Note

This project includes a phishing awareness component (`pishing.js`). Ensure proper security measures are in place when deploying, especially for the Firebase configuration and API keys.

## License

This project is open-source. Please check individual component licenses for third-party libraries used.

## Contact

For questions or support, please use the contact form within the application or reach out to the development team.
