
var $CONFIG = {};

function __INIT_CONFIG__ () {
    var init_url = document.getElementById("plack-debugger-js-init").src;

    $CONFIG.request_uid = init_url.split("#")[1];

    var url_parts = init_url.split("/"); 
    
    url_parts.pop();
    $CONFIG.static_js_url = url_parts.join("/");

    url_parts.pop();
    $CONFIG.static_url = url_parts.join("/");

    url_parts.pop();
    $CONFIG.root_url = url_parts.join("/");
}

function __LOAD_STATIC_JS__ (url, callback) {
    var script  = document.createElement("script");
    script.type = "text/javascript";
    script.src  = $CONFIG.static_js_url + url;
    if (script.readyState) { // IE
        script.onreadystatechange = function () {
            if (script.readyState == "loaded" || script.readyState == "complete") {
                script.onreadystatechange = null;
                callback();
            }
        };
    } 
    else { 
        script.onload = function () { callback() };
    }
    document.getElementsByTagName("body")[0].appendChild( script );
}

// basic formatter ...

function generate_data_for_panel (data) {
    if (!data) return "";
    switch ( data.constructor ) {
        case String:
        case Number:
            return data;
        case Array:
            var out = '<table>';
            for (var i = 0; i < data.length; i++) {
                out += '<tr><td>' + generate_data_for_panel( data[i] ) + '</td></tr>';
            }
            return out + '</table>'; 
        case Object:
            var out = '<table>';
            for (key in data) {
                out += '<tr><td>' + key + '</td><td>' + generate_data_for_panel( data[key] ) + '</td></tr>';
            }
            return out + '</table>';
        default:
            return "NO IDEA WHAT THIS IS! " + (typeof data);          
    }
}

__INIT_CONFIG__();
__LOAD_STATIC_JS__('/lib/Plack/Debugger.js', function () {
    // ... 

    var plack_debugger = new Plack.Debugger();

    plack_debugger.ready(function ($) {

        var self = this;

        // setup the debugger UI

        var UI = new Plack.Debugger.UI( $(document.body) );

        $.ajax({
            dataType : "json",
            url      : $CONFIG.root_url + '/' + $CONFIG.request_uid,
            global   : false
        }).then(function (res) {

            self.request_results = res;

            $.each( res.data.results, function (i, e) {
                e.id = i;
                UI.toolbar.add_new_button( e );
                UI.content.add_new_panel( e, generate_data_for_panel );
            });

            var ajax_panel = {
                "id"            : res.data.results.length,
                "title"         : "AJAX Subrequests",
                "notifications" : {
                    "error"   : 0,
                    "warning" : 0,
                    "success" : 0
                }
            };

            self.subrequest_controls["button"] = UI.toolbar.add_new_button( ajax_panel );
            self.subrequest_controls["panel"]  = UI.content.add_new_panel( ajax_panel, generate_data_for_panel );

            self.subrequest_controls["button"].find('.notifications .badge').show();
            self.subrequest_controls["panel"].find('.header .notifications .badge').show();
        });

        // Global AJAX request setup ...

        $(document).ajaxSend(function (e, xhr, options) {
            xhr.setRequestHeader('X-Plack-Debugger-Parent-Request-UID', self.request_uid);
            self.subrequest_count++;
        });

        $(document).ajaxComplete(function (e, xhr, options) {
            if ( self.subrequest_count != self.subrequest_results.length ) {
                $.ajax({
                    dataType : "json",
                    url      : self.request_results.links[1].url,
                    global   : false
                }).then(function (res) {

                    // save the subrequest results 
                    self.subrequest_results = res;

                    // need totals for all subrequests
                    var all_subrequest_notification_totals = { "success" : 0, "error" : 0, "warning" : 0 };

                    // clean out the content area ...
                    var $content_area = self.subrequest_controls["panel"].find(".content");
                    $content_area.html('');

                    // looping through all the subrequests
                    $.each( res.data, function (i, subrequest) {

                        var subpanels = '';

                        // need totals for all subrequests
                        var subrequest_notification_totals = { "success" : 0, "error" : 0, "warning" : 0 };

                        $.each( subrequest.results, function (j, results) {
                            if ( results.notifications ) {
                                subrequest_notification_totals.error   += results.notifications.error;
                                subrequest_notification_totals.warning += results.notifications.warning;
                                subrequest_notification_totals.success += results.notifications.success;

                                all_subrequest_notification_totals.error   += results.notifications.error;
                                all_subrequest_notification_totals.warning += results.notifications.warning;
                                all_subrequest_notification_totals.success += results.notifications.success;
                            }

                            subpanels += '<div class="subpanel">'
                                + '<h3>' + results.title + '</h3>'
                                + '<h4>' + results.subtitle + '</h4>'
                                + '<div>' + generate_data_for_panel( results.result ) + '</div>'
                            + '</div>';
                        });

                        $content_area.append(
                            '<div class="subrequest-content">' 
                                + '<div class="subheader">'
                                    + '<div class="notifications">'
                                        + '<div class="badge warning">' + subrequest_notification_totals.warning + '</div>'
                                        + '<div class="badge error">'   + subrequest_notification_totals.error   + '</div>'
                                        + '<div class="badge success">' + subrequest_notification_totals.success + '</div>'
                                    + '</div>'
                                    + '<div class="title">' 
                                        + subrequest.request_uid 
                                    + '</div>'
                                + '</div>'
                                + '<div class="subpanels">'
                                    + subpanels
                                + '</div>' 
                            + '</div>' 
                        );

                        self.subrequest_controls["button"].find(".notifications .error").text( all_subrequest_notification_totals.error );
                        self.subrequest_controls["panel"].find(".header .notifications .error > span").text( all_subrequest_notification_totals.error );

                        self.subrequest_controls["button"].find(".notifications .warning").text( all_subrequest_notification_totals.warning );
                        self.subrequest_controls["panel"].find(".header .notifications .warning > span").text( all_subrequest_notification_totals.warning );

                        self.subrequest_controls["button"].find(".notifications .success").text( all_subrequest_notification_totals.success );
                        self.subrequest_controls["panel"].find(".header .notifications .success > span").text( all_subrequest_notification_totals.success );                
                    });

                    $content_area.find(".subrequest-content .title").click(function () {
                        var $e = $(this).parent().parent().find(".subpanels");
                        if ( $e.css('display') == 'none' ) {
                            $e.show();
                        } else {
                            $e.hide();
                        }
                    });

                });
            }
        });

    });

});

