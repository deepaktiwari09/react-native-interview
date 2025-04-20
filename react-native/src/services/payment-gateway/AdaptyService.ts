
// src/services/payment-gateway/AdaptyService.ts

/**
 * @file AdaptyService.ts
 * @description Service layer for handling interactions with Adapty.
 * Adapty is a platform for integrating and managing in-app subscriptions, running A/B tests for paywalls,
 * and analyzing subscription performance, similar to RevenueCat.
 * This file includes examples of common Adapty functionalities and potential interview discussion points.
 * Note: Adapty integration typically uses the 'react-native-adapty' library.
 */

import { adapty } from 'react-native-adapty';
import type {
  AdaptyPaywall,
  AdaptyProduct,
  AdaptyProfile,
  AdaptyError,
  AdaptySubscriptionUpdateParameters,
} from 'react-native-adapty';

// --- Interview Question: How do you initialize and configure the Adapty SDK in a React Native app? ---
// Discussion points: Public SDK Key (from Adapty dashboard), User ID management (important!), observer mode, logging.
const initializeAdapty = async (sdkKey: string, customerUserId?: string | null) => {
  console.log(`Initializing Adapty SDK. Customer User ID: ${customerUserId || 'Not set'}`);
  try {
    // --- Interview Question: Why is setting a customerUserId crucial in Adapty (and similar platforms)? ---
    // Discussion: Links purchases and profile data across devices/platforms for the same logged-in user. Essential for restores and consistent access.
    await adapty.activate(sdkKey, { customerUserId: customerUserId || undefined }); // Pass undefined if null/empty

    // Optional: Set log level
    await adapty.setLogLevel('verbose'); // 'verbose', 'info', 'error', 'none'

    console.log('Adapty activated successfully.');

    // Optional: Set up listener for profile updates
    adapty.addEventListener('onLatestProfileLoad', handleProfileUpdate);

  } catch (error) {
    console.error('Error initializing Adapty:', error);
    // --- Interview Question: How would you handle Adapty initialization errors? ---
  }
};

// --- Interview Question: Explain the concept of Paywalls and Products in Adapty. ---
// Discussion points: Paywalls are UI configurations defined in Adapty dashboard (can include multiple products, remote config, A/B tests).
// Products represent the actual App Store/Play Store items available for purchase. Fetching a paywall gives you the products configured for that specific paywall view.
const fetchPaywall = async (paywallId: string): Promise<{ paywall: AdaptyPaywall; products: AdaptyProduct[] } | null> => {
  console.log(`Fetching Adapty paywall: ${paywallId}`);
  try {
    // --- Interview Question: How does Adapty facilitate A/B testing paywalls? ---
    // Discussion: Define tests in the dashboard. SDK fetches the correct paywall variation based on user segmentation/randomization. `getPaywall` returns the assigned paywall.
    const paywall = await adapty.getPaywall(paywallId);
    console.log(`Paywall fetched: ${paywall.name} (Revision: ${paywall.revision})`);

    // --- Interview Question: How do you get the products associated with a fetched paywall? ---
    // Discussion: Use `getPaywallProducts`. This fetches product details (price, currency, period) from the stores.
    const products = await adapty.getPaywallProducts(paywall);
    console.log('Products associated with paywall:', products.map(p => `${p.vendorProductId} (${p.localizedPrice})`));

    if (products.length === 0) {
      console.warn('No products found for this paywall.');
      // Handle case where paywall is configured but products aren't available/fetched correctly.
    }

    return { paywall, products };
  } catch (error) {
    console.error(`Error fetching Adapty paywall (${paywallId}) or products:`, error);
    // --- Interview Question: What are common reasons for errors when fetching paywalls/products? ---
    // Discussion: Network issues, incorrect paywall ID, products not configured correctly in Adapty/App Stores, App Store/Play Store connection problems.
    return null;
  }
};

// --- Interview Question: Describe the process of making a purchase using Adapty. ---
// Discussion points: Get the AdaptyProduct object (usually from `getPaywallProducts`), call `makePurchase`, handle the result (profile update, error, cancellation).
const makePurchase = async (product: AdaptyProduct): Promise<AdaptyProfile | null> => {
  console.log(`Attempting to purchase product: ${product.vendorProductId}`);
  try {
    // The result of a successful purchase is an updated AdaptyProfile object
    const profile = await adapty.makePurchase(product);

    console.log('Purchase successful!');
    // --- Interview Question: What information is available in the AdaptyProfile after a purchase? ---
    // Discussion: Access levels (entitlements), active/inactive subscriptions, non-subscriptions, customer user ID.
    console.log('Updated Profile Access Levels:', profile.accessLevels); // Check for your entitlement identifier here

    // --- Interview Question: How do you determine if the user gained access to premium features after purchase? ---
    // Discussion: Check `profile.accessLevels['your_premium_access_level']?.isActive`. Access Levels abstract specific products.
    if (profile.accessLevels['premium']?.isActive) {
      console.log('User now has active "premium" access level.');
      // Unlock features based on this access level.
    }

    return profile;
  } catch (error: any) {
    const adaptyError = error as AdaptyError;
    if (adaptyError.adaptyCode === 'userCancelled') { // Check specific error codes from Adapty docs
      console.log('User cancelled the purchase.');
    } else {
      console.error('Error making purchase:', adaptyError);
      // --- Interview Question: How would you handle different purchase errors reported by Adapty? ---
      // Discussion: Check adaptyError.adaptyCode and adaptyError.localizedDescription. Provide user feedback.
    }
    return null;
  }
};

