$(function() {
    $( "#datepicker" ).datepicker();
});

angular.module('DontForget', ['ui.bootstrap']);

var DontForgetCtrl = function ($scope, $timeout, $filter)
{
    var _settings = {};

    $scope.alerts = [];

    $scope.settings = {
        snoozeTime: 10
    };

    //datepicker
    $scope.today = function() {
        $scope.dt = new Date();
    };
    $scope.today();
    $scope.open = function() {

        $scope.opened = true;
    };
    $scope.dateOptions = {
        'year-format': "'yy'",
        'starting-day': 1
    };

    $scope.SaveAlert = function(){
        var message = $scope.reminderText || '';
        var alertDateTime;
        var repeat = $scope.selectedRepeat;

        if($scope.radioModel == 'on') {
            var mydate = new Date($('#datepicker')[0].value);
            var mytime = $scope.mytime.split(':');
            alertDateTime = Date.UTC(mydate.getFullYear(), mydate.getMonth(), mydate.getDate(), mytime[0], mytime[1], 0);
        } else {
            var mydate = new Date();
            mydate.setHours(mydate.getHours() + $scope.inHours);
            mydate.setMinutes(mydate.getMinutes() + $scope.inMinutes);

            alertDateTime = Date.UTC(mydate.getFullYear(), mydate.getMonth(), mydate.getDate(), mydate.getHours(), mydate.getMinutes(), 0);
        }

        if(repeat === 'Repeat Every' || repeat === 'never')
            repeat = null;

        if(message === '')
            message = "Don't Forget!";

        //success = green $scope.alerts.push({type: 'success', msg: new Date(alertDateTime - new Date()) + " " + message});
        //fail = red $scope.alerts.push({type: 'error', msg: new Date(alertDateTime - new Date()) + " " + message});
        //no type = yellow
        //$scope.alerts.push({msg: alertDateTime + " " + message});

        chrome.runtime.sendMessage({
            action: 'addAlarm',
            fromPopup: true,
            alarm: {
                date: alertDateTime,
                message: message,
                repeat: repeat
            }
        }, function(response){
            if (response.error) {
                console.error('addAlarm failed: ' + response.error)
            } else if (response.alarms) {
                $scope.alerts = generateAlerts(response.alarms);
                $scope.$digest();
            }
        });

        SetDefaults();
    }

    $scope.closeAlert = function(index) {
        var id = $scope.alerts[index].id;

        chrome.runtime.sendMessage({
            action: 'dismissAlarm',
            fromPopup: true,
            id: id
        }, function(response){
            if (response.error) {
                console.error('dismissAlarm failed: ' + response.error)
            } else if (response.alarms) {
                $scope.alerts = generateAlerts(response.alarms);
                $scope.$digest();
            }
        });

        SetDefaults();
    };

    $scope.CloseWindow = function (){
        window.close();
    }

    function SetDefaults(){
        $scope.inHours = 0;
        $scope.inMinutes = 15;
        $scope.reminderText = '';
        $scope.selectedRepeat = 'Repeat Every';
    }

    function padTime(myNum){
       return myNum < 10 ? "0" + myNum : myNum;
    }

    function loadAlerts(){
        chrome.runtime.sendMessage({
            action: 'getSettings'
        }, function(settings) {
            // store settings locally
            _settings = settings.settings;

            chrome.runtime.sendMessage({
                action: 'getAlarms'
            }, function(response){
                console.debug('received getAlarms message: ', response);

                if (response.error) {
                    console.error('getAlarms failed: ' + response.error)
                } else if (response.alarms) {
                    $scope.alerts = generateAlerts(response.alarms);
                    $scope.$digest();
                }
            });
        });
    }
    $scope.loadAlerts = loadAlerts;

    // called from the background page
    window.refreshAlarms = loadAlerts;

    function generateAlerts(alarms){
        alarms.sort(function(a,b){return a.date - b.date });
        return alarms.map(function(value, index){
            var adjustedDT = new Date(value.date);
            // force to local timezone
            adjustedDT.setMinutes(adjustedDT.getMinutes() + adjustedDT.getTimezoneOffset());

            return {
                id: value.id,
                type: '',
                date: value.date,
                repeat: value.repeat ? "repeat" : '',
                msg: value.message + ' @ ' + $filter('date')(adjustedDT, friendlyDTFormat(adjustedDT))
            };
        });
    }

    function friendlyDTFormat(adjustedDT){
        var now = new Date();
        var dateString = '';
        var tf = _settings.timeFormat || 'h:mm a';
        var df = _settings.dateFormat || 'MMM d, y';

        if (adjustedDT.getDate() == now.getDate()) {
            dateString = "'Today at' " + tf;
        } else if (adjustedDT.getDate() == now.getDate()+1) {
            dateString = "'Tomorrow at' " + tf;
        } else if (adjustedDT.getDate() == now.getDate()-1) {
            dateString = "'Yesterday at' " + tf;
        } else {
            dateString = df + ' ' + tf;
        }
        return dateString;
    }

    $scope.getAlertClass = function (date){
        return date <= getCurrentDate() ? 'alert-error' : 'alert';
    };

    function getCurrentDate() {
        var now = new Date();
        return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0);
    }

    $scope.DeleteAlert = function (id){
        chrome.runtime.sendMessage({
            action: 'deleteAlarm',
            fromPopup: false,
            id: id
        }, function(response){
            if (response.error) {
                console.error('deleteAlarm failed: ' + response.error);
            } else if (response.alarms) {
                $scope.alerts = generateAlerts(response.alarms);
                $scope.$digest();
            }
        });
    };

    $scope.SnoozeAlert = function (id){
        chrome.runtime.sendMessage({
            action: 'snoozeAlarm',
            fromPopup: false,
            id: id
        }, function(response){
            if (response.error) {
                console.error('snoozeAlarm failed: ' + response.error);
            } else if (response.alarms) {
                $scope.alerts = generateAlerts(response.alarms);
                $scope.$digest();
            }
        });
    };

    $scope.showTooltip = function(repeat){
        return repeat ? "This will delete all occurrences of this reminder" : '';
    };

    $scope.createTab = function (){
        // TODO: check for tab already open
        var url = chrome.extension.getURL('../other/alarmmgmt.html#mgmt');
        chrome.tabs.create({url: url, active: true});
    };

    $scope.SaveSettings = function() {
        chrome.runtime.sendMessage({
            action: 'saveSettings',
            settings: $scope.settings
        }, function(response) {
            if (response.error) {
                console.error('saveSettings failed: ' + response.error)
            } else {
                $('#settings-saved-alert').show();
                setTimeout(function() {
                    $('#settings-saved-alert').hide('fade');
                }, 1500);
            }
        });
    };

    $scope.loadSettings = function() {
        chrome.runtime.sendMessage({
            action: 'getSettings'
        }, function(response) {
            $scope.settings = $.extend({}, response.settings);
            $scope.$digest();
        });
    };

    $scope.mgmtInit = function() {
        console.log('mgmtInit');

        $scope.ddTimeFormat = ['4:05', '16:05'];
        $scope.selectedTimeFormat = '4:05';
        $scope.onTimeFormatClicked = function(event) {
            $scope.selectedTimeFormat = event;
        };
        $scope.ddDateFormat = ['Sep 5, 2013', '2013-09-05'];
        $scope.selectedDateFormat = 'Sep 5, 2013';
        $scope.onDateFormatClicked = function(event) {
            $scope.selectedDateFormat = event;
        };
        $scope.ddNotifFormat = ['Desktop Notification', 'Open a tab', 'Both', 'Nothing'];
        $scope.selectedNotifFormat = 'Desktop Notification';
        $scope.onNotifFormatClicked = function(event) {
            $scope.selectedNotifFormat = event;
        };
        $scope.ddReminderSound = ['Gentle Roll', 'Picked'];
        $scope.selectedReminderSound = 'Gentle Roll';
        $scope.onSoundClicked = function(event){
            $scope.selectedReminderSound = event;
        };

        $timeout(function(){
            $scope.activeTab = {
                mgmt: (location.hash == '#mgmt'),
                settings: (location.hash != '#mgmt')
            };
        }, 0);
    };

    $scope.popupInit = function() {
        //defaults
        $scope.ddInOn = ['in', 'on'];
        $scope.ddRepeat = ['never', 'half hour', 'hour', 'day', 'work day', 'week', 'year'];
        $scope.radioModel = 'in';
        $scope.showWeeks = false;
        var date = new Date();
        // round to next 15 minutes
        date.setMinutes(date.getMinutes() + 15 + (15 - (date.getMinutes() % 15)));

        $scope.mytime = padTime(date.getHours()) + ":" + padTime(date.getMinutes());
        SetDefaults();

        console.log('Loading alerts...');
        loadAlerts();

        $scope.selectedRepeat = "Repeat Every";
        $scope.onRepeatClicked = function(event) {
            $scope.selectedRepeat = event;
        };
    };

    $scope.isNotExpired = function(item){
        return item.date > getCurrentDate();
    };
};
