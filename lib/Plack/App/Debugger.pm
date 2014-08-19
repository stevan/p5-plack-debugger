package Plack::App::Debugger;

use strict;
use warnings;

use Try::Tiny;
use Scalar::Util qw[ blessed ];

use JSON::XS;
use File::ShareDir;
use File::Spec::Unix ();

use Plack::App::File;

use parent 'Plack::Component';

use constant DEFAULT_BASE_URL => '/debugger';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'base_url'}    ||= DEFAULT_BASE_URL; 
    $args{'static_url'}  ||= '/static';
    $args{'js_init_url'} ||= '/js/__init__.js';

    die "You must pass a reference to a 'Plack::Debugger' instance"
        unless blessed $args{'debugger'} 
            && $args{'debugger'}->isa('Plack::Debugger');

    # ... private data 
    $args{'_share_dir'}  = try { File::ShareDir::dist_dir('Plack-Debugger') } || 'share';
    $args{'_static_app'} = Plack::App::File->new( root => $args{'_share_dir'} )->to_app;
    $args{'_JSON'}       = JSON::XS->new->utf8->pretty;

    $class->SUPER::new( %args );
}

# accessors ...

sub debugger    { (shift)->{'debugger'}    } # a reference to the Plack::Debugger
sub base_url    { (shift)->{'base_url'}    } # the base URL the debugger application will be mounted at
sub static_url  { (shift)->{'static_url'}  } # the URL root from where the debugger can load static resources
sub js_init_url { (shift)->{'js_init_url'} } # the JS application initializer URL

# create an injector middleware for this debugger application

sub make_injector_middleware {
    my $self      = shift;
    my $middlware = Plack::Util::load_class('Plack::Middleware::Debugger::Injector');
    my $content   = sub {
        my $env = shift;
        sprintf '<script id="plack-debugger-js-init" type="text/javascript" src="%s#%s"></script>' => ( 
            File::Spec::Unix->canonpath(join "" => $self->base_url, $self->static_url, $self->js_init_url), 
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

    ## Get static resources ...
    if ( $r->path_info =~ m!^$static_url! ) {
        # clean off the path ...
        $r->env->{'PATH_INFO'} =~ s!^$static_url!!;
        # serve static stuff ...
        return $self->{'_static_app'}->( $r->env );
    } 
    else {

        # this only supports GET requests
        return [ 405, [ 'Content-Type' => 'text/plain', 'Content-Length' => 18 ], [ 'Method Not Allowed' ] ]
            if $r->method ne 'GET';

        my ($request_uid, $get_subrequests, $get_specific_subrequest) = grep { $_ } split '/' => $r->path_info;

        # need a page-id
        return [ 400, [ 'Content-Type' => 'text/plain', 'Content-Length' => 11 ], [ 'Bad Request' ] ]
            unless $request_uid;

        if ( !$get_subrequests ) {
            return [
                200,
                [ 'Content-Type' => 'application/json' ],
                [ 
                    $self->{'_JSON'}->encode({
                        data  => $self->debugger->load_request_results( $request_uid ),
                        links => [
                            { 
                                rel => 'self', 
                                url => (join '/' => $self->base_url, $request_uid)
                            },
                            { 
                                rel => 'subrequest.all', 
                                url => (join '/' => $self->base_url, $request_uid, 'subrequest')
                            }
                        ]
                    })
                ]
            ];
        }
        elsif ( !$get_specific_subrequest ) {
            my $all_subrequests = $self->debugger->load_all_subrequest_results( $request_uid );
            return [
                200,
                [ 'Content-Type' => 'application/json' ],
                [ 
                    $self->{'_JSON'}->encode({
                        data  => $all_subrequests,
                        links => [
                            { 
                                rel => 'self', 
                                url => (join '/' => $self->base_url, $request_uid, 'subrequest')
                            },
                            { 
                                rel => 'request.parent', 
                                url => (join '/' => $self->base_url, $request_uid)
                            },
                            map {
                                {
                                    rel => 'subrequest',
                                    url => (join '/' => $self->base_url, $request_uid, 'subrequest', $_->{'request_uid'})
                                }
                            } @$all_subrequests
                        ]
                    })
                ]
            ];
        }
        else {
            return [
                200,
                [ 'Content-Type' => 'application/json' ],
                [ 
                    $self->{'_JSON'}->encode({
                        data  => $self->debugger->load_subrequest_results( $request_uid, $get_specific_subrequest ),
                        links => [
                            { 
                                rel => 'self', 
                                url => (join '/' => $self->base_url, $request_uid, 'subrequest', $get_specific_subrequest)
                            },
                            { 
                                rel => 'request.parent', 
                                url => (join '/' => $self->base_url, $request_uid)
                            },
                            { 
                                rel => 'subrequest.siblings', 
                                url => (join '/' => $self->base_url, $request_uid, 'subrequest')
                            }
                        ]
                    })
                ]
            ];
        }
        
    }
}

1;

__END__