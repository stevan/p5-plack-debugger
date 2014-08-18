
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

    $(document).ajaxSend(function (e, xhr, options) {
        xhr.setRequestHeader('X-Plack-Debugger-Parent-Request-UID', plack_debugger.request_uid);
    });

    $(document.body).append(
        '<style type="text/css">' 
            + '@import url(' + this.config.static_url + '/css/toolbar.css);'
        + '</style>'
        + '<div id="plack-debugger">' 
            + '<div id="plack-debugger-toolbar">'
                + '<span><strong>Plack::Debugger</strong></span>'
                + '<span class="seperator">|</span>'
                + '<span>request uid: ' + this.request_uid + '</span>'
                + '<span class="seperator">|</span>'
            + '</div>'
            + '<div id="plack-debugger-content"></div>'
        + '</div>'
    );

    $.getJSON(
        this.config["root_url"] + '/' + this.request_uid
    ).then(function (data) {
        var $toolbar = $("#plack-debugger-toolbar");
        var $content = $("#plack-debugger-content");

        $.each( data.results, function (k, v) {
            $toolbar.append('<span>' + k + '</span><span class="seperator">|</span>');

            // console.log( typeof v );
            // console.log( v );
            // if ( typeof v == 'string' || typeof v == 'number' ) {
            //     $content.append("<p>" + v + "</p>");
            // } 
            // else if ( typeof v == 'object' ) {
            //     $content.append("<table>");
            //     $.each(v, function (k, v) {
            //         $content.append("<tr><td>" + k + "</td><td>" + v + "</td></tr>");
            //     });
            //     $content.append("</table>");
            // }
            // $content.append("<hr/>");
        });
    });

});

