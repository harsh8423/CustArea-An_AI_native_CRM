import { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import { config } from '../config/env';

export const validateTwilioSignature = (req: Request, res: Response, next: NextFunction) => {
    // Skip validation in local dev if needed, or if explicitly disabled
    if (process.env.TWILIO_WEBHOOK_AUTH_ENABLED === 'false') {
        return next();
    }

    const signature = req.headers['x-twilio-signature'] as string;

    // Construct the URL that Twilio used to request this webhook
    // In production, this must match exactly what Twilio sees (https://api.yourdomain.com...)
    // For now, we'll assume the host header is correct or use a config
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    const url = `${protocol}://${host}${req.originalUrl}`;

    // Twilio validation expects the body to be the raw body or parsed body depending on how it's passed
    // If using express.urlencoded(), req.body is an object. validateRequest expects that object.

    const isValid = twilio.validateRequest(
        config.twilio.authToken!,
        signature,
        url,
        req.body
    );

    if (isValid) {
        return next();
    } else {
        console.warn(`Invalid Twilio signature. URL: ${url}`);
        return res.status(403).send('Invalid signature');
    }
};
