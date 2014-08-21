
// setup our base namespace
if ( Plack == undefined ) var Plack = {};

Plack.Debugger = function () {
    this.config             = {};
    this.request_uid        = null;
    this.request_results    = null;
    this.subrequest_panels  = { "toolbar" : null, "content" : null };
    this.subrequest_results = [];
    this.subrequest_count   = 0;
    this._init();    
};

// initializer 

Plack.Debugger.prototype._init = function () {
    var init_url = document.getElementById("plack-debugger-js-init").src;

    this.request_uid = init_url.split("#")[1];

    var url_parts = init_url.split("/"); 
    
    url_parts.pop();
    this.config.static_js_url = url_parts.join("/");

    url_parts.pop();
    this.config.static_url = url_parts.join("/");

    url_parts.pop();
    this.config.root_url = url_parts.join("/");
};

// methods ...

Plack.Debugger.prototype.ready = function (callback) {
    var self = this;
    if ( typeof jQuery == 'undefined' ) {
        self._load_static_js( "/jquery.js", function () { 
            jQuery(document).ready(function () { 
                callback.apply(self, [ jQuery ]) 
            }) 
        });
    }
    else {
        jQuery(document).ready(function () {
            callback.apply(self, [ jQuery ]) 
        });
    }
};

// private utilities ...

Plack.Debugger.prototype._load_static_js = function (url, callback) {
    var script  = document.createElement("script");
    script.type = "text/javascript";
    script.src  = this.config.static_js_url + url;
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
};

// ... 

var plack_debugger = new Plack.Debugger();

