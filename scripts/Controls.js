/* global $ */

$(document).ready(function() {
	$.get("html/CommandBar.html", function (data) {
		$("#divCommandBar").append(data);
		$("ul#CommandBar").menu();
	});
	$.get("html/ControlBar.html", function (data) {
		$("div#ControlBar").append(data);
		$("#zoomIn").button({
			text: false,
			icons: {
				primary: "ui-icon-zoomin"
			}
		});
		$( "#zoomIn" ).click(function() {
			document.getElementById('viewFrame').contentWindow.controls.dollyIn(1.25);
		});
		$("#zoomOut").button({
			text: false,
			icons: {
				primary: "ui-icon-zoomout"
			}
		});
		$( "#zoomOut" ).click(function() {
		  document.getElementById('viewFrame').contentWindow.controls.dollyIn(.75);
		});
		$("#panLeft").button({
			text: false,
			icons: {
				primary: "ui-icon-arrow-1-w"
			}
		});
		$( "#panLeft" ).click(function() {
		  document.getElementById('viewFrame').contentWindow.controls.panLeft(1);
		});

		$("#panRight").button({
			text: false,
			icons: {
				primary: "ui-icon-arrow-1-e"
			}
		});
		$( "#panRight" ).click(function() {
		  document.getElementById('viewFrame').contentWindow.controls.panLeft(-1);
		});

		$("#panUp").button({
			text: false,
			icons: {
				primary: "ui-icon-arrow-1-n"
			}
		});
		$( "#panUp" ).click(function() {
		  document.getElementById('viewFrame').contentWindow.controls.panUp(1);
		});
		$("#panDown").button({
			text: false,
			icons: {
				primary: "ui-icon-arrow-1-s"
			}
		});
		$( "#panDown" ).click(function() {
		  document.getElementById('viewFrame').contentWindow.controls.panUp(-1);
		});


		$("#toggleButton").button();
		$("#radioDemo").buttonset();

		$(document).keydown(function(event) {
			//prevent arrow key scrolling
			if(event.keyCode>=38 && event.keyCode<=40)
				event.preventDefault();
			document.getElementById('viewFrame').contentWindow.controls.onKeyDown(event);
		});
	});

	$(window).resize(function() {
		var height = $(window).height();
		height -= $("#viewFrame").position().top;
		height -= $("div#ControlBar").outerHeight(true);
		height -= 8;
		$("#viewFrame").height(height);
	});
});
