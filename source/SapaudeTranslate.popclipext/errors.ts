// a problem the user can fix in the extension's settings; the message is shown as is
export class SettingsError extends Error {}

// the service answered, but not with a usable translation
export class BadResponseError extends Error {}
