
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
    self._load_static_js( "/jquery.js", function () { 

        // TODO - setup global AJAX handlers here ...

        jQuery(document).ready(function () { 
            callback.apply(self, [ jQuery ]) 
        }) 
    });
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

    $(document.body).append(
        '<div id="plack-debugger" style="padding: 5px; border: 1px #333 solid; background: #ccc">' 
        + '<h3>Debugger</h3>'
        + '<hr/>'
        + '<p>Your request id is: ' + this.request_uid + '.</p>'
        + '<div id="plack-debugger-content" style="padding: 2px; border: 1px #333 solid;">' 
        + '</div>'
        + '</div>'
    );

    $.getJSON(
        this.config["root_url"] + '/' + this.request_uid
    ).then(function (data) {
        var $content = $("#plack-debugger-content");
        $.each( data.results, function (k, v) {
            $content.append("<h3>" + k + "</h3>");

            console.log( typeof v );
            console.log( v );

            if ( typeof v == 'string' || typeof v == 'number' ) {
                $content.append("<p>" + v + "</p>");
            } 
            else if ( typeof v == 'object' ) {
                $content.append("<table>");
                $.each(v, function (k, v) {
                    $content.append("<tr><td>" + k + "</td><td>" + v + "</td></tr>");
                });
                $content.append("</table>");
            }
            $content.append("<hr/>");
        });
    });

});

