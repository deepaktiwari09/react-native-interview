
// src/services/payment-gateway/BhimUPIService.ts

/**
 * @file BhimUPIService.ts
 * @description Service layer for triggering payments via any UPI-supporting app (like BHIM) using a standard UPI Intent.
 * This focuses on constructing the generic `upi://` deeplink.
 * Note: This relies on the user having at least one UPI app installed (BHIM, GPay, PhonePe, Paytm, etc.).
 */

import { Linking, Platform } from 'react-native';

// --- Interview Question: How do you initiate a generic UPI payment that allows the user to choose any installed UPI app (like BHIM, GPay, PhonePe)? ---
// Discussion points: Constructing the standard UPI Intent URL (`upi://pay?...`) with all required parameters.
// Using `Linking.openURL` which triggers the OS's app chooser mechanism if multiple UPI apps are installed.

// --- Interview Question: What are the essential parameters for a standard UPI Intent URL? ---
// Discussion points:
// - `pa` (Payee VPA): Merchant's Virtual Payment Address.
// - `pn` (Payee Name): Merchant's display name.
// - `tid` (Transaction ID): Your unique reference ID for backend tracking. Crucial for reconciliation.
// - `am` (Amount): Payment amount.
// - `cu` (Currency Code): Usually 'INR'.
// - `tn` (Transaction Note): Description visible to the user.
// Optional parameters like `mc` (Merchant Category Code), `url` (Callback URL - less reliable) can also be included.

const triggerGenericUPIIntent = async (
    payeeVpa: string,
    payeeName: string,
    transactionId: string, // Unique ID from your backend
    amount: string,
    transactionNote: string,
    merchantCode?: string
): Promise<boolean> => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
        console.log('UPI Intents are typically used on mobile platforms.');
        return false;
    }

    // Construct the standard UPI Intent URL
    let upiUrl = `upi://pay?pa=${encodeURIComponent(payeeVpa)}` +
                 `&pn=${encodeURIComponent(payeeName)}` +
                 `&tid=${encodeURIComponent(transactionId)}` +
                 `&am=${encodeURIComponent(amount)}` +
                 `&cu=INR` +
                 `&tn=${encodeURIComponent(transactionNote)}`;

    if (merchantCode) {
        upiUrl += `&mc=${encodeURIComponent(merchantCode)}`;
    }

    console.log('Constructed Generic UPI Intent URL:', upiUrl);

    try {
        // Check if *any* app can handle the UPI intent
        const supported = await Linking.canOpenURL(upiUrl);

        if (supported) {
            // Trigger the intent - OS will show app chooser or open default
            await Linking.openURL(upiUrl);
            console.log('UPI app chooser launched (or default app opened).');
            // --- Interview Question: What happens in the app lifecycle when the user switches to the UPI app and then returns? ---
            // Discussion: Your app goes into the background (`AppState` changes to 'background'). When the user returns (after payment or cancellation), it comes back to the foreground (`AppState` changes to 'active'). Need to handle this, potentially by triggering a status check on return.
            return true;
        } else {
            console.error('No UPI app is installed or available to handle the payment intent.');
            // --- Interview Question: What user feedback is appropriate if no UPI app is found? ---
            // Discussion: Inform the user clearly, suggest installing a UPI app (BHIM, GPay, etc.), offer alternative payment methods.
            return false;
        }
    } catch (error) {
        console.error('Error triggering UPI Intent:', error);
        return false;
    }
};

// --- Interview Question: How does your application determine the success or failure of the payment after the user interacts with the chosen UPI app (e.g., BHIM)? ---
// Discussion points: This is the main challenge of the Intent flow. There's NO direct callback. Confirmation MUST come from the backend.
// 1. Backend Webhook: Your payment gateway or bank sends a server-to-server notification upon final status change (success/failure). This requires backend setup and is the most reliable method.
// 2. Backend Polling: Your app (perhaps upon returning to foreground) asks your backend to check the status using the `transactionId`. The backend then queries the relevant API (gateway/bank).

const checkPaymentStatusOnServer = async (transactionId: string): Promise<'SUCCESS' | 'PENDING' | 'FAILURE' | 'UNKNOWN'> => {
    console.log(`Checking payment status on server for Txn ID: ${transactionId}`);
    // This simulates the app polling *your* backend.
    // Your backend needs the actual logic to check with the PSP or bank.
    try {
        // const response = await fetch(`/api/payment/status/${transactionId}`);
        // const data = await response.json();
        // if (!response.ok) throw new Error('Status check failed');
        // return data.status;

        // Placeholder simulation
        const statuses: Array<'SUCCESS' | 'PENDING' | 'FAILURE'> = ['SUCCESS', 'PENDING', 'FAILURE'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        console.log('Mock Server Status for Txn ID:', randomStatus);
        // --- Interview Question: How should the app handle a 'PENDING' status returned from the backend? ---
        // Discussion: Inform the user the payment is processing. Avoid granting access/shipping. Implement a retry mechanism for the status check after a delay, or rely on push notifications triggered by the backend webhook.
        return randomStatus;
    } catch (error) {
        console.error('Error checking payment status on server:', error);
        return 'UNKNOWN';
    }
};

// --- Interview Question: Why is the `tid` (Transaction ID) parameter so important in the UPI Intent URL? ---
// Discussion points: It's the primary key for linking the client-side initiation with the backend records and the eventual webhook/status confirmation. It MUST be unique for each transaction attempt and generated/managed by your backend system.

// --- Interview Question: Compare and contrast using a generic UPI intent vs. integrating a specific payment gateway's SDK (like PayU, Paytm, Cashfree) for handling UPI. ---
// Discussion points:
// - Intent: Simpler client code, no SDK dependency, relies on user having apps, no direct callback (backend reliance), less control over UI/flow.
// - SDK: More complex integration, SDK dependency, often provides callbacks (still need backend verification), potentially better error reporting, might offer other payment methods in one flow, handles app-switching more smoothly sometimes.

export const BhimUPIService = {
  triggerGenericUPIIntent,
  checkPaymentStatusOnServer, // Simulates client polling backend
};

// --- General Interview Questions ---
// - What is UPI Lite? How does it differ from standard UPI?
// - What is UPI Autopay/Mandates? How is it set up?
// - Explain the different roles in the UPI ecosystem (PSP app, Payer Bank, Payee Bank, NPCI, Merchant).
// - What security measures are inherent in UPI? (Device binding, UPI PIN, transaction limits).
