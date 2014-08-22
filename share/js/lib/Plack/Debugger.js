// ===================================================== //

// setup our base namespace
if ( Plack == undefined ) var Plack = {};

// ----------------------------------------------------- //
// Main Debugger object, all things spring from here ...
// ----------------------------------------------------- //

Plack.Debugger = function () {    
    this.UI   = null;
    this.AJAX = null

    // ... private data 
    this._results_cache      = { "page" : null, "subrequests" : [] };    
    this._subrequest_counter = 0;
    this._subrequest_UI      = { "button" : null, "panel" : null }; 
}

// getting things ready ...

Plack.Debugger.prototype.ready = function (callback) {
    var self = this;
    if ( typeof jQuery == 'undefined' ) {
        __LOAD_STATIC_JS__( "/jquery.js", function () { 
            jQuery(document).ready(function () { self._get_ready( jQuery, callback ) }) 
        });
    } else {
        jQuery(document).ready(function () { self._get_ready( jQuery, callback ) });
    }
}

Plack.Debugger.prototype._get_ready = function ( $, callback ) {
    this.UI   = new Plack.Debugger.UI( $(document.body) );
    this.AJAX = new Plack.Debugger.AJAX( $ );

    // setup AJAX handler
    var self = this;
    this.AJAX.register_global_handlers({ 
        "send"     : function (e, xhr, settings) { self._handle_AJAX_send(e, xhr, settings)     },     
        "complete" : function (e, xhr, settings) { self._handle_AJAX_complete(e, xhr, settings) },     
        "error"    : function (e, xhr, settings) { self._handle_AJAX_error(e, xhr, settings)    }         
    });

    callback.apply( this, [] );
}

// methods ...

Plack.Debugger.prototype.load_request_by_id = function ( request_uid ) {
    var self = this;
    self._clear_cache();
    self.AJAX
        .load_JSON( $CONFIG.root_url + "/" + request_uid )
        .then(function ( result ) {
        
            self._cache_page_result( result );

            $.each( result.data.results, function (i, panel) {
                self.UI.setup_panel( i, panel, generate_data_for_panel );
            });

            self.UI.setup_panel( 
                result.data.results.length, 
                {
                    "title"         : "AJAX Subrequests",
                    "notifications" : {
                        "error"   : 0,
                        "warning" : 0,
                        "success" : 0
                    }
                },
                generate_data_for_panel 
            );

            self._subrequest_UI["button"] = self.UI.toolbar.get_button_by_id( result.data.results.length );
            self._subrequest_UI["panel"]  = self.UI.content.get_panel_by_id( result.data.results.length );

            self._subrequest_UI["button"].show_all_notifications();
            self._subrequest_UI["panel"].show_all_notifications();
        });
}

// AJAX handlers ...

Plack.Debugger.prototype._handle_AJAX_send = function (e, xhr, options) {
    xhr.setRequestHeader( 'X-Plack-Debugger-Parent-Request-UID', this._results_cache.page.data.request_uid );
    this._subrequest_counter++; 
}

