'use strict';

/**
 * Database Transaction Safety Utility
 * This utility provides methods to handle database transactions with retry logic and atomic operations.
 *
 * @module dbTransactions
 */

const { beginTransaction, commit, rollback } = require('your-database-library'); // Replace with your actual database library

/**
 * Executes a function within a transaction with retry logic.
 *
 * @param {Function} operation - The function containing the transaction operation.
 * @param {number} [maxRetries=3] - The maximum number of retry attempts.
 * @returns {Promise<any>} - The result of the transaction operation.
 */
async function executeWithTransaction(operation, maxRetries = 3) {
    let attempt = 0;
    let success = false;
    let result;

    while (attempt < maxRetries && !success) {
        const connection = await beginTransaction();
        try {
            result = await operation(connection);
            await commit(connection);
            success = true;
        } catch (error) {
            await rollback(connection);
            attempt++;
            console.error(`Transaction failed. Attempt ${attempt} of ${maxRetries}:`, error);
            if (attempt === maxRetries) {
                throw new Error('Max retries reached. Transaction failed.');
            }
        }
    }
    return result;
}

module.exports = { executeWithTransaction };