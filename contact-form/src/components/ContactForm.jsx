import React, { useState } from 'react';
import { sendEmail } from '../services/emailService';

const ContactForm = () => {
    const [formData, setFormData] = useState({
        from_name: '',
        to_name: 'Recipient',
        message: '',
        reply_to: ''
    });
    const [status, setStatus] = useState(null);

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: 'loading', message: 'Sending...' });
        
        const result = await sendEmail(formData);
        
        setStatus({
            type: result.success ? 'success' : 'error',
            message: result.message
        });

        if (result.success) {
            setFormData({
                from_name: '',
                to_name: 'Recipient',
                message: '',
                reply_to: ''
            });
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="text"
                name="from_name"
                value={formData.from_name}
                onChange={handleChange}
                placeholder="Your Name"
                required
            />
            <input
                type="email"
                name="reply_to"
                value={formData.reply_to}
                onChange={handleChange}
                placeholder="Your Email"
                required
            />
            <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Your Message"
                required
            />
            <button type="submit">Send</button>
            
            {status && (
                <div className={`status ${status.type}`}>
                    {status.message}
                </div>
            )}
        </form>
    );
};

export default ContactForm; 