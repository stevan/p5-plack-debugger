
var $CONFIG = {};

function __INIT_CONFIG__ () {
    var init_url = document.getElementById("plack-debugger-js-init").src;

    $CONFIG.current_request_uid = init_url.split("#")[1];

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

__INIT_CONFIG__();
__LOAD_STATIC_JS__('/lib/Plack/Debugger.js', function () {

    new Plack.Debugger().ready(
        function () {
            this.load_request_by_id( $CONFIG.current_request_uid );
        }
    );

});

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