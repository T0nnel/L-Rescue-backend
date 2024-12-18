import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;
const PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

async function testEmail() {
    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'origin': 'http://localhost'
            },
            body: JSON.stringify({
                service_id: SERVICE_ID,
                template_id: TEMPLATE_ID,
                user_id: PUBLIC_KEY,
                accessToken: PRIVATE_KEY,
                template_params: {
                    from_name: "Test User",
                    to_name: "Recipient",
                    message: "This is a test message",
                    reply_to: "test@example.com"
                }
            })
        });

        if (response.ok) {
            console.log('SUCCESS!', response.status);
        } else {
            throw new Error(`Failed with status: ${response.status}`);
        }
    } catch(error) {
        console.log('FAILED...', error.message);
    }
}

testEmail(); 