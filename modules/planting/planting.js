(function () {
	var transactionModule = angular.module("kapa.planting", [
		"kapa.services",
		"ngRoute",
		"ngHandsontable",
		"ui.bootstrap",
		"ui.bootstrap.showErrors"
	]);

	transactionModule.config(function ($routeProvider) {
		$routeProvider
			.when('/planting', {
				templateUrl: 'modules/planting/planting.html',
				controller: 'PlantingController'
			});
	});

	transactionModule.controller("PlantingController", function ($scope, kapaServer) {
		$scope.items = [];
		var suffixRenderer = function (suffix) {
			return function (instance, td, row, col, prop, value, cellProperties) {
				Handsontable.renderers.NumericRenderer.apply(this, [instance, td, row, col, prop, value, cellProperties]);
				if (td.textContent) {
					td.textContent += suffix;
				}
			};
		};
		
		var Property = function (options) {
			$.extend(this, { readOnly: !!options.recalculate }, options);
		};
		Property.prototype.value = function (item) {
			return item[this.property];
		};
		Property.prototype.hasValue = function (item) {
			return !!item[this.property];
		};
		Property.prototype.asNumber = function (item) {
			var value = this.value(item);
			return typeof value === 'number' ? value : 0;
		};
		Property.prototype.asText = function (item) {
			var value = this.value(item);
			return typeof value === 'string' ? value : "";
		};
		Property.prototype.toProperty = function () {
			return function (item, value) {
				if (typeof value === 'undefined') {
					return this.get(item);
				} else {
					return this.set(item, value);
				}
			}.bind(this);
		};

		var SimpleProperty = function (options) {
			Property.apply(this, arguments);
		}
		SimpleProperty.prototype = Object.create(Property.prototype);
		SimpleProperty.prototype.get = function (item) {
			return item[this.property];
		};
		SimpleProperty.prototype.set = function (item, value) {
			item[this.property] = value;
		}
		SimpleProperty.prototype.toJson = function (item, json) {
			json[this.property] = this.get(item);
		};
		SimpleProperty.prototype.fromJson = function (item, json) {
			this.set(item, json ? json[this.property] : null);
		};
		SimpleProperty.prototype.toColumn = function () {
			return $.extend({}, this.column, {
				type: this.type || "text",
				title: this.title,
				data: this.toProperty(),
				readOnly: this.readOnly ? true : false
			});
		};

		var ReferenceProperty = function (options) {
			Property.apply(this, arguments);
			$.extend(this, {
				idField: "id",
				nameField: "name"
			});
			this.idLookup = {};
			this.nameLookup = {};
			this.data.forEach (function (datum) {
				var id = datum[this.idField];
				var name = datum[this.nameField];
				this.idLookup[id] = datum;
				this.nameLookup[name] = datum;
			}, this);
		};
		ReferenceProperty.prototype = Object.create(Property.prototype);
		ReferenceProperty.renderer = function (instance, td, row, col, prop, displayValue, cellProperties) {
			Handsontable.renderers.NumericRenderer.apply(null, [instance, td, row, col, prop, displayValue, cellProperties]);
			var value = this.value(row);
			if (value) {
				if (!value.id) {
					td.color = "red";
				} else {
					td.title = "ID: " + value.id;
				}
			}
			return td;
		};
		ReferenceProperty.prototype.get = function (item) {
			var value = item[this.property];
			// console.log("Item: ", item, " value: ", value);
			return value ? value[this.nameField] : null;
		};
		ReferenceProperty.prototype.set = function (item, value) {
			var ref;
			if (value === null || value === "") {
				ref = null;
			} else if (typeof value === 'string') {
				ref = this.nameLookup[value];
				if (!ref) {
					ref = {};
					ref[this.idField] = null;
					ref[this.nameField] = value;
				}					
			} else {
				ref = value;
			}
			// console.log(">>> SET", item, ref);
			item[this.property] = ref;
		};
		ReferenceProperty.prototype.toJson = function (item, json) {
			json[this.property] = this.get(item);
		};
		ReferenceProperty.prototype.fromJson = function (item, json) {
			var value = json ? json[this.property] : null;
			this.set(item, value ? this.idLookup[value] : null);
		};
		ReferenceProperty.prototype.toColumn = function () {
			return $.extend({}, this.column, {
				type: "dropdown",
				source: this.data.map(function (datum) { return datum.name; }),
				title: this.title,
				data: this.toProperty(),
				renderer: ReferenceProperty.renderer.bind(this)
			});
		};
		
		var Item = function () {
		};
		Item.prototype.value = function (property) {
			return property.value(this);
		};
		Item.prototype.hasValue = function (property) {
			return property.hasValue(this);
		};
		Item.prototype.asNumber = function (property) {
			return property.asNumber(this);
		};
		Item.prototype.asText = function (property) {
			return property.asText(this);
		};
		
		var ItemProperty = function (item, property) {
			this.item = item;
			this.property = property;
		};
		ItemProperty.prototype.value = function () {
			return this.property.value(this.item);
		};
		ItemProperty.prototype.hasValue = function () {
			return this.property.hasValue(this.item);
		};
		ItemProperty.prototype.asNumber = function () {
			return this.property.asNumber(this.item);
		};
		ItemProperty.prototype.asText = function () {
			return this.property.asText(this.item);
		};
		
		var Table = function (options) {
			$.extend(this, {
				data: [],
				properties: []
			}, options);
			var dataProperties = this.properties.slice();
			var self = this;
			var assignId = function (item) {
				var hasId = item.hasValue(self.id);
				var hasSomeValues = dataProperties.some(function (property) { return item.hasValue(property); });
				if (!hasId && hasSomeValues) {
					var maxId = 0;
					self.data.forEach(function (item) {
						maxId = Math.max(item.asNumber(self.id), maxId);
					}, self);
					return maxId + 1;
				} else if (hasId && !hasSomeValues) {
					return null;
				} else {
					return item.value(self.id);
				}
			};
			this.id = new SimpleProperty({ property: "id", title: "ID", readOnly: true, column: { className: "htCenter" }, recalculate: assignId });
			this.properties.unshift(this.id);
			
			this.propertiesMap = {};
			this.properties.forEach(function (property) {
				this.propertiesMap[property.property] = property;
			}, this);
			this.recalculateProps = this.properties.map(function (property) {
				if (typeof property.recalculate !== 'function') {
					return function (item) {};
				}
				return function (item) {
					var parameterNames = angular.injector.$$annotate(property.recalculate);
					var parameters = parameterNames.map(function (name) {
						if (name === "item") {
							return item;
						}
						var dependentProperty = this.propertiesMap[name];
						if (!dependentProperty) {
							throw new Error("Unknown property '" + name + "' for table '" + this.name + "'");
						}
						return new ItemProperty(item, dependentProperty);
					}, this);
					property.set(item, property.recalculate.apply(item, parameters));
				}.bind(this);
			}, this);
			
			this.Item = function (json) {
				Item.apply(this);
				self.properties.forEach(function (property) {
					property.fromJson(this, json);
				}, this);
				self.recalculate(this);
			};
			this.Item.prototype = Object.create(Item.prototype);
		};
		Table.prototype.recalculate = function (item) {
			this.recalculateProps.forEach(function (recalculateProp) {
				recalculateProp(item);
			});
		};
		Table.prototype.toSettings = function () {
			var self = this;
			var afterChange = function (changes, source) {
				console.log("Event", arguments);
				// Don't do stuff when loading
				if (source === "loadData") {
					return;
				}
				var rows = {};
				changes.forEach(function (change) {
					var rowNo = change[0];
					if (!rows[rowNo]) {
						rows[rowNo] = true;
						var row = self.data[rowNo];
						self.recalculate(row);					}
				});
				this.render();
			};
			
			return $.extend({}, this.settings, {
				data: this.data,
				dataSchema: function () { return new this.Item({}); }.bind(this),
				afterChange: afterChange,
				columns: this.properties.map(function (property) { return property.toColumn(); })
			});
		};
		Table.prototype.load = function (itemsJson) {
			// Clear the array
			this.data.length = 0;
			itemsJson.forEach(function (itemJson) {
				this.data.push(new this.Item(itemJson));
			}, this);
		};
		
		var produces = [
			{ id: 1, name: "Zsázsa", rowWidth: 15 },
			{ id: 2, name: "Mizuna", rowWidth: 12 },
		];
		var plantations = [
			{ id: 1, produce: 1, seed: "Zsázsamag", time: "2015-05-13", seedsPerGramm: 4 },
			{ id: 2, produce: 2, seed: "Mizunamag", time: "2015-05-17", seedsPerGramm: 0.25 },
		];
		
		var produceProp = new ReferenceProperty({ property: "produce", title: "Termény", data: produces });
		var seedProp = new SimpleProperty({ property: "seed", title: "Mag" });
		var timeProp = new SimpleProperty({ property: "time", title: "Dátum", type: "date", column: { dateFormat: "YYYY-MM-DD" } });
		var seedCountProp = new SimpleProperty({ property: "seedsPerGramm", title: "Magok száma", type: "numeric", column: { format: "0.00", renderer: suffixRenderer(" db/g") } });
		var seedCountPropPlus1 = new SimpleProperty({ property: "seedsPerGrammPlus1", title: "Magok száma + 1", type: "numeric", column: { format: "0.00", renderer: suffixRenderer(" db/g") }, recalculate: function (seedsPerGramm) {
			if (seedsPerGramm.hasValue()) {
				return seedsPerGramm.asNumber() + 1;
			} else {
				return null;
			}
		} });
		
		var plantingTable = new Table({
			name: "planting",
			data: $scope.items,
			properties: [ produceProp, seedProp, timeProp, seedCountProp, seedCountPropPlus1 ],
			settings: {
				colHeaders: true,
				rowHeaders: false,
				contextMenu: ['row_above', 'row_below', 'remove_row'],
				minSpareRows: 1,
				height: 300,
				width: 700,				
			}
		});
		$scope.settings = plantingTable.toSettings();

		var reload = function () {
			plantingTable.load(plantations);
		};
		reload();
	});
})();
