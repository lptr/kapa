(function () {
	var server = angular.module("kapa.server", []);
	server.factory("kapaServer", function ($http) {
		return {
			query: function (method, data, callback) {
				$http.jsonp("https://script.google.com/macros/s/AKfycbzr__tdtQoB4Hg9mJOCaK8Y9AL8Fwx4uyIxHefJSis/dev", {
					params: {
						method: method,
						data: JSON.stringify(data),
						callback: "JSON_CALLBACK"
					}
				}).success(function(data, status, headers, config) {
					callback(data);
				}).error(function(data, status, headers, config) {
					console.log("Error", xhr, error, exception);
					alert("Error: " + error);
				});
			}
		}
	});
})();
