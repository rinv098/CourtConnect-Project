const { EventEmitter } = require('events');

// Single shared event bus for the whole app.
// Route handlers emit events here; listener files react to them independently.
const eventBus = new EventEmitter();

module.exports = eventBus;
