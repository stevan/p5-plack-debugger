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
        script.src  = Plack.Debugger.$CONFIG.static_js_url + '/jquery.js';

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

    return self;
}

Plack.Debugger.prototype._ready = function ( $jQuery, callback ) {
    this.UI       = new Plack.Debugger.UI( $jQuery(document.body) );
    this.resource = new Plack.Debugger.Resource( $jQuery, this.UI );

    $jQuery(document).ajaxSend( this._handle_AJAX_send.bind( this ) );
    $jQuery(document).ajaxComplete( this._handle_AJAX_complete.bind( this ) );

    // NOTE:
    // Not sure I see the need for any of this yet, but 
    // we can just leave them here for now.
    // - SL
    // $jQuery(document).ajaxError( this._handle_AJAX_error.bind( this ) );    
    // $jQuery(document).ajaxSuccess( this._handle_AJAX_success.bind( this ) );
    // $jQuery(document).ajaxStart( this._handle_AJAX_start.bind( this ) );
    // $jQuery(document).ajaxStop( this._handle_AJAX_stop.bind( this ) );

    callback.apply( this, [] );
}

Plack.Debugger.prototype._handle_AJAX_send = function (e, xhr, options) {
    xhr.setRequestHeader( 'X-Plack-Debugger-Parent-Request-UID', Plack.Debugger.$CONFIG.current_request_uid );
    this.resource.trigger('plack-debugger._:ajax-send');
}

Plack.Debugger.prototype._handle_AJAX_complete = function (e, xhr, options) {
    this.resource.trigger('plack-debugger._:ajax-complete');
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
    if ( this.$element != null ) {
        //console.log('... calling event <' + e + '> on ' + this.$element.selector);
        this.$element.trigger( e, [ data ] );
    }
}

// register events ...

Plack.Debugger.Abstract.Eventful.prototype.on = function ( e, cb ) { 
    if ( this.$element != null ) {
        // NOTE:
        // Yuk, this silliness is so that we can support
        // jQuery going all the way back to 1.0, instead
        // of the nice 1.7 .on method.
        // - SL 
        if ( this._cache == undefined ) this._cache = {};
        this._cache[ e ] = cb;
        this.$element.bind( e, cb );
    }
}

// unregister events ...

Plack.Debugger.Abstract.Eventful.prototype.off = function ( e ) { 
    if ( this.$element != null ) {
        // NOTE:
        // Yuk, this silliness is so that we can support
        // jQuery going all the way back to 1.0, instead
        // of the nice 1.7 .off method.
        // - SL
        if ( this._cache == undefined ) this._cache = {};        
        if ( this._cache[ e ] != undefined ) {
            this.$element.unbind( e, this._cache[ e ] );
            delete this._cache[ e ];
        }
    }
}

Plack.Debugger.Abstract.Eventful.prototype.cancel = function ( e ) { 
    if ( this.$element != null ) {
        this.off( e );
        this.on( e, function ( _e ) { _e.stopPropagation() } );
    }
}

// ----------------------------------------------------------------
// simple UI object to handle common events 

Plack.Debugger.Abstract.UI = function () {
    this.$element = null;
}

Plack.Debugger.Abstract.UI.prototype = new Plack.Debugger.Abstract.Eventful();

Plack.Debugger.Abstract.UI.prototype.hide = function ( e, duration ) { 
    e.stopPropagation(); 
    if ( this.$element != null ) this.$element.hide( duration );
}

Plack.Debugger.Abstract.UI.prototype.show = function ( e, duration ) { 
    e.stopPropagation(); 
    if ( this.$element != null ) this.$element.show( duration );
}

/* =============================================================== */

Plack.Debugger.Resource = function ( $jQuery, $target ) {
    this.$jQuery = $jQuery;
    this.$target = $target;

    // we need a place to listen 
    // for events and it has to 
    // be above the $target on 
    // the DOM tree, so we create
    // that level here.
    this.$element = $target.$element.wrap(
        '<div class="pdb-listener"></div>'
    ).parent();

    this._request          = null;
    this._subrequests      = [];
    this._subrequest_count = 0;

    this.register();
}

Plack.Debugger.Resource.prototype = new Plack.Debugger.Abstract.Eventful();

