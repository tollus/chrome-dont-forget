$(function() {
    $( "#datepicker" ).datepicker();
    $( "#format" ).change(function() {
        $( "#datepicker" ).datepicker( "option", "dateFormat", $( this ).val() );
    });
});

angular.module('DontForget', ['ui.bootstrap']);

var DontForgetCtrl = function ($scope, $timeout, $filter)
{
    //defaults
    $scope.ddInOn = ['in', 'on'];
    $scope.ddRepeat = ['never', 'half hour', 'hour', 'day', 'week', 'year'];
    $scope.radioModel = 'in';
    $scope.showWeeks = false;
    var date = new Date();
    // round to next 15 minutes
    date.setMinutes(date.getMinutes() + 15 + (15 - (date.getMinutes() % 15)));

    var hours = date.getHours();

    $scope.mytime = padTime(hours) + ":" + padTime(date.getMinutes());
    SetDefaults();

    $scope.alerts = [];
    console.log('Loading alerts...');
    loadAlerts();

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

    $scope.selectedRepeat = "Repeat Every"
    $scope.onRepeatClicked = function(event) {
        $scope.selectedRepeat = event;
    }

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
            action: 'getAlarms'
        }, function(response){
            console.debug('received getAlarms message: ', response);

            if (response.error) {
                console.error('getAlarms failed: ' + response.error)
            } else if (response.alarms) {
                $scope.alerts = generateAlerts(response.alarms).slice(0,5);
                $scope.$digest();
            }
        });
    }

    function generateAlerts(alarms){
        return alarms.map(function(value, index){
            var adjustedDT = new Date(value.date);
            // force to local timezone
            adjustedDT.setMinutes(adjustedDT.getMinutes() + adjustedDT.getTimezoneOffset());

             return {
                id: value.id,
                type: '',
                msg: value.message + ' @ ' + $filter('date')(adjustedDT, friendlyDTFormat(adjustedDT))
            };
        });
    }

    function friendlyDTFormat(adjustedDT){
        var now = new Date();
        var dateString = '';

        if (adjustedDT.getDate() == now.getDate()) {
            dateString = "'Today at' h:mm a";
        } else if (adjustedDT.getDate() == now.getDate()+1) {
            dateString = "'Tomorrow at' h:mm a";
        } else if (adjustedDT.getDate() == now.getDate()-1) {
            dateString = "'Yesterday at' h:mm a";
        } else {
            dateString = 'MMM d, y h:mm a';
        }
        return dateString;
    }

    // called from the background page
    window.refreshAlarms = loadAlerts;
};
