// src/lib/validation.js

// Utility function to validate email
function validateEmail(email) {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
}

// Utility function to validate password (at least 8 characters, 1 number, 1 uppercase letter)
function validatePassword(password) {
    const regex = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
    return regex.test(password);
}

// Utility function to validate numeric fields
function validateNumeric(value) {
    return !isNaN(value) && value !== '';
}

// Custom validator example: check if a string is not empty
function validateNotEmpty(value) {
    return value !== ''; // true if not empty
}

// Export functions
module.exports = { validateEmail, validatePassword, validateNumeric, validateNotEmpty };