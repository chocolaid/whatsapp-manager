const { Client, Clientinfo,LinkingMethod, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const userAgent = 'MANAGER';
let response = '';
let accessToken = generateToken(); // Generate the token once and store it in a variable

let sendQRCodeCallback; // Callback function to send the QR code to your application
let sendCodetoapp;
function generateToken() {
    const allowedCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    
    for (let i = 0; i < 30; i++) {
        const randomIndex = Math.floor(Math.random() * allowedCharacters.length);
        randomPart += allowedCharacters.charAt(randomIndex);
    }

    const token = `Wha-manager:${randomPart}`;
    return token;
}


async function linkDevice(method, phone, process) {
    sendQRCodeCallback = process;
    sendCodetoapp = process;

    if (method === "qr") {
        response = 'Show QR code for linking';
        const client = new Client({
            linkingMethod: new LinkingMethod({
                qr: {
                    maxRetries: 100
                }
            }),
            puppeteer: {
                args: ['--no-sandbox'],
                userAgent,
            },
            authStrategy: new LocalAuth({ clientId: accessToken.slice(12) })
        });

        client.on('qr', (qrCode) => {
            sendQRCodeCallback(qrCode); // Send the QR code to your application
            qrcode.generate(qrCode, { small: true });
        });

        client.on('ready', () => {
            console.log('Client is ready!');
            response = `Access token has been sent`;
            client.sendMessage(client.info.wid._serialized, `Your access code is ${accessToken}`);
        });

        client.on('authenticated', (session) => {
            console.log('Client is authenticated!');
            response = 'Client is authenticated!';
        });

        client.initialize();
    } else if (method === "number") {
        response = 'Send the linking code to the provided number';
        const client = new Client({
            linkingMethod: new LinkingMethod({
                phone: {
                    number: phone
                }
            }),
            authStrategy: new LocalAuth({ clientId: accessToken.slice(12) }),
            puppeteer: {
                args: ['--no-sandbox'],
                userAgent,
            },
        });

        client.on('code', (code) => {
            console.log('CODE RECEIVED', code);
            sendCodetoapp(code);
            response = code;
        });

        client.on('ready', () => {
            console.log('Client is ready!');
            response = `Access token has been sent`;
            client.sendMessage(client.info.wid._serialized, `Your access code is ${accessToken}`);
        });

        client.on('authenticated', (session) => {
            console.log('Client is authenticated!');
            response = 'Client is authenticated!';
        });

        client.initialize();
    } else {
        console.log("Invalid linking method.");
        response = 'Invalid linking method.';
    }
}

module.exports = {
    linkDevice,
    getResponse: () => response,
};
