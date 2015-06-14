function loadSidebar(minerals) {
	var chartIndex = 0;
	$('.minerals').html('');
	for(var mineral in minerals) {
		var div = $('<div class="mineral-container">').appendTo('.minerals');
		div.append('<input type="checkbox"><label>' + mineral + '</label>');
		$('<svg id="svg' + chartIndex + '" class="chart">').appendTo(div);

		addChart(minerals[mineral], chartIndex, mineral);
		chartIndex++;
	}

	function addChart(mineralIntervals, chartIndex, mineral) {
		var values = [];
		for (var interval in mineralIntervals.intervals) {
			values.push(Math.log(mineralIntervals.intervals[interval].value));
		}

		// Formatters for counts and times (converting numbers to Dates).
		var formatCount = d3.format(",.0f");
		var formatDensity = d3.format(",.3f");

		var margin = {top: 10, right: 30, bottom: 30, left: 30},
			width = 400 - margin.left - margin.right,
			height = 200 - margin.top - margin.bottom;

		var x = d3.scale.linear()
			.domain([d3.min(values), d3.max(values)])
			.range([0, width]);

		// Generate a histogram using uniformly-spaced bins.
		var intervals = 10;
		var data = d3.layout.histogram()
			.bins(x.ticks(intervals))
			(values);

		var y = d3.scale.linear()
			.domain([0, d3.max(data, function(d) { return d.y; })])
			.range([height, 0]);

		var xAxis = d3.svg.axis()
			.scale(x)
			.orient("bottom")
			.tickFormat(function(d) { return formatDensity(Math.exp(d)); });

		var svg = d3.select("#svg" + chartIndex)
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
		  .append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		var bar = svg.selectAll(".bar")
			.data(data)
		  .enter().append("g")
			.attr("class", "bar")
			.attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });

		bar.append("rect")
			.attr("x", 1)
			.attr("width", width/intervals)
			.attr("height", function(d) { return height - y(d.y); });

	// Labels for the bar frequency
		bar.append("text")
			.attr("dy", ".75em")
			.attr("y", -10)
			.attr("x", width/intervals / 2)
			.attr("text-anchor", "middle")
			.text(function(d) { return d.y > 0 ? formatCount(d.y) : ''; });
	
		svg.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + height + ")")
			.call(xAxis);

		var brush = d3.svg.brush()
	    .x(x)
	    .extent([d3.min(values), d3.max(values)])
	    .on("brushstart", brushstart)
	    .on("brush", brushmove)
	    .on("brushend", brushend);

		var gBrush = svg.append("g")
	    .attr("class", "brush")
	    .call(brush);
//        .call(brush.event);

		gBrush.selectAll(".resize")
			.append("path")
			.attr("d", resizePath);

		gBrush.selectAll("rect")
		    .attr("height", height);

//		brushstart();
//		brushmove();

		function resizePath(d) {
		var e = +(d == "e"),
		    x = e ? 1 : -1,
		    y = height / 3;
		return "M" + (.5 * x) + "," + y
		    + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6)
		    + "V" + (2 * y - 6)
		    + "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y)
		    + "Z"
		    + "M" + (2.5 * x) + "," + (y + 8)
		    + "V" + (2 * y - 8)
		    + "M" + (4.5 * x) + "," + (y + 8)
		    + "V" + (2 * y - 8);
		}

		function brushstart() {
		  svg.classed("selecting", true);
		}

		function brushmove() {
		    var extent = brush.extent().map(function (d) {
		        var step = .1;
		        var low = .05;
		        return d - ((d - low) % step);
		    });

		    d3.select(this).call(brush.extent(extent))
		}

		function brushend() {
		    svg.classed("selecting", !d3.event.target.empty());

		    view.updateVisibility(mineral, Math.exp(brush.extent()[0]), Math.exp(brush.extent()[1]));
		}
	}
}