Plack.Debugger.prototype._handle_AJAX_complete = function (e, xhr, options) {
    if ( this._are_there_uncached_subrequests() ) {
        var self = this;
        self.AJAX
            .load_JSON( this._results_cache.page.links[1].url)
            .then(function (res) {

                self._cache_subrequest_results( res );

                var $content_area = self._subrequest_UI["panel"].$root.find(".content");
                $content_area.html('');

                var all_subrequest_notification_totals = { "success" : 0, "error" : 0, "warning" : 0 };

                // looping through all the subrequests
                $.each( res.data, function (i, subrequest) {

                    var subpanels = '';

                    // need totals for all subrequests
                    var subrequest_notification_totals = { "success" : 0, "error" : 0, "warning" : 0 };

                    $.each( subrequest.results, function (j, results) {
                        if ( results.notifications ) {
                            subrequest_notification_totals.error   += results.notifications.error;
                            subrequest_notification_totals.warning += results.notifications.warning;
                            subrequest_notification_totals.success += results.notifications.success;

                            all_subrequest_notification_totals.error   += results.notifications.error;
                            all_subrequest_notification_totals.warning += results.notifications.warning;
                            all_subrequest_notification_totals.success += results.notifications.success;
                        }

                        subpanels += '<div class="subpanel">'
                            + '<h3>' + results.title + '</h3>'
                            + '<h4>' + results.subtitle + '</h4>'
                            + '<div>' + generate_data_for_panel( results.result ) + '</div>'
                        + '</div>';
                    });

                    $content_area.append(
                        '<div class="subrequest-content">' 
                            + '<div class="subheader">'
                                + '<div class="notifications">'
                                    + '<div class="badge warning">' + subrequest_notification_totals.warning + '</div>'
                                    + '<div class="badge error">'   + subrequest_notification_totals.error   + '</div>'
                                    + '<div class="badge success">' + subrequest_notification_totals.success + '</div>'
                                + '</div>'
                                + '<div class="title">' 
                                    + subrequest.request_uid 
                                + '</div>'
                            + '</div>'
                            + '<div class="subpanels">'
                                + subpanels
                            + '</div>' 
                        + '</div>' 
                    );

                    self._subrequest_UI["button"].$root.find(".notifications .error").text( all_subrequest_notification_totals.error );
                    self._subrequest_UI["panel"].$root.find(".header .notifications .error > span").text( all_subrequest_notification_totals.error );

                    self._subrequest_UI["button"].$root.find(".notifications .warning").text( all_subrequest_notification_totals.warning );
                    self._subrequest_UI["panel"].$root.find(".header .notifications .warning > span").text( all_subrequest_notification_totals.warning );

                    self._subrequest_UI["button"].$root.find(".notifications .success").text( all_subrequest_notification_totals.success );
                    self._subrequest_UI["panel"].$root.find(".header .notifications .success > span").text( all_subrequest_notification_totals.success );                
                });

                $content_area.find(".subrequest-content .title").click(function () {
                    var $e = $(this).parent().parent().find(".subpanels");
                    if ( $e.css('display') == 'none' ) {
                        $e.show();
                    } else {
                        $e.hide();
                    }
                });

            });
    }        
}

Plack.Debugger.prototype._handle_AJAX_error = function (e, xhr, options) {
        
}

// caching ...

Plack.Debugger.prototype._clear_cache = function () {
    this._results_cache.page        = null;
    this._results_cache.subrequests = [];
}

Plack.Debugger.prototype._cache_page_result = function ( res ) {
    this._results_cache.page = res
}

Plack.Debugger.prototype._cache_subrequest_results = function ( res ) {
    this._results_cache.subrequests = res
}

Plack.Debugger.prototype._are_there_uncached_subrequests = function () {
    return this._subrequest_counter != this._results_cache.subrequests.length     
}

// ===================================================== //

Plack.Debugger.AJAX = function ( $root ) {
    this.$root = $root;
}

Plack.Debugger.AJAX.prototype.load_JSON = function ( url ) {
    return this.$root.ajax({
        dataType : "json",
        url      : url,
        global   : false
    });
}

Plack.Debugger.AJAX.prototype.register_global_handlers = function ( handlers ) {
    for ( type in handlers ) {
        switch ( type.toLowerCase() ) {
            case 'send':
                this.$root(document).ajaxSend( handlers[ type ] );
                break;
            case 'start':
                this.$root(document).ajaxStart( handlers[ type ] );
                break;
            case 'stop':
                this.$root(document).ajaxStop( handlers[ type ] );
                break;
            case 'success':
                this.$root(document).ajaxSuccess( handlers[ type ] );
                break;
            case 'complete':
                this.$root(document).ajaxComplete( handlers[ type ] );
                break;
            case 'error':
                this.$root(document).ajaxError( handlers[ type ] );
                break;
            default:
                throw "I have no idea what " + type + " is???";
        }
    }
}

// ===================================================== //