Plack.Debugger.Resource.prototype.register = function () {
    // register for events we handle 
    this.on( 'plack-debugger.resource.request:load',     this._load_request.bind( this ) );
    this.on( 'plack-debugger.resource.subrequests:load', this._load_subrequests.bind( this ) );

    this.on( 'plack-debugger._:ajax-send',     this._handle_ajax_send.bind( this ) );
    this.on( 'plack-debugger._:ajax-complete', this._handle_ajax_complete.bind( this ) );    
}

Plack.Debugger.Resource.prototype._load_request = function ( e ) {
    e.stopPropagation();
    this.$jQuery.ajax({
        'dataType' : 'json',
        'url'      : (Plack.Debugger.$CONFIG.root_url + '/' + Plack.Debugger.$CONFIG.current_request_uid),
        'global'   : false,
        'success'  : this._update_target_on_request_success.bind( this ),
        'error'    : this._update_target_on_error.bind( this ),
    });
}

Plack.Debugger.Resource.prototype._load_subrequests = function ( e ) {
    e.stopPropagation();
    this.$jQuery.ajax({
        'dataType' : 'json',
        'url'      : (
            Plack.Debugger.$CONFIG.root_url 
            + '/' 
            + Plack.Debugger.$CONFIG.current_request_uid
            + '/subrequest'
        ),
        'global'   : false,
        'success'  : this._update_target_on_subrequest_success.bind( this ),
        'error'    : this._update_target_on_error.bind( this ),
    });
}

Plack.Debugger.Resource.prototype._update_target_on_request_success = function ( response, status, xhr ) {
    this.$target.trigger( 'plack-debugger.ui:load-request', response.data.results );

    // once the target is updated, we can 
    // just start to ignore the event 
    this.cancel( 'plack-debugger.resource.request:load' );

    this._request = response;
}

Plack.Debugger.Resource.prototype._update_target_on_subrequest_success = function ( response, status, xhr ) {
    this.$target.trigger( 'plack-debugger.ui:load-subrequests', response.data );
    this._subrequests = response;
}

Plack.Debugger.Resource.prototype._update_target_on_error = function ( xhr, status, error ) {
    this.$target.trigger( 'plack-debugger.ui:load-error', error );
}

Plack.Debugger.Resource.prototype._handle_ajax_send = function ( e ) {
    this._subrequest_count++;
}

Plack.Debugger.Resource.prototype._handle_ajax_complete = function ( e ) {
    // NOTE:
    // while it is unlikely that this will get out 
    // of sync, one can never tell so best to just 
    // have this simple check here.
    // - SL
    if ( this._subrequest_count != this._subrequests.length ) {
        this.trigger('plack-debugger.resource.subrequests:load')
    }
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
    this.on( 'plack-debugger.ui:load-request',     this._load_request.bind( this ) );
    this.on( 'plack-debugger.ui:load-subrequests', this._load_subrequests.bind( this ) );
    this.on( 'plack-debugger.ui:load-error',       this._load_data_error.bind( this ) );

    this.on( 'plack-debugger.ui.toolbar:open',     this._open_toolbar.bind( this ) );
    this.on( 'plack-debugger.ui.toolbar:close',    this._close_toolbar.bind( this ) );

    this.on( 'plack-debugger.ui.panels:open',      this._open_panels.bind( this ) );
    this.on( 'plack-debugger.ui.panels:close',     this._close_panels.bind( this ) );

    this.on( 'plack-debugger.ui._:hide', function () { throw new Error("You cannot hide() the Plack.Debugger.UI itself") } );
    this.on( 'plack-debugger.ui._:show', function () { throw new Error("You cannot show() the Plack.Debugger.UI itself") }  );
}

Plack.Debugger.UI.prototype._load_request = function ( e, data ) {
    e.stopPropagation();
    // load the data into the various places 
    for ( var i = 0; i < data.length; i++ ) {

        // TODO:
        // if we notice an AJAX panel here
        // we should bubble an event up to 
        // the Resource level so that it can 
        // turn on the AJAX handling and then
        // we should make a note of where the
        // index is for the AJAX button/panel
        // are in the list.
        // - SL

        this.toolbar.add_button( data[i] );
        this.panels.add_panel( data[i] );
    }
}

