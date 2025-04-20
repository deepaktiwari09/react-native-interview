
// src/services/payment-gateway/PhonePeService.ts

/**
 * @file PhonePeService.ts
 * @description Service layer for handling interactions with the PhonePe Payment Gateway.
 * PhonePe integration often involves server-to-server calls for initiating payments and client-side handling (via SDK or deep linking) to open the PhonePe app.
 * This file includes examples of common functionalities and potential interview discussion points.
 * Note: Specific implementation depends heavily on the chosen PhonePe integration method (SDK, Intent/Deeplink).
 */

import { Linking, Platform } from 'react-native';

// --- Interview Question: Explain the standard flow for initiating a PhonePe payment from a mobile app. ---
// Discussion points: Backend initiates payment request with PhonePe API (amount, transaction ID, callback URL), receives a redirect URL/deeplink.
// Client app uses this URL to open the PhonePe app. User completes payment in PhonePe. PhonePe notifies backend via webhook/callback.
// Client app might poll backend or receive notification to confirm status.

// --- Interview Question: How do you generate the necessary payload and checksum for a PhonePe payment request? ---
// Discussion points: This MUST be done on the backend server to protect the Salt Key and Merchant ID.
// Payload typically includes merchant ID, transaction ID, amount, user details, callback URL.
// Payload is Base64 encoded. Checksum is calculated using SHA256(Base64(payload) + apiEndpoint + saltKey) + ### + saltIndex.
const initiatePhonePePaymentOnServer = async (amount: number, currency: string, transactionId: string, userId: string): Promise<{ redirectUrl: string } | null> => {
  console.log(`Initiating PhonePe payment on server for Txn ID: ${transactionId}`);
  try {
    // IMPORTANT: This happens on YOUR backend server.
    // 1. Construct the payment request payload.
    // 2. Generate the X-VERIFY checksum header.
    // 3. Make a POST request to PhonePe's /pg/v1/pay endpoint.
    // 4. Parse the response to get the redirect URL.
    // const response = await fetch('/api/phonepe/initiate', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ amount, currency, transactionId, userId }),
    // });
    // const data = await response.json();
    // if (!response.ok || !data.redirectUrl) {
    //   throw new Error(data.error || 'Failed to initiate PhonePe payment');
    // }
    // return { redirectUrl: data.redirectUrl };

    // Placeholder simulation
    const mockRedirectUrl = `phonepe://pay?pa=merchant@ybl&pn=MerchantName&tid=${transactionId}&am=${amount}&cu=${currency}&url=yourappscheme://paymentresponse`;
    console.log('Mock PhonePe Redirect URL generated:', mockRedirectUrl);
    return { redirectUrl: mockRedirectUrl };

  } catch (error) {
    console.error('Error initiating PhonePe payment on server:', error);
    // --- Interview Question: How would you handle errors during payment initiation? ---
    return null;
  }
};

// --- Interview Question: How does the client app use the redirect URL to open the PhonePe app? ---
// Discussion points: Using React Native's Linking API (`Linking.openURL`). Need to handle cases where PhonePe app is not installed (`Linking.canOpenURL`).
const openPhonePeApp = async (redirectUrl: string): Promise<boolean> => {
  console.log('Attempting to open PhonePe app with URL:', redirectUrl);
  try {
    const supported = await Linking.canOpenURL(redirectUrl);
    if (supported) {
      await Linking.openURL(redirectUrl);
      console.log('PhonePe app launched.');
      return true;
    } else {
      console.error('PhonePe app is not installed or the URL is invalid.');
      // --- Interview Question: What fallback mechanism would you implement if the PhonePe app is not installed? ---
      // Discussion: Show error message, suggest installation, potentially offer alternative payment methods.
      return false;
    }
  } catch (error) {
    console.error('Error opening PhonePe app:', error);
    return false;
  }
};

// --- Interview Question: How does the app get the payment status after the user completes the action in the PhonePe app? ---
// Discussion points:
// 1. Server-to-Server Callback/Webhook: PhonePe sends a notification to your backend callback URL. Backend verifies the checksum and updates the transaction status.
// 2. Client-side Polling: The app periodically checks the transaction status with your backend.
// 3. Deep Linking Response (Less common/reliable for final status): PhonePe might redirect back to your app via a custom URL scheme, potentially with basic status info, but final confirmation should come from the backend.
const checkPhonePeTransactionStatusOnServer = async (transactionId: string): Promise<'SUCCESS' | 'PENDING' | 'FAILURE' | 'UNKNOWN'> => {
  console.log(`Checking PhonePe transaction status on server for Txn ID: ${transactionId}`);
  try {
    // IMPORTANT: This happens on YOUR backend server.
    // 1. Generate checksum for status check API.
    // 2. Make GET request to PhonePe's status check endpoint (/pg/v1/status/{merchantId}/{merchantTransactionId}).
    // 3. Verify the response checksum.
    // 4. Return the status.
    // const response = await fetch(`/api/phonepe/status/${transactionId}`);
    // const data = await response.json();
    // if (!response.ok) {
    //   throw new Error(data.error || 'Failed to check PhonePe status');
    // }
    // return data.status; // e.g., 'PAYMENT_SUCCESS', 'PAYMENT_ERROR', 'PENDING'

    // Placeholder simulation
    const statuses: Array<'SUCCESS' | 'PENDING' | 'FAILURE'> = ['SUCCESS', 'PENDING', 'FAILURE'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    console.log('Mock PhonePe Status:', randomStatus);
    return randomStatus;

  } catch (error) {
    console.error('Error checking PhonePe transaction status:', error);
    return 'UNKNOWN';
  }
};

// --- Interview Question: Why is server-to-server callback/webhook verification crucial for confirming PhonePe payments? ---
// Discussion points: Security (client-side checks can be spoofed), reliability (handles cases where user closes app before redirect), definitive status source.
// Backend MUST verify the checksum/signature of the incoming webhook payload before trusting it.

// --- Interview Question: How would you handle Pending payment statuses from PhonePe? ---
// Discussion points: Inform the user the payment is processing, use background polling or rely on webhooks for final confirmation, avoid granting access/shipping goods until success is confirmed.

export const PhonePeService = {
  initiatePhonePePaymentOnServer, // Simulates backend call
  openPhonePeApp,
  checkPhonePeTransactionStatusOnServer, // Simulates backend call
  // Webhook handling is purely backend-side.
};

// --- General Interview Questions ---
// - What are the different integration methods offered by PhonePe (Standard Checkout, SDKs)? Pros and Cons?
// - Explain the role of the Merchant ID, Salt Key, and Salt Index.
// - How do you handle refunds with PhonePe? (Usually via Server-to-Server API call).
// - How do you test PhonePe integration in a staging/UAT environment?
