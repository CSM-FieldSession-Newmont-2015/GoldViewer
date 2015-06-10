/* global $ */
/* global view */
/* global View */

function LoadMenu() {
    $.get("html/Menu.html", function (data) {
        $("#divTopMenu").append(data);
        $("ul#TopMenu").menu({
            select: function (event, ui) {
                switch(ui.item.attr('id')) {
                    case 'menuDatasets':
                        $('#dialogDatasets').dialog({
                            resizable: true,
                            height: 480,
                            width: 640,
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
                                                view = new View($(this).attr('data-url'));
                                                view.start();
                                                $('#dialogDatasets').dialog("close");
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
                $(this).find('#menuDatasets').trigger('click');
            }
        });
    });
}

function LoadControls() {
    $.get("html/ControlBar.html", function (data) {
        $("div#ControlBar").append(data);
        $("#zoomIn").button({
            text: false,
            icons: {
                primary: "ui-icon-zoomin"
            }
        });
        $( "#zoomIn" ).click(function() {
            var controls = document.getElementById('viewFrame').contentWindow.controls;
            if (controls) {
                controls.dollyIn(1.25);
            }
        });
        $("#zoomOut").button({
            text: false,
            icons: {
                primary: "ui-icon-zoomout"
            }
        });
        $( "#zoomOut" ).click(function() {
            var controls = document.getElementById('viewFrame').contentWindow.controls;
            if (controls) {
                controls.dollyIn(.75);
            }
        });
        $("#panLeft").button({
            text: false,
            icons: {
                primary: "ui-icon-arrow-1-w"
            }
        });
        $( "#panLeft" ).click(function() {
            var controls = document.getElementById('viewFrame').contentWindow.controls;
            if (controls) {
                controls.panLeft(1);
            }
        });

        $("#panRight").button({
            text: false,
            icons: {
                primary: "ui-icon-arrow-1-e"
            }
        });
        $( "#panRight" ).click(function() {
            var controls = document.getElementById('viewFrame').contentWindow.controls;
            if (controls) {
                controls.panLeft(-1);
            }
        });

        $("#panUp").button({
            text: false,
            icons: {
                primary: "ui-icon-arrow-1-n"
            }
        });
        $( "#panUp" ).click(function() {
            var controls = document.getElementById('viewFrame').contentWindow.controls;
            if (controls) {
                controls.panUp(1);
            }
        });
        $("#panDown").button({
            text: false,
            icons: {
                primary: "ui-icon-arrow-1-s"
            }
        });
        $( "#panDown" ).click(function() {
            var controls = document.getElementById('viewFrame').contentWindow.controls;
            if (controls) {
                controls.panUp(-1);
            }
        });

        $("#toggleButton").button();
        $("#radioDemo").buttonset();

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

function SetWindowResizeEvent() {
    $(window).resize(function() {
        var height = $(window).height();
        height -= $("#viewFrame").position().top;
        height -= $("div#ControlBar").outerHeight(true);
        height -= 8;
        $("#viewFrame").height(height);
    });
}
