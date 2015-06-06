'use strict';

if (global.CustomEvent) {
  module.exports = global.CustomEvent;
} else {
  function CustomEvent(eventName, options) {
    options = options || {bubbles: false, cancelable: false, detail: undefined};

    var e = document.createEvent('CustomEvent');

    e.initCustomEvent(eventName, options.bubbles, options.cancelable, options.detail);

    return e;
  }

  CustomEvent.prototype = Event.prototype;

  module.exports = CustomEvent;
}