Plack.Debugger.UI.prototype._load_subrequests = function ( e, data ) {
    e.stopPropagation();

    // collect and collate some information on 
    // all the subrequests that have been fired
    // so that we have something to display in 
    // the panel content.

    var all = { 
        'notifications' : { 'warning' : 0, 'error' : 0, 'success' : 0 },
        'result'        : []
    };

    for ( var i = 0; i < data.length; i++ ) {
        var page = {
            'request_uid'        : data[i].request_uid,
            'parent_request_uid' : data[i].parent_request_uid,
            'notifications'      : { 'warning' : 0, 'error' : 0, 'success' : 0 },
            'results'            : [],
        };

        for ( var j = 0; j < data[i].results.length; j++ ) {
            if ( data[i].results[j].notifications ) {
                var notifications = data[i].results[j].notifications;
                if ( notifications.warning ) {
                    all.notifications.warning  += notifications.warning;
                    page.notifications.warning += notifications.warning;
                }
                if ( notifications.error ) {
                    all.notifications.error  += notifications.error;
                    page.notifications.error += notifications.error;
                }
                if ( notifications.success ) {
                    all.notifications.success  += notifications.success;
                    page.notifications.success += notifications.success;
                }
            }            
            page.results.push({
                'title'    : data[i].results[j].title,
                'subtitle' : data[i].results[j].subtitle,
                'result'   : data[i].results[j].result
            });
        }

        all.result.push( page );
    }

    // TODO:
    // We need a better way to find and mark the ajax
    // button & panel, this makes a seriously bad 
    // assumption.
    // - SL

    var ajax_button = this.toolbar.buttons[ this.toolbar.buttons.length -1 ];
    var ajax_panel  = this.panels.panels[ this.panels.panels.length -1 ];

    ajax_button.trigger( 'plack-debugger.ui.toolbar.button:update', all );
    ajax_panel.trigger(  'plack-debugger.ui.panels.panel:update', all );    
}

Plack.Debugger.UI.prototype._load_data_error = function ( e, error ) {
    e.stopPropagation();
    alert("Sorry, we are unable to load the debugging data at the moment, please try again in a few moments.");
}

Plack.Debugger.UI.prototype._open_toolbar = function ( e ) {
    e.stopPropagation();
    this.collapsed.trigger('plack-debugger.ui._:hide', 'slow');
    this.toolbar.trigger('plack-debugger.ui._:show',   'slow');
    this.panels.trigger('plack-debugger.ui._:hide'); // re-hide the panels
}

Plack.Debugger.UI.prototype._close_toolbar = function ( e ) {
    e.stopPropagation();
    this.panels.trigger('plack-debugger.ui._:hide');
    this.toolbar.trigger('plack-debugger.ui._:hide',   'slow');
    this.collapsed.trigger('plack-debugger.ui._:show', 'slow');
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
        '<div class="pdb-collapsed"><div class="pdb-open-button">&#9756;</div></div>'
    ).find('.pdb-collapsed');
    this.register();
}

Plack.Debugger.UI.Collapsed.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Collapsed.prototype.register = function () {
    // fire events
    this.$element.find('.pdb-open-button').click( 
        this.trigger.bind( this, 'plack-debugger.ui.toolbar:open' ) 
    );

    // register for events we handle
    this.on( 'plack-debugger.ui._:hide', this.hide.bind( this ) );
    this.on( 'plack-debugger.ui._:show', this.show.bind( this ) );
}

/* =============================================================== */

Plack.Debugger.UI.Toolbar = function ( $parent ) {
    this.$element = $parent.append(
        '<div class="pdb-toolbar">' 
            + '<div class="pdb-header">'
                + '<div class="pdb-close-button">&#9758;</div>'
            + '</div>'
            + '<div class="pdb-buttons"></div>'
        + '</div>'
    ).find('.pdb-toolbar');
    this.register();

    this.buttons = [];
}

Plack.Debugger.UI.Toolbar.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Toolbar.prototype.register = function () {
    // fire events
    this.$element.find('.pdb-header .pdb-close-button').click( 
        this.trigger.bind( this, 'plack-debugger.ui.toolbar:close' ) 
    );

    // register for events we handle
    this.on( 'plack-debugger.ui._:hide', this.hide.bind( this ) );
    this.on( 'plack-debugger.ui._:show', this.show.bind( this ) );
}

Plack.Debugger.UI.Toolbar.prototype.add_button = function ( data ) {
    var button = new Plack.Debugger.UI.Toolbar.Button( this.$element.find('.pdb-buttons') );
    button.trigger( 'plack-debugger.ui.toolbar.button:update', data );
    this.buttons.push( button );
}

// ------------------------------------------------------------------

