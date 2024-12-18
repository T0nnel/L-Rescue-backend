# EmailJS Backend Service

REST API service for sending emails using EmailJS.

## Setup

1. Install dependencies:
```bash
npm install
```

## API Endpoint

POST `/api/send-email`

Request body:
```json
{
    "from_name": "Sender Name",
    "to_name": "Recipient",
    "message": "Email content",
    "reply_to": "sender@email.com"
}
```

## Run the Server

Development mode:
```bash
npm run dev
```