plack_debugger.ready(function ($) {

    var self = this;

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
                var $content_area = self.subrequest_panels["content"].find(".content");
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

                    self.subrequest_panels["toolbar"].find(".notifications .error").text( all_subrequest_notification_totals.error );
                    self.subrequest_panels["content"].find(".notifications .error > span").text( all_subrequest_notification_totals.error );

                    self.subrequest_panels["toolbar"].find(".notifications .warning").text( all_subrequest_notification_totals.warning );
                    self.subrequest_panels["content"].find(".notifications .warning > span").text( all_subrequest_notification_totals.warning );

                    self.subrequest_panels["toolbar"].find(".notifications .success").text( all_subrequest_notification_totals.success );
                    self.subrequest_panels["content"].find(".notifications .success > span").text( all_subrequest_notification_totals.success );

                    self.subrequest_panels["content"].find(".notifications .info > span").text( res.data.length );                    
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

    // setup the debugger UI
    $(document.body).append(
        '<style type="text/css">' 
            + '@import url(' + self.config.static_url + '/css/toolbar.css);'
        + '</style>'
        + '<div id="plack-debugger">' 
            + '<div class="collapsed">' 
                + '<div class="open-button">&#9756;</div>'
            + '</div>'
            + '<div class="toolbar">' 
                + '<div class="header">'
                    + '<div class="close-button">&#9758;</div>'
                    + '<div class="data">' 
                        + '<strong>uid</strong>' 
                        + ' : ' 
                        + '<a>' + self.request_uid + '</a>' 
                    + '</div>'
                + '</div>'
                + '<div class="panels"></div>'
            + '</div>'
            + '<div class="panel-content"></div>'
        + '</div>'
    );

    // debugger UI events ...

    var $toolbar   = $("#plack-debugger .toolbar");
    var $collapsed = $("#plack-debugger .collapsed");
    var $content   = $("#plack-debugger .panel-content");

    $collapsed.find(".open-button").click(function () {
        $content.show();
        $toolbar.show();
        $collapsed.hide();
    });

    $toolbar.find(".close-button").click(function () {
        $content.hide();
        $toolbar.hide();
        $collapsed.show();
    });

    $toolbar.find(".header .data a").click(function () {
        window.open( self.config["root_url"] + '/' + $(this).text() )
    });

    // load and draw panel information 

    var generate_data_for_panel = function (data) {
        if (!data) return "";
        switch ( data.constructor ) {
            case String:
            case Number:
                return data;
            case Array:
                var out = '<table>';
                for (var i = 0; i < data.length; i++) {
                    out += '<tr><td>' + data[i] + '</td></tr>';
                }
                return out + '</table>'; 
            case Object:
                var out = '<table>';
                for (key in data) {
                    out += '<tr><td>' + key + '</td><td>' + data[key] + '</td></tr>';
                }
                return out + '</table>';
            default:
                return "NO IDEA WHAT THIS IS! " + (typeof data);          
        }
    };

    $.ajax({
        dataType : "json",
        url      : self.config["root_url"] + '/' + self.request_uid,
        global   : false
    }).then(function (res) {
        
        var $toolbar_panels = $toolbar.find(".panels");

        $.each( 
            res.data.results, 
            function (i, e) {

                $toolbar_panels.append(
                    '<div class="panel">'
                        + '<div class="notifications">'
                            + ((e['notifications'] != undefined)
                                ? (((e['notifications']['warning'] > 0) ? '<div class="badge warning">' + e['notifications']['warning'] + '</div>' : '')
                                  +((e['notifications']['error']   > 0) ? '<div class="badge error">'   + e['notifications']['error']   + '</div>' : '')
                                  +((e['notifications']['success'] > 0) ? '<div class="badge success">' + e['notifications']['success'] + '</div>' : ''))
                                : '')
                        + '</div>'
                        + '<span class="idx">' + i + "</span>"
                        + '<div class="title">' + e['title'] + '</div>'
                        + ((e['subtitle'] != undefined) ? '<div class="subtitle">' + e['subtitle'] + '</div>' : '')
                    + '</div>'
                );

                $content.append(
                    '<div id="plack-debugger-panel-content-' + i + '" class="panel">'
                        + '<div class="header">'
                            + '<div class="close-button">&#9746;</div>'
                            + '<div class="notifications">'
                                + ((e['notifications'] != undefined)
                                    ? (((e['notifications']['warning'] > 0) ? '<div class="badge warning">warnings (' + e['notifications']['warning'] + ')</div>' : '')
                                      +((e['notifications']['error']   > 0) ? '<div class="badge error">errors ('     + e['notifications']['error']   + ')</div>' : '')
                                      +((e['notifications']['success'] > 0) ? '<div class="badge success">success ('  + e['notifications']['success'] + ')</div>' : ''))
                                    : '')
                            + '</div>'
                            + '<div class="title">' + e['title'] + '</div>'
                            + ((e['subtitle'] != undefined) ? '<div class="subtitle">' + e['subtitle'] + '</div>' : '')
                        + '</div>'
                        + '<div class="content">'
                            + generate_data_for_panel( e['result'] )
                        + '</div>'
                    + '</div>'
                );
            }
        );

        $toolbar_panels.append(
            '<div class="panel">'
                + '<div class="notifications">'                   
                    + '<div class="badge warning">0</div>'
                    + '<div class="badge error">0</div>'
                    + '<div class="badge success">0</div>'                    
                + '</div>'
                + '<span class="idx">' + res.data.results.length + "</span>"
                + '<div class="title">AJAX Subrequests</div>'
            + '</div>'
        );

        $content.append(
            '<div id="plack-debugger-panel-content-' + res.data.results.length + '" class="panel">'
                + '<div class="header">'
                    + '<div class="close-button">&#9746;</div>'
                    + '<div class="notifications">'                      
                        + '<div class="badge warning">warnings (<span>0</span>)</div>'
                        + '<div class="badge error">errors (<span>0</span>)</div>'
                        + '<div class="badge success">success (<span>0</span>)</div>'                        
                        + '<div class="badge info">num-requests (<span>0</span>)</div>'                                                
                    + '</div>'
                    + '<div class="title">AJAX Subrequests</div>'
                + '</div>'
                + '<div class="content"></div>'
            + '</div>'
        );

        $toolbar_panels.find(".panel").click(function () {
            $content.find('.panel').hide();
            $("#plack-debugger-panel-content-" + $(this).find(".idx").text()).show();
            $content.show();
        });

        $content.find(".panel > .header > .close-button").click(function () {
            $(this).parent().parent().hide();
            $content.hide();
        });

        self.request_results              = res;
        self.subrequest_panels["toolbar"] = $toolbar_panels.find(".panel").last();
        self.subrequest_panels["content"] = $content.find(".panel").last();

    });

});

