import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;
const PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

app.post('/api/send-email', async (req, res) => {
    try {
        const { from_name, to_name, message, reply_to } = req.body;
        
        console.log('Attempting to send email with:', {
            SERVICE_ID,
            TEMPLATE_ID,
            from_name,
            to_name,
            message,
            reply_to
        });

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
                    from_name,
                    to_name,
                    message,
                    reply_to
                }
            })
        });

        if (response.ok) {
            console.log('Email sent successfully');
            res.json({ success: true, message: "Email sent successfully!" });
        } else {
            const errorData = await response.text();
            console.error('Failed to send email:', errorData);
            res.status(500).json({ 
                success: false, 
                message: errorData
            });
        }
    } catch(error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Environment variables loaded:', {
        SERVICE_ID,
        TEMPLATE_ID,
        PUBLIC_KEY: PUBLIC_KEY ? 'Set' : 'Not set',
        PRIVATE_KEY: PRIVATE_KEY ? 'Set' : 'Not set'
    });
});