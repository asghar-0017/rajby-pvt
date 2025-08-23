// Hardcoded rates for each transaction type based on FBR API response
// This eliminates the need to call the FBR API for rates every time

export const TRANSACTION_TYPE_RATES = {
  // 75 - Goods at standard rate (default)
  75: [{ ratE_ID: 728, ratE_DESC: "18%", ratE_VALUE: 18 }],

  // 24 - Goods at Reduced Rate
  24: [
    { ratE_ID: 436, ratE_DESC: "0.5%", ratE_VALUE: 0.5 },
    { ratE_ID: 413, ratE_DESC: "1%", ratE_VALUE: 1 },
    { ratE_ID: 419, ratE_DESC: "1.5%", ratE_VALUE: 1.5 },
    { ratE_ID: 126, ratE_DESC: "2%", ratE_VALUE: 2 },
    { ratE_ID: 434, ratE_DESC: "3%", ratE_VALUE: 3 },
    { ratE_ID: 424, ratE_DESC: "4.5%", ratE_VALUE: 4.5 },
    { ratE_ID: 109, ratE_DESC: "5%", ratE_VALUE: 5 },
    { ratE_ID: 175, ratE_DESC: "7%", ratE_VALUE: 7 },
    { ratE_ID: 415, ratE_DESC: "7.5%", ratE_VALUE: 7.5 },
    { ratE_ID: 261, ratE_DESC: "8%", ratE_VALUE: 8 },
    { ratE_ID: 329, ratE_DESC: "8.5%", ratE_VALUE: 8.5 },
    { ratE_ID: 129, ratE_DESC: "10%", ratE_VALUE: 10 },
    { ratE_ID: 286, ratE_DESC: "12.5%", ratE_VALUE: 12.5 },
    { ratE_ID: 623, ratE_DESC: "12.75%", ratE_VALUE: 12.75 },
    { ratE_ID: 432, ratE_DESC: "13%", ratE_VALUE: 13 },
    { ratE_ID: 747, ratE_DESC: "15%", ratE_VALUE: 15 },
    { ratE_ID: 730, ratE_DESC: "17%", ratE_VALUE: 17 },
    { ratE_ID: 732, ratE_DESC: "18%", ratE_VALUE: 18 },
    { ratE_ID: 722, ratE_DESC: "Rs.700/MT", ratE_VALUE: 700 },
  ],

  // 80 - Goods at zero-rate
  80: [{ ratE_ID: 131, ratE_DESC: "0%", ratE_VALUE: 0 }],

  // 85 - Petroleum Products
  85: [
    { ratE_ID: 654, ratE_DESC: "0%", ratE_VALUE: 0 },
    { ratE_ID: 645, ratE_DESC: "0.20%", ratE_VALUE: 0.2 },
    { ratE_ID: 680, ratE_DESC: "0.46%", ratE_VALUE: 0.46 },
    { ratE_ID: 653, ratE_DESC: "1.43%", ratE_VALUE: 1.43 },
    { ratE_ID: 677, ratE_DESC: "1.63%", ratE_VALUE: 1.63 },
    { ratE_ID: 685, ratE_DESC: "2.5%", ratE_VALUE: 2.5 },
    { ratE_ID: 681, ratE_DESC: "2.70%", ratE_VALUE: 2.7 },
    { ratE_ID: 643, ratE_DESC: "2.74%", ratE_VALUE: 2.74 },
    { ratE_ID: 641, ratE_DESC: "3.67%", ratE_VALUE: 3.67 },
    { ratE_ID: 682, ratE_DESC: "4.77%", ratE_VALUE: 4.77 },
    { ratE_ID: 686, ratE_DESC: "5.44%", ratE_VALUE: 5.44 },
    { ratE_ID: 644, ratE_DESC: "6.70%", ratE_VALUE: 6.7 },
    { ratE_ID: 652, ratE_DESC: "6.75%", ratE_VALUE: 6.75 },
    { ratE_ID: 650, ratE_DESC: "6.84%", ratE_VALUE: 6.84 },
    { ratE_ID: 655, ratE_DESC: "7.20%", ratE_VALUE: 7.2 },
    { ratE_ID: 678, ratE_DESC: "7.37%", ratE_VALUE: 7.37 },
    { ratE_ID: 639, ratE_DESC: "7.56%", ratE_VALUE: 7.56 },
    { ratE_ID: 679, ratE_DESC: "8.19%", ratE_VALUE: 8.19 },
    { ratE_ID: 683, ratE_DESC: "8.30%", ratE_VALUE: 8.3 },
    { ratE_ID: 684, ratE_DESC: "9.08%", ratE_VALUE: 9.08 },
    { ratE_ID: 642, ratE_DESC: "9.15%", ratE_VALUE: 9.15 },
    { ratE_ID: 640, ratE_DESC: "10.07%", ratE_VALUE: 10.07 },
    { ratE_ID: 651, ratE_DESC: "10.32%", ratE_VALUE: 10.32 },
    { ratE_ID: 648, ratE_DESC: "10.54%", ratE_VALUE: 10.54 },
    { ratE_ID: 647, ratE_DESC: "10.77%", ratE_VALUE: 10.77 },
    { ratE_ID: 649, ratE_DESC: "11.64%", ratE_VALUE: 11.64 },
    { ratE_ID: 286, ratE_DESC: "12.5%", ratE_VALUE: 12.5 },
    { ratE_ID: 638, ratE_DESC: "15.44%", ratE_VALUE: 15.44 },
    { ratE_ID: 646, ratE_DESC: "16.40%", ratE_VALUE: 16.4 },
    { ratE_ID: 728, ratE_DESC: "18%", ratE_VALUE: 18 },
  ],

  // 62 - Electricity Supply to Retailers
  62: [
    { ratE_ID: 147, ratE_DESC: "5%", ratE_VALUE: 5 },
    { ratE_ID: 110, ratE_DESC: "7.5%", ratE_VALUE: 7.5 },
  ],

  // 129 - SIM
  129: [{ ratE_ID: 411, ratE_DESC: "Rs.250", ratE_VALUE: 250 }],

  // 77 - Gas to CNG stations
  77: [{ ratE_ID: 728, ratE_DESC: "18%", ratE_VALUE: 18 }],

  // 122 - Mobile Phones
  122: [
    { ratE_ID: 627, ratE_DESC: "Rs.10", ratE_VALUE: 10 },
    { ratE_ID: 736, ratE_DESC: "18%", ratE_VALUE: 18 },
    { ratE_ID: 735, ratE_DESC: "25%", ratE_VALUE: 25 },
    { ratE_ID: 621, ratE_DESC: "Rs.130", ratE_VALUE: 130 },
    { ratE_ID: 619, ratE_DESC: "Rs.200", ratE_VALUE: 200 },
    { ratE_ID: 397, ratE_DESC: "Rs.1680", ratE_VALUE: 1680 },
    { ratE_ID: 398, ratE_DESC: "Rs.1740", ratE_VALUE: 1740 },
    { ratE_ID: 399, ratE_DESC: "Rs.5400", ratE_VALUE: 5400 },
    { ratE_ID: 409, ratE_DESC: "Rs.9270", ratE_VALUE: 9270 },
  ],

  // 25 - Processing/Conversion of Goods
  25: [
    { ratE_ID: 269, ratE_DESC: "0%", ratE_VALUE: 0 },
    { ratE_ID: 185, ratE_DESC: "3%", ratE_VALUE: 3 },
    { ratE_ID: 54, ratE_DESC: "5%", ratE_VALUE: 5 },
    { ratE_ID: 728, ratE_DESC: "18%", ratE_VALUE: 18 },
  ],

  // 23 - 3rd Schedule Goods
  23: [
    { ratE_ID: 728, ratE_DESC: "18%", ratE_VALUE: 18 },
    { ratE_ID: 746, ratE_DESC: "25%", ratE_VALUE: 25 },
  ],

  // 21 - Goods (FED in ST Mode)
  21: [
    { ratE_ID: 132, ratE_DESC: "0.5%", ratE_VALUE: 0.5 },
    { ratE_ID: 128, ratE_DESC: "8%", ratE_VALUE: 8 },
    { ratE_ID: 402, ratE_DESC: "17%", ratE_VALUE: 17 },
  ],

  // 22 - Services (FED in ST Mode)
  22: [
    { ratE_ID: 41, ratE_DESC: "8%", ratE_VALUE: 8 },
    { ratE_ID: 22, ratE_DESC: "16%", ratE_VALUE: 16 },
    { ratE_ID: 92, ratE_DESC: "17%", ratE_VALUE: 17 },
    { ratE_ID: 23, ratE_DESC: "19.5%", ratE_VALUE: 19.5 },
    { ratE_ID: 42, ratE_DESC: "200/bill", ratE_VALUE: 200 },
  ],

  // 18 - Services
  18: [
    { ratE_ID: 28, ratE_DESC: "Exempt", ratE_VALUE: 0 },
    { ratE_ID: 280, ratE_DESC: "0%", ratE_VALUE: 0 },
    { ratE_ID: 422, ratE_DESC: "5%", ratE_VALUE: 5 },
    { ratE_ID: 614, ratE_DESC: "15%", ratE_VALUE: 15 },
    { ratE_ID: 22, ratE_DESC: "16%", ratE_VALUE: 16 },
    { ratE_ID: 92, ratE_DESC: "17%", ratE_VALUE: 17 },
    { ratE_ID: 430, ratE_DESC: "18.5%", ratE_VALUE: 18.5 },
    { ratE_ID: 281, ratE_DESC: "50/SqY", ratE_VALUE: 50 },
    { ratE_ID: 282, ratE_DESC: "100/SqY", ratE_VALUE: 100 },
    { ratE_ID: 717, ratE_DESC: "Rs.1000", ratE_VALUE: 1000 },
  ],

  // 81 - Exempt goods
  81: [{ ratE_ID: 133, ratE_DESC: "Exempt", ratE_VALUE: 0 }],

  // 82 - DTRE goods
  82: [{ ratE_ID: 134, ratE_DESC: "DTRE", ratE_VALUE: 0 }],

  // 130 - Cotton ginners
  130: [{ ratE_ID: 728, ratE_DESC: "18%", ratE_VALUE: 18 }],

  // 132 - Electric Vehicle
  132: [{ ratE_ID: 625, ratE_DESC: "1%", ratE_VALUE: 1 }],

  // 134 - Cement /Concrete Block
  134: [
    { ratE_ID: 629, ratE_DESC: "Rs.2", ratE_VALUE: 2 },
    { ratE_ID: 631, ratE_DESC: "Rs.3", ratE_VALUE: 3 },
    { ratE_ID: 633, ratE_DESC: "Rs.5", ratE_VALUE: 5 },
    { ratE_ID: 635, ratE_DESC: "Rs.10", ratE_VALUE: 10 },
  ],

  // 84 - Telecommunication services
  84: [
    { ratE_ID: 343, ratE_DESC: "17%", ratE_VALUE: 17 },
    { ratE_ID: 146, ratE_DESC: "18.5%", ratE_VALUE: 18.5 },
    { ratE_ID: 181, ratE_DESC: "19.5%", ratE_VALUE: 19.5 },
  ],

  // 123 - Steel melting and re-rolling
  123: [{ ratE_ID: 728, ratE_DESC: "18%", ratE_VALUE: 18 }],

  // 125 - Ship breaking
  125: [{ ratE_ID: 745, ratE_DESC: "18%", ratE_VALUE: 18 }],

  // 115 - Potassium Chlorate
  115: [
    {
      ratE_ID: 734,
      ratE_DESC: "18% along with rupees 60 per kilogram",
      ratE_VALUE: 18,
    },
  ],

  // 178 - CNG Sales
  178: [],

  // 181 - Toll Manufacturing
  181: [],

  // 138 - Non-Adjustable Supplies
  138: [{ ratE_ID: 727, ratE_DESC: "0%", ratE_VALUE: 0 }],

  // 139 - Goods as per SRO.297(|)/2023
  139: [{ ratE_ID: 742, ratE_DESC: "25%", ratE_VALUE: 25 }],
};

/**
 * Get rates for a specific transaction type
 * @param {string|number} transactionTypeId - The transaction type ID
 * @returns {Array} Array of rates for the transaction type, or empty array if not found
 */
export const getRatesForTransactionType = (transactionTypeId) => {
  if (!transactionTypeId) return [];

  const rates = TRANSACTION_TYPE_RATES[transactionTypeId];
  return rates || [];
};

/**
 * Get all available transaction type IDs
 * @returns {Array} Array of transaction type IDs
 */
export const getAvailableTransactionTypeIds = () => {
  return Object.keys(TRANSACTION_TYPE_RATES).map(Number);
};

/**
 * Check if a transaction type has rates
 * @param {string|number} transactionTypeId - The transaction type ID
 * @returns {boolean} True if the transaction type has rates, false otherwise
 */
export const hasRatesForTransactionType = (transactionTypeId) => {
  if (!transactionTypeId) return false;

  const rates = TRANSACTION_TYPE_RATES[transactionTypeId];
  return rates && rates.length > 0;
};

export default TRANSACTION_TYPE_RATES;
