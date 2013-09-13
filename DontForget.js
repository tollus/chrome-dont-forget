angular.module('DontForget', ['ui.bootstrap']);

var DontForgetCtrl = function ($scope, $timeout)
{
    //defaults
    $scope.ddInOn = ['in', 'on'];
    $scope.ddRepeat = ['never','half hour', 'hour', 'day', 'week', 'year'];
    $scope.radioModel = 'in';
    $scope.showWeeks = false;
    var date = new Date();
    var hours = date.getHours();

    var padTime = function(myNum){
       return myNum < 10 ? "0" + myNum : myNum;
    }
    $scope.mytime = padTime(hours) + ":" + padTime(date.getMinutes());
    $scope.alerts = [];

    //datepicker
    $scope.today = function() {
        $scope.dt = new Date();
    };
    $scope.today();
    $scope.open = function() {
        $timeout(function() {
            $scope.opened = true;
        });
    };
    $scope.dateOptions = {
        'year-format': "'yy'",
        'starting-day': 1
    };

    $scope.selectedRepeat = "Repeat Every"
    $scope.onRepeatClicked = function(event){
        $scope.selectedRepeat = event;
    }

    $scope.SaveAlert = function(){
        var message = $scope.reminderText;
        var alertDateTime;
        if($scope.radioModel == 'on')
        {
             var mydate = $scope.dt;
             var mytime = $scope.mytime.split(':');
             alertDateTime = new Date(mydate.getFullYear(), mydate.getMonth(), mydate.getDay(), mytime[0], mytime[1], 0, 0)
        }else{
            var mydate = $scope.dt;
            var mytime = $scope.mytime.split(':');
            alertDateTime = new Date(mydate.getFullYear(), mydate.getMonth(), mydate.getDay(), mytime[0], mytime[1], 0, 0)
        }

        if(message == undefined)
            message = "Don't Forget!";

        //success = green $scope.alerts.push({type: 'success', msg: new Date(alertDateTime - new Date()) + " " + message});
        //fail = red $scope.alerts.push({type: 'error', msg: new Date(alertDateTime - new Date()) + " " + message});
        //no type = yellow
        $scope.alerts.push({msg: alertDateTime + " " + message});
        chrome.browserAction.setIcon({path: 'DontForget.png'});
        chrome.browserAction.setBadgeBackgroundColor({color:[255, 255, 255, 0]});
        chrome.browserAction.setBadgeText({text: $scope.alerts.length.toString()});

        SetDefaults();
    }
    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
        chrome.browserAction.setBadgeText({text: $scope.alerts.length.toString()});
        SetDefaults();
    };

    function SetDefaults(){
        $scope.reminderText = '';
        $scope.selectedRepeat = 'Repeat Every';
    }

    $scope.CloseWindow = function (){
        window.close();
    }
};
