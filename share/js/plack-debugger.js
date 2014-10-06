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
    this.UI       = new Plack.Debugger.UI( $jQuery(document.body), this, "resource" );
    this.resource = new Plack.Debugger.Resource( $jQuery, this, "UI" );

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
    // don't send events if they are not tracking them
    if ( this.resource.is_AJAX_tracking_enabled() ) {
        this.resource.trigger('plack-debugger._:ajax-send');
    }
}

Plack.Debugger.prototype._handle_AJAX_complete = function (e, xhr, options) {
    if ( this.resource.is_AJAX_tracking_enabled() ) {
        this.resource.trigger('plack-debugger._:ajax-complete');
    }
}

/* =============================================================== */

// NOTE:
// as we find more and more silly jQUery back-compat issues
// this is the namespace to put the shims we need to fix 
// them and move on with our lives.
// - SL

Plack.Debugger.Util = {
    index_of : function ( $element, array ) {
        var idx      = -1; 
        var $siblings = $element.parent().children();
        for ( var i = 0; i < $siblings.length; i++ ) {
            if ( $siblings[i] === $element[0] ) {
                idx = i;
                break;
            }
        }
        return idx;
    }
};

/* =============================================================== */

Plack.Debugger.Abstract = {};

// ----------------------------------------------------------------
// basic event handling object

Plack.Debugger.Abstract.Eventful = function () {}

Plack.Debugger.Abstract.Eventful.prototype.register = function () { 
    throw new Error('[Abstract Method] you must define a `register` method'); 
}

Plack.Debugger.Abstract.Eventful.prototype.setup_target = function ( $parent, $target ) { 
    this.$parent = $parent;
    this.$target = $target;
}

Plack.Debugger.Abstract.Eventful.prototype.locate_target = function ( $parent, $target ) { 
    if ( this.$parent &&  this.$target ) return this.$parent[ this.$target ];
    if ( this.$parent && !this.$target ) return this.$parent;
    throw new Error("Cannot locate the $target");
}

Plack.Debugger.Abstract.Eventful.prototype.trigger = function ( e, data, options ) { 
    //console.log([ "... triggering " + e + " on ", this, data, options ]);
    //console.trace();
    if ( this._callbacks      == undefined ) return; // handle no events (yet)
    if ( this._callbacks[ e ] == undefined ) {
        //console.log(["... attempting to bubble " + e + " on ", this, data, options ]);
        // not handling this specific event, so ...
        if ( options != undefined && options.bubble ) {
            // ... attempt to bubble the event to the target 
            this.locate_target().trigger( e, data, options );
        }
        else {
            //for (var x in this._callbacks) {
            //    console.log( "... we have " + x + " in callback set" );
            //}
            //console.trace();
            throw new Error("[Unhandled event] This object does not handle event(" + e + ") ... and bubbling was not requested");
        }
    }
    else {
        // otherwise we know we can handle this event, so do it ...
        var self = this;
        // and do it asynchronously ... 
        setTimeout(function () {
            var cbs = self._callbacks[ e ];     
            for ( var i = 0; i < cbs.length; i++ ) {
                cbs[i].apply( self, [ data ] )
            }
        }, 0);
    }
}

// register events ...

Plack.Debugger.Abstract.Eventful.prototype.on = function ( e, cb ) { 
    if ( this._callbacks      == undefined ) this._callbacks = {};
    if ( this._callbacks[ e ] == undefined ) this._callbacks[ e ] = [];
    //console.log([ "registering event: " + e + " on ", this, cb ]);
    this._callbacks[ e ].push( cb );
    if ( this._callbacks[ e ].length > 1 ) {
        throw new Error ("Got more than one event registered for: " + e);
    }
}

// unregister events ...

Plack.Debugger.Abstract.Eventful.prototype.off = function ( e ) { 
    if ( this._callbacks      == undefined ) return;
    if ( this._callbacks[ e ] == undefined ) return;
    //console.log(["un-registering event: " + e + " on ", this ]);
    delete this._callbacks[ e ];
}

