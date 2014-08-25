

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

/* =============================================================== */

var Plack = {};

Plack.Debugger = function ( $parent ) {
    this.UI = new Plack.Debugger.UI( $parent );
}

/* =============================================================== */

Plack.Debugger.Abstract = {};

Plack.Debugger.Abstract.Eventful = function () {
    this.$element = null;
}

Plack.Debugger.Abstract.Eventful.prototype.register = function () { 
    throw new Error("Define a register method man!") 
}

Plack.Debugger.Abstract.Eventful.prototype.trigger = function ( e, data ) { 
    if ( this.$element != null ) this.$element.trigger( e, [ data ] ) 
}

Plack.Debugger.Abstract.Eventful.prototype.on = function ( e, cb   ) { 
    if ( this.$element != null ) this.$element.on( e, cb )            
}

// ----------------------------------------------------------------

Plack.Debugger.Abstract.UI = function () {
    this.$element = null;
}

Plack.Debugger.Abstract.UI.prototype = new Plack.Debugger.Abstract.Eventful();

Plack.Debugger.Abstract.UI.prototype.hide = function ( e ) { 
    e.stopPropagation(); 
    if ( this.$element != null ) this.$element.hide();
}

Plack.Debugger.Abstract.UI.prototype.show = function ( e ) { 
    e.stopPropagation(); 
    if ( this.$element != null ) this.$element.show();
}

/* =============================================================== */

Plack.Debugger.UI = function ( $parent ) {
    this.$element = $(
        '<style type="text/css">@import url(' + $CONFIG.static_url + '/css/toolbar.css);</style>'
        + '<div id="plack-debugger"></div>'
    );

    this.collapsed = new Plack.Debugger.UI.Collapsed( this.$element );
    this.toolbar   = new Plack.Debugger.UI.Toolbar( this.$element );
    
    this.register();
    $parent.append( this.$element );    
}

Plack.Debugger.UI.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.prototype.register = function () {

    // register for events we handle 
    this.on( "toolbar:open",  this.open_toolbar.bind( this ) );
    this.on( "toolbar:close", this.close_toolbar.bind( this ) );

    this.on( "hide", function () { console.log('no bubbling for hide') } );
    this.on( "show", function () { console.log('no bubbling for show') } );
}

Plack.Debugger.UI.prototype.open_toolbar = function ( e ) {
    e.stopPropagation();
    this.collapsed.trigger("hide");
    this.toolbar.trigger("show");
}

Plack.Debugger.UI.prototype.close_toolbar = function ( e ) {
    e.stopPropagation();
    this.toolbar.trigger("hide");
    this.collapsed.trigger("show");
}

// ------------------------------------------------------------------

Plack.Debugger.UI.Collapsed = function ( $parent ) {
    this.$element = $('<div class="collapsed"><div class="open-button">&#9756;</div></div>');
    this.register();
    $parent.append( this.$element );
}

Plack.Debugger.UI.Collapsed.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Collapsed.prototype.register = function () {
    // fire events
    this.$element.find(".open-button").click( 
        this.trigger.bind( this, [ 'toolbar:open' ] ) 
    );

    // register for events we handle
    this.on( "hide", this.hide.bind( this ) );
    this.on( "show", this.show.bind( this ) );
}

// ------------------------------------------------------------------

Plack.Debugger.UI.Toolbar = function ( $parent ) {
    this.$element = $(
        '<div class="toolbar">' 
            + '<div class="header">'
                + '<div class="close-button">&#9758;</div>'
            + '</div>'
            + '<div class="buttons"></div>'
        + '</div>'
    );
    this.register();
    $parent.append( this.$element );

    this.buttons = [
        new Plack.Debugger.UI.Toolbar.Button( this.$element.find(".buttons") )
    ];

    this.buttons[0].trigger( 
        "model:update", {
            title         : "Hello",
            subtitle      : "... testing",
            notifications : {
                warnings : 2,
                errors   : 0,
                success  : 1
            }
        } 
    );
}

Plack.Debugger.UI.Toolbar.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Toolbar.prototype.register = function () {
    // fire events
    this.$element.find('.header .close-button').click( 
        this.trigger.bind( this, [ 'toolbar:close' ] ) 
    );

    // register for events we handle
    this.on( "hide", this.hide.bind( this ) );
    this.on( "show", this.show.bind( this ) );
}

// ------------------------------------------------------------------

Plack.Debugger.UI.Toolbar.Button = function ( $parent ) {
    this.$element = $(
        '<div class="button">'
            + '<div class="notifications">'
                + '<div class="badge warning"></div>'
                + '<div class="badge error"></div>'
                + '<div class="badge success"></div>'
            + '</div>'
            + '<div class="title"></div>'
            + '<div class="subtitle"></div>'
        + '</div>'
    );
    this.register();
    $parent.append( this.$element );
}

Plack.Debugger.UI.Toolbar.Button.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Toolbar.Button.prototype.register = function () {
    // register for events we handle
    this.on( "model:update", this._update.bind( this ) );
}

Plack.Debugger.UI.Toolbar.Button.prototype._update = function ( e, data ) {
    e.stopPropagation();

    if ( data.title ) {
        this.$element.find(".title").html( data.title );
    }

    if ( data.subtitle ) {
        this.$element.find(".subtitle").html( data.subtitle ).show();
    }  
    else {
        this.$element.find(".subtitle").html('').hide();
    }

    if ( data.notifications ) {
        if ( data.notifications.warnings > 0 ) {
            this.$element.find(".notifications .warning").html( data.notifications.warnings ).show();
        }
        else {
            this.$element.find(".notifications .warning").html('').hide();
        }

        if ( data.notifications.errors > 0 ) {
            this.$element.find(".notifications .error").html( data.notifications.errors ).show();
        } 
        else {
            this.$element.find(".notifications .error").html('').hide();
        }

        if ( data.notifications.success > 0 ) {
            this.$element.find(".notifications .success").html( data.notifications.success ).show();
        }
        else {
            this.$element.find(".notifications .success").html('').hide();
        }
    }
}

/* =============================================================== */

__INIT_CONFIG__();
__LOAD_STATIC_JS__('/jquery.js', function () {
    $(document).ready(function () {
        new Plack.Debugger( $(document.body) );
    })
});

/*
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

*/

