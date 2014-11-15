package Plack::App::Debugger;

# ABSTRACT: The web service backend for the debugger

use strict;
use warnings;

use Try::Tiny;
use Scalar::Util qw[ blessed ];

use File::ShareDir;
use File::Spec::Unix ();
use JSON::XS         ();

use Plack::App::File;

use Plack::Debugger;

our $VERSION   = '0.02';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Component';

use constant DEFAULT_BASE_URL => '/debugger';

# Be *extremely* lax about our JSON, this
# might be overkill for simple cases, but 
# for non-simple cases, it just makes sense.
our $JSON = JSON::XS
                ->new
                ->utf8
                #->pretty(1)
                #->canonical(1)
                ->allow_blessed(1)
                ->convert_blessed(1)
                ->allow_nonref(1)
                ->allow_unknown(1);

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'base_url'}         ||= DEFAULT_BASE_URL; 
    $args{'static_url'}       ||= '/static';
    $args{'js_init_url'}      ||= '/js/plack-debugger.js';
    $args{'static_asset_dir'} ||= try { File::ShareDir::dist_dir('Plack-Debugger') } || 'share';

    die "You must pass a reference to a 'Plack::Debugger' instance"
        unless blessed $args{'debugger'} 
            && $args{'debugger'}->isa('Plack::Debugger');

    die "Could not locate the static asssets needed for the Plack::Debugger at (" . $args{'static_asset_dir'} . ")"
        unless -d $args{'static_asset_dir'};

    # ... private data 
    $args{'_static_app'} = Plack::App::File->new( root => $args{'static_asset_dir'} )->to_app;
    $args{'_JSON'}       = $JSON;

    $class->SUPER::new( %args );
}

# accessors ...

sub debugger         { (shift)->{'debugger'}         } # a reference to the Plack::Debugger
sub base_url         { (shift)->{'base_url'}         } # the base URL the debugger application will be mounted at
sub static_url       { (shift)->{'static_url'}       } # the URL root from where the debugger can load static resources
sub js_init_url      { (shift)->{'js_init_url'}      } # the JS application initializer URL
sub static_asset_dir { (shift)->{'static_asset_dir'} } # the directory that the static assets are served from (optional)

# create an injector middleware for this debugger application

sub make_injector_middleware {
    my $self      = shift;
    my $middlware = Plack::Util::load_class('Plack::Middleware::Debugger::Injector');
    my $js_url    = File::Spec::Unix->canonpath(join "" => $self->base_url, $self->static_url, $self->js_init_url);
    my $content   = sub {
        my $env = shift;
        die "Unable to locate the debugger request-uid, cannot inject the debugger application"
            unless exists $env->{'plack.debugger.request_uid'};
        sprintf '<script id="plack-debugger-js-init" type="text/javascript" src="%s#%s"></script>' => ( 
            $js_url, 
            $env->{'plack.debugger.request_uid'} 
        );
    };
    return sub { $middlware->new( content => $content )->wrap( @_ ) }
}

# ...

sub call {
    my $self = shift;
    my $env  = shift;
    my $r    = Plack::Request->new( $env );

    my $static_url = $self->static_url;

    if ( $r->path_info =~ m!^$static_url! ) {
        # clean off the path and 
        # serve the static resources
        $r->env->{'PATH_INFO'} =~ s!^$static_url!!;
        return $self->{'_static_app'}->( $r->env );
    } 
    else {
        # now handle the requests for results ...
        $self->construct_debug_data_response( $r );
    }
}

sub construct_debug_data_response {
    my ($self, $r) = @_;
    my ($req, $err) = $self->validate_and_prepare_request( $r );
    return $err if defined $err;
    $self->_create_JSON_response( 200 => $self->fetch_debug_data_for_request( $req ) );
}