Plack.Debugger.UI = function ( $root ) {
    this.$root = $root;
    
    this.$root.append(
        '<style type="text/css">' 
            + '@import url(' + $CONFIG.static_url + '/css/toolbar.css);'
        + '</style>'
        + '<div id="plack-debugger">' 
            + '<div class="collapsed">' 
                + '<div class="open-button">&#9756;</div>'
            + '</div>'
            + '<div class="toolbar">' 
                + '<div class="header">'
                    + '<div class="close-button">&#9758;</div>'
                + '</div>'
                + '<div class="buttons"></div>'
            + '</div>'
            + '<div class="panels"></div>'
        + '</div>'
    );

    this.collapsed = new Plack.Debugger.UI.Collapsed ( this.$root.find("#plack-debugger .collapsed"), this );
    this.content   = new Plack.Debugger.UI.Content   ( this.$root.find("#plack-debugger .panels"),    this );
    this.toolbar   = new Plack.Debugger.UI.Toolbar   ( this.$root.find("#plack-debugger .toolbar"),   this );
}


Plack.Debugger.UI.prototype.setup_panel = function ( id, panel, formatter ) {
    this.toolbar.add_new_button( id, panel );
    this.content.add_new_panel( id, panel, formatter );    
}

// ----------------------------------------------------- //

Plack.Debugger.UI.AbstractElement = function () { // ( $root, parent )
    this.$root  = null;
    this.parent = null;
}

Plack.Debugger.UI.AbstractElement.prototype.hide = function () { if ( this.$root ) { this.$root.hide() } } 
Plack.Debugger.UI.AbstractElement.prototype.show = function () { if ( this.$root ) { this.$root.show() } } 

// ----------------------------------------------------- //

Plack.Debugger.UI.Collapsed = function ( $root, parent ) {
    this.$root  = $root;
    this.parent = parent;
    this._init();
}

Plack.Debugger.UI.Collapsed.prototype = new Plack.Debugger.UI.AbstractElement();

Plack.Debugger.UI.Collapsed.prototype._init = function () {
    var self = this;
    this.$root.find(".open-button").click(function () {
        self.hide();        
        self.parent.toolbar.show();
    });
}

// ----------------------------------------------------- //

Plack.Debugger.UI.Toolbar = function ( $root, parent ) {
    this.$root  = $root;
    this.parent = parent;
    this._init();
}

Plack.Debugger.UI.Toolbar.prototype = new Plack.Debugger.UI.AbstractElement();

Plack.Debugger.UI.Toolbar.prototype._init = function () {
    this._button_id_prefix = "plack-debugger-button-";
    this._buttons          = {};

    var self = this;
    this.$root.find(".close-button").click(function () {
        self.parent.content.hide();
        self.parent.content.hide_all_panels();
        self.hide();        
        self.parent.collapsed.show();
    });
}

Plack.Debugger.UI.Toolbar.prototype.get_button_by_id = function ( id ) { return this._buttons[ id ] }

Plack.Debugger.UI.Toolbar.prototype.add_new_button = function ( id, panel ) {
    var self       = this;
    var new_button = new Plack.Debugger.UI.Toolbar.Button( 
        (self._button_id_prefix + id), 
        panel, 
        function () {
            self.parent.content.hide_all_panels();
            self.parent.content.get_panel_by_id( 
                $(this).attr("id").slice( self._button_id_prefix.length ) 
            ).show(); 
            self.parent.content.show();
        }
    );
    this.$root.find(".buttons").append( new_button.$root );
    this._buttons[ id ] = new_button;
}

// ----------------------------------------------------- //

Plack.Debugger.UI.Content = function ( $root, parent ) {
    this.$root  = $root;
    this.parent = parent;
    this._init();
}

Plack.Debugger.UI.Content.prototype = new Plack.Debugger.UI.AbstractElement();

Plack.Debugger.UI.Content.prototype._init = function () {
    this._panel_id_prefix = "plack-debugger-panel-";
    this._panels          = {};
}

// ...

Plack.Debugger.UI.Content.prototype.hide_all_panels = function () { this.$root.find('.panel').hide() }
Plack.Debugger.UI.Content.prototype.get_panel_by_id = function ( id ) { return this._panels[ id ] }

