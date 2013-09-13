angular.module('DontForget', ['ui.bootstrap']);

var DontForgetCtrl = function ($scope, $timeout)
{
    //defaults
    $scope.ddInOn = ['in', 'on'];
    $scope.ddRepeat = ['never','half hour', 'hour', 'day', 'week', 'year'];
    $scope.foo = "you foo";
    $scope.radioModel = 'on';
    $scope.showWeeks = false;
    var date = new Date();
    var hours = date.getHours();
    if (hours > 12) {
        hours -= 12;
    } else if (hours === 0) {
        hours = 12;
    }
    $scope.mytime = hours + ":" + date.getMinutes();
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
             alertDateTime = new Date(mydate.getYear(), mydate.getMonth(), mydate.getDay(), mytime[0], mytime[1], 0, 0)
        }else{

        }
        if(message == undefined)
            message = "Don't Forget!";

        //success = green $scope.alerts.push({type: 'success', msg: new Date(alertDateTime - new Date()) + " " + message});
        //fail = red $scope.alerts.push({type: 'error', msg: new Date(alertDateTime - new Date()) + " " + message});
        //no type = yellow
        $scope.alerts.push({msg: new Date(alertDateTime - new Date()) + " " + message});
        $scope.reminderText = '';
    }
    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };
};