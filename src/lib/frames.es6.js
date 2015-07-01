'use strict';

const ALLOW_WILDCARD = '.*';
const DEFAULT_MESSAGE_NAMESPACE = '.postMessage';
const DEFAULT_POSTMESSAGE_OPTIONS = {
  targetOrigin: '*',
};

var allowedOrigins = [ALLOW_WILDCARD];
var re_postMessageAllowedOrigin = compileOriginRegExp(allowedOrigins);
var messageNamespaces = [DEFAULT_MESSAGE_NAMESPACE];
var re_messageNamespaces = compileNamespaceRegExp(messageNamespaces);
var listening = false;

function receiveMessage(e) {
  if (e.origin !== location.origin &&
      !re_postMessageAllowedOrigin.test(e.origin)
      && e.origin !== 'null') {
    return;
  }

  try {
    var message = JSON.parse(e.data);
    var type = message.type;

    // Namespace doesn't match, ignore
    if (!re_messageNamespaces.test(type)) {
      return;
    }

    var customEvent = new CustomEvent(message.type, {detail: message.data});

    customEvent.source = e.source;

    global.dispatchEvent(customEvent);
  } catch (x) {}
}



function compileOriginRegExp(origins) {
  return new RegExp('^http(s)?:\\/\\/' + origins.join('|') + '$', 'i');
}

function compileNamespaceRegExp(namespaces) {
  return new RegExp('\\.(?:' + namespaces.join('|') + ')$')
}

function isWildcard(origin) {
  return /\*/.test(origin);
}


/** @module frames */
/* @example
 * // parent window
 * // frames.listen('dfp')
 * // frames.receiveMessageOnce('init.dfp', callback)
 * @example
 * // iframe
 * // frames.postMessage(window.parent, 'init.dfp', data);
 */
var frames = module.exports = {
  /*
   * Send a message to another window.
   * param {Window} target The frame to deliver the message to.
   * param {String} type The message type. (if it doesn't include a namespace the default namespace will be used)
   * param {Object} data The data to send.
   * param {Object} options The `postMessage` options.
   * param {String} options.targetOrigin Specifies what the origin of otherWindow must be for the event to be dispatched.
   */
  postMessage: function (target, type, data, options) {
    if (!/\..+$/.test(type)) {
      type += DEFAULT_MESSAGE_NAMESPACE;
    }

    options = options || {};
    for (var key in DEFAULT_POSTMESSAGE_OPTIONS) {
      if (!options.hasOwnProperty(key)) {
        options[key] = DEFAULT_POSTMESSAGE_OPTIONS[key];
      }
    }

    target.postMessage(JSON.stringify({type: type, data: data, options: options}), options.targetOrigin);
  },

  /*
   * Receive a message from another window.
   * param {Window} [source] The frame to that send the message.
   * param {String} type The message type. (if it doesn't include a namespace the default namespace will be used)
   * param {Function} callback The callback to invoke upon retrieval.
   * param {Object} [context=this] The context the callback is invoked with.
   * returns {Object} The listener.
   */
  receiveMessage: function (source, type, callback, context) {
    if (typeof source === 'string') {
      context = callback;
      callback = type;
      type = source;
      source = null;
    }

    if (!/\..+$/.test(type)) {
      type += DEFAULT_MESSAGE_NAMESPACE;
    }
    context = context || this;

    var scoped = function(e) {
      if (source &&
          source !== e.source &&
          source.contentWindow !== e.source) {
        return;
      }

      callback.apply(context, arguments);
    };

    window.addEventListener(type, scoped);

    return {
      off: function () { window.removeEventListener(type, scoped); }
    };
  },

  /*
   * Receive a message from another window once.
   * param {Window} [source] The frame to that send the message.
   * param {String} type The message type. (if it doesn't include a namespace the default namespace will be used)
   * param {Function} callback The callback to invoke upon retrieval.
   * param {Object} [context=this] The context the callback is invoked with.
   * returns {Object} The listener.
   */
  receiveMessageOnce: function (source, type, callback, context) {
    var listener = frames.receiveMessage(source, type, function() {
      callback && callback.apply(this, arguments);

      listener.off();
    }, context);

    return listener;
  },

  /*
   * Adds an allowed origin to be listened to.
   * param {String} origin The origin to be added.
   */
  addPostMessageOrigin: function (origin) {
    if (isWildcard(origin)) {
      allowedOrigins = [ALLOW_WILDCARD];
    } else if (allowedOrigins.indexOf(origin) === -1) {
      frames.removePostMessageOrigin(ALLOW_WILDCARD);

      allowedOrigins.push(origin);

      re_postMessageAllowedOrigin = compileOriginRegExp(allowedOrigins);
    }
  },

  /*
   * Removes an origin from the list of those listened to.
   * param {String} origin The origin to be removed.
   */
  removePostMessageOrigin: function (origin) {
    var index = allowedOrigins.indexOf(origin);

    if (index !== -1) {
      allowedOrigins.splice(index, 1);

      re_postMessageAllowedOrigin = compileOriginRegExp(allowedOrigins);
    }
  },

  /*
   * Listens to messages on of the specified namespace.
   * param {String} namespace The namespace to be listened to.
   */
  listen: function (namespace) {
    if (messageNamespaces.indexOf(namespace) === -1) {
      messageNamespaces.push(namespace);
      re_messageNamespaces = compileNamespaceRegExp(messageNamespaces);
    }

    if (!listening) {
      global.addEventListener('message', receiveMessage, false);
      listening = true;
    }
  },

  /*
   * Stops listening to messages on of the specified namespace.
   * param {String} namespace The namespace to stop listening to.
   */
  stopListening: function (namespace) {
    var index = messageNamespaces.indexOf(namespace);

    if (index !== -1) {
      messageNamespaces.splice(index, 1);

      if (messageNamespaces.length) {
        re_messageNamespaces = compileNamespaceRegExp(messageNamespaces);
      } else {
        global.removeEventListener('message', receiveMessage, false);
        listening = false;
      }
    }
  },

};
