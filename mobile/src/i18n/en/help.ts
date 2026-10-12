/** Help, FAQ, contact the dairy and privacy policy. The Marathi twin is ../mr/help.ts. */
export const help = {
  retry: 'Retry',
  faq: {
    title: 'Help & FAQ',
    intro: 'Find quick answers about signing in, OTP, and dairy delivery support.',
    loadError: 'Could not load FAQs. Please try again.',
    /** The questions, by their place in the list (`sortOrder`). */
    items: {
      1: {
        question: 'How do I sign in to the Amrale Dairy app?',
        answer:
          'Enter your registered 10-digit mobile number with country code +91, then tap Verify with OTP. You will receive a 6-digit code via SMS to complete sign-in.',
      },
      2: {
        question: 'I did not receive my OTP. What should I do?',
        answer:
          'Wait for the resend timer to finish, then tap Resend OTP. Ensure your mobile number is correct and has network coverage. If the issue continues, use Contact Admin from the login screen.',
      },
      3: {
        question: 'Can I change my mobile number after logging in?',
        answer:
          'On the OTP screen, tap Change mobile number to go back and enter a different number. For updating your registered account number, please contact your dairy administrator.',
      },
      4: {
        question: 'Who do I contact for delivery or subscription help?',
        answer:
          'Use Contact Admin on the login screen to reach your local Amrale Dairy coordinator. For urgent delivery issues, call during your usual delivery window.',
      },
      5: {
        question: 'Is my personal information secure?',
        answer:
          'Yes. We use OTP-based sign-in and secure access to protect your account. Your mobile number is used only for authentication and delivery communication. See Privacy Policy for full details.',
      },
    },
  },
  contact: {
    title: 'Contact Us',
    loadError: 'Could not load contact details. Please try again.',
    pageTitle: "We're here to help",
    pageSubtitle: 'Our dedicated team is ready to assist you with your dairy subscriptions and inquiries.',
    headline: "Kothrud's Trusted Dairy Since 1976",
    bodyLines: ['Experience the true taste of purity with us.', 'Premium Quality Dairy & Food Products Available.'],
    getInTouch: 'Get in touch',
    visitUs: 'Visit us',
    /** Short labels stored with each way of reaching the dairy. */
    labels: {
      call: 'CALL US',
      whatsapp: 'WHATSAPP',
      email: 'EMAIL US',
      website: 'WEBSITE',
      address: 'VISIT US',
    },
    /** Row titles on the Contact Us card. */
    channels: {
      call: 'Call us',
      whatsapp: 'WhatsApp',
      email: 'Email us',
      website: 'Website',
    },
    /** What tapping each row does (screen readers). */
    hints: {
      call: 'Call the dairy',
      whatsapp: 'Chat the dairy',
      email: 'Email the dairy',
      website: 'Opens the dairy’s website',
    },
    channelLabel: (title: string, value: string) => `${title}: ${value}`,
    mapLabel: 'Map of the dairy. Opens in maps',
    mapTitle: 'Map showing Amrale Dairy location',
    getDirections: 'Get directions',
  },
  privacy: {
    title: 'Privacy Policy',
    loadError: 'Could not load privacy policy. Please try again.',
    lastUpdated: 'Last updated: January 2024',
    intro:
      'Amrale Dairy ("we", "our", "us") respects your privacy. This policy explains how we collect, use, and protect your information when you use our mobile application and delivery services.',
    /** The sections, by their place in the policy (`sortOrder`). */
    sections: {
      1: {
        title: 'Information We Collect',
        paragraphs: [
          'Mobile number and one-time password (OTP) details used to verify your identity and secure your account.',
          'Subscription, delivery, and order information needed to fulfil daily dairy deliveries.',
          'Device and app usage data required to keep the service reliable and secure.',
        ],
      },
      2: {
        title: 'How We Use Your Information',
        paragraphs: [
          'To authenticate you and manage your account.',
          'To process subscriptions, deliveries, billing, and customer support requests.',
          'To send service-related messages such as OTP codes and delivery updates.',
          'To improve our products, routes, and app experience.',
        ],
      },
      3: {
        title: 'Sharing of Information',
        paragraphs: [
          'We do not sell your personal information.',
          'We may share limited data with delivery partners and service providers who help us operate the dairy service, under strict confidentiality.',
          'We may disclose information when required by law or to protect the rights and safety of our customers and staff.',
        ],
      },
      4: {
        title: 'Data Security',
        paragraphs: [
          'We use industry-standard safeguards including OTP-based sign-in and secure storage for session data.',
          'No method of transmission over mobile networks is completely secure; we work continuously to protect your data.',
        ],
      },
      5: {
        title: 'Your Choices',
        paragraphs: [
          'You may contact us to update your registered mobile number or subscription details through your dairy administrator.',
          'You may request information about your data or raise privacy concerns using the Contact Admin option in the app.',
        ],
      },
      6: {
        title: 'Contact Us',
        paragraphs: [
          'For privacy-related questions, email support@amraledairy.com, call +91 99224 43636 or visit dairy.matdarraja.in.',
          'Amrale Dairy — Kothrud’s Trusted Dairy Since 1976.',
        ],
      },
    },
  },
};
