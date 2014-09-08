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
    var ready_callback = function ( $jQuery ) { 
        // NOTE:
        // We need a jQuery newer then 1.7 so that 
        // we can assure stable event handling 
        // - SL
        if ( self._is_jQuery_acceptable( $jQuery, '1.7' ) ) {
            self._ready( $jQuery, callback ) 
        } else {
            throw new Error('[Bad jQuery version] The version of jQuery loaded (' + $jQuery().jquery + ') is not supported')
        }
    };

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

// NOTE:
// adapted this from here:
//    http://stackoverflow.com/questions/6832596/how-to-compare-software-version-number-using-js-only-number/6832721#6832721
// and made it more specific
// to my usage.
// - SL
Plack.Debugger.prototype._is_jQuery_acceptable = function ( $jQuery, min_version ) {
    var v1 = ('' + $jQuery().jquery).split('.');
    var v2 = ('' + min_version).split('.');

    var min_length = Math.min(v1.length, v2.length);

    for( var i = 0; i < min_length; i++ ) {
        var p1 = parseInt( v1[i], 10 );
        var p2 = parseInt( v2[i], 10 );

        if ( isNaN(p1) ) p1 = v1[i];
        if ( isNaN(p2) ) p2 = v2[i];
        
        if ( p1 == p2 ) continue;
        if ( p1 >  p2 ) return true;
        if ( p1 <  p2 ) return false;

        throw new Error(
            '[Bad jQuery version] Cannot compare jQuery versions, got: [' 
            + $jQuery().jquery 
            + ', ' 
            + min_version 
            + ']'
        );
    }
    
    if (v1.length === v2.length) return true;

    return (v1.length < v2.length) ? true : false;
}

Plack.Debugger.prototype._ready = function ( $jQuery, callback ) {
    this.UI       = new Plack.Debugger.UI( $jQuery(document.body) );
    this.resource = new Plack.Debugger.Resource( $jQuery, this.UI );

    // YAGNI (yet):
    // It might be useful to be able to capture AJAX calls
    // that are made by frameworks other then jQuery, in 
    // which case this needs to get more sophisticated. I 
    // can't easily see a need for it right now, but if 
    // there is a need, it could be done.
    // - SL

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

    this.resource.trigger( 'plack-debugger.resource.request:load' );

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
        this.$element.trigger( e, [ data ] );
    }
}

// register events ...

Plack.Debugger.Abstract.Eventful.prototype.on = function ( e, cb ) { 
    if ( this.$element != null ) {
        this.$element.on( e, cb );
    }
}

// unregister events ...

Plack.Debugger.Abstract.Eventful.prototype.off = function ( e ) { 
    if ( this.$element != null ) {
        this.$element.off( e );
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

Plack.Debugger.Abstract.UI.prototype.is_hidden = function ( e ) { 
    return this.$element.is(':hidden');
}

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
    this._AJAX_tracking    = false;

    this.register();
}

Plack.Debugger.Resource.prototype = new Plack.Debugger.Abstract.Eventful();

Plack.Debugger.Resource.prototype.register = function () {
    // register for events we handle 
    this.on( 'plack-debugger.resource.request:load',     this._load_request.bind( this ) );
    this.on( 'plack-debugger.resource.subrequests:load', this._load_subrequests.bind( this ) );

    // also catch these global events
    // ... see NOTE below by the registered 
    //     event handler functions themselves
    this.on( 'plack-debugger._:ajax-tracking-enable',  this._enable_AJAX_tracking.bind( this ) );
    this.on( 'plack-debugger._:ajax-tracking-disable', this._disable_AJAX_tracking.bind( this ) );    
}

Plack.Debugger.Resource.prototype.is_AJAX_tracking_enabled = function () {
    return this._AJAX_tracking;
}

// ... events handlers

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

// NOTE:
// These AJAX handlers are hooked to global 
// events such as:
//
//   plack-debugger._:ajax-tracking-enable
//   plack-debugger._:ajax-tracking-disable
//
// as well as then registering for the other 
// generic AJAX events. 
//
// Since these global events might want to 
// be handled elsewhere, do not stop the 
// propagation as we do in other events.
// - SL

// enable/disable AJAX tracking

Plack.Debugger.Resource.prototype._enable_AJAX_tracking = function ( e ) {
    if ( !this._AJAX_tracking ) { // don't do silly things ...
        this.on( 'plack-debugger._:ajax-send',     this._handle_ajax_send.bind( this ) );
        this.on( 'plack-debugger._:ajax-complete', this._handle_ajax_complete.bind( this ) );        
        this._AJAX_tracking = true;  
    }  
}

Plack.Debugger.Resource.prototype._disable_AJAX_tracking = function ( e ) {
    if ( this._AJAX_tracking ) { // don't do silly things ...
        this.off( 'plack-debugger._:ajax-send' );
        this.off( 'plack-debugger._:ajax-complete' );        
        this._AJAX_tracking = false;    
    }
}

// AJAX tracking event handlers

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
            + '@import url(' + Plack.Debugger.$CONFIG.static_url + '/css/plack-debugger.css);' 
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
    // fire events
    this.$element.parent().keyup( 
        this._toggle_toolbar_with_escape_key.bind( this )
    );

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

        var button = this.toolbar.add_button( data[i] );
        var panel  = this.panels.add_panel( data[i] );

        // handle metadata ...
        if ( data[i].metadata ) {

            // turn on AJAX tracking ...
            if ( data[i].metadata.track_subrequests ) {
                this.trigger( 'plack-debugger._:ajax-tracking-enable' );
            }

        }
    }
}

