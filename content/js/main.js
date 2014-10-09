var yomoApp = angular.module("yomoApp", []);

yomoApp.controller("CalculateController", ['$scope', function ($scope) {

    var loans = [{
        name: "Lån #1",
        calculations: [new Calculation()],
        active: false
    }];

    $scope.paymentLimit = 12;
	
	$scope.loanRows = [{row: 0, loans: []}];
	
	var updateLoanRows = function(loan) {
		var lastLoanRow = $scope.loanRows[$scope.loanRows.length-1];
		if(lastLoanRow.loans.length == 2) {
			var newLoanRow = {row: $scope.loanRows.length-1, loans: []};
			$scope.loanRows.push(newLoanRow);
			lastLoanRow = newLoanRow;
		}
		
		lastLoanRow.loans.push(loan);
		console.log($scope.loanRows);
	};
	
	updateLoanRows(loans[0]);

    $scope.activate = function (loan, deposit) {
        var copy = angular.copy(loans[loans.length - 1]); //Copy the last loan
        copy.name = 'Skapa ny';
		
		var activatedLoan = loans[loans.length - 1];
		activatedLoan.active = true;

        var activeDeposits = loans.filter(function (loan) { return loan.active && loan.deposit; }).length;
        var activeLoans = loans.length - activeDeposits;
        activeDeposits += 1;

        //Om det inte är samma typ vi lägger till så resetta tillbaka till "default" värden
        if (!activatedLoan.deposit && deposit) {
            activatedLoan.calculations[0].years = 5;
            activatedLoan.calculations[0].amount = 5000;
            activatedLoan.calculations[0].interest = "1.2";
            activatedLoan.calculations[0].installment = 1000;
        } else if (activatedLoan.deposit && !deposit) {
            activatedLoan.calculations[0].amount = 100000;
            activatedLoan.calculations[0].interest = "5";
            activatedLoan.calculations[0].installment = 1000;
        }

        activatedLoan.deposit = deposit;
        activatedLoan.name = deposit ? "Sparande #" + activeDeposits : "Lån #" + activeLoans;

        //loans.splice(loans.length - 1, 0, copy);
		loans.push(copy);
		
		updateLoanRows(copy);
    };
}]);

yomoApp.controller("CalculationController", ['$scope', function ($scope) {
    var calculation = $scope.calculation;
    var loan = $scope.loan;

    $scope.modeText = function (mode) {
        if (mode == 1)
            return "månader";
        if (mode == 2)
            return "år";
    }

    $scope.$watch("calculation.interest + calculation.amount", function () {
        $scope.calculate(calculation);
    });

    $scope.calculate = function (calculation) {
        calculation.calculate(loan.deposit);
    }
}]);

yomoApp.controller("LoanController", ['$scope', function ($scope) {
    var loan = $scope.loan;

    $scope.addCalculation = function () {
        var copy = angular.copy(loan.calculations[loan.calculations.length - 1]);
        loan.calculations.push(copy);
    };

    $scope.getHideContent = function () {
        /*
        console.log('woop woop');
        var interests = loan.calculations.map(function (n) { return parseInt(n.result.totalInterestCharge); });
        console.log(interests);
        
        console.log(Array.max(interests));
        console.log(Array.min(interests));
        if (loan.calculations.length > 1) {
            
        }*/
    };
}]);


