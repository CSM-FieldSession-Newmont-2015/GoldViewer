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
                                                InitProgressBar();
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
                InitFrameSizing();
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
        //        height -= $("div#ControlBar").outerHeight(true);
        height -= 4;
        $("#viewFrame").height(height);
    });
}

function InitFrameSizing() {
    var height = $(window).height();
    height -= $("#viewFrame").position().top;
    //        height -= $("div#ControlBar").outerHeight(true);
    height -= 4;
    $("#viewFrame").height(height);
}

function InitProgressBar() {
    $('#progressbar').progressbar({
        value: false,
        change: function () {
//            $('.progress-label').text($('#progressbar').progressbar('value') + "%");
        },
        complete: function () {
            $('.progress-label').text("Complete!");
            $('.progress-label').css('left', $('#progressbar').width() / 2 - $('.progress-label').width() / 2 + 'px');
            $('#progressbar').hide('drop', { direction: 'down' }, 'slow');
        },
        create: function () {
            $('#progressbar').css('top', $("#viewFrame").position().top + 20 + 'px');
            $('.progress-label').css('left', $('#progressbar').width() / 2 - $('.progress-label').width() / 2 + 'px');
        }
    });
}

function SetProgressBar(percent) {
    var progressbar = $('#progressbar');
    percent = percent < 0 ? 0 : percent;
    progressbar.progressbar('value', percent);
}