Plack.Debugger.UI.prototype._load_subrequests = function ( e, data ) {
    e.stopPropagation();

    // collect and collate some information on 
    // all the subrequests that have been fired
    // so that we have something to display in 
    // the panel content.

    var all = { 
        'subtitle'      : 'Number of requests made: ' + data.length,
        'notifications' : { 'warning' : 0, 'error' : 0, 'success' : 0 },
        'result'        : []
    };

    for ( var i = 0; i < data.length; i++ ) {
        var page = {
            'method'             : data[i].method,
            'uri'                : data[i].uri,               
            'timestamp'          : data[i].timestamp,               
            'request_uid'        : data[i].request_uid,
            'parent_request_uid' : data[i].parent_request_uid,
            'notifications'      : { 'warning' : 0, 'error' : 0, 'success' : 0 },
            'results'            : []
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
                'title'         : data[i].results[j].title,
                'subtitle'      : data[i].results[j].subtitle,
                'result'        : data[i].results[j].result,
                'metadata'      : data[i].results[j].metadata,
                'notifications' : data[i].results[j].notifications
            });
        }

        all.result.push( page );
    }

    $.each( this.toolbar.buttons, function (i, b) { 
        if ( b.is_tracking_subrequests() ) b.trigger( 'plack-debugger.ui.toolbar.button:update', all ) 
    });

    $.each( this.panels.panels, function (i, p) { 
        if ( p.is_tracking_subrequests() ) p.trigger( 'plack-debugger.ui.panels.panel:update', all )
    });    
}

Plack.Debugger.UI.prototype._load_data_error = function ( e, error ) {
    e.stopPropagation();
    alert("Sorry, we are unable to load the debugging data at the moment, please try again in a few moments.");
}

Plack.Debugger.UI.prototype._open_toolbar = function ( e ) {
    e.stopPropagation();
    this.collapsed.trigger('plack-debugger.ui._:hide');
    this.toolbar.trigger('plack-debugger.ui._:show');
    if ( this.panels.active_panel ) {
        this.panels.trigger('plack-debugger.ui._:show');
    }
}

Plack.Debugger.UI.prototype._close_toolbar = function ( e ) {
    e.stopPropagation();
    this.panels.trigger('plack-debugger.ui._:hide');
    this.toolbar.trigger('plack-debugger.ui._:hide');
    this.collapsed.trigger('plack-debugger.ui._:show');
}

