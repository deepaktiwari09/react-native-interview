
// src/services/payment-gateway/CatRevenueService.ts

/**
 * @file CatRevenueService.ts
 * @description Service layer for handling interactions with RevenueCat (assuming "CatRevenue" meant RevenueCat).
 * RevenueCat simplifies implementing and managing in-app purchases and subscriptions across platforms (iOS, Android).
 * This file includes examples of common RevenueCat functionalities and potential interview discussion points.
 * Note: RevenueCat integration typically uses the 'react-native-purchases' library.
 */

import Purchases, { LOG_LEVEL, PurchasesOffering, PurchasesPackage, CustomerInfo, PurchasesError } from 'react-native-purchases';

// --- Interview Question: How do you initialize and configure the RevenueCat SDK in a React Native app? ---
// Discussion points: API Key (platform-specific), user ID management (anonymous vs. logged-in), debug logs, App Store/Play Store setup.
const initializeRevenueCat = (apiKey: string, appUserID?: string | null) => {
  console.log(`Initializing RevenueCat SDK. App User ID: ${appUserID || 'Anonymous'}`);
  Purchases.setLogLevel(LOG_LEVEL.DEBUG); // Use DEBUG for development, INFO or WARN for production

  // --- Interview Question: Explain the importance of providing a stable appUserID. ---
  // Discussion: Links purchases across devices/platforms for the same user, crucial for restore purchases, prevents creating duplicate RC users.
  // Best practice: Use your backend's unique user ID once the user logs in.
  Purchases.configure({ apiKey, appUserID });

  console.log('RevenueCat configured.');

  // Optional: Set up listener for customer info updates
  Purchases.addCustomerInfoUpdateListener(handleCustomerInfoUpdate);
};

// --- Interview Question: How do you fetch available products or offerings from RevenueCat? ---
// Discussion points: Offerings (current set of products presented to user), Packages (different ways to buy, e.g., monthly, annual), Products (underlying App Store/Play Store items).
const fetchOfferings = async (): Promise<PurchasesOffering | null> => {
  console.log('Fetching RevenueCat offerings...');
  try {
    const offerings = await Purchases.getOfferings();
    // --- Interview Question: What's the difference between 'current' offering and others? ---
    // Discussion: 'current' is the one you've configured on the RC dashboard to be shown by default. You can have multiple offerings for A/B testing or different user segments.
    if (offerings.current && offerings.current.availablePackages.length > 0) {
      console.log('Current offering fetched:', offerings.current.identifier);
      console.log('Available packages:', offerings.current.availablePackages.map(p => `${p.identifier} (${p.packageType})`));
      return offerings.current;
    } else {
      console.log('No current offering or packages found.');
      return null;
    }
  } catch (error) {
    console.error('Error fetching RevenueCat offerings:', error);
    // --- Interview Question: How would you handle errors when fetching offerings? ---
    // Discussion: Show error message, retry logic, maybe disable purchase buttons.
    return null;
  }
};

// --- Interview Question: Describe the process of initiating a purchase for a specific package using RevenueCat. ---
// Discussion points: Getting the PurchasesPackage object, calling `purchasePackage`, handling the result (success, user cancellation, error).
const purchasePackage = async (pkg: PurchasesPackage): Promise<{ customerInfo: CustomerInfo; productIdentifier: string } | null> => {
  console.log(`Attempting to purchase package: ${pkg.identifier} (${pkg.product.identifier})`);
  try {
    const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pkg);

    // --- Interview Question: What information does the 'customerInfo' object contain after a successful purchase? ---
    // Discussion: Active entitlements, active subscriptions, non-renewing purchases, original purchase date, latest expiration date, management URL.
    console.log(`Purchase successful for product: ${productIdentifier}`);
    console.log('Active Entitlements:', Object.keys(customerInfo.entitlements.active));

    // --- Interview Question: How do you verify if the user is now entitled to premium features? ---
    // Discussion: Check `customerInfo.entitlements.active['your_entitlement_id']`. Entitlements decouple features from specific products.
    if (customerInfo.entitlements.active['premium']) { // Assuming 'premium' is your entitlement identifier
      console.log('User has gained 'premium' entitlement.');
      // Unlock premium features here or based on subsequent customerInfo updates.
    }

    return { customerInfo, productIdentifier };
  } catch (error: any) {
    const purchasesError = error as PurchasesError;
    if (purchasesError.userCancelled) {
      console.log('User cancelled the purchase.');
    } else {
      console.error('Error purchasing package:', purchasesError);
      // --- Interview Question: How do you handle different purchase errors (e.g., payment declined, product unavailable)? ---
      // Discussion: Check error code, provide specific user feedback.
    }
    return null;
  }
};

// --- Interview Question: Explain the purpose of "Entitlements" in RevenueCat. ---
// Discussion points: Abstracting access away from specific SKUs/product IDs, easier to manage access control, allows granting access via different products (e.g., monthly/annual sub both grant 'premium').

