/* global $ */
/* global view */
/* global View */

function loadMenu() {
	$.get("html/Menu.html", function (data) {
		$("#divTopMenu").append(data);
		$("ul#TopMenu").menu({
			select: function (event, ui) {
				switch(ui.item.attr('id')) {
					case 'menuDatasets':
						$('#dialogDatasets').dialog({
							resizable: true,
							height: 480,
							width: 800,
							modal: true,
							buttons: {
								Cancel: function () {
									$(this).dialog("close");
								}
							},
							open: function (event, ui) {
								$.getJSON('data/DatasetTemplate.json', function (template) {
									$.getJSON('data/Datasets.json', function (data) {
										$('#templateContainer').html('');
										$('#templateContainer').json2html(data.dataset, template);
										$('.dataset').each(function (data) {
											$(this).click(function () {
												$('#dialogDatasets').dialog("close");
												initProgressBar();
												view = new View($(this).attr('data-url'));
												view.start();
											});
										});
									})
										.fail(function () {
											console.log("Failed to load data/Datasets.json");
										});
								})
									.fail(function () {
										console.log("Failed to load data/DatasetTemplate.json");
									});
							}
						});
						break;
				}
			},
			create: function (event, ui) {
				resizeFrames();
				$(this).find('#menuDatasets').trigger('click');
			}
		});
	});
}

function loadControls() {

	$.get("html/ControlBar.html", function (data) {
		$("div#ControlBar").append(data);
		$("#zoomIn").button({
			text: false,
			icons: {
				primary: "ui-icon-zoomin"
			}
		});
		$( "#zoomIn" ).click(function() {
			view.zoomIn();
		});
		$("#zoomOut").button({
			text: false,
			icons: {
				primary: "ui-icon-zoomout"
			}
		});
		$( "#zoomOut" ).click(function() {
			view.zoomOut();
		});

		$(document).keydown(function(event) {
			// Prevent arrow key scrolling
			if(event.keyCode>=38 && event.keyCode<=40)
				event.preventDefault();
			var controls = document.getElementById('viewFrame').contentWindow.controls;
			if (controls) {
				controls.onKeyDown(event);
			}
		});
	});

}

function loadSidebar() {
	$.get("html/Sidebar.html", function (data) {
		$("#sidebar").append(data);

		//Add google map
		var lonepine = new google.maps.LatLng(36.607111, -118.072778);
		function initialize() {
		  var mapOptions = {
		    zoom: 8,
		    center: lonepine,
		    mapTypeId: 'hybrid'
		  }
		  map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
		}
		initialize();

		// Add slider
		$(function() {
		    $( "#slider-range" ).slider({
		      range: true,
		      orientation: "vertical",
		      min: 0,
		      max: 500,
		      values: [ 75, 300 ],
		      slide: function( event, ui ) {
		        $( "#amount" ).val( ui.values[ 0 ] + " -" + ui.values[ 1 ] );
		      }
		    });
		    $( "#amount" ).val($( "#slider-range" ).slider( "values", 0 ) +
		      " -" + $( "#slider-range" ).slider( "values", 1 ) );
		});

		//Add checkbox
		function addCheckbox(name) {
		   var container = $('#cblist');
		   var inputs = container.find('input');
		   var id = inputs.length+1;

		   $('<input />', { type: 'checkbox', id: 'cb'+id, value: name }).appendTo(container);
		   $('<label />', { 'for': 'cb'+id, text: name }).appendTo(container);
		   $('<br>').appendTo(container);
		}

		addCheckbox(('Bob'));
		addCheckbox(('Joe'));
		addCheckbox(('Johnson'));
	});

}

function setWindowResizeEvent() {
	$(window).resize(function () {
		resizeFrames();
	});
}

function resizeFrames() {
	var height = $(window).height();
	height -= $('#viewFrame').position().top;
	height -= 4;
	$('#viewFrame').height(height);
	$('.sidebar-container').css('top', ($('#viewFrame').position().top));
	$('.sidebar-container').height(height);
}

function initProgressBar() {
    $('#progressbar').progressbar({
        value: false,
        change: function () {
            //$('.progress-label').text($('#progressbar').progressbar('value') + "%");
        },
        complete: function () {
            $('.progress-label').text("Complete!");
            $('.progress-label').css('left', $(this).width() / 2 - $('.progress-label').width() / 2 + 'px');
            $(this).hide('drop', { direction: 'down' }, 'slow', function() {
                $(this).progressbar('destroy');
            });
        },
        create: function () {
            $('.progress-label').text("Loading Geometries...");
            $(this).show();
            $(this).css('top', $("#viewFrame").position().top + 20 + 'px');
            $('.progress-label').css('left', $(this).width() / 2 - $('.progress-label').width() / 2 + 'px');
        }
    });
}

function setProgressBar(percent) {
	var progressbar = $('#progressbar');
	percent = percent < 0 ? 0 : percent;
	progressbar.progressbar('value', percent);
}
