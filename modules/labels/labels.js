(function() {
	var labelsModule = angular.module("kapa.labels", [
			"kapa.services",
			"ngRoute",
			"ui.bootstrap",
			"ui.bootstrap.showErrors"
		]);

	labelsModule.config(function($routeProvider) {
		$routeProvider
			.when('/labels', {
				templateUrl: 'modules/labels/labels.html'
			});
	});

	labelsModule.factory("log", function ($filter) {
		return function (message) {
			var labelsLog = $("#labelsLog");
			var logMessage = "";
			// logMessage += $filter("date")(new Date(), "yyyy-MM-dd HH:MM:ss") + ": ";
			logMessage += message;
			logMessage += "\n" + labelsLog.text();
			labelsLog.text(logMessage);
		};
	});

	labelsModule.controller("LabelPrinterController", function ($scope, $filter, productManager, log) {
		$scope.products = null;
		$scope.labels = [];

		log("Termékek betöltése... (amíg tölt, nem lehet matricát nyomtatni)");
		productManager.load(function (products) {
			$scope.products = products;
			log("Termékek betöltve");
		});

		$scope.printLabels = function() {
			if (!$scope.labels) {
				alert("Nincs betöltve matrica adat");
				return;
			}

			var printWindow = window.open("modules/labels/print.html", "KAPA_PrintLabels", "width=800, height=600");
			if (!printWindow) {
				alert("Nem tudom megnyitni a nyomtatási ablakot");
				return;
			}

			$(printWindow).load(function () {
				var printBody = $(printWindow.document).contents().find("body");
				printBody.empty();
				$scope.labels.forEach(function (label) {
					var labelDiv = $('<div class="label"></div>');
					labelDiv.append('<div class="hu">' + label.hu + '</div>');
					labelDiv.append('<div class="en">' + label.en + '</div>');
					labelDiv.append('<div class="date">' + label.date + '</div>');
					printBody.append(labelDiv);
				});
				printWindow.focus();
				printWindow.print();
			});

		}
		$scope.filePicked = function(element) {
			var file = element.files[0];
			log("Matricák betöltése megkezdve: " + file.name);
			var date = $filter("date")(new Date(), "yyyy-MM-dd");
			var reader = new FileReader();
			reader.onload = function(event) {
				// Parse CSV
				CSV.COLUMN_SEPARATOR = ";";
				var data = CSV.parse(reader.result);
				console.log("Raw CSV data:", data);

				// Skip first line
				data.shift();

				var numberOfProducts = data.length;
				var numberOfMissingProducts = 0;

				$scope.$apply (function() {
					$scope.labels = [];
					while (data.length > 0) {
						var row = data.shift();
						// CSV format:
						// Cikkszam;Nev;Darabszam;Netto ar;Brutto ar;Gyarto, Rendelesi azonosito(k)
						var productSKU = row[0];
						var productNameHU;
						var productNameEN;
						var product = $scope.products[productSKU];
						if (!product) {
							log("Ez a cikkszám nem szerepel a KAPA-ban: " + productSKU + " (" + row[1] + ")");
							numberOfMissingProducts++;
							continue;
						}
						productNameEN = product.en;
						productNameHU = product.hu;

						var count = row[2];
						for (var idx = 0; idx < count; idx++) {
							$scope.labels.push({
								en: productNameEN,
								hu: productNameHU,
								date: date
							});
						}
					}
					log("Matricák adatai betöltve, összesen " + numberOfProducts + " termék, " + $scope.labels.length + " matrica");
					if (numberOfMissingProducts) {
						log("Összesen " + numberOfMissingProducts + " termék nem szerepelt a KAPA-ban, ezekhez nem nyomtatunk matricát");
					}
				});
			};
			reader.readAsText(file, "iso-8859-2");
		}
	});
})();