Plack.Debugger.UI.prototype._toggle_toolbar_with_escape_key = function ( e ) {
    if (e.keyCode == 27) { 
        e.stopPropagation();
        if ( this.toolbar.is_hidden() ) {
            this._open_toolbar( e );
        }
        else {
            this._close_toolbar( e );
        }
    }
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
        '<div class="pdb-collapsed"><div class="pdb-open-button">&#9776;</div></div>'
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
                + '<div class="pdb-close-button">&#9776;</div>'
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
    return button;
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

    this._metadata = {};
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

Plack.Debugger.UI.Toolbar.Button.prototype.metadata = function ( key ) {
    return this._metadata[ key ];
}

Plack.Debugger.UI.Toolbar.Button.prototype.is_tracking_subrequests = function () {
    return this._metadata.track_subrequests ? true : false
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

    if ( data.metadata ) {
        this._metadata = data.metadata;
    }
}

/* =============================================================== */

Plack.Debugger.UI.Panels = function ( $parent ) {
    this.$element = $parent.append(
        '<div class="pdb-panels"></div>'
    ).find('.pdb-panels');
    this.register();

    this.panels       = [];
    this.active_panel = null;
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
    return panel;
}

Plack.Debugger.UI.Panels.prototype._open_panel = function ( e, index ) {
    e.stopPropagation();
    if ( this.active_panel ) {
        // close the last active panel ...
        this.active_panel.trigger( 'plack-debugger.ui._:hide' );
    }
    this.trigger( 'plack-debugger.ui._:show' );
    if ( index >= this.panels.length ) {
        throw new Error('[Invalid Event Args] there is no panel at index:' + index);
    }
    this.active_panel = this.panels[ index ];
    this.active_panel.trigger( 'plack-debugger.ui._:show' );
}

Plack.Debugger.UI.Panels.prototype._close_panel = function ( e, index ) {
    e.stopPropagation();
    this.trigger( 'plack-debugger.ui._:hide' );
    if ( this.active_panel ) {
        this.active_panel.trigger( 'plack-debugger.ui._:hide' );    
    }
    else {
        throw new Error('This should never happen!');
    }
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

    this._metadata = {};
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

Plack.Debugger.UI.Panels.Panel.prototype.metadata = function ( key ) {
    return this._metadata[ key ];
}

Plack.Debugger.UI.Panels.Panel.prototype.is_tracking_subrequests = function () {
    return this._metadata.track_subrequests ? true : false
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

    if ( data.metadata ) {
        this._metadata = data.metadata;
    }  

    if ( data.result ) {
        
        // use a special formatter if specified
        var formatter = this._metadata.formatter
            ? this.formatters[ this._metadata.formatter ]
            : this.formatters.generic_data_formatter;

        this.$element.find('.pdb-content').html( 
            // NOTE:
            // it is not uncommon for a formatter
            // to need to be recursive in some way
            // so we make `this` in the formatters
            // be the `formatters` object itself
            // so that it can recursive on itself
            // or on another formatter if needed.
            // - SL
            formatter['formatter'].apply( this.formatters, [ data.result ] ) 
        );

        if ( formatter['callback'] ) {
            formatter['callback'].apply( this.formatters, [ this.$element, data.result ] )
        }
    } 
    else {
        this.$element.find('.pdb-content').html('...');
    } 
}

// formatters for the Panel content

Plack.Debugger.UI.Panels.Panel.prototype.formatters = {
    // basic formatter ...
    generic_data_formatter : {
        'formatter' : function (data) {
            if (!data) return "undef";
            switch ( data.constructor ) {
                case String:
                case Number:
                    return data;
                case Array:
                    var out = '<table class="pdb-item-list">';
                    for (var i = 0; i < data.length; i++) {
                        out += '<tr>'                   
                            // FIXME: this code right below here is ugly and confusing 
                            + '<td class="pdb-item">' + this.generic_data_formatter.formatter.apply( this, [ data[i] ] ) + '</td>' 
                            + '</tr>';
                    }
                    return out + '</table>'; 
                case Object:
                    var out = '<table class="pdb-key-value-pairs">';
                    for (key in data) {
                        out += '<tr>' 
                            + '<td class="pdb-key">' + key + '</td>' 
                            // FIXME: this code right below here is ugly and confusing 
                            + '<td class="pdb-value">' + this.generic_data_formatter.formatter.apply( this, [ data[key] ] ) + '</td>' 
                            + '</tr>';
                    }
                    return out + '</table>';
                default:
                    throw new Error("[Bad Formatter Args] 'generic_data_formatter' expected type { String,Number,Array,Object }");
            }
        },
    },
    // some specialities ...
    ordered_key_value_pairs : {
        'formatter' : function (data) {
            if ( data.constructor != Array ) throw new Error("[Bad Formatter Args] 'ordered_key_value_pairs' expected an Array");
            if ( ( data.length % 2 ) != 0  ) throw new Error("[Bad Formatter Args] 'ordered_key_value_pairs' expected an even length Array");
            var out = '<table class="pdb-key-value-pairs">';
            for ( var i = 0; i < data.length; i += 2 ) {
                out += '<tr>' 
                    + '<td class="pdb-key">' + data[i] + '</td>' 
                    // FIXME: this code right below here is ugly and confusing 
                    + '<td class="pdb-value">' + this.generic_data_formatter.formatter.apply( this, [ data[ i + 1 ] ] ) + '</td>' 
                    + '</tr>';
            }
            return out + '</table>'; 
        }
    },
    ordered_keys_with_nested_data : {
        'callback' : function ( $e, data ) {
            // delegate ...
            this.nested_data.callback.apply( this, [ $e, data ] );
        },
        'formatter' : function ( data ) {
            if ( data.constructor != Array ) throw new Error("[Bad Formatter Args] 'ordered_nested_data' expected an Array");
            if ( ( data.length % 2 ) != 0  ) throw new Error("[Bad Formatter Args] 'ordered_nested_data' expected an even length Array");
            var out = '<ul class="pdb-ulist">';
            for ( var i = 0; i < data.length; i += 2 ) {
                out += '<li class="pdb-ulist-item">'
                        + '<span class="pdb-key">' + data[i] + '</span>' 
                        + '<span class="pdb-value">' + this.nested_data.formatter.apply( this, [ data[i + 1] ] ) + '</span>' 
                    + '</li>';
            }
            return out + '</ul>'; 
        }
    },
    nested_data : {
        'callback' : function ( $e, data ) {
            $e.find('.pdb-key').click(function () {
                $(this).siblings('.pdb-value').find('.pdb-ulist').first().toggle();
            });
        },
        'formatter' : function ( data ) {
            var visitor = function ( d ) {
                if (!d) return "undef";
                switch ( d.constructor ) {
                    case String:
                        return '"' + d + '"';
                    case Number:
                        return d;
                    case Array:
                        if (d.length == 0) return '';
                        var out = '<ul class="pdb-ulist">';
                        for ( var i = 0; i < d.length; i += 1 ) {
                            out += '<li class="pdb-ulist-item">' + visitor( d[i] ) + '</li>';
                        }
                        return out + '</ul>';
                    case Object: 
                        if (Object.keys(d).length == 0) return '';
                        var out = '<ul class="pdb-ulist">';
                        for ( var k in d ) {
                            out += '<li class="pdb-ulist-item"><span class="pdb-key">' + k + '</span><span class="pdb-value">' + visitor( d[k] ) + '</span></li>';
                        }
                        return out + '</ul>';
                    default:
                        throw new Error("[Bad Formatter Args] 'nested_data' expected type { String,Number,Array,Object }");
                }
            };
            return visitor( data );
        }
    },
    subrequest_formatter : {
        'callback' : function ( $e , data ) {
            $e.find('.pdb-subrequest-details').click(function () {
                $(this).siblings('.pdb-subrequest-results').toggle();
            });

            $e.find('.pdb-subrequest-result .pdb-subrequest-header .pdb-title').click(function () {
                $(this).parent().siblings('.pdb-subrequest-result-data').toggle();
            });
        },
        'formatter' : function (data) {
            var out = '';

            for ( var i = 0; i < data.length; i++ ) {
                out += '<div class="pdb-subrequest">'; 
                    out += '<div class="pdb-subrequest-details">' 
                            + '<div class="pdb-notifications">' 
                                + '<div class="pdb-badge pdb-warning">' + data[i].notifications.warning + '</div>'
                                + '<div class="pdb-badge pdb-error">'   + data[i].notifications.error   + '</div>'
                                + '<div class="pdb-badge pdb-success">' + data[i].notifications.success + '</div>'
                            + '</div>'
                            + '<strong>' + data[i].uri + '</strong>' 
                            + '<small>{' 
                                + ' method : ' 
                                    + data[i].method
                                + ', request-UID : ' 
                                    + data[i].request_uid 
                                + ', timestamp : '
                                    + data[i].timestamp
                                + ' }</small>'
                        + '</div>';
                    out += '<div class="pdb-subrequest-results">';
                        for ( var j = 0; j < data[i].results.length; j++ ) {
                            var result        = data[i].results[j];
                            var notifications = result.notifications;
                            out += 
                            '<div class="pdb-subrequest-result">' 
                                + '<div class="pdb-subrequest-header">' 
                                    + ((notifications) 
                                        ?  '<div class="pdb-notifications">' 
                                                + ((notifications.warning) ? '<div class="pdb-badge pdb-warning">' + notifications.warning + '</div>' : '')
                                                + ((notifications.error)   ? '<div class="pdb-badge pdb-error">'   + notifications.error   + '</div>' : '')
                                                + ((notifications.success) ? '<div class="pdb-badge pdb-success">' + notifications.success + '</div>' : '')
                                            + '</div>'
                                        : '')
                                    + '<div class="pdb-title">' + result.title    + '</div>'
                                + '</div>'
                                + '<div class="pdb-subrequest-result-data">';
                                    // FIXME: this code right below here is ugly and confusing 
                                    if ( result.metadata && result.metadata.formatter ) {
                                        out += this[ result.metadata.formatter ].formatter.apply( this, [ result.result ] );
                                    } 
                                    else {
                                        out += this.generic_data_formatter.formatter.apply( this, [ result.result ] );
                                    }
                                out += '</div>'
                            + '</div>';
                        }
                    out += '</div>';
                out += '</div>';
            }
            return out;
        }
    }
}

/* =============================================================== */

var plack_debugger = new Plack.Debugger().ready(function () {
    console.log('... ready to debug some stuff!');
});


