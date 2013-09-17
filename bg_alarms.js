;(function(undefined) {
    "use strict";

    var autoClosingNotification;

    chrome.runtime.onStartup.addListener(init);
    chrome.runtime.onInstalled.addListener(init);
    chrome.runtime.onMessage.addListener(messageReceived);
    chrome.alarms.onAlarm.addListener(alarmFired);
    chrome.notifications.onClosed.addListener(notificationClosed);
    chrome.notifications.onButtonClicked.addListener(buttonClicked);

    // shared functions for runtime.sendMessage
    var msgFunctions = {
        'addAlarm': function(message, callback) {
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
                    alarmsCreated(settings.alarms);

                    callback({alarms: settings.alarms});
                    // tell popup to refresh if it's open
                    refreshPopup();
                });
            });
            // return true to process callback async
            return true;
        },

        'deleteAlarm': function(message, callback) {
            if (message.id === undefined) {
                console.error('Missing id parameter in deleteAlarm call.');
                callback({error: 'Missing id parameter.'});
                return;
            }
            if(!message.id.length)
            {
                message.id = [message.id];
            }

            chrome.storage.local.get(function(settings) {
                // find alarm by id
                var isFound;
                message.id.forEach(function(id){
                    var indexToDelete = -1;
                    settings.alarms.every(function(value, index) {
                        if (value.id === id) {
                            indexToDelete = index;
                            return false;
                        }
                        return true;
                    });

                    if (indexToDelete > -1) {
                        var alarm = settings.alarms.splice(indexToDelete, 1);
                        isFound = true;
                    }
                });

                if(isFound)
                {
                    chrome.storage.local.set(settings, function() {
                        if (settings.alarms.length === 0) {
                            alarmsRemoved();
                        } else {
                            alarmsCreated(settings.alarms);
                        }
                        callback({
                            result: true,
                            alarms: settings.alarms
                        });

                        // tell popup to refresh if it's open
                        refreshPopup();
                    });

                }else{
                    callback({
                        result: false,
                        alarms: settings.alarms
                    });
                }
            });

            // return true to process callback async
            return true;
        },
        'getAlarms': function(message, callback) {
            chrome.storage.local.get(function(settings) {
                //TODO: check runtime.error
                callback({alarms: settings.alarms || []});
            });

            // return true to process callback async
            return true;
        }
    };

    function init() {
        console.debug('init called');

        // check settings to update badge count
        chrome.storage.local.get(function(settings) {
            //TODO: check runtime.error
            var updateSettings = false;
            console.debug('settings: ', settings);

            // default alarms to array if not defined
            settings.alarms = settings.alarms || [];

            if (!settings.uuid && settings.uuid !== 0) {
                settings.uuid = 0;
                updateSettings = true;
            }

            if (settings.alarms.length > 0) {
                alarmsCreated(settings.alarms);

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
            } else {
                alarmsRemoved();
            }

            if (updateSettings) {
                console.log('fixed settings ... adjusted to: ', settings);
                chrome.storage.local.set(settings, function() {
                    //TODO: check runtime.error
                });
            }
        });
    }

    // tell popup to refresh if it's open
    function refreshPopup() {
        var pop = chrome.extension.getViews({type:'popup'});
        if (pop.length === 1) {
            pop = pop[0];
            pop.refreshAlarms();
        }
    }

    // when there are alarms, add the timeout and update the icon
    function alarmsCreated(alarms) {
        if (alarms.length === 0) {
            alarmsRemoved();
            return;
        }

        chrome.browserAction.setIcon({path: 'DontForget.png'});
        chrome.browserAction.setBadgeBackgroundColor({color:[255, 255, 255, 0]});
        chrome.browserAction.setBadgeText({text: alarms.length.toString()});

        chrome.alarms.create("alerts", {delayInMinutes: .1, periodInMinutes: .25});
    }

    // when there are no alarms left, remove the timeout
    function alarmsRemoved() {
        chrome.browserAction.setBadgeText({text: ''});
        chrome.browserAction.setIcon({path: 'DontForgetBW.png'});

        chrome.alarms.clearAll();
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

        var fn = msgFunctions[message.action];
        if (fn) {
            return fn.call(this, message, callback);
        }

        callback({error: 'Action ' + message.action + ' not implemented.'});
    }

    function alarmFired() {
        console.debug("alarm fired");
        notify();
    }

    function notify() {
        var alertItems = [];
        var now = new Date(Date.now());
        var currentDT = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(),
                                now.getHours(), now.getMinutes());

        chrome.storage.local.get(function(settings) {
            var firedAlertIDs = [];

            settings.alarms.forEach(function(value, index) {
                if (value.date <= currentDT) {
                    alertItems.push({ title: '', message: value.message});
                    firedAlertIDs.push(value.id);
                }
            });

            chrome.storage.local.set({firedAlertIDs: firedAlertIDs}, function(){
                //TODO: check runtime.err

                if (alertItems.length > 0) {
                    console.debug(alertItems);
                    var opts = {
                        type: "list",
                        title: "Don't Forget!",
                        message: "my message",
                        iconUrl: "DontForget64.png",
                        items: alertItems,
                        buttons: [{iconUrl: 'snooze.png', title: "Snooze"}, {iconUrl: 'dismiss.png', title: "Dismiss"}]
                    };

                    autoClosingNotification = true;
                    chrome.notifications.clear("alerts", function() {
                        autoClosingNotification = false;
                        chrome.notifications.create("alerts", opts, function(){});
                    });
                }
            });
        });
    }

    function buttonClicked(notificationID, buttonIndex){
        if(buttonIndex == 0){
            console.log("snooze pressed");
            snoozeAlert(notificationID);
        } else {
            console.log("dismiss pressed");
            chrome.storage.local.get('firedAlertIDs', function(settings){
                msgFunctions['deleteAlarm'].call(this, {
                    id: settings.firedAlertIDs
                }, function(response){
                    if (response.error) {
                        console.error('deleteAlarm failed: ' + response.error)
                    }
                });
            });
        }
    }

    function snoozeAlert()   {
        chrome.storage.local.get(function(settings) {
            settings.alarms = settings.alarms.map(function(value,index){
                if(settings.firedAlertIDs.indexOf(value.id) > -1)
                {
                    value.date = value.date + 600000;
                }
                return value;
            });
            chrome.storage.local.set(settings, function() {
                // tell popup to refresh if it's open
                refreshPopup();
            });
        });
    }

    function notificationClosed() {
        // ignore auto closes
        if (autoClosingNotification) return;

        console.debug("notification closed");
    }
}());