Plack.Debugger.UI.Content.prototype.add_new_panel = function ( id, panel, result_formatter ) {
    var self      = this;
    var new_panel = new Plack.Debugger.UI.Content.Panel( 
        (self._panel_id_prefix + id), 
        panel, 
        function () {
            self.get_panel_by_id( id ).hide();
            self.hide();
        }, 
        result_formatter 
    );

    this.$root.append( new_panel.$root );

    this._panels[ id ] = new_panel;
}

// ----------------------------------------------------- //

Plack.Debugger.UI.Toolbar.Button = function ( id, panel, on_click ) {
    this._init( id, panel, on_click );
}

Plack.Debugger.UI.Toolbar.Button.prototype._init = function ( id, panel, on_click ) {
    this.$root = jQuery(
        '<div class="button" id="' + id + '">'
            + '<div class="notifications">'
                + ((panel.notifications != undefined)
                    ? ('<div class="badge ' + ((panel.notifications.warning <= 0) ? 'hidden ' : '') + 'warning">' + panel.notifications.warning + '</div>'
                      +'<div class="badge ' + ((panel.notifications.error   <= 0) ? 'hidden ' : '') + 'error">'   + panel.notifications.error   + '</div>'
                      +'<div class="badge ' + ((panel.notifications.success <= 0) ? 'hidden ' : '') + 'success">' + panel.notifications.success + '</div>') 
                    : '')
            + '</div>'
            + '<div class="title">' + panel.title + '</div>'
            + ((panel.subtitle != undefined) ? '<div class="subtitle">' + panel.subtitle + '</div>' : '')
        + '</div>'
    );

    this.$root.click( on_click );
}

Plack.Debugger.UI.Toolbar.Button.prototype.show_all_notifications = function () {
    this.$root.find(".notifications .badge").show();
}

Plack.Debugger.UI.Toolbar.Button.prototype.set_notifications = function ( notifications ) {
    this.$root.find(".notifications .warning").text( notifications.warning );
    this.$root.find(".notifications .error  ").text( notifications.error   );
    this.$root.find(".notifications .success").text( notifications.success );
}

// ----------------------------------------------------- //

Plack.Debugger.UI.Content.Panel = function ( id, panel, on_close, formatter ) {
    this._init( id, panel, on_close, formatter );
}

Plack.Debugger.UI.Content.Panel.prototype = new Plack.Debugger.UI.AbstractElement();

Plack.Debugger.UI.Content.Panel.prototype._init = function ( id, panel, on_close, formatter ) {
    this.$root = jQuery(
        '<div class="panel" id="' + id + '">'
            + '<div class="header">'
                + '<div class="close-button">&#9746;</div>'
                + '<div class="notifications">'
                    + ((panel.notifications != undefined)
                        ? ('<div class="badge ' + ((panel.notifications.warning <= 0) ? 'hidden ' : '') + 'warning">warnings (<span>' + panel.notifications.warning + '</span>)</div>'
                          +'<div class="badge ' + ((panel.notifications.error   <= 0) ? 'hidden ' : '') + 'error">errors (<span>'     + panel.notifications.error   + '</span>)</div>'
                          +'<div class="badge ' + ((panel.notifications.success <= 0) ? 'hidden ' : '') + 'success">success (<span>'  + panel.notifications.success + '</span>)</div>')
                        : '')
                + '</div>'
                + '<div class="title">' + panel.title + '</div>'
                + ((panel.subtitle != undefined) ? '<div class="subtitle">' + panel.subtitle + '</div>' : '')
            + '</div>'
            + '<div class="content">'
                + formatter( panel.result )
            + '</div>'
        + '</div>'
    );

    this.$root.find(".header > .close-button").click( on_close );
}

Plack.Debugger.UI.Content.Panel.prototype.show_all_notifications = function () {
    this.$root.find(".header .notifications .badge").show();
}

Plack.Debugger.UI.Content.Panel.prototype.set_notifications = function ( notifications ) {
    this.$root.find(".header .notifications .warning > span").text( notifications.warning );
    this.$root.find(".header .notifications .error   > span").text( notifications.error   );
    this.$root.find(".header .notifications .success > span").text( notifications.success );
}

// ===================================================== //
