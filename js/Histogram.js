function loadSidebar(property) {
	var latCenter = ((property.longLatMin.y + property.longLatMax.y) / 2).toFixed(8);;
	var lngCenter = ((property.longLatMin.x + property.longLatMax.x) / 2).toFixed(8);;

	$('.propertyOverview').html('');

	$('.propertyOverview').append('<div class="propertyTitle">' + property["name"] + '</div>')
		.append(property["description"]+"<br><br>")
		.append("Holes: " + property["numHoles"] + "<br>")
		.append("Meters Drilled: " + property["totalMetersDrilled"] + "<br>")
		.append("LatLong: " + latCenter + "," + lngCenter + "<br>"); var chartIndex = 0;

	var chartIndex = 0;
	$('.minerals').html('');

	// Don't make functions in loops.
	function callToggleVisible() {
		view.toggleVisible($(this).attr('data-mineral'),
			$(this).is(':checked'));
	}

	for (var mineral in property.analytes) {
		var div = $('<div class="mineral-container">').appendTo('.minerals');
		$('<input id="cb' + mineral + '" type="checkbox" data-mineral="' + mineral + '">').appendTo(div);
		$('<h2><label for="cb' + mineral + '">' + mineral + '</label></h2>').appendTo(div);
		$('<div class="colorBar" style="background-color: ' + property.analytes[mineral].color + ';"></div>;').appendTo(div);
		$('<svg id="svg' + mineral + '" class="chart">').appendTo(div);
		$('#cb' + mineral).prop('checked', false);
		$('#cb' + mineral).click(callToggleVisible);
	}
}

function addMineralToSidebar( mineralName, intervals ){

	$('#cb' + mineralName).prop('checked', true);
	var values = [];
	for (var interval in intervals) {
		// We want to see the log of the data, because reasons.
		var concentration = intervals[interval].raw.value;
		if (concentration < 0.0) {
			console.warn(
				"Found negative concentration when loading minerals:" +
				JSON.stringify(intervals[interval]));
		}
		values.push(Math.log(concentration));
	}

	if (values.length === 0) {
		console.log("No data found when parsing " + mineral + ".");
		return;
	}

	var formatCount = d3.format(",.0f");
	var formatDensity = d3.format(",.3f");

	var margin = {
			top: 35,
			right: 30,
			bottom: 75,
			left: 30
		},
		width = 400 - margin.left - margin.right,
		height = 200 - margin.top - margin.bottom;

	// Generate a histogram using uniformly-spaced bins.
	var intervals = 24;
	var x = d3.scale.linear()
		.domain([d3.min(values), d3.max(values)])
		.range([0, width])
		.nice(intervals);

	var data = d3.layout.histogram()
		.bins(x.ticks(intervals))
		(values);

	var y = d3.scale.linear()
		.domain([0, d3.max(data, function (d) {
			return d.y;
		})])
		.range([height, 0]);

	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom")
		.tickFormat(function (d) {
			return formatDensity(Math.exp(d));
		});

	var svg = d3.select("#svg" + mineralName)
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" +
			margin.left + "," + margin.top + ")");
/*
	svg.append("text")
    .attr("x", (width / 2))
    .attr("y", 0 - (margin.top / 2))
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("text-decoration", "underline")
    .text("Value vs Date Graph");
*/
	var bar = svg.selectAll(".bar")
		.data(data)
		.enter().append("g")
		.attr("class", "bar")
		.attr("transform", function (d) {
			return "translate(" + x(d.x) +
				"," + y(d.y) + ")";
		});

	bar.append("rect")
		.attr("x", 1)
		.attr("width", width / intervals)
		.attr("height", function (d) {
			return height - y(d.y);
		});

	// Labels for the bar frequency
	bar.append("text")
		// 2 looks nice. This offset should scale with graph size,
		// but is otherwise unimportant.
		.attr("y", -2)
		// This offset is chosen by brute force. It works for 20 intervals.
		// If you change the intervals count, you'll need to change this.
		.attr("x", Math.floor(width / intervals) - 8)
//			.attr("text-anchor", "middle")
		.text(function (d) {
			if (d.y <= 0) {
				// Don't add a "0" for empty bins.
				// We shouldn't see negative bins.
				return "";
			} else if (d.y > 99) {
				// Only label small-ish bars that are hard to see otherwise.
				// TODO: Base this off of the maximum bar height.
				// We chose 99 now to make sure our labels are all 2 digits.
				return formatCount(d.y);
			} else {
				// Otherwise, just format it.
				return formatCount(d.y);
			}
		})
		.style("text-anchor", "start")
		.attr("transform", function (d) {
			return "translate(10,5) rotate(-65)";
		});

	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis)
		.selectAll("text")
		.style("text-anchor", "end")
		.attr("dx", "-.8em")
		.attr("dy", ".15em")
		.attr("transform", function (d) {
			return "rotate(-65)";
		});

	var brush = d3.svg.brush()
		.x(x)
		.extent(xAxis.scale().domain())
		.on("brushstart", brushstart)
		.on("brush", brushmove)
		.on("brushend", brushend);

	var gBrush = svg.append("g")
		.attr("class", "brush")
		.call(brush);

	gBrush.selectAll(".resize")
		.append("path")
		.attr("d", resizePath);

	gBrush.selectAll("rect")
		.attr("height", height);

	function resizePath(d) {
		var e = +(d == "e"),
			x = e ? 1 : -1,
			y = height / 3;
		return "M" + (0.5 * x) + "," + y +
			"A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6) +
			"V" + (2 * y - 6) +
			"A6,6 0 0 " + e + " " + (0.5 * x) + "," + (2 * y) +
			"Z" +
			"M" + (2.5 * x) + "," + (y + 8) +
			"V" + (2 * y - 8) +
			"M" + (4.5 * x) + "," + (y + 8) +
			"V" + (2 * y - 8);
	}

	function brushstart() {
		svg.classed("selecting", true);
	}

	function brushmove() {
		// TODO: Do something with this.
		/*
					var extent = brush.extent().map(function (d) {
						var step = 0.1;
						var low = 0.05;
						return d - ((d - low) % step);
					});

					d3.select(this).call(brush.extent(extent));
		*/
		var lower = Math.exp(brush.extent()[0]);
		var upper = Math.exp(brush.extent()[1]);

		view.updateVisibility(mineralName, lower, upper);
	}

	function brushend() {
		svg.classed("selecting", !d3.event.target.empty());

		// Our data is stored as a natural log, so we need to
		// exponentiate it before sending it back to view.
	}
}
