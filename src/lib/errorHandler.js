// errorHandler.js

/**
 * Error Handling Utility
 * Provides retry logic, timeout management, and error categorization.
 */

// Configuration for retry logic
const RETRY_ATTEMPTS = 3;
const TIMEOUT_DURATION = 5000; // 5 seconds timeout

/**
 * Categories of errors
 */
const ErrorCategories = {
    NETWORK: 'NetworkError',
    TIMEOUT: 'TimeoutError',
    SERVER: 'ServerError',
    CLIENT: 'ClientError',
    UNEXPECTED: 'UnexpectedError'
};

/**
 * Error Handler Utility Class
 */
class ErrorHandler {
    static async handleWithRetry(fn) {
        let attempts = 0;
        while (attempts < RETRY_ATTEMPTS) {
            try {
                // Execute function with timeout
                return await this.executeWithTimeout(fn);
            } catch (error) {
                attempts++;
                if (attempts >= RETRY_ATTEMPTS) {
                    throw this.categorizeError(error);
                }
            }
        }
    }

    static async executeWithTimeout(fn) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), TIMEOUT_DURATION))
        ]);
    }

    static categorizeError(error) {
        if (error.message === 'Operation timed out') {
            return { category: ErrorCategories.TIMEOUT, error };
        }
        if (error.response) {
            // Assuming error has a response object for server-related errors
            return { category: ErrorCategories.SERVER, error };
        }
        if (error.request) {
            return { category: ErrorCategories.NETWORK, error };
        }
        return { category: ErrorCategories.UNEXPECTED, error };
    }
}

export default ErrorHandler;
