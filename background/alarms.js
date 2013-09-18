;(function(AppSettings, undefined) {
    "use strict";

    var alarmActive;
    var autoClosingNotification;
    var repeatEnumMinutes = {
        'half hour': 30,
        'hour': 60,
        'day': 60 * 24,
        'week': 60 * 24 * 7
        // month + year ignored because it's special ...
    };

    chrome.runtime.onStartup.addListener(init);
    chrome.runtime.onInstalled.addListener(init);
    chrome.runtime.onMessage.addListener(messageReceived);
    chrome.alarms.onAlarm.addListener(alarmFired);
    chrome.notifications.onClosed.addListener(notificationClosed);
    chrome.notifications.onButtonClicked.addListener(buttonClicked);
    chrome.storage.onChanged.addListener(storageChanged);

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

            AppSettings.get(function(settings) {
                message.alarm.id = settings.uuid++;
                settings.alarms.push(message.alarm);

                settings.alarms.sort(function(a,b){return a.date - b.date });

                AppSettings.set(settings, function() {
                    // wait to respond and update icon when set finishes
                    alarmsCreated(settings.alarms);

                    callback({alarms: settings.alarms});

                    if (!message.fromPopup) {
                        // tell popup to refresh if it's open
                        refreshPopup();
                    }
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
            if (!message.id.length) {
                message.id = [message.id];
            }

            AppSettings.get(function(settings) {
                // find alarm by id
                var isFound;
                message.id.forEach(function(id) {
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

                if (isFound) {
                    AppSettings.set(settings, function() {
                        if (settings.alarms.length === 0) {
                            alarmsRemoved();
                        } else {
                            alarmsCreated(settings.alarms);
                        }
                        callback({
                            result: true,
                            alarms: settings.alarms
                        });

                        if (!message.fromPopup) {
                            // tell popup to refresh if it's open
                            refreshPopup();
                        }
                    });

                } else {
                    callback({
                        result: false,
                        alarms: settings.alarms
                    });
                }
            });

            // return true to process callback async
            return true;
        },
        'dismissAlarm': function(message, callback) {
            if (message.id === undefined) {
                console.error('Missing id parameter in dismissAlarm call.');
                callback({error: 'Missing id parameter.'});
                return;
            }
            if (!message.id.length) {
                message.id = [message.id];
            }

            AppSettings.get(function(settings) {
                // find alarm by id
                var isFound;
                message.id.forEach(function(id) {
                    var foundIndex = -1;
                    settings.alarms.every(function(value, index) {
                        if (value.id === id) {
                            foundIndex = index;
                            return false;
                        }
                        return true;
                    });

                    if (foundIndex > -1) {
                        isFound = true;

                        var alarm = settings.alarms[foundIndex];
                        if (alarm.repeat) {
                            settings.alarms[foundIndex] = toNextAlarm(alarm);
                        } else {
                            settings.alarms.splice(foundIndex, 1);
                        }
                    }
                });

                if (isFound) {
                    AppSettings.set(settings, function() {
                        if (settings.alarms.length === 0) {
                            alarmsRemoved();
                        } else {
                            alarmsCreated(settings.alarms);
                        }
                        callback({
                            result: true,
                            alarms: settings.alarms
                        });

                        if (!message.fromPopup) {
                            // tell popup to refresh if it's open
                            refreshPopup();
                        }
                    });

                } else {
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
            AppSettings.get(function(settings) {
                settings.alarms.sort(function(a,b){return a.date - b.date });
                callback({alarms: settings.alarms || []});
            });

            // return true to process callback async
            return true;
        }
    };

    function init() {
        console.debug('alarms init called');

        // check settings to update badge count
        AppSettings.get(function(settings) {
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
                console.log('initialized settings: ', settings);
                AppSettings.set(settings, function() {});
            }
        });
    }

    function storageChanged(changes, area) {
        if (area === 'sync') {
            if (changes.alarms) {
                alarmsCreated(changes.alarms.newValue);
                refreshPopup();
            }
        }
    }

    // tell popup to refresh if it's open
    function refreshPopup() {
        chrome.extension.getViews({type:'popup'}).forEach(function(pop) {
            if (pop.refreshAlarms) {
                pop.refreshAlarms();
            }
        });
    }

    // when there are alarms, add the timeout and update the icon
    function alarmsCreated(alarms) {
        if (alarms.length === 0) {
            alarmsRemoved();
            return;
        }

        chrome.browserAction.setBadgeText({text: alarms.length.toString()});

        if (!alarmActive) {
            chrome.browserAction.setIcon({path: 'images/logo128.png'});
            chrome.browserAction.setBadgeBackgroundColor({color:[255, 255, 255, 0]});
            chrome.alarms.create("alerts", {periodInMinutes: 1});
            alarmActive = true;
        }
    }

    // when there are no alarms left, remove the timeout
    function alarmsRemoved() {
        chrome.browserAction.setBadgeText({text: ''});
        chrome.browserAction.setIcon({path: 'images/logo_BW128.png'});

        if (alarmActive !== false) {
            chrome.alarms.getAll(function(alarms) {
                alarms.every(function(alarm) {
                    if (alarm.name === "alerts") {
                        chrome.alarms.clear(alarm.name);
                        return false;
                    }
                    return true;
                });
            });
        }
        alarmActive = false;
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

    function alarmFired(alarm) {
        if (alarm.name === "alerts") {
            console.debug("alarm fired");
            notify();
        }
    }

    function notify() {
        var alertItems = [];
        var now = new Date(Date.now());
        var currentDT = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(),
                                now.getHours(), now.getMinutes());

        AppSettings.get(function(settings) {
            var firedAlertIDs = [];

            settings.alarms.forEach(function(value, index) {
                if (value.date <= currentDT) {
                    alertItems.push({ title: '', message: value.message});
                    firedAlertIDs.push(value.id);
                }
            });

            AppSettings.set({firedAlertIDs: firedAlertIDs}, function() {
                if (alertItems.length > 0) {
                    console.debug(alertItems);
                    var opts = {
                        type: "list",
                        title: "Don't Forget!",
                        message: "my message",
                        iconUrl: "images/logo_alarm64.png",
                        items: alertItems,
                        buttons: [{iconUrl: 'images/snooze.png', title: "Snooze"}, {iconUrl: 'images/dismiss.png', title: "Dismiss"}]
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

    function buttonClicked(notificationID, buttonIndex) {
        if (buttonIndex == 0) {
            console.log("snooze pressed");
            snoozeAlert(notificationID);
        } else {
            console.log("dismiss pressed");
            AppSettings.get(function(settings) {
                msgFunctions['dismissAlarm'].call(this, {
                    id: settings.firedAlertIDs
                }, function(response) {
                    if (response.error) {
                        console.error('dismissAlarm failed: ' + response.error)
                    }
                });
            });
        }
    }

    function snoozeAlert()   {
        AppSettings.get(function(settings) {
            var newalarms = [];
            settings.alarms = settings.alarms.map(function(value,index) {
                if (settings.firedAlertIDs.indexOf(value.id) > -1) {
                    var now = getCurrentDate();

                    if (value.repeat) {
                        // create a new alarm for the snooze, and
                        //  go to the next occurrence for this alarm
                        //  this way we don't lose the original start time

                        var snooze = duplicateAlarm(value, settings.uuid++);
                        snooze.date = now + 1000 * 60 * 10; // 10 min
                        delete snooze.repeat;
                        if (snooze.originalStart) {
                            delete snooze.originalStart;
                        }
                        newalarms.push(snooze);

                        return toNextAlarm(value);
                    } else {
                        value.date = now + 1000 * 60 * 10; // 10 min
                    }
                }
                return value;
            });

            if (newalarms.length > 0) {
                settings.alarms = settings.alarms.concat(newalarms);
            }

            settings.alarms.sort(function(a,b){return a.date - b.date });

            AppSettings.set(settings, function() {
                // tell popup to refresh if it's open
                refreshPopup();
            });
        });
    }

    // returns the current date as number (local timezone stored as UTC with 0 seconds)
    function getCurrentDate() {
        var now = new Date();
        return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0);
    }

    function notificationClosed() {
        // ignore auto closes
        if (autoClosingNotification) return;

        console.debug("notification closed");
    }

    // move to next occurrence
    function toNextAlarm(alarm) {
        if (!alarm.originalStart) {
            alarm.originalStart = alarm.date;
        }

        var newdate = new Date(alarm.date);
        var mins = repeatEnumMinutes[alarm.repeat];

        if (mins) {
            newdate.setMinutes(newdate.getMinutes() + mins);
        } else if (alarm.repeat === 'month') {
            newdate.setMonth(newdate.getMonth() + 1);
        } else if (alarm.repeat === 'month') {
            newdate.setFullYear(newdate.getFullYear() + 1);
        } else {
            //TODO: Handle error for invalid enum?
            newdate.setMinutes(newdate.getMinutes() + 60);
        }
        alarm.date = newdate.getTime();

        return alarm;
    }

    // returns duplicate alarm with a new uuid
    function duplicateAlarm(alarm, nextId) {
        var newalarm = {};
        var i;
        for( i in alarm ) {
            newalarm[i] = alarm[i];
        }

        newalarm.id = nextId;
        return newalarm;
    }
}(window.AppSettings));
