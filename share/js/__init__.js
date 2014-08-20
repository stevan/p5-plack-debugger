
// setup our base namespace
if ( Plack == undefined ) var Plack = {};

Plack.Debugger = function () {
    this.request_uid = null;
    this.config      = {};

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
        switch ( typeof data ) {
            case 'string':
            case 'number':
                return data;
            case 'object':
                var out = '<table>';
                for (key in data) {
                    out += '<tr><td>' + key + '</td><td>' + data[key] + '</td></tr>';
                }
                return out + '</table>';
            case 'array':
                var out = '<ul>';
                for (var i = 0; i < data.length; i++) {
                    out += '<li>' + data[i] + '</li>';
                }
                return out + '</ul>';  
            default:
                return "NO IDEA WHAT THIS IS! " + (typeof data);          
        }
    };

    $.getJSON(
        self.config["root_url"] + '/' + self.request_uid
    ).then(function (res) {
        
        var $toolbar_panels = $toolbar.find(".panels");

        $.each( 
            res.data.results, 
            function (i, e) {
                $toolbar_panels.append(
                    '<div class="panel">'
                        + '<div class="notifications">'
                            + ((e['notifications'] != undefined)
                                ? (((e['notifications']['success'] > 0) ? '<div class="badge success">' + e['notifications']['success'] + '</div>' : '')
                                    + ((e['notifications']['info']    > 0) ? '<div class="badge info">'    + e['notifications']['info']    + '</div>' : '')                       
                                    + ((e['notifications']['warning'] > 0) ? '<div class="badge warning">' + e['notifications']['warning'] + '</div>' : '')
                                    + ((e['notifications']['error']   > 0) ? '<div class="badge error">'   + e['notifications']['error']   + '</div>' : ''))
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
                                    ? (((e['notifications']['success'] > 0) ? '<div class="badge success">success ('     + e['notifications']['success'] + ')</div>' : '')
                                        + ((e['notifications']['info']    > 0) ? '<div class="badge info">info ('        + e['notifications']['info']    + ')</div>' : '')                       
                                        + ((e['notifications']['warning'] > 0) ? '<div class="badge warning">warnings (' + e['notifications']['warning'] + ')</div>' : '')
                                        + ((e['notifications']['error']   > 0) ? '<div class="badge error">errors ('     + e['notifications']['error']   + ')</div>' : ''))
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

        $toolbar_panels.find(".panel").click(function () {
            $content.find('.panel').hide();
            $("#plack-debugger-panel-content-" + $(this).find(".idx").text()).show();
            $content.show();
        });

        $content.find(".panel > .header > .close-button").click(function () {
            $(this).parent().parent().hide();
            $content.hide();
        });

    });

});

