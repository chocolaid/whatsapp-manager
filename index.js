const express = require('express');
const https = require('https'); // Change from http to https
const WebSocket = require('ws');
const { linkDevice, getResponse } = require('./ext/link-device');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Use HTTPS with your SSL certificate (replace with your certificate paths)
const server = https.createServer({
    key: fs.readFileSync('/path/to/your/private/key.pem'),
    cert: fs.readFileSync('/path/to/your/certificate/cert.pem'),
}, app);

const wss = new WebSocket.Server({ server });

const activeSessions = new Map();

function generateSessionId() {
    return Math.random().toString(36).substring(2, 15);
}

function broadcastToSession(sessionId, data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.sessionId === sessionId) {
            client.send(data);
        }
    });
}

function sendQRCodeToApp(sessionId, qrCode) {
    console.log(`Session ${sessionId} - QR Code:`, qrCode);
    broadcastToSession(sessionId, JSON.stringify({ type: 'qrCode', data: qrCode }));
}

function sendCodeToApp(sessionId, code) {
    console.log(`Session ${sessionId} - Received Code:`, code);
    broadcastToSession(sessionId, JSON.stringify({ type: 'receivedCode', data: code }));
}

function sendQRCodeURLToApp(sessionId, qrCodeURL) {
    console.log(`Session ${sessionId} - QR Code URL:`, qrCodeURL);
    broadcastToSession(sessionId, JSON.stringify({ type: 'qrCodeURL', data: qrCodeURL }));
}

function handleConnection(ws) {
    console.log('Client connected');

    const sessionId = generateSessionId();
    ws.sessionId = sessionId;

    ws.send(JSON.stringify({ type: 'initialResponse', data: { sessionId } }));

    activeSessions.set(sessionId, ws);

    ws.on('message', (message) => {
        console.log(`Session ${sessionId} - Received message: ${message}`);
    });

    ws.on('close', () => {
        console.log(`Session ${sessionId} - Client disconnected`);
        activeSessions.delete(sessionId);
    });
}

wss.on('connection', handleConnection);

app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'qr.html'));
});

app.get('/code', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'code.html'));
});

app.get('/link-qr', async (req, res) => {
    const sessionId = req.query.sessionId || '';
    const ws = activeSessions.get(sessionId);

    if (ws) {
        const tempQrImagePath = path.join(__dirname, 'public', 'temp', `${sessionId}_qr.png`);

        try {
            const qrCode = await new Promise((resolve, reject) => {
                linkDevice('qr', null, (qrCode) => resolve(qrCode));
            });

            await new Promise((resolve, reject) => {
                qrcode.toFile(tempQrImagePath, qrCode, { margin: 1 }, (err) => {
                    if (err) {
                        console.error('Error generating QR code:', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            sendQRCodeURLToApp(sessionId, `/temp/${sessionId}_qr.png`);
            res.send(getResponse());
        } catch (error) {
            console.error('Error processing QR code request:', error);
            res.status(500).send('Internal Server Error');
        }
    } else {
        res.status(404).send('Invalid session ID');
    }
});

app.get('/link-number', (req, res) => {
    const sessionId = req.query.sessionId || '';
    const ws = activeSessions.get(sessionId);

    if (ws) {
        const phoneNumber = req.query.phone || '';
        linkDevice('number', phoneNumber, (code) => sendCodeToApp(sessionId, code));
        res.send(getResponse());
    } else {
        res.status(404).send('Invalid session ID');
    }
});

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

// Global error handler to prevent process termination
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason, 'Promise:', promise);
});
