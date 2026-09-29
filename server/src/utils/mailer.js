const { Resend } = require('resend');

console.log('[MAILER] Resend mailer loaded');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendResetEmail(to, resetLink) {
    const { data, error } = await resend.emails.send({
        from: 'CourtConnect <onboarding@resend.dev>',
        to: [to],
        subject: 'Reset your CourtConnect password',
        html: `
            <p>Click below to reset your CourtConnect password.</p>
            <p>This link expires in 30 minutes.</p>
            <a href="${resetLink}">${resetLink}</a>
        `,
    });

    if (error) {
        console.error('[MAILER] Reset email failed:', error);
        throw new Error(error.message);
    }

    console.log('[MAILER] Reset email sent:', data.id);
}

async function sendVerificationEmail(to, code) {
    const { data, error } = await resend.emails.send({
        from: 'CourtConnect <onboarding@resend.dev>',
        to: [to],
        subject: 'Verify your CourtConnect email',
        html: `
            <p>Your CourtConnect verification code is:</p>
            <h2>${code}</h2>
            <p>This code expires in 10 minutes.</p>
        `,
    });

    if (error) {
        console.error('[MAILER] Verification email failed:', error);
        throw new Error(error.message);
    }

    console.log('[MAILER] Verification email sent:', data.id);
}

async function sendApprovalEmail(to, details) {
    const { data, error } = await resend.emails.send({
        from: 'CourtConnect <onboarding@resend.dev>',
        to: [to],
        subject: 'Your reservation was approved!',
        html: `
            <p>Your booking for ${details.courtName}
            on ${details.date} at ${details.startTime}
            has been approved.</p>
        `,
    });

    if (error) {
        console.error('[MAILER] Approval email failed:', error);
        throw new Error(error.message);
    }

    console.log('[MAILER] Approval email sent:', data.id);
}

module.exports = {
    sendResetEmail,
    sendVerificationEmail,
    sendApprovalEmail
};