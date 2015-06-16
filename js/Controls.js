function loadMenu() {
	var windowWidth = $(window).width();
	var windowHeight = $(window).height();
	$.get("html/Menu.html", function (data) {
		$("#divTopMenu").append(data);
		$("ul#TopMenu").menu({
			select: function (event, ui) {
				switch (ui.item.attr('id')) {
					case 'menuDatasets':
						$('#dialogDatasets').dialog({
							resizable: true,
							height: windowHeight - 40,
							width: windowWidth - 40,
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
														setTimeout(function () {
															view.start();
														}, 0);
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

/**
* jQuery Button Control
* Load the button controls for
* zooming, rotating,
* toggling terrain, and toggling drill holes,
* and the sidebar handle.
* Attach click events to each button
*/
function loadControls() {
	$.get("html/ControlBar.html", function (data) {
		$("div#ControlBar").append(data);
		$("#zoomIn").button({
			text: false,
			icons: {
				primary: "ui-icon-circle-plus"
			}
		});
		$("#zoomIn").click(function () {
			view.zoomIn();
		});
		$("#zoomOut").button({
			text: false,
			icons: {
				primary: "ui-icon-circle-minus"
			}
		});
		$("#zoomOut").click(function () {
			view.zoomOut();
		});
		$("#toggleTerrain").button({
			text: false,
			icons: {
				primary: "ui-icon-calculator"
			}
		});
		$("#toggleTerrain").click(function () {
			view.toggleVisible("terrain");
		});
		$("#autoRotate").button({
			text: false,
			icons: {
				primary: "ui-icon-arrowrefresh-1-s"
			}
		});
		$("#autoRotate").click(function () {
			view.autoRotate();
		});
		
		$("#toggleSurveyHoles").button({
			text: false,
			icons: {
				primary: "ui-icon-signal"
			}
		});
		$("#toggleSurveyHoles").click(function () {
			view.toggleVisible("surveyHoles");
		});

		$("#sidebarHandle").button({
			text: false,
			icons: {
				primary: "ui-icon-play"
			}
		});
	});
}

/**
* Create an empty sliding tab area on the side.
* Attach click events to slide it open and close.
*/
function initSidebar() {
	$.get("html/Sidebar.html", function (data) {
		$("#sidebar").append(data);

		$('.sidebar-container').click(function (e) {
			if ($(this).width() - e.pageX > 20)
				return;

			$('#sidebarHandle').hide();

			// Hide the sidebar-container before sliding the sidebar closed.
			if ($('#sidebar').css('display') != 'none') {
				$(this).width(20);
			}

			$('#sidebar').toggle('slide', {
				direction: 'left'
				}, function () {
					if ($(this).css('display') == 'none') {
						$('.sidebar-container').width(20);
						$('#sidebarHandle').css('right', '');
						$('#sidebarHandle').css('left', '0');
						$('#sidebarHandle').css('transform', '');
						$('#sidebarHandle').show();
					} else {
						$('.sidebar-container').width($(this).width() + 20);
						$('#sidebarHandle').css('left', '');
						$('#sidebarHandle').css('right', '0');
						$('#sidebarHandle').css('transform', 'rotate(180deg)');
						$('#sidebarHandle').show();
					}
			});
		});
	});
}

/**
* When we resize the window,
* We want to resize the frames to prevent the inclusion of scrollbars.
*/
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
	$('#sidebarHandle').css('top', $('.sidebar-container').height() / 2 - $('#sidebarHandle').height() / 2);
	var windowWidth = $(window).width();
	var windowHeight = $(window).height();
}

/**
* We are doing work that will take some time.
* Give the user an indicator that the application is active.
*/
function initProgressBar() {
	$('#progressbar').progressbar({
		value: false,
		change: function () {
			$('.progress-label').text("Calculating Geometries...");
		},
		complete: function () {
			$('.progress-label').text("Complete!");
			$('.progress-label').css('left', $(this).width() / 2 - $('.progress-label').width() / 2 + 'px');
			$(this).hide('drop', {
				direction: 'down'
			}, 'slow', function () {
				$(this).progressbar('destroy');
			});
		},
		create: function () {
			$('.progress-label').text("Loading Terrain...");
			$(this).show();
			$(this).css('top', $("#viewFrame").position().top + 20 + 'px');
			$('.progress-label').css('left', $(this).width() / 2 - $('.progress-label').width() / 2 + 'px');
		}
	});
}

/**
* Setter function for the progress bar.
*/
function setProgressBar(percent) {
	var progressbar = $('#progressbar');
	percent = percent < 0 ? 0 : percent;
	progressbar.progressbar('value', percent);
}
