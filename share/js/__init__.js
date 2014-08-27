/* =============================================================== */

if ( Plack == undefined ) var Plack = {};

Plack.Debugger = function () {
    if ( Plack.Debugger.$CONFIG == undefined ) {
        Plack.Debugger.$CONFIG = this._init_config();
    }
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

Plack.Debugger.prototype.ready = function ( callback ) {
    var self           = this;
    var ready_callback = function ( $jQuery ) { self._ready( $jQuery, callback ) };

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

Plack.Debugger.prototype._ready = function ( $root, callback ) {
    this.UI    = new Plack.Debugger.UI( $root(document.body) );
    this.model = new Plack.Debugger.Model( $root, this.UI );

    callback.apply( this, [] );
}

/* =============================================================== */

Plack.Debugger.Model = function ( $root, $target ) {
    this.$root   = $root;
    this.$target = $target;
}

Plack.Debugger.Model.prototype.load_request_by_id = function ( request_uid ) {
    this.$root.ajax({
        'dataType' : 'json',
        'url'      : (Plack.Debugger.$CONFIG.root_url + '/' + request_uid),
        'global'   : false
    }).then(
        this._update_target.bind( this )       
    );
}

Plack.Debugger.Model.prototype._update_target = function ( response ) {
    this.$target.trigger( 'plack-debugger.ui:update', response.data.results );
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

// register events ...

Plack.Debugger.Abstract.Eventful.prototype.on = function ( e, cb ) { 
    if ( this.$element != null ) this.$element.on( e, cb )            
}

Plack.Debugger.Abstract.Eventful.prototype.one = function ( e ) { 
    if ( this.$element != null ) this.$element.one( e )            
}

// unregister events ...

Plack.Debugger.Abstract.Eventful.prototype.off = function ( e ) { 
    if ( this.$element != null ) this.$element.off( e )            
}

Plack.Debugger.Abstract.Eventful.prototype.cancel = function ( e ) { 
    if ( this.$element != null ) {
        this.$element.off( e );
        this.$element.on( e, function ( e ) { e.stopPropagation() } );
    }
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
    this.panels    = new Plack.Debugger.UI.Panels( this.$element );
    
    this.register();   
}

Plack.Debugger.UI.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.prototype.register = function () {
    // register for events we handle 
    this.on( 'plack-debugger.ui:update',  this._update_data.bind( this ) );

    this.on( 'plack-debugger.ui.toolbar:open',  this._open_toolbar.bind( this ) );
    this.on( 'plack-debugger.ui.toolbar:close', this._close_toolbar.bind( this ) );

    this.on( 'plack-debugger.ui.panels:open',  this._open_panels.bind( this ) );
    this.on( 'plack-debugger.ui.panels:close', this._close_panels.bind( this ) );

    this.on( 'plack-debugger.ui._:hide', function () { throw new Error("You cannot hide() the Plack.Debugger.UI itself") } );
    this.on( 'plack-debugger.ui._:show', function () { throw new Error("You cannot show() the Plack.Debugger.UI itself") }  );
}

Plack.Debugger.UI.prototype._update_data = function ( e, data ) {
    for ( var i = 0; i < data.length; i++ ) {
        this.toolbar.add_button( data[i] );
        this.panels.add_panel( data[i] );
    }
}

Plack.Debugger.UI.prototype._open_toolbar = function ( e ) {
    e.stopPropagation();
    this.collapsed.trigger('plack-debugger.ui._:hide');
    this.toolbar.trigger('plack-debugger.ui._:show');
    this.panels.trigger('plack-debugger.ui._:hide'); // re-hide the panels
}

Plack.Debugger.UI.prototype._close_toolbar = function ( e ) {
    e.stopPropagation();
    this.panels.trigger('plack-debugger.ui._:hide');
    this.toolbar.trigger('plack-debugger.ui._:hide');
    this.collapsed.trigger('plack-debugger.ui._:show');
}

Plack.Debugger.UI.prototype._open_panels = function ( e, index ) {
    e.stopPropagation();
    this.panels.trigger('plack-debugger.ui.panels.panel:open', index);
}

Plack.Debugger.UI.prototype._close_panels = function ( e, index ) {
    e.stopPropagation();
    this.panels.trigger('plack-debugger.ui.panels.panel:close', index);
}

/* =============================================================== */

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
        this.trigger.bind( this, 'plack-debugger.ui.toolbar:open' ) 
    );

    // register for events we handle
    this.on( 'plack-debugger.ui._:hide', this.hide.bind( this ) );
    this.on( 'plack-debugger.ui._:show', this.show.bind( this ) );
}

/* =============================================================== */

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

    this.buttons = [];
}

Plack.Debugger.UI.Toolbar.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Toolbar.prototype.register = function () {
    // fire events
    this.$element.find('.header .close-button').click( 
        this.trigger.bind( this, 'plack-debugger.ui.toolbar:close' ) 
    );

    // register for events we handle
    this.on( 'plack-debugger.ui._:hide', this.hide.bind( this ) );
    this.on( 'plack-debugger.ui._:show', this.show.bind( this ) );
}

Plack.Debugger.UI.Toolbar.prototype.add_button = function ( data ) {
    var button = new Plack.Debugger.UI.Toolbar.Button( this.$element.find('.buttons') );
    button.trigger( 'plack-debugger.ui.toolbar.button:update', data );
    this.buttons.push( button );
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
    // fire events
    this.$element.click( 
        this.trigger.bind( this, 'plack-debugger.ui.panels:open', this.$element.index() ) 
    );

    // register for events we handle
    this.on( 'plack-debugger.ui.toolbar.button:update', this._update.bind( this ) );
}