Plack.Debugger.UI.Toolbar.Button = function ( $parent ) {
    this.$element = $parent.append(
        '<div class="pdb-button">'
            + '<div class="pdb-notifications">'
                + '<div class="pdb-badge pdb-warning"></div>'
                + '<div class="pdb-badge pdb-error"></div>'
                + '<div class="pdb-badge pdb-success"></div>'
            + '</div>'
            + '<div class="pdb-title"></div>'
            + '<div class="pdb-subtitle"></div>'
        + '</div>'
    ).find('.pdb-button').last();
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
        this.$element.find('.pdb-title').html( data.title );
    }

    if ( data.subtitle ) {
        this.$element.find('.pdb-subtitle').html( data.subtitle ).show();
    }  

    if ( data.notifications ) {
        if ( data.notifications.warning > 0 ) {
            this.$element.find('.pdb-notifications .pdb-warning').html( data.notifications.warning ).show();
        }
        else {
            this.$element.find('.pdb-notifications .pdb-warning').html('').hide();
        }

        if ( data.notifications.error > 0 ) {
            this.$element.find('.pdb-notifications .pdb-error').html( data.notifications.error ).show();
        } 
        else {
            this.$element.find('.pdb-notifications .pdb-error').html('').hide();
        }

        if ( data.notifications.success > 0 ) {
            this.$element.find('.pdb-notifications .pdb-success').html( data.notifications.success ).show();
        }
        else {
            this.$element.find('.pdb-notifications .pdb-success').html('').hide();
        }
    } 
    else {
        this.$element.find('.pdb-notifications .pdb-badge').html('').hide();
    }
}

/* =============================================================== */

Plack.Debugger.UI.Panels = function ( $parent ) {
    this.$element = $parent.append(
        '<div class="pdb-panels"></div>'
    ).find('.pdb-panels');
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
    this.$element.find('.pdb-panel:visible').hide(); // hide any strays
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
        '<div class="pdb-panel">'
            + '<div class="pdb-header">'
                + '<div class="pdb-close-button">&#9746;</div>'
                + '<div class="pdb-notifications">'
                    + '<div class="pdb-badge pdb-warning">warnings (<span></span>)</div>'
                    + '<div class="pdb-badge pdb-error">errors (<span></span>)</div>'
                    + '<div class="pdb-badge pdb-success">success (<span></span>)</div>'
                + '</div>'
                + '<div class="pdb-title"></div>'
                + '<div class="pdb-subtitle"></div>'
            + '</div>'
            + '<div class="pdb-content"></div>'
        + '</div>'
    ).find('.pdb-panel').last();
    this.register();
}

Plack.Debugger.UI.Panels.Panel.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Panels.Panel.prototype.register = function () {
    // fire events
    this.$element.find('.pdb-header .pdb-close-button').click( 
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
        this.$element.find('.pdb-header .pdb-title').html( data.title );
    }

    if ( data.subtitle ) {
        this.$element.find('.pdb-header .pdb-subtitle').html( data.subtitle );
    } 

    if ( data.notifications ) {
        if ( data.notifications.warning > 0 ) {
            var e = this.$element.find('.pdb-header .pdb-notifications .pdb-warning');
            e.find('span').html( data.notifications.warning );
            e.show();
        }
        else {
            var e = this.$element.find('.pdb-header .pdb-notifications .pdb-warning');
            e.find('span').html('');
            e.hide();
        }

        if ( data.notifications.error > 0 ) {
            var e = this.$element.find('.pdb-header .pdb-notifications .pdb-error');
            e.find('span').html( data.notifications.error );
            e.show();
        } 
        else {
            var e = this.$element.find('.pdb-header .pdb-notifications .pdb-error');
            e.find('span').html('');
            e.hide();
        }

        if ( data.notifications.success > 0 ) {
            var e = this.$element.find('.pdb-header .pdb-notifications .pdb-success');
            e.find('span').html( data.notifications.success );
            e.show();
        }
        else {
            var e = this.$element.find('.pdb-header .pdb-notifications .pdb-success');
            e.find('span').html('');
            e.hide();
        }
    }
    else {
        var e = this.$element.find('.pdb-header .pdb-notifications .pdb-badge');
        e.find('span').html('');
        e.hide();
    }

    if ( data.result ) {
        // TODO - add formatter ...
        this.$element.find('.pdb-content').html( generate_data_for_panel( data.result ) );
    }
}

/* =============================================================== */

var plack_debugger = new Plack.Debugger().ready(function () {
    console.log('... ready to debug some stuff!');

    this.resource.trigger( 'plack-debugger.resource.request:load' );
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


