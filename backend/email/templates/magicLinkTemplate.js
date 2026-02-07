/**
 * Generate the HTML email for Magic Link
 * @param {string} url - The magic link URL
 * @param {string} companyName - Name of the app/company
 */
function getMagicLinkEmail(url, companyName) {
    const currentYear = new Date().getFullYear();
    const siteName ='CustArea';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign in to your account</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; background-color: #f9fafb;">
    <div style="max-width: 580px; margin: 0 auto; padding: 40px 20px;">
        <!-- Container -->
        <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); padding: 40px; text-align: center;">
            
            <!-- Logo area -->
            <div style="margin-bottom: 32px;">
                <h1 style="font-size: 24px; font-weight: 700; color: #111111; margin: 0;">${siteName}</h1>
            </div>

            <!-- Main Content -->
            <h2 style="font-size: 20px; font-weight: 600; color: #111111; margin-bottom: 16px;">
                Sign in to your account
            </h2>
            
            <p style="color: #4b5563; font-size: 16px; margin-bottom: 32px;">
                Click the button below to sign in. This link will expire in 1 hour.
            </p>

            <!-- Button -->
            <a href="${url}" style="display: inline-block; background-color: #111111; color: #ffffff; font-weight: 600; font-size: 16px; padding: 12px 32px; text-decoration: none; border-radius: 6px; margin-bottom: 32px;">
                Sign In
            </a>

            <!-- Fallback Link -->
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
                If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="word-break: break-all; color: #6b7280; font-size: 12px;">
                ${url}
            </p>

            <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 32px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    If you didn't request this email, you can safely ignore it.
                </p>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 20px;">
            <p style="color: #9ca3af; font-size: 12px;">
                © ${currentYear} ${siteName}. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
    `;
}

module.exports = { getMagicLinkEmail };