// --- Interview Question: How do users restore purchases with Adapty, and why is it important? ---
// Discussion points: Required by stores, handles reinstalls/new devices, call `adapty.restorePurchases()`, results in an updated AdaptyProfile.
const restorePurchases = async (): Promise<AdaptyProfile | null> => {
  console.log('Attempting to restore purchases via Adapty...');
  try {
    const profile = await adapty.restorePurchases();
    console.log('Restore purchases successful.');
    console.log('Restored Profile Access Levels:', profile.accessLevels);

    // --- Interview Question: What should the app do after a successful restore? ---
    // Discussion: Update UI based on the restored `profile.accessLevels`, potentially show a confirmation.
     if (profile.accessLevels['premium']?.isActive) {
      console.log('Premium access level restored.');
    } else {
        console.log('No active premium access level found after restore.');
    }
    return profile;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    // --- Interview Question: Should an error be shown if restore finds no purchases? ---
    // Discussion: Usually not an error state, just means no prior purchases for that store account. Handle gracefully.
    return null;
  }
};

// --- Interview Question: How do you get the user's current subscription/entitlement status with Adapty? ---
// Discussion points: `adapty.getProfile()` fetches the latest profile data, check `profile.accessLevels`. Use the profile update listener for real-time changes.
const getCurrentProfile = async (): Promise<AdaptyProfile | null> => {
  console.log('Getting current Adapty profile...');
  try {
    const profile = await adapty.getProfile();
    console.log('Current Profile Access Levels:', profile.accessLevels);
    return profile;
  } catch (error) {
    console.error('Error getting Adapty profile:', error);
    return null;
  }
};

// Listener for profile updates pushed from Adapty servers
const handleProfileUpdate = (profile: AdaptyProfile) => {
  console.log('Received Adapty profile update via listener:');
  console.log('Updated Access Levels:', profile.accessLevels);
  // --- Interview Question: Why is the profile update listener useful? ---
  // Discussion: Provides real-time updates without polling (e.g., after background renewals, cancellations, or changes made via Adapty API/dashboard). Keeps app state consistent.
  // Update application state based on the latest profile.
};

// --- Interview Question: How does Adapty handle user identity changes (login/logout)? ---
// Discussion points: `adapty.identify(yourUserId)` associates the profile with your logged-in user. `adapty.logout()` disassociates the profile (moves back to anonymous or potentially merges if logging into another known ID).
const identifyUser = async (userId: string) => {
  console.log(`Identifying Adapty user: ${userId}`);
  try {
    await adapty.identify(userId);
    console.log('Adapty user identified successfully.');
    // Fetch profile again to get potentially merged data
    await getCurrentProfile();
  } catch (error) {
    console.error('Error identifying Adapty user:', error);
  }
};

const logoutUser = async () => {
  console.log('Logging out Adapty user...');
  try {
    await adapty.logout();
    console.log('Adapty user logged out successfully.');
    // Fetch profile again to get anonymous profile data
    await getCurrentProfile();
  } catch (error) {
    console.error('Error logging out Adapty user:', error);
  }
};

// --- Interview Question: How can you update a subscription using Adapty (e.g., upgrade/downgrade)? ---
// Discussion points: Requires the currently active subscription product and the new product. Use `adapty.makePurchase` with the new product and potentially `AdaptySubscriptionUpdateParameters` for specific proration modes (platform dependent).
const updateSubscription = async (newProduct: AdaptyProduct, oldSubscription: /* AdaptySubscription object from profile */ any, prorationMode?: AdaptySubscriptionUpdateParameters['prorationMode']) => {
    console.log(`Attempting to update subscription to ${newProduct.vendorProductId}`);
    // This is a simplified example. You need the actual old subscription object from the profile.
    // const oldSubVendorProductId = oldSubscription.vendorProductId; // Example property
    // const updateParams: AdaptySubscriptionUpdateParameters = { oldSubVendorProductId, prorationMode };
    try {
        // Pass the new product and update parameters
        // const profile = await adapty.makePurchase(newProduct, updateParams);
        // console.log('Subscription update successful. New profile:', profile);
        // return profile;

        // Placeholder simulation
        console.log('Subscription update simulated successfully.');
        return await getCurrentProfile(); // Simulate getting updated profile
    } catch (error) {
        console.error('Error updating subscription:', error);
        return null;
    }
};


// --- Interview Question: What are Adapty webhooks (server-to-server notifications) used for? ---
// Discussion points: Similar to other platforms - reliable tracking of subscription lifecycle events (renewals, cancellations, billing issues, trial conversions), analytics, backend integrations. Requires setting up a secure endpoint.

// --- Interview Question: How does Adapty help with analytics and understanding subscription metrics? ---
// Discussion points: Adapty dashboard provides charts and data on revenue, subscribers, trials, churn, MRR, events, paywall performance, A/B test results.

export const AdaptyService = {
  initializeAdapty,
  fetchPaywall,
  makePurchase,
  restorePurchases,
  getCurrentProfile,
  identifyUser,
  logoutUser,
  updateSubscription, // Note: Requires more specific parameters from profile
  // Webhook handling is backend-side.
};

// --- General Interview Questions ---
// - Compare Adapty with RevenueCat or implementing native IAP directly. (Features, pricing, A/B testing capabilities, analytics focus).
// - How does Adapty handle receipt validation? (Server-side validation with Apple/Google).
// - Explain how you would set up and interpret an A/B test for a paywall in Adapty.
// - How does Adapty handle promotional offers or introductory pricing? (Configuration via products/paywalls).
