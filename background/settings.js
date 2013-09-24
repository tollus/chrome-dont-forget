;(function(scope, undefined){

    chrome.runtime.onMessage.addListener(messageReceived);

    var syncProps = ['alarms', 'uuid', 'settings'];

    var msgFunctions = {
        'saveSettings': function(message, callback) {
            if (!message.settings) {
                callback({error: 'Missing settings property.'});
                return;
            }

            AppSettings.set({settings: message.settings}, function() {
                callback({result:true});
            });

            // return true to process callback async
            return true;
        },
        'getSettings': function(message, callback) {
            AppSettings.get(function(settings) {
                callback({settings: settings.settings});
            });

            // return true to process callback async
            return true;
        }
    };

    var AppSettings = scope.AppSettings = {
        get: function(callback) {
            chrome.storage.local.get(function(settings) {
                // TODO: check for chrome.runtime.error
                chrome.storage.sync.get(function(syncSettings) {
                    // TODO: check for chrome.runtime.error

                    syncProps.forEach(function(x) {
                        settings[x] = syncSettings[x];
                    });

                    callback(settings);
                });
            });

            return true;
        },
        set: function(value, callback) {
            callback = callback || function() {};

            chrome.storage.local.set(value, function() {
                // TODO: check for chrome.runtime.error
                var syncSettings = {};
                var saveSync = false;

                syncProps.forEach(function(prop) {
                    if (value[prop] !== undefined) {
                        syncSettings[prop] = value[prop];
                        saveSync = true;
                    }
                });

                if (saveSync) {
                    console.log('saving sync settings: ', syncSettings);
                    chrome.storage.sync.set(syncSettings, function() {
                        // TODO: check for chrome.runtime.error
                        callback();
                    });
                } else {
                    callback();
                }
            });

            return true;
        },
        clear: function(callback) {
            callback = callback || function() {};

            chrome.storage.local.clear(function() {
                // TODO: check for chrome.runtime.error
                chrome.storage.sync.clear(function() {
                    // TODO: check for chrome.runtime.error
                    callback();
                });
            });

            return true;
        }
    };

    function messageReceived(message, sender, callback) {
        if (sender.id !== chrome.runtime.id) {
            // validate it's from our extension???
            return;
        }

        if (!(message !== null && message.action)) {
            // invalid message received
            callback({error: 'Invalid message received.'});
            return;
        }

        var fn = msgFunctions[message.action];
        if (fn) {
            console.debug( 'settings.messageReceived action: ' + message.action + ' object: ', message);
            return fn.call(this, message, callback);
        }

        return false;
    }

}(window));