var Calculation = function () {
    this.interest = "5.00",
    this.amount = "100000",
    this.installment = "1000",
    this.mode = 1,
    this.dateMode = 1,
    this.years = 10,
    this.months = 120
}
Calculation.prototype = {
    calculate: function (deposit) {

        var interest = this.interest.replace(',', '.') / 100;
        var totalInterestCharge = 0;
        if (this.installment == '') {
            this.installment = 0;
        }
        this.installment = parseFloat(this.installment);

        if (deposit) {
            this.months = this.years * 12;
            this.result = this.calculateDeposit(interest);
        } else {

            if (this.mode == 1) {
                this.result = this.calculateCostsByInstallment(interest);
            } else {
                if (this.mode == 2) {
                    this.months = this.years * 12;
                }
                this.result = this.calculateCostsByTime(interest);
            }
        }
        return this.result;
    },
    calculateDeposit: function (interest) {
        var result = parseFloat(this.amount);

        for (var i = 0; i < this.months; i++) {
            var montlyInterestCharge = parseFloat((result * interest) / 12);
            result += montlyInterestCharge + this.installment;
        }

        return { lastPaymentDate: '', totalInterestCharge: result.toRoundedLocale() };
    },
    calculateCostsByTime: function (interest) {
        this.installment = Math.round(this.amount / this.months);
        return this.calculateCosts(interest);
    },
    calculateCostsByInstallment: function (interest) {
        var result = this.calculateCosts(interest);

        this.tooLowInstallment = result.tooLowInstallment;
        if (!this.tooLowInstallment) {
            var months = new Date().monthDiff(result.lastDate);
            this.months = months;
            this.years = +(months / 12).toFixed(2);
        } else {
            this.months = 0;
            this.years = 0;
        }


        return result;
    },
    calculateCosts: function (interest) {

        var result = { totalInterestCharge: 0 };
        var sum = this.amount;
        var installments = this.amount / this.installment;

        if (this.installment < 100 && installments > 1000) {
            result.tooLowInstallment = true;
            result.totalInterestCharge = ((sum * interest) / 12).toRoundedLocale();
            result.lastPaymentDate = "~";
            return result;
        } else if (installments > 10000) {
            result.tooLowInstallment = true;
            result.totalInterestCharge = "~";
            result.lastPaymentDate = "~";
            return result;
        }

        var currentDate = new Date().addMonth(1);
        var payments = [];

        while (sum > 0) {
            var montlyInterestCharge = ((sum * interest) / 12);
            result.totalInterestCharge += montlyInterestCharge;
            sum = sum - this.installment;
            payments.push({ monthlyCost: montlyInterestCharge, sum: sum, date: new Date().copy(currentDate) });
            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        result.overview = this.paymentOverview(payments, result);
		
        result.totalInterestCharge = result.totalInterestCharge.toRoundedLocale();
        result.lastDate = payments[payments.length - 1].date;
        result.lastPaymentDate = result.lastDate.toString();

        return result;
    },
    paymentOverview: function (payments, calculationResults) {
        var currentYear = new Date().getFullYear();
        var overviews = [];

        var yearlyCost = 0;
        var monthCount = 0;
        var sum = this.amount;
        for (var i = 0; i < payments.length; i++) {
            if (payments[i].date.getFullYear() > currentYear) {
                overviews.push(new Overview(currentYear, yearlyCost, this.installment, monthCount));

                monthCount = yearlyCost = 0;
                currentYear++;
            }

            monthCount++;
            yearlyCost += payments[i].monthlyCost;
        }
        //Resterande
        overviews.push(new Overview(currentYear, yearlyCost, this.installment, monthCount));

        overviews.push(new Overview('Total', calculationResults.totalInterestCharge, this.installment, this.months));

        return overviews;
    }
};

var Overview = function (id, sum, installment, monthCount) {
    this.id = id;
    this.sum = sum.toRoundedLocale();
    this.sumWithInstallment = (sum + (installment * monthCount)).toRoundedLocale();
    this.monthly = (sum / monthCount).toRoundedLocale();
    this.monthlyWithInstallment = ((sum + (installment * monthCount)) / monthCount).toRoundedLocale();
}

Number.maxInt = 4294967295;
Number.prototype.toRoundedLocale = function () {

    if (this > Number.maxInt) { //Riiik! :)
        return "$$$";
    }
    return Math.round(this).toLocaleString();
}

Date.prototype.monthDiff = function (otherDate) {
    var months;
    months = (otherDate.getFullYear() - this.getFullYear()) * 12;
    months -= this.getMonth();
    months += otherDate.getMonth();
    return months <= 0 ? 0 : months;
}

Date.prototype.addMonth = function (months) {
    this.setMonth(this.getMonth() + months, 1); //1 dagen i månaden kör jag på med :P
    return this;
}

Date.prototype.toString = function () {
    var monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
    return monthNames[this.getMonth()] + ", " + this.getFullYear();
}

Date.prototype.copy = function (date) {
    this.setFullYear(date.getFullYear());
    this.setMonth(date.getMonth(), 1);
    return this;
}

Array.max = function (array) {
    return Math.max.apply(Math, array);
};

Array.min = function (array) {
    return Math.min.apply(Math, array);
};