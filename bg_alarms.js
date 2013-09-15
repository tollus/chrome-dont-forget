;(function(undefined) {"use strict";

    chrome.runtime.onStartup.addListener(init);
    chrome.runtime.onInstalled.addListener(init);
    chrome.runtime.onMessage.addListener(messageReceived);

    function init() {
        console.debug('init called');

        // check settings to update badge count
        chrome.storage.local.get(function(settings) {
            //TODO: check runtime.error
            var updateSettings = false;

            // default alarms to array if not defined
            settings.alarms = settings.alarms || [];

            if (!settings.uuid) {
                settings.uuid = 0;
                updateSettings = true;
            }

            if (settings.alarms.length > 0) {
                chrome.browserAction.setIcon({path: 'DontForget.png'});
                chrome.browserAction.setBadgeBackgroundColor({color:[255, 255, 255, 0]});
                chrome.browserAction.setBadgeText({text: settings.alarms.length.toString()});

                // make sure the alarms have id values
                var changed = false;
                var alarms = settings.alarms.map(function (value, index) {
                    if (value.id === undefined) {
                        changed = true;
                        value.id = settings.uuid++;
                    }
                    return value;
                });
                if (changed) {
                    settings.alarms = alarms;
                    updateSettings = true;
                }
            }

            if (updateSettings) {
                console.log('fixed settings ... adjusted to: ', settings);
                chrome.storage.local.set(settings, function() {
                    //TODO: check runtime.error
                });
            }
        });
    }

    function messageReceived(message, sender, callback) {
        if (sender.id !== chrome.runtime.id) {
            // validate it's from our extension???
            return;
        }

        console.debug( 'messageReceived action: ' + message.action + ' object: ', message);

        if (!(message !== null && message.action)) {
            // invalid message received
            callback({error: 'Invalid message received.'});
            return;
        }

        switch(message.action) {
            case 'addAlarm':
                if (!message.alarm) {
                    console.error('Missing alarm parameter in addAlarm call.');
                    callback({error: 'Missing alarm parameter.'});
                    return;
                }

                //TODO: Validate the alarm object?
                /* expected:

                    alarm: {
                        date: (int) alertDateTime,
                        message: (string) message,
                        repeat: (Enum - 'half hour', 'hour', 'day', 'week', 'year') repeat
                    }

                    */

                chrome.storage.local.get(function(settings) {
                    //TODO: check runtime.error

                    message.alarm.id = settings.uuid++;
                    settings.alarms.push(message.alarm);

                    chrome.storage.local.set(settings, function() {
                        //TODO: check runtime.error

                        // wait to respond and update icon when set finishes
                        chrome.browserAction.setIcon({path: 'DontForget.png'});
                        chrome.browserAction.setBadgeBackgroundColor({color:[255, 255, 255, 0]});
                        chrome.browserAction.setBadgeText({text: settings.alarms.length.toString()});

                        callback({alarms: settings.alarms});
                    });
                });
                // return true to process callback async
                return true;

            case 'deleteAlarm':
                if (message.id === undefined) {
                    console.error('Missing id parameter in deleteAlarm call.');
                    callback({error: 'Missing id parameter.'});
                    return;
                }

                chrome.storage.local.get(function(settings) {
                    // find alarm by id
                    var indexToDelete = -1;
                    settings.alarms.every(function(value, index) {
                        if (value.id === message.id) {
                            indexToDelete = index;
                            return false;
                        }
                        return true;
                    });

                    if (indexToDelete > -1) {
                        var alarm = settings.alarms.splice(indexToDelete, 1);

                        chrome.storage.local.set(settings, function() {
                            if (settings.alarms.length === 0) {
                                chrome.browserAction.setBadgeText({text: ''});
                                chrome.browserAction.setIcon({path: 'DontForgetBW.png'});
                            } else {
                                chrome.browserAction.setBadgeText({text: settings.alarms.length.toString()});
                            }
                            callback({
                                result: true,
                                deleted: alarm,
                                alarms: settings.alarms
                            });
                        });
                    } else {
                        // could not find alarm by that id
                        callback({
                            result: false,
                            alarms: settings.alarms
                        });
                    }
                });

                // return true to process callback async
                return true;

            case 'getAlarms':
                chrome.storage.local.get(function(settings) {
                    //TODO: check runtime.error
                    callback({alarms: settings.alarms || []});
                });

                // return true to process callback async
                return true;

            default:
                callback({error: 'Action ' + message.action + ' not implemented.'});
                break;

        }
    }

}())