// ----------------------------------------------------------------
// simple UI object to handle common events 

Plack.Debugger.Abstract.UI = function () {
    this.$element = null;
}

Plack.Debugger.Abstract.UI.prototype = new Plack.Debugger.Abstract.Eventful();

Plack.Debugger.Abstract.UI.prototype.is_hidden = function ( e ) { 
    if (this.$element == null) {
        throw new Error("It is not possible to know if a null $element is hidden, stop asking!");
    }
    return this.$element.is(':hidden');
}

Plack.Debugger.Abstract.UI.prototype.hide = function ( duration ) {  
    if ( this.$element != null ) this.$element.hide( duration );
}

Plack.Debugger.Abstract.UI.prototype.show = function ( duration ) {  
    if ( this.$element != null ) this.$element.show( duration );
}

/* =============================================================== */

Plack.Debugger.Resource = function ( $jQuery, $parent, $target ) {
    this.$jQuery = $jQuery; // the root jQuery object, for Ajax stuff

    this._request          = null;
    this._subrequests      = [];
    this._subrequest_count = 0;
    this._AJAX_tracking    = false;

    this.register();
    this.setup_target( $parent, $target );
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

Plack.Debugger.Resource.prototype._load_request = function () {
    this.$jQuery.ajax({
        'dataType' : 'json',
        'url'      : (Plack.Debugger.$CONFIG.root_url + '/' + Plack.Debugger.$CONFIG.current_request_uid),
        'global'   : false,
        'success'  : this._update_target_on_request_success.bind( this ),
        'error'    : this._update_target_on_error.bind( this ),
    });
}

Plack.Debugger.Resource.prototype._load_subrequests = function () {
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
    this.trigger( 'plack-debugger.ui:load-request', response.data.results, { bubble : true } );

    // once the target is updated, we can 
    // just start to ignore the event 
    this.off( 'plack-debugger.resource.request:load' );

    this._request = response;
}

Plack.Debugger.Resource.prototype._update_target_on_subrequest_success = function ( response, status, xhr ) {
    this.trigger( 'plack-debugger.ui:load-subrequests', response.data, { bubble : true } );
    this._subrequests = response;
}

Plack.Debugger.Resource.prototype._update_target_on_error = function ( xhr, status, error ) {
    this.trigger( 'plack-debugger.ui:load-error', error, { bubble : true } );
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

Plack.Debugger.UI = function ( $jQuery, $parent, $target ) {
    this.$element = $jQuery.append(
        '<style type="text/css">' 
            + '@import url(' + Plack.Debugger.$CONFIG.static_url + '/css/plack-debugger.css);' 
        + '</style>' 
        + '<div id="plack-debugger"></div>'
    ).find('#plack-debugger');

    this.collapsed = new Plack.Debugger.UI.Collapsed( this.$element, this );
    this.toolbar   = new Plack.Debugger.UI.Toolbar( this.$element, this );
    this.panels    = new Plack.Debugger.UI.Panels( this.$element, this );
    
    this.register();   
    this.setup_target( $parent, $target );
}

Plack.Debugger.UI.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.prototype.register = function () {
    // fire events
    var self = this;
    this.$element.parent().keyup(function ( e ) {
        if (e.keyCode == 27) { 
            e.stopPropagation();
            (self.toolbar.is_hidden()) 
                ? self._open_toolbar()
                : self._close_toolbar();
        }
    });

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

Plack.Debugger.UI.prototype._load_request = function ( data ) {
    // load the data into the various places 
    for ( var i = 0; i < data.length; i++ ) {

        var button = this.toolbar.add_button( data[i] );
        var panel  = this.panels.add_panel( data[i] );

        // handle metadata ...
        if ( data[i].metadata ) {

            // turn on AJAX tracking ...
            if ( data[i].metadata.track_subrequests ) {
                this.trigger( 'plack-debugger._:ajax-tracking-enable', null, { bubble : true } );
            }

        }
    }
}

Plack.Debugger.UI.prototype._load_subrequests = function ( data ) {

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

Plack.Debugger.UI.prototype._load_data_error = function ( error ) {
    alert("Sorry, we are unable to load the debugging data at the moment, please try again in a few moments.");
}

Plack.Debugger.UI.prototype._open_toolbar = function () {
    this.collapsed.trigger('plack-debugger.ui._:hide');
    this.toolbar.trigger('plack-debugger.ui._:show');
    if ( this.panels.active_panel ) {
        this.panels.trigger('plack-debugger.ui._:show');
    }
}

Plack.Debugger.UI.prototype._close_toolbar = function () {
    this.panels.trigger('plack-debugger.ui._:hide');
    this.toolbar.trigger('plack-debugger.ui._:hide');
    this.collapsed.trigger('plack-debugger.ui._:show');
}

Plack.Debugger.UI.prototype._open_panels = function ( index ) {
    this.panels.trigger('plack-debugger.ui.panels.panel:open', index);
}

Plack.Debugger.UI.prototype._close_panels = function ( index ) {
    this.panels.trigger('plack-debugger.ui.panels.panel:close', index);
}

/* =============================================================== */

Plack.Debugger.UI.Collapsed = function ( $jQuery, $parent ) {
    this.$element = $jQuery.append(
        '<div class="pdb-collapsed"><div class="pdb-open-button">&#9776;</div></div>'
    ).find('.pdb-collapsed');
    this.register();
    this.setup_target( $parent );
}

Plack.Debugger.UI.Collapsed.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Collapsed.prototype.register = function () {
    // fire events
    var self = this;
    this.$element.find('.pdb-open-button').click(function (e) {
        e.stopPropagation()
        self.trigger( 'plack-debugger.ui.toolbar:open', null, { bubble : true } );
    });

    // register for events we handle
    this.on( 'plack-debugger.ui._:hide', this.hide.bind( this ) );
    this.on( 'plack-debugger.ui._:show', this.show.bind( this ) );
}

/* =============================================================== */

Plack.Debugger.UI.Toolbar = function ( $jQuery, $parent ) {
    this.$element = $jQuery.append(
        '<div class="pdb-toolbar">' 
            + '<div class="pdb-header">'
                + '<div class="pdb-close-button">&#9776;</div>'
            + '</div>'
            + '<div class="pdb-buttons"></div>'
        + '</div>'
    ).find('.pdb-toolbar');
    this.register();
    this.setup_target( $parent );

    this.buttons = [];
}

Plack.Debugger.UI.Toolbar.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Toolbar.prototype.register = function () {
    // fire events
    var self = this;
    this.$element.find('.pdb-header .pdb-close-button').click(function ( e ) { 
        e.stopPropagation();
        self.trigger( 'plack-debugger.ui.toolbar:close', null, { bubble : true } ) 
    });

    // register for events we handle
    this.on( 'plack-debugger.ui._:hide', this.hide.bind( this ) );
    this.on( 'plack-debugger.ui._:show', this.show.bind( this ) );
}

Plack.Debugger.UI.Toolbar.prototype.add_button = function ( data ) {
    var button = new Plack.Debugger.UI.Toolbar.Button( this.$element.find('.pdb-buttons'), this );
    button.trigger( 'plack-debugger.ui.toolbar.button:update', data );
    this.buttons.push( button );
    return button;
}

// ------------------------------------------------------------------

Plack.Debugger.UI.Toolbar.Button = function ( $jQuery, $parent ) {
    this.$element = $jQuery.append(
        '<div class="pdb-button">'
            + '<div class="pdb-notifications">'
                + '<div class="pdb-badge pdb-warning"></div>'
                + '<div class="pdb-badge pdb-error"></div>'
                + '<div class="pdb-badge pdb-success"></div>'
            + '</div>'
            + '<div class="pdb-title"></div>'
            + '<div class="pdb-subtitle"></div>'
        + '</div>'
    ).find('.pdb-button').slice(-1);

    this._metadata = {};
    this.register();
    this.setup_target( $parent );
}

Plack.Debugger.UI.Toolbar.Button.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Toolbar.Button.prototype.register = function () {
    // fire events
    var self = this;
    this.$element.click(function ( e ) { 
        e.stopPropagation();
        var idx = Plack.Debugger.Util.index_of( $(this) );
        if ( idx == -1 ) throw new Error("Could not find the index of this element");
        self.trigger( 'plack-debugger.ui.panels:open', idx, { bubble : true } ) 
    });

    // register for events we handle
    this.on( 'plack-debugger.ui.toolbar.button:update', this._update.bind( this ) );
}

Plack.Debugger.UI.Toolbar.Button.prototype.metadata = function ( key ) {
    return this._metadata[ key ];
}

Plack.Debugger.UI.Toolbar.Button.prototype.is_tracking_subrequests = function () {
    return this._metadata.track_subrequests ? true : false
}

Plack.Debugger.UI.Toolbar.Button.prototype._update = function ( data ) {

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

Plack.Debugger.UI.Panels = function ( $jQuery, $parent ) {
    this.$element = $jQuery.append(
        '<div class="pdb-panels"></div>'
    ).find('.pdb-panels');
    this.register();
    this.setup_target( $parent );

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
    var panel = new Plack.Debugger.UI.Panels.Panel( this.$element, this );
    panel.trigger( 'plack-debugger.ui.panels.panel:update', data );
    this.panels.push( panel );
    return panel;
}

Plack.Debugger.UI.Panels.prototype._open_panel = function ( index ) {
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

Plack.Debugger.UI.Panels.prototype._close_panel = function ( index ) {
    this.trigger( 'plack-debugger.ui._:hide' );
    if ( this.active_panel ) {
        this.active_panel.trigger( 'plack-debugger.ui._:hide' );    
    }
    else {
        throw new Error('This should never happen!');
    }
}

// ------------------------------------------------------------------

Plack.Debugger.UI.Panels.Panel = function ( $jQuery, $parent ) {
    this.$element = $jQuery.append(
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
    ).find('.pdb-panel').slice(-1);

    this._metadata = {};
    this.register();
    this.setup_target( $parent );
}

Plack.Debugger.UI.Panels.Panel.prototype = new Plack.Debugger.Abstract.UI();

Plack.Debugger.UI.Panels.Panel.prototype.register = function () {
    // fire events
    var self = this;
    this.$element.find('.pdb-header .pdb-close-button').click(function ( e ) {
        e.stopPropagation();
        var idx = Plack.Debugger.Util.index_of( $(this) );
        if ( idx == -1 ) throw new Error("Could not find the index of this element");
        self.trigger( 'plack-debugger.ui.panels:close', idx, { bubble : true } ) 
    });

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

Plack.Debugger.UI.Panels.Panel.prototype._update = function ( data ) {

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
            formatter['callback'].apply( this.formatters, [ this.$element.find('.pdb-content'), data.result ] )
        }
    } 
    else {
        this.$element.find('.pdb-content').html('...');
    } 
}

// formatters for the Panel content

Plack.Debugger.UI.Panels.Panel.prototype.formatters = {
    // no formatter at all 
    pass_through : { 'formatter' : function (data) { return data } },
    // basic formatter ...
    generic_data_formatter : {
        'formatter' : function (data) {
            if (!data) return "undef";
            switch ( data.constructor ) {
                case String:
                    return data.replace(/>/g, "&gt;").replace(/</g, "&lt;")
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
    simple_data_table : {
        'formatter' : function (data) {
            if ( data.constructor != Array ) throw new Error("[Bad Formatter Args] 'simple_data_table' expected an Array");
            var out = '<table class="pdb-data-table">';
            for ( var i = 0; i < data.length; i++ ) {
                out += '<tr>';
                for ( var j = 0; j < data[i].length; j++ ) {
                    out += '<td>' + data[i][j] + '</td>';
                }
                out += '</tr>';
            }
            return out + '</table>'; 
        }
    },
    simple_data_table_w_headers : {
        'formatter' : function (data) {
            if ( data.constructor != Array ) throw new Error("[Bad Formatter Args] 'simple_data_table' expected an Array");
            var out = '<table class="pdb-data-table">';
                out += '<thead>';
                    out += '<tr>';
                    for ( var j = 0; j < data[0].length; j++ ) {
                        out += '<th>' + data[0][j] + '</th>';
                    }
                    out += '</tr>';
                out += '</thead>';
                out += '<tbody>';
                for ( var i = 1; i < data.length; i++ ) {
                    out += '<tr>';
                    for ( var j = 0; j < data[i].length; j++ ) {
                        out += '<td>' + data[i][j] + '</td>';
                    }
                    out += '</tr>';
                }
                out += '</tbody>';
            return out + '</table>'; 
        }
    },
    multiple_data_table : {
        'formatter' : function (data) {
            if ( data.constructor != Array ) throw new Error("[Bad Formatter Args] 'multiple_data_table' expected an Array");
            if ( data.length      == 2     ) throw new Error("[Bad Formatter Args] 'multiple_data_table' expected an Array w/ length of 2");
            var out = '';
            for ( var i = 0; i < data.length; i += 2 ) {
                out += '<h1>' + data[i] + '</h1>';
                out += this.simple_data_table.formatter.apply( this, [ data[ i + 1 ] ] );
                out += '<br/>'; 
            }
            return out;
        }
    },
    multiple_data_table_w_headers : {
        'formatter' : function (data) {
            if ( data.constructor != Array ) throw new Error("[Bad Formatter Args] 'multiple_data_table_w_headers' expected an Array");
            if ( data.length      == 2     ) throw new Error("[Bad Formatter Args] 'multiple_data_table_w_headers' expected an Array w/ length of 2");
            var out = '';
            for ( var i = 0; i < data.length; i += 2 ) {
                out += '<h1>' + data[i] + '</h1>';
                out += this.simple_data_table_w_headers.formatter.apply( this, [ data[ i + 1 ] ] );
                out += '<br/>'; 
            }
            return out;
        }
    },
    ordered_key_value_pairs : {
        'formatter' : function (data) {
            //console.log( data );
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
            if (!data) return '';
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
            
            $e.prepend(
                '<div class="pdb-controls">' 
                    + '<button class="pdb-control pdb-open" disabled="true">open</button>'
                    + '<button class="pdb-control pdb-close">close</button>'
                + '</div>'
            );

            $e.find('.pdb-controls .pdb-open').click(function () {
                $e.find('.pdb-value > .pdb-ulist').show();
                $(this).attr('disabled', true);
                $(this).siblings('.pdb-close').attr('disabled', false);
            });

            $e.find('.pdb-controls .pdb-close').click(function () {
                $e.find('.pdb-value > .pdb-ulist').hide();
                $(this).attr('disabled', true);
                $(this).siblings('.pdb-open').attr('disabled', false);
            });

            $e.find('.pdb-key').click(function () {
                $(this).siblings('.pdb-value').find('.pdb-ulist').eq(0).toggle();
            });
        },
        'formatter' : function ( data ) {
            var visitor = function ( d ) {
                if (!d) return "undef";
                switch ( d.constructor ) {
                    case String:
                        return '"' + d.replace(/>/g, "&gt;").replace(/</g, "&lt;") + '"';
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

            for ( var i = 0; i < data.length; i++ ) {
                for ( var j = 0; j < data[i].results.length; j++ ) {
                    var result = data[i].results[j];
                    if ( result.metadata && result.metadata.formatter ) {
                        var sub_formatter  = this[ result.metadata.formatter ];
                        if ( sub_formatter.callback ) {
                            sub_formatter.callback.apply(
                                this, 
                                [
                                    $e.find('.pdb-subrequest')
                                            .eq( i )
                                            .find('.pdb-subrequest-results .pdb-subrequest-result')
                                            .eq( j )
                                            .find('.pdb-subrequest-result-data'),
                                    result
                                ]
                            )
                        }
                    }
                }
            }
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


