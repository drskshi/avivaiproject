/**
 * Editable site / email copy — change wording here without touching business logic.
 * Frontend mirrors key fields via /api/content and frontend/js/content.js.
 */
module.exports = {
  brandName: 'O2 TICKETS',
  event: {
    artist: 'Dua Lipa',
    venue: 'The O2 Arena',
    city: 'London',
    dateLabel: '30 November 2026',
    salesStartLabel: '1 July 2026',
    tagline: 'One night only. Secure your seat before they sell out.',
  },
  homepage: {
    eyebrow: 'The O2 Arena · London',
    headline: 'O2 TICKETS',
    subhead: 'Dua Lipa — 30 November 2026. Sales open now for registered fans.',
    ctaPrimary: 'Get tickets',
    ctaSecondary: 'Register for discounts',
    detailsTitle: 'Event details',
    detailsIntro:
      'Choose Restricted, Standard, VIP, or a Group Standard family ticket for up to five people.',
    goodToKnowTitle: 'Good to know',
    goodToKnow: [
      'Children under 16 must be accompanied by an adult on the same order.',
      'Guest checkout needs only an email — guest purchases are not refundable.',
      'Cancellations (eligible tickets) up to 72 hours before the show — 20% fee.',
      'Amendments are upgrades only; never downgrades.',
    ],
  },
  discountsBanner: {
    registeredHint: 'Registered early-bird discounts: July 10% · August 5% · September 10%.',
    guestHint: 'Sign in as a registered (verified) user for seasonal discounts.',
  },
  auth: {
    verifyTitle: 'Verify your email',
    verifyHelp: 'Enter the 6-digit code we sent, or open the link from your email.',
    unverifiedLogin: 'Please verify your email before logging in.',
    resendLabel: 'Resend verification email',
    forgotTitle: 'Forgot password',
    forgotHelp: 'Enter your account email and we’ll send a reset code (and link).',
    resetTitle: 'Reset your password',
    resetHelp: 'Enter the 6-digit code from your email and choose a new password.',
  },
  emails: {
    verifySubject: 'Verify your O2 Tickets account',
    resetSubject: 'Reset your O2 Tickets password',
    ticketSubjectPrefix: 'Your O2 Arena ticket',
  },
};
