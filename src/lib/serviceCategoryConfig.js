// serviceCategoryConfig.js
//
// CATEGORY_SPECIFIC_SETUP_PLAN.md Phase 1. Single source of truth for
// category-aware copy (placeholders, item vocabulary, hint text) used by
// ServiceSetupForm (ProviderDashboard.jsx) and OfferingsManager
// (ProviderOfferingsPage.jsx). Deliberately separate from
// SERVICE_TYPE_LABELS_BN (serviceSync.js) — that map is just the category
// button label itself; this one is everything ELSE that needs to change
// per-category (placeholders, item word, availability toggle labels).
//
// Data model is unchanged by this file — every category still writes the
// exact same services/{id} shape and offerings[] item shape. This is a
// presentation-layer-only config.

export const CATEGORY_SETUP_CONFIG = {
  salon: {
    categoryHintBn: 'সেলুন, পার্লার, স্পা',
    itemWordBn: 'সার্ভিস',
    itemWordPluralBn: 'সার্ভিস',
    shopNamePlaceholder: 'যেমন: Noor Saloon',
    itemNamePlaceholder: 'যেমন: হেয়ারকাট',
    priceNotePlaceholder: 'যেমন: ৳50 - ৳300',
    availableLabelBn: 'এখন করানো যাচ্ছে',
    unavailableLabelBn: 'এখন বন্ধ',
    hasFixedCatalog: true,
    imageHelperTextBn: 'সার্ভিসের ছবি',
    offeringsPageTitleBn: 'আপনার সার্ভিস লিস্ট',
  },
  hotel: {
    categoryHintBn: 'খাবার, হোটেল, রেস্তোরাঁ',
    itemWordBn: 'মেনু আইটেম',
    itemWordPluralBn: 'মেনু আইটেম',
    shopNamePlaceholder: 'যেমন: রহিম হোটেল',
    itemNamePlaceholder: 'যেমন: চিকেন বিরিয়ানি',
    priceNotePlaceholder: 'যেমন: ৳80 - ৳250',
    availableLabelBn: 'আজ পাওয়া যাচ্ছে',
    unavailableLabelBn: 'আজ নাই',
    hasFixedCatalog: true,
    imageHelperTextBn: 'খাবারের ছবি',
    offeringsPageTitleBn: 'আপনার মেনু',
  },
  medicine: {
    categoryHintBn: 'ওষুধ ও মেডিকেল প্রোডাক্ট',
    itemWordBn: 'প্রোডাক্ট',
    itemWordPluralBn: 'প্রোডাক্ট',
    shopNamePlaceholder: 'যেমন: নূর ফার্মেসি',
    itemNamePlaceholder: 'যেমন: ন্যাপা এক্সট্রা',
    priceNotePlaceholder: 'যেমন: ৳5 - ৳50 (স্টক ভেদে)',
    availableLabelBn: 'স্টকে আছে',
    unavailableLabelBn: 'স্টকে নাই',
    hasFixedCatalog: true,
    imageHelperTextBn: 'প্রোডাক্টের ছবি',
    offeringsPageTitleBn: 'আপনার প্রোডাক্ট লিস্ট',
  },
  bookstore: {
    categoryHintBn: 'বই, স্টেশনারি, ফটোকপি',
    itemWordBn: 'প্রোডাক্ট',
    itemWordPluralBn: 'প্রোডাক্ট',
    shopNamePlaceholder: 'যেমন: ক্যাম্পাস বুক কর্নার',
    itemNamePlaceholder: 'যেমন: A4 খাতা (৮০ পাতা)',
    priceNotePlaceholder: 'যেমন: ৳20 - ৳150',
    availableLabelBn: 'স্টকে আছে',
    unavailableLabelBn: 'স্টকে নাই',
    hasFixedCatalog: true,
    imageHelperTextBn: 'প্রোডাক্টের ছবি',
    offeringsPageTitleBn: 'আপনার প্রোডাক্ট লিস্ট',
  },
  onlinemart: {
    categoryHintBn: 'দৈনন্দিন প্রয়োজনীয় জিনিস, শুধু ডেলিভারি',
    itemWordBn: 'প্রোডাক্ট',
    itemWordPluralBn: 'প্রোডাক্ট',
    shopNamePlaceholder: 'যেমন: ক্যাম্পাস মার্ট',
    itemNamePlaceholder: 'যেমন: হ্যান্ড স্যানিটাইজার (২৫০মিলি)',
    priceNotePlaceholder: 'যেমন: ৳50 - ৳500',
    availableLabelBn: 'স্টকে আছে',
    unavailableLabelBn: 'স্টকে নাই',
    hasFixedCatalog: true,
    imageHelperTextBn: 'প্রোডাক্টের ছবি',
    offeringsPageTitleBn: 'আপনার প্রোডাক্ট লিস্ট',
  },
  // Errand Runner has no fixed catalog by design (existing interactionMode
  // 'errand' logic — see serviceSync.js TYPE_TO_INTERACTION_MODE comment):
  // a Runner fetches/delivers whatever a student or faculty member
  // requests, so there's no offerings[] list to build here. hasFixedCatalog
  // false is what ServiceSetupForm / ProviderOfferingsPage key off of to
  // skip the Offerings step entirely for this category.
  errand: {
    categoryHintBn: 'জিনিস কিনে এনে দেওয়া, পৌঁছে দেওয়া, ছোটখাটো কাজ',
    itemWordBn: null,
    itemWordPluralBn: null,
    shopNamePlaceholder: 'যেমন: রাফি এরান্ড সার্ভিস',
    itemNamePlaceholder: null,
    priceNotePlaceholder: 'যেমন: ৳20 (ক্যাম্পাসের মধ্যে) - ৳100+ (দূরত্ব ভেদে)',
    availableLabelBn: null,
    unavailableLabelBn: null,
    hasFixedCatalog: false,
    imageHelperTextBn: null,
    offeringsPageTitleBn: null,
  },
};

/** Safe getter — falls back to salon's config shape if an unknown type ever shows up, so callers never have to null-check every field. */
export function getCategorySetupConfig(type) {
  return CATEGORY_SETUP_CONFIG[type] || CATEGORY_SETUP_CONFIG.salon;
}
