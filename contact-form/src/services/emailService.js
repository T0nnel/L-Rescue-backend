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