;(function(scope, undefined){

    scope.AppSettings = {
        get: function(callback) {
            chrome.storage.local.get(function(settings){
                // check for chrome.runtime.error

                callback(settings);
            });
        },
        set: function(value, callback) {
            if (value._needSync === undefined) {
                value._needSync = true;
            }

            chrome.storage.local.set(value, function(){
                // check for chrome.runtime.error
                callback();
            });
        }
    };

}(window));