// --- Interview Question: How does a user restore their previous purchases, and why is it necessary? ---
// Discussion points: Apple/Google requirement, handles reinstalls or new devices, call `Purchases.restorePurchases()`, updates `customerInfo`.
const restorePurchases = async (): Promise<CustomerInfo | null> => {
  console.log('Attempting to restore purchases...');
  try {
    const customerInfo = await Purchases.restorePurchases();
    console.log('Restore purchases successful.');
    console.log('Active Entitlements after restore:', Object.keys(customerInfo.entitlements.active));
    // --- Interview Question: What should happen in the UI after a successful restore? ---
    // Discussion: Update UI to reflect restored access (e.g., show premium state), potentially thank the user.
    if (customerInfo.entitlements.active['premium']) {
        console.log('Premium entitlement restored.');
    } else {
        console.log('No active premium entitlement found after restore.');
    }
    return customerInfo;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    // --- Interview Question: Should you show an error if restore doesn't find any purchases? ---
    // Discussion: Generally no, it just means the user had no previous purchases with that App Store/Google account. Maybe a subtle confirmation.
    return null;
  }
};

// --- Interview Question: How do you get the current user's subscription/entitlement status? ---
// Discussion points: `Purchases.getCustomerInfo()`, checking `customerInfo.entitlements.active`, using the listener for real-time updates.
const checkSubscriptionStatus = async (): Promise<CustomerInfo | null> => {
  console.log('Checking current customer info...');
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    console.log('Current Active Entitlements:', Object.keys(customerInfo.entitlements.active));
    return customerInfo;
  } catch (error) {
    console.error('Error getting customer info:', error);
    return null;
  }
};

// Listener for updates pushed from RevenueCat (e.g., after purchase, renewal, expiration)
const handleCustomerInfoUpdate = (customerInfo: CustomerInfo) => {
  console.log('Received CustomerInfo update via listener:');
  console.log('Active Entitlements:', Object.keys(customerInfo.entitlements.active));
  // --- Interview Question: Why use the listener instead of just calling getCustomerInfo repeatedly? ---
  // Discussion: Efficiency, real-time updates without polling, ensures UI reflects status changes promptly (e.g., after background renewal).
  // Update your application state based on the latest customerInfo
  // e.g., updateReduxState(customerInfo.entitlements.active);
};

// --- Interview Question: How do you handle user identity changes (login/logout)? ---
// Discussion points: Calling `Purchases.logIn()` with your backend user ID, calling `Purchases.logOut()`. Crucial for associating purchases correctly.
const loginUser = async (appUserID: string) => {
    console.log(`Logging in RevenueCat user: ${appUserID}`);
    try {
        const { customerInfo, created } = await Purchases.logIn(appUserID);
        console.log(`RevenueCat login successful. User ${created ? 'created' : 'found'}.`);
        console.log('Active Entitlements:', Object.keys(customerInfo.entitlements.active));
        // Refresh UI based on potentially merged/new customerInfo
    } catch (error) {
        console.error('Error logging in RevenueCat user:', error);
    }
};

const logoutUser = async () => {
    console.log('Logging out RevenueCat user...');
    try {
        const customerInfo = await Purchases.logOut();
        console.log('RevenueCat logout successful.');
        console.log('Active Entitlements (now anonymous):', Object.keys(customerInfo.entitlements.active));
        // Reset UI to non-premium state
    } catch (error) {
        console.error('Error logging out RevenueCat user:', error);
    }
};


// --- Interview Question: What are RevenueCat webhooks used for? ---
// Discussion points: Server-to-server notifications (more reliable than client), tracking events like renewals, cancellations, billing issues, trial conversions. Useful for analytics and backend logic. Requires setting up an endpoint to receive POST requests from RevenueCat.

// --- Interview Question: How would you test in-app purchases during development? ---
// Discussion points: Sandbox accounts (App Store Connect, Google Play Console), TestFlight/Internal Testing, RevenueCat's sandbox environment, testing renewals/expirations.

export const CatRevenueService = {
  initializeRevenueCat,
  fetchOfferings,
  purchasePackage,
  restorePurchases,
  checkSubscriptionStatus,
  loginUser,
  logoutUser,
  // Note: Webhook handling would be a backend service, not client-side.
};

// --- General Interview Questions ---
// - Compare RevenueCat to implementing native IAP directly. (Pros: Abstraction, cross-platform, analytics, server-side receipt validation. Cons: Dependency, cost).
// - How does RevenueCat handle receipt validation? (Server-side validation with Apple/Google).
// - Explain how you would A/B test different price points or packages using RevenueCat Offerings.
// - How do you handle subscription upgrades/downgrades/crossgrades with RevenueCat? (Usually involves purchasing a new package, RC handles proration logic with the stores).
