# EmailJS Backend Service Documentation

## Environment Variables
Create a `.env` file in the server directory with these variables:
```env
REACT_APP_EMAILJS_PUBLIC_KEY=rvKVcw5oU9fwRO2zt
REACT_APP_EMAILJS_SERVICE_ID=service_515zd2r
REACT_APP_EMAILJS_TEMPLATE_ID=template_l4a8q2g
EMAILJS_PRIVATE_KEY=qRr4ni_xyXtJ0e0mIawuh
PORT=3000
```

## API Endpoint

### Send Email
- **URL**: `/api/send-email`
- **Method**: POST
- **Content-Type**: application/json

#### Request Body
```json
{
    "from_name": "Sender Name",
    "to_name": "Recipient",
    "message": "Email content",
    "reply_to": "sender@email.com"
}
```

#### Success Response
```json
{
    "success": true,
    "message": "Email sent successfully!"
}
```

#### Error Response
```json
{
    "success": false,
    "message": "Error message here"
}
```

## Testing
Using cURL:
```bash
curl -X POST http://localhost:3000/api/send-email \
-H "Content-Type: application/json" \
-d "{\"from_name\":\"Test User\",\"to_name\":\"Recipient\",\"message\":\"This is a test message\",\"reply_to\":\"test@example.com\"}"
```

## Running the Server
Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```