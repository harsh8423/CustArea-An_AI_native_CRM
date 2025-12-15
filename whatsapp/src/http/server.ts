import express from 'express';
import { config } from '../config/env';
import { validateTwilioSignature } from '../twilio/verifySignature';
import { twilioIncomingHandler } from './routes/twilioWebhook';
import { twilioStatusHandler } from './routes/twilioStatus';

export const createServer = () => {
    const app = express();

    // Twilio sends form-urlencoded
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.set('trust proxy', true);

    // Routes
    app.post('/webhook/twilio/whatsapp', validateTwilioSignature, twilioIncomingHandler);
    app.post('/webhook/twilio/status', validateTwilioSignature, twilioStatusHandler);

    app.get('/health', (req, res) => {
        res.status(200).send('OK');
    });

    return app;
};
