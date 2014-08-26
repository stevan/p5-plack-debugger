/* =============================================================== */

if ( Plack == undefined ) var Plack = {};

Plack.Debugger = function () {
    Plack.Debugger.$CONFIG = this._init_config();
}

Plack.Debugger.prototype._init_config = function () {
    var init_url = document.getElementById('plack-debugger-js-init').src;

    var config = {
        'current_request_uid' : init_url.split("#")[1]
    };

    var url_parts = init_url.split('/'); 
    url_parts.pop(); config.static_js_url = url_parts.join('/');
    url_parts.pop(); config.static_url    = url_parts.join('/');
    url_parts.pop(); config.root_url      = url_parts.join('/');

    return config;
}

Plack.Debugger.prototype.ready = function (callback) {
    var self           = this;
    var ready_callback = function ( $jQuery ) { self._ready( $jQuery(document), callback ) };

    if ( typeof jQuery == 'undefined' ) {

        var script  = document.createElement('script');
        script.type = 'text/javascript';
        script.src  = this.$CONFIG.static_js_url + '/jquery.js';

        if (script.readyState) { // IE
            script.onreadystatechange = function () {
                if (script.readyState == 'loaded' || script.readyState == 'complete') {
                    script.onreadystatechange = null;
                    jQuery.noConflict();
                    jQuery(document).ready(ready_callback);
                }
            };
        } 
        else { 
            script.onload = function () {
                jQuery.noConflict();
                jQuery(document).ready(ready_callback);
            };
        }

        document.getElementsByTagName('body')[0].appendChild( script );
    } else {
        jQuery(document).ready(ready_callback);
    }
}

Plack.Debugger.prototype._ready = function ( $parent, callback ) {
    this.UI = new Plack.Debugger.UI( $parent.find('body') );

    callback.apply( this, [] );
}

/* =============================================================== */

Plack.Debugger.Abstract = {};

// ----------------------------------------------------------------
// basic event handling object

Plack.Debugger.Abstract.Eventful = function () {
    this.$element = null;
}

Plack.Debugger.Abstract.Eventful.prototype.register = function () { 
    throw new Error('[Abstract Method] you must define a `register` method'); 
}

Plack.Debugger.Abstract.Eventful.prototype.trigger = function ( e, data ) { 
    if ( this.$element != null ) this.$element.trigger( e, [ data ] ) 
}

Plack.Debugger.Abstract.Eventful.prototype.on = function ( e, cb ) { 
    if ( this.$element != null ) this.$element.on( e, cb )            
}

// ----------------------------------------------------------------
// simple UI object to handle common events 

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
    this.$element = $parent.append(
        '<style type="text/css">' 
            + '@import url(' + Plack.Debugger.$CONFIG.static_url + '/css/toolbar.css);' 
        + '</style>' 
        + '<div id="plack-debugger"></div>'
    ).find('#plack-debugger');

    this.collapsed = new Plack.Debugger.UI.Collapsed( this.$element );
    this.toolbar   = new Plack.Debugger.UI.Toolbar( this.$element );
    
    this.register();   
}

Plack.Debugger.UI.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.prototype.register = function () {
    // register for events we handle 
    this.on( 'plack-debugger:toolbar:open',  this.open_toolbar.bind( this ) );
    this.on( 'plack-debugger:toolbar:close', this.close_toolbar.bind( this ) );
}

Plack.Debugger.UI.prototype.open_toolbar = function ( e ) {
    e.stopPropagation();
    this.collapsed.trigger("plack-debugger:_:hide");
    this.toolbar.trigger("plack-debugger:_:show");
}

Plack.Debugger.UI.prototype.close_toolbar = function ( e ) {
    e.stopPropagation();
    this.toolbar.trigger("plack-debugger:_:hide");
    this.collapsed.trigger("plack-debugger:_:show");
}

// ------------------------------------------------------------------

Plack.Debugger.UI.Collapsed = function ( $parent ) {
    this.$element = $parent.append(
        '<div class="collapsed"><div class="open-button">&#9756;</div></div>'
    ).find('.collapsed');
    this.register();
}

Plack.Debugger.UI.Collapsed.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Collapsed.prototype.register = function () {
    // fire events
    this.$element.find('.open-button').click( 
        this.trigger.bind( this, [ 'plack-debugger:toolbar:open' ] ) 
    );

    // register for events we handle
    this.on( 'plack-debugger:_:hide', this.hide.bind( this ) );
    this.on( 'plack-debugger:_:show', this.show.bind( this ) );
}

// ------------------------------------------------------------------

Plack.Debugger.UI.Toolbar = function ( $parent ) {
    this.$element = $parent.append(
        '<div class="toolbar">' 
            + '<div class="header">'
                + '<div class="close-button">&#9758;</div>'
            + '</div>'
            + '<div class="buttons"></div>'
        + '</div>'
    ).find('.toolbar');
    this.register();

    var $buttons = this.$element.find('.buttons');
    this.buttons = [
        new Plack.Debugger.UI.Toolbar.Button( $buttons ),
        new Plack.Debugger.UI.Toolbar.Button( $buttons )
    ];

    this.buttons[0].trigger( 
        'plack-debugger:toolbar:button:update', {
            title         : "Hello",
            subtitle      : "... testing",
            notifications : {
                warnings : 2,
                errors   : 0,
                success  : 1
            }
        } 
    );

    this.buttons[1].trigger( 
        'plack-debugger:toolbar:button:update', {
            title         : "Goodbye",
            notifications : {
                warnings : 0,
                errors   : 100,
                success  : 1
            }
        } 
    );
}

Plack.Debugger.UI.Toolbar.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Toolbar.prototype.register = function () {
    // fire events
    this.$element.find('.header .close-button').click( 
        this.trigger.bind( this, [ 'plack-debugger:toolbar:close' ] ) 
    );

    // register for events we handle
    this.on( 'plack-debugger:_:hide', this.hide.bind( this ) );
    this.on( 'plack-debugger:_:show', this.show.bind( this ) );
}

// ------------------------------------------------------------------

Plack.Debugger.UI.Toolbar.Button = function ( $parent ) {
    this.$element = $parent.append(
        '<div class="button">'
            + '<div class="notifications">'
                + '<div class="badge warning"></div>'
                + '<div class="badge error"></div>'
                + '<div class="badge success"></div>'
            + '</div>'
            + '<div class="title"></div>'
            + '<div class="subtitle"></div>'
        + '</div>'
    ).find('.button').last();
    this.register();
}

Plack.Debugger.UI.Toolbar.Button.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Toolbar.Button.prototype.register = function () {
    // register for events we handle
    this.on( 'plack-debugger:toolbar:button:update', this._update.bind( this ) );
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


new Plack.Debugger().ready(function () {
    console.log('... ready to debug some stuff!')
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