sub validate_and_prepare_request {
    my ($self, $r) = @_;

    # this only supports GET requests    
    return (undef, $self->_create_error_response( 405 => 'Method Not Allowed' ))
            if $r->method ne 'GET';

    my ($request_uid, $get_subrequests, $get_specific_subrequest) = grep { $_ } split '/' => $r->path_info;

    # we need to have a request-id at a minimum
    return (undef, $self->_create_error_response( 400 => 'Bad Request' ))
        unless $request_uid;

    # some debugging help to make sure the UI is robust
    return (undef, $self->_create_error_response( 500 => 'I AM THE CHAOS MONKEY, HEAR ME ROAR!!!!!' )) 
        if Plack::Debugger::DEBUG && (rand() <= $ENV{'PLACK_DEBUGGER_CHAOS_MONKEY_LEVEL'});

    # track the request uid
    my $req = { request_uid => $request_uid };

    # if there is a specific subrequest uid
    $req->{'subrequest_uid'}  = $get_specific_subrequest 
        if $get_specific_subrequest;

    # or if they just want all subrequests
    $req->{'all_subrequests'} = {} 
        if $get_subrequests && !$get_specific_subrequest;

    # handle any special headers 
    if ( my $epoch = $r->header('X-Plack-Debugger-SubRequests-Modified-Since') ) {
        $req->{'all_subrequests'}->{'modified_since'} = $epoch;
    }

    return ($req, undef);
}

sub fetch_debug_data_for_request {
    my ($self, $req) = @_;

    # if no subrequests requested, get the base request
    if ( (not exists $req->{'subrequest_uid'}) && (not exists $req->{'all_subrequests'}) ) {
        return $self->debugger->load_request_results( $req->{'request_uid'} )
    }
    # if no specific subrequest is requested, get all the subrequests for a specific request
    elsif ( (not exists $req->{'subrequest_uid'}) && exists $req->{'all_subrequests'} ) {
        if ( exists $req->{'all_subrequests'}->{'modified_since'} ) {
            return $self->debugger->load_all_subrequest_results_modified_since( 
                $req->{'request_uid'},
                $req->{'all_subrequests'}->{'modified_since'} 
            );
        } 
        else {
            return $self->debugger->load_all_subrequest_results( $req->{'request_uid'} )
        }
    }
    # if a specific subrequest is requested, return that 
    elsif ( exists $req->{'subrequest_uid'} ) {
        return $self->debugger->load_subrequest_results( $req->{'request_uid'}, $req->{'subrequest_uid'} )
    }
    # should never actually get here 
    else {
        die 'Unknown request type';
    }
}

# ...

sub _create_error_response {
    my ($self, $status, $body) = @_;
    return [ $status, [ 'Content-Type' => 'text/plain', 'Content-Length' => length $body ], [ $body ] ]
}

sub _create_JSON_response {
    my ($self, $status, $data) = @_;
    my $json = $self->{'_JSON'}->encode( $data );
    return [ $status, [ 'Content-Type' => 'application/json', 'Content-Length' => length $json ], [ $json ] ]
}

1;

__END__

=head1 DESCRIPTION

This is the web API backend for the L<Plack::Debugger>, its primary 
purpose is to deliver the recorded debugging data to the debugging 
UI. It must be mounted as its own endpoint within your L<Plack> 
application, by default it expects to be mounted at C</debugger> but
this can be changed if needed.

This module is tightly coupled with the L<Plack::Middleware::Debugger::Injector>
in the sense that what is injected by that middleware is the debugging
UI that this module provides the backend for.

=head1 API

=over 4

=item C</static/*>

This serves the static resources (Javascript and CSS) needed by the
debugging UI as well as the debugging UI itself.

=item C</$request_uid>

This will return the data associated with the specified C<$request_uid>
as a single JSON object.

=item C</$request_uid/subrequests>

This will return all the subrequest data associated with the specified 
C<$request_uid> as a JSON array or JSON objects.

If the C<X-Plack-Debugger-SubRequests-Modified-Since> header is set, 
then it will only return the subset of subrequest data that has happened
since the epoch specified in this header.

=item C</$request_uid/subrequests/$subrequest_uid>

This will return the specific subrequest data associated with the  
C<$request_uid> and C<$subrequest_uid> as a JSON object.

=back

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the authors would like to express their gratitude.
