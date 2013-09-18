;(function(scope, undefined){

    var syncProps = ['alarms', 'uuid'];

    scope.AppSettings = {
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

}(window));
