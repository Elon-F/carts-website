// With no other option left, here's a date management class...

export const date_options = {
    year: "numeric", month: "2-digit", day: "2-digit",
};

export const date_options_tz = { // maybe try converting to this format after create a timezone-free string?
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC"
};

export const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Returns the cleaned up (current if empty) date in the current timezone.
 * @returns {Date} The current date, 00:00:00, in the current timezone.
 */
export function getDate(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    // return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))

}

/**
 * Returns the (current if empty) date and time.
 * @returns {Date} The current date and time.
 */
export function getTime() {
    let date = new Date();
    return date;
    // return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()))

}

/**
 * Returns the timestamp at the end of the day in the given date.
 * @param date
 * @returns {number}
 */
export function getEndOfDate(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()) + DAY_MS - 1
}

/**
 * Returns the current date as dd/MM/yyyy
 * @returns {string}
 */
export function getAsDateString(date) {
    // toLocaleDateString uses Intl.DateTimeFormat where possible.
    return date.toLocaleString("en-GB", date_options);
}

export function getAsFullDateString(date) {
    return date.toLocaleString("en-GB", {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
}

export function getAsFullHebrewDateString(date) {
    return date.toLocaleString("he-HE", {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
}


/**
 * Returns the current date as yyyy-MM-dd for compatibility with date input fields.
 * @returns {string}
 */
export function getDateForInputField(date) {
    return date.toLocaleString("fr-CA", date_options); // honestly, i should probably just do the conversion manually in a template with 0-padding .toString.padStart(2, "0")
}


/**
 * Takes the given localised date object and converts it to the exact same relative time, in a UTC timestamp.
 * @param date
 * @returns {Date}
 */
export function convertToUTC(date) {
    // this could also be done with timeZone tricks:
    // let userTimezoneOffset = date.getTimezoneOffset() * 60000;
    // new Date(date.getTime() - userTimezoneOffset);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));
}

/**
 * Takes the given un-localised date object and converts it to the exact same relative time, under the current timezone.
 * @param date
 * @returns {Date}
 */
export function convertFromUTC(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
}

/**
 * Takes the given string in ISO order and converts it to the exact same relative time, under the current timezone.
 * @param date
 * @returns {Date}
 */
export function convertFromISO(date) {
    let date_split = date.split(/[-\/]/);
    return new Date(date_split[0], date_split[1] - 1, date_split[2]);
}
