// ===================================================== //

// setup our base namespace
if ( Plack == undefined ) var Plack = {};

// ----------------------------------------------------- //
// Main Debugger object, all things spring from here ...
// ----------------------------------------------------- //

Plack.Debugger = function () {    
    this.request_uid         = $CONFIG.request_uid;
    this.request_results     = null;

    this.subrequest_controls = { "button" : null, "panel" : null };
    this.subrequest_count    = 0;
    this.subrequest_results  = [];

    this._init();    
};

// initializer 

Plack.Debugger.prototype._init = function () {};

// methods ...

Plack.Debugger.prototype.ready = function (callback) {
    var self = this;
    if ( typeof jQuery == 'undefined' ) {
        __LOAD_STATIC_JS__( "/jquery.js", function () { 
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

// ===================================================== //

Plack.Debugger.UI = function ( $root ) {
    this.$root = $root;

    this._init();

    this.collapsed = new Plack.Debugger.UI.Collapsed ( this.$root.find("#plack-debugger .collapsed"), this );
    this.content   = new Plack.Debugger.UI.Content   ( this.$root.find("#plack-debugger .panels"),    this );
    this.toolbar   = new Plack.Debugger.UI.Toolbar   ( this.$root.find("#plack-debugger .toolbar"),   this );
}

Plack.Debugger.UI.prototype._init = function () {
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
                    + '<div class="data">' 
                        + '<strong>uid</strong> : <a>' + $CONFIG.request_uid + '</a>' 
                    + '</div>'
                + '</div>'
                + '<div class="buttons"></div>'
            + '</div>'
            + '<div class="panels"></div>'
        + '</div>'
    );
}

// ----------------------------------------------------- //

Plack.Debugger.UI.AbstractElement = function () { // ( $root, parent )
    this.$root  = null;
    this.parent = null;
}

Plack.Debugger.UI.AbstractElement.prototype.hide = function () { if ( this.$root ) { console.log(this.$root); this.$root.hide() } } 
Plack.Debugger.UI.AbstractElement.prototype.show = function () { if ( this.$root ) { console.log(this.$root); this.$root.show() } } 

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
        self.parent.content.show();
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
    var self = this;

    this.$root.find(".close-button").click(function () {
        self.parent.content.hide();
        self.hide();        
        self.parent.collapsed.show();
    });

    this.$root.find(".header .data a").click(function () {
        window.open( $CONFIG.root_url + '/' + $(this).text() )
    });

    this.$buttons = this.$root.find(".buttons");

    this._button_id_prefix = "plack-debugger-button-";
}

Plack.Debugger.UI.Toolbar.prototype.add_new_button = function ( panel ) {
    var $button = jQuery(
        '<div class="button" id="' + this._button_id_prefix + panel.id + '">'
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

    this.$buttons.append( $button );

    var self = this;
    $button.click(function () {
        self.parent.content.hide_all_panels();
        self.parent.content.show_panel_by_id( 
            $(this).attr("id").slice( self._button_id_prefix.length ) 
        ); 
        self.parent.content.show();
    });

    return $button;
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
}

Plack.Debugger.UI.Content.prototype._find_panel_by_id = function ( id ) {
    console.log(["_find_panel_by_id",  id, '#' + this._panel_id_prefix + id]); 
    return this.$root.find( '#' + this._panel_id_prefix + id )
}

// ...

Plack.Debugger.UI.Content.prototype.hide_all_panels = function () { console.log(["hide_all_panels"]); this.$root.find('.panel').hide() }

Plack.Debugger.UI.Content.prototype.show_panel_by_id = function ( id ) { console.log(["show_panel_by_id",  id]); this._find_panel_by_id( id ).show() }
Plack.Debugger.UI.Content.prototype.hide_panel_by_id = function ( id ) { console.log(["hide_panel_by_id",  id]); this._find_panel_by_id( id ).hide() }

Plack.Debugger.UI.Content.prototype.add_new_panel = function ( panel, result_formatter ) {
    var $panel = jQuery(
        '<div class="panel" id="' + this._panel_id_prefix + panel.id + '">'
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
                + result_formatter( panel.result )
            + '</div>'
        + '</div>'
    );

    this.$root.append( $panel );

    var self = this;
    $panel.find(".header > .close-button").click(function () {
        self.hide_panel_by_id( panel.id );
        self.hide();
    });

    return $panel;
}


// ===================================================== //