Plack.Debugger.UI.Toolbar.Button.prototype._update = function ( e, data ) {
    e.stopPropagation();

    if ( data.title ) {
        this.$element.find('.title').html( data.title );
    }

    if ( data.subtitle ) {
        this.$element.find('.subtitle').html( data.subtitle ).show();
    }  
    else {
        this.$element.find('.subtitle').html('').hide();
    }

    if ( data.notifications ) {
        if ( data.notifications.warnings > 0 ) {
            this.$element.find('.notifications .warning').html( data.notifications.warnings ).show();
        }
        else {
            this.$element.find('.notifications .warning').html('').hide();
        }

        if ( data.notifications.errors > 0 ) {
            this.$element.find('.notifications .error').html( data.notifications.errors ).show();
        } 
        else {
            this.$element.find('.notifications .error').html('').hide();
        }

        if ( data.notifications.success > 0 ) {
            this.$element.find('.notifications .success').html( data.notifications.success ).show();
        }
        else {
            this.$element.find('.notifications .success').html('').hide();
        }
    } 
    else {
        this.$element.find('.notifications .badge').html('').hide();
    }
}

/* =============================================================== */

Plack.Debugger.UI.Panels = function ( $parent ) {
    this.$element = $parent.append(
        '<div class="panels"></div>'
    ).find('.panels');
    this.register();

    this.panels = [];
}

Plack.Debugger.UI.Panels.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Panels.prototype.register = function () {
    // register for events we handle
    this.on( 'plack-debugger.ui.panels.panel:open',  this._open_panel.bind( this )  );
    this.on( 'plack-debugger.ui.panels.panel:close', this._close_panel.bind( this ) );

    this.on( 'plack-debugger.ui._:hide', this.hide.bind( this ) );
    this.on( 'plack-debugger.ui._:show', this.show.bind( this ) );
}

Plack.Debugger.UI.Panels.prototype.add_panel = function ( data ) {
    var panel = new Plack.Debugger.UI.Panels.Panel( this.$element );
    panel.trigger( 'plack-debugger.ui.panels.panel:update', data );
    this.panels.push( panel );
}

Plack.Debugger.UI.Panels.prototype._open_panel = function ( e, index ) {
    e.stopPropagation();
    // XXX - could do this better ...
    this.$element.find('.panel:visible').hide(); // hide any strays
    this.trigger( 'plack-debugger.ui._:show' );
    this.panels[ index ].trigger( 'plack-debugger.ui._:show' );
}

Plack.Debugger.UI.Panels.prototype._close_panel = function ( e, index ) {
    e.stopPropagation();
    this.trigger( 'plack-debugger.ui._:hide' );
    this.panels[ index ].trigger( 'plack-debugger.ui._:hide' );    
}

// ------------------------------------------------------------------

Plack.Debugger.UI.Panels.Panel = function ( $parent ) {
    this.$element = $parent.append(
        '<div class="panel">'
            + '<div class="header">'
                + '<div class="close-button">&#9746;</div>'
                + '<div class="notifications">'
                    + '<div class="badge warning">warnings (<span></span>)</div>'
                    + '<div class="badge error">errors (<span></span>)</div>'
                    + '<div class="badge success">success (<span></span>)</div>'
                + '</div>'
                + '<div class="title"></div>'
                + '<div class="subtitle"></div>'
            + '</div>'
            + '<div class="content"></div>'
        + '</div>'
    ).find('.panel').last();
    this.register();
}

Plack.Debugger.UI.Panels.Panel.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Panels.Panel.prototype.register = function () {
    // fire events
    this.$element.find('.header .close-button').click( 
        this.trigger.bind( this, 'plack-debugger.ui.panels:close', this.$element.index() ) 
    );

    // register for events we handle
    this.on( 'plack-debugger.ui.panels.panel:update', this._update.bind( this ) );

    this.on( 'plack-debugger.ui._:hide', this.hide.bind( this ) );
    this.on( 'plack-debugger.ui._:show', this.show.bind( this ) );
}

Plack.Debugger.UI.Panels.Panel.prototype._update = function ( e, data ) {
    e.stopPropagation();

    if ( data.title ) {
        this.$element.find('.header .title').html( data.title );
    }

    if ( data.subtitle ) {
        this.$element.find('.header .subtitle').html( data.subtitle );
    } 

    if ( data.notifications ) {
        if ( data.notifications.warnings > 0 ) {
            var e = this.$element.find('.header .notifications .warning');
            e.find('span').html( data.notifications.warnings );
            e.show();
        }
        else {
            var e = this.$element.find('.header .notifications .warning');
            e.find('span').html('');
            e.hide();
        }

        if ( data.notifications.errors > 0 ) {
            var e = this.$element.find('.header .notifications .error');
            e.find('span').html( data.notifications.errors );
            e.show();
        } 
        else {
            var e = this.$element.find('.header .notifications .error');
            e.find('span').html('');
            e.hide();
        }

        if ( data.notifications.success > 0 ) {
            var e = this.$element.find('.header .notifications .success');
            e.find('span').html( data.notifications.success );
            e.show();
        }
        else {
            var e = this.$element.find('.header .notifications .success');
            e.find('span').html('');
            e.hide();
        }
    }
    else {
        var e = this.$element.find('.header .notifications .badge');
        e.find('span').html('');
        e.hide();
    }

    if ( data.result ) {
        // TODO - add formatter ...
        this.$element.find('.content').html( generate_data_for_panel( data.result ) );
    }
}

/* =============================================================== */


new Plack.Debugger().ready(function () {
    console.log('... ready to debug some stuff!');

    this.model.load_request_by_id( Plack.Debugger.$CONFIG.current_request_uid );
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


