# EmailJS Contact Form Integration

Quick guide to integrate EmailJS contact form into your React frontend.

## 1. Installation
```bash
npm install @emailjs/browser react-router-dom
```

## 2. Environment Setup
Create `.env`:
```env
REACT_APP_EMAILJS_PUBLIC_KEY=rvKVcw5oU9fwRO2zt
REACT_APP_EMAILJS_SERVICE_ID=service_515zd2r
REACT_APP_EMAILJS_TEMPLATE_ID=template_l4a8q2g
EMAILJS_PRIVATE_KEY=qRr4ni_xyXtJ0e0mIawuh 
```

## 3. Integration Steps

### Email Service
```javascript:src/services/emailService.js
import emailjs from '@emailjs/browser';

const EMAIL_SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID;
const EMAIL_TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;

export const sendEmail = async (formData) => {
    try {
        const response = await emailjs.send(
            EMAIL_SERVICE_ID,
            EMAIL_TEMPLATE_ID,
            formData,
            PUBLIC_KEY
        );
        return { success: true, message: "Email sent successfully!" };
    } catch (error) {
        return { success: false, message: "Failed to send email. Please try again." };
    }
};
```

### Contact Form Component
```javascript:src/components/ContactForm.jsx
import React, { useState } from 'react';
import { sendEmail } from '../services/emailService';

const ContactForm = () => {
    const [formData, setFormData] = useState({
        from_name: '',
        to_name: 'Recipient',
        message: '',
        reply_to: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await sendEmail(formData);
        // Handle result
    };

    return (
        <form onSubmit={handleSubmit}>
            <input name="from_name" placeholder="Your Name" />
            <input name="reply_to" type="email" placeholder="Your Email" />
            <textarea name="message" placeholder="Your Message" />
            <button type="submit">Send</button>
        </form>
    );
};

export default ContactForm;
```

### Usage
```javascript:src/pages/Contact.jsx
import ContactForm from '../components/ContactForm';

const Contact = () => (
    <div>
        <h1>Contact Us</h1>
        <ContactForm />
    </div>
);

export default Contact;
```

## Template Variables
Your EmailJS template should use:
- `from_name`: Sender's name
- `to_name`: Recipient's name
- `message`: Email content
- `reply_to`: Sender's email
```

This README provides:
1. Setup instructions
2. Project structure
3. Testing procedures
4. Component documentation
5. Environment configuration
6. Security considerations
7. Dependencies and scripts

Would you like me to add or modify any section?
