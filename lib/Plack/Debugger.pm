package Plack::Debugger;

# ABSTRACT: Debugging tool for Plack web applications

use strict;
use warnings;

use Scalar::Util qw[ blessed ];
use POSIX        qw[ strftime ];

our $VERSION   = '0.02';
our $AUTHORITY = 'cpan:STEVAN';

use Plack::Request;
use Plack::Debugger::Panel;

use constant DEBUG => $ENV{'PLACK_DEBUGGER_DEBUG'} ? 1 : 0;

our $UID_SEQ = 0;

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    die "You must provide a storage backend and it must be a subclass of 'Plack::Debugger::Storage'"
        unless blessed $args{'storage'} 
            && $args{'storage'}->isa('Plack::Debugger::Storage');

    if (exists $args{'uid_generator'}) {
        die "The UID generator must be a CODE reference"
            unless ref $args{'uid_generator'} 
                && ref $args{'uid_generator'} eq 'CODE';
    }
    else {
        $args{'uid_generator'} = sub { sprintf '%s-%05d' => (strftime('%F_%T', localtime), ++$UID_SEQ) };
    }

    if (exists $args{'panels'}) {
        die "You must provide panels as an ARRAY ref"
            unless ref $args{'panels'} 
                && ref $args{'panels'} eq 'ARRAY';

        foreach my $panel ( @{$args{'panels'}} ) {
            die "Panel object must be a subclass of Plack::Debugger::Panel"
                unless blessed $panel 
                    && $panel->isa('Plack::Debugger::Panel');
        }
    }
    else {
        $args{'panels'} = [];
    }

    bless {
        storage       => $args{'storage'},
        uid_generator => $args{'uid_generator'},       
        panels        => $args{'panels'},
    } => $class;
}

# accessors 

sub storage       { (shift)->{'storage'}       } # a Plack::Debugger::Storage instance (required)
sub panels        { (shift)->{'panels'}        } # array ref of Plack::Debugger::Panel objects (optional)
sub uid_generator { (shift)->{'uid_generator'} } # a code ref for generating unique IDs (optional)

# create a collector middleware for this debugger

sub make_collector_middleware {
    my $self      = shift;
    my $middlware = Plack::Util::load_class('Plack::Middleware::Debugger::Collector');
    return sub { $middlware->new( debugger => $self )->wrap( @_ ) }
}

# request lifecycle ...

sub initialize_request {
    my ($self, $env) = @_;

    # reset the panels, just in case ...
    $_->reset foreach @{ $self->panels };

    if ( not $env->{'psgix.cleanup'} ) {
        $_->has_cleanup && die 'Cannot use the <' . $_->title . '> debug panel with a `cleanup` phase, this Plack env does not support it'
          foreach @{ $self->panels };
    }

    # stash the request UID
    $env->{'plack.debugger.request_uid'} = $self->uid_generator->();

    # stash the parent request UID (if available)
    $env->{'plack.debugger.parent_request_uid'} = $env->{'HTTP_X_PLACK_DEBUGGER_PARENT_REQUEST_UID'}
        if exists $env->{'HTTP_X_PLACK_DEBUGGER_PARENT_REQUEST_UID'};    
}

sub run_before_phase {
    my ($self, $env) = @_;
    foreach my $panel ( @{ $self->panels } ) {
        $panel->run_before_phase( $env );
    }
}

sub run_after_phase {
    my ($self, $env, $resp) = @_;
    foreach my $panel ( @{ $self->panels } ) {
        $panel->run_after_phase( $env, $resp );
    }
}

sub run_cleanup_phase {
    my ($self, $env) = @_;
    foreach my $panel ( @{ $self->panels } ) {
        $panel->run_cleanup_phase( $env );
    }
}

sub finalize_request {
    my $self = shift;
    my $r    = Plack::Request->new( shift );

    my @results;
    foreach my $panel ( @{ $self->panels } ) {
        next if $panel->is_disabled;
        push @results => { 
            title    => $panel->title,
            subtitle => $panel->subtitle,
            result   => $panel->get_result,
            ($panel->has_notifications 
                ? (notifications => $panel->notifications) 
                : ()),
            ($panel->has_metadata 
                ? (metadata => $panel->metadata) 
                : ())
        };
    }

    if ( exists $r->env->{'plack.debugger.parent_request_uid'} ) {
        $self->store_subrequest_results( $r, \@results );
    }
    else {
        $self->store_request_results( $r, \@results );
    }

    # always good to reset here too ...
    $_->reset foreach @{ $self->panels };
}

# ... delegate to the underlying storage

sub store_request_results {
    my ($self, $r, $results) = @_;
    $self->storage->store_request_results( 
        $r->env->{'plack.debugger.request_uid'}, 
        {
            'method'      => $r->method,
            'uri'         => $r->uri->as_string,
            'timestamp'   => time(),
            'request_uid' => $r->env->{'plack.debugger.request_uid'},
            'results'     => $results 
        }
    );
}

sub store_subrequest_results {
    my ($self, $r, $results) = @_;
    $self->storage->store_subrequest_results( 
        $r->env->{'plack.debugger.parent_request_uid'},
        $r->env->{'plack.debugger.request_uid'}, 
        {
            'method'             => $r->method,
            'uri'                => $r->uri->as_string,
            'timestamp'          => time(),
            'request_uid'        => $r->env->{'plack.debugger.request_uid'},            
            'parent_request_uid' => $r->env->{'plack.debugger.parent_request_uid'},            
            'results'            => $results 
        }
    );
}

sub load_request_results {
    my ($self, $request_uid) = @_;
    $self->storage->load_request_results( $request_uid );
}

sub load_subrequest_results {
    my ($self, $request_uid, $subrequest_uid) = @_;
    $self->storage->load_subrequest_results( $request_uid, $subrequest_uid );
}

sub load_all_subrequest_results {
    my ($self, $request_uid) = @_;
    return [
        sort { 
            # order them sequentially ...
            $b->{'timestamp'} <=> $a->{'timestamp'}
        } @{ $self->storage->load_all_subrequest_results( $request_uid ) }
    ];
}

sub load_all_subrequest_results_modified_since {
    my ($self, $request_uid, $epoch) = @_;
    return [
        sort { 
            # order them sequentially ...
            $b->{'timestamp'} <=> $a->{'timestamp'}
        } @{ $self->storage->load_all_subrequest_results_modified_since( $request_uid, $epoch ) }
    ];
}

1;

__END__

=head1 SYNOPSIS

  use Plack::Builder;
  
  use JSON;
  
  use Plack::Debugger;
  use Plack::Debugger::Storage;
  
  use Plack::App::Debugger;
  
  use Plack::Debugger::Panel::Timer;
  use Plack::Debugger::Panel::AJAX;
  use Plack::Debugger::Panel::Memory;
  use Plack::Debugger::Panel::Warnings;
  
  my $debugger = Plack::Debugger->new(
      storage => Plack::Debugger::Storage->new(
          data_dir     => '/tmp/debugger_panel',
          serializer   => sub { encode_json( shift ) },
          deserializer => sub { decode_json( shift ) },
          filename_fmt => "%s.json",
      ),
      panels => [
          Plack::Debugger::Panel::Timer->new,     
          Plack::Debugger::Panel::AJAX->new, 
          Plack::Debugger::Panel::Memory->new,
          Plack::Debugger::Panel::Warnings->new   
      ]
  );
  
  my $debugger_app = Plack::App::Debugger->new( debugger => $debugger );
  
  builder {
      mount $debugger_app->base_url => $debugger_app->to_app;
  
      mount '/' => builder {
          enable $debugger_app->make_injector_middleware;
          enable $debugger->make_collector_middleware;
          $app;
      }
  };

=head1 DESCRIPTION

This is a rethinking of the excellent L<Plack::Middleware::Debug> 
module, with the specific intent of providing more flexibility and 
supporting capture of debugging data in as many places as possible.
Specifically we support the following features not I<easily> handled
in the previous module. 

=head2 Capturing AJAX requests

This module is able to capture AJAX requests that are performed 
on a page and then associate them with the current request. 

B<NOTE:> This is currently done using jQuery's global AJAX handlers
which means it will only capture AJAX requests made through jQuery.
This is not a limitation, it is possible to capture non-jQuery AJAX
requests too, but given the ubiquity of jQuery it is unlikely that 
will be needed. That said, patches are most welcome :) 

=head2 Capturing post-request data

Not all debugging data may be available during the normal lifecycle
of a request, some data is better captured and collated in some kind
of post-request cleanup phase. This module allows you to specify that
code can be run in the C<psgix.cleanup> phase, which - if your server
supports it - will happens after the request has been sent to the 
browser. 

=head2 Just capturing data

This module has been designed such that it is possible to just 
collect debugging data and not use the provided javascript UI. 
This will allow data to be collected and viewed using some other 
type of mechanism, for instance it would be possible to collect 
data on a web browsing session and view it in aggregate instead 
of just per-page. 

B<NOTE:> While we currently do not provide any code to do this, 
the possibilities are pretty endless if you think about it.

=head1 ARCHITECTURE

=head2 L<Plack::Debugger>

This is the main component of this system, just about every other 
component either uses information from this component or uses the
actual component itself as a delegate. 

The primary responsibilities of this component are to coordinate
the capture of data using the L<Plack::Debugger::Panel> objects 
and to store this data using L<Plack::Debugger::Storage>. 

=head2 L<Plack::Middleware::Debugger::Collector>

This is a simple middleware that wraps your L<Plack> application and
runs all the phases of the L<Plack::Debugger> to collect data upon 
the current request. 

=head2 L<Plack::Middleware::Debugger::Injector>

This is middleware that attempts to sensibly inject a single HTML 
C<<script>> tag into the body of a web request. It analyzes a 
combination of the HTTP status code, headers and the response 
content-type to try and make a sensible decision about injecting 
or not. See the documentation in the module for a more detailed 
description.

=head2 L<Plack::App::Debugger>

This is a small web-service which has two basic responsibilities. The
first is to supply the necessary javascript and CSS for the debugging
UI. The second is to provide a small REST style JSON web-service that
serves up the debugging data. 

=head2 C<Plack.Debugger>

This is the javascript end of this application which powers the UI 
for the debugger. This component uses jQuery heavily and so if there 
is not already a jQuery instance loaded it will pull in its own copy
and use that. 

=head3 Note about jQuery usage

This module ships with the latest jQuery (2.1.1), but the javascript
code used by the Plack.Debugger object has been tested against very 
old versions of jQuery (~1.2.6) to insure that it still functions. 
If you need to support older versions of jQuery, patches are welcome, 
but the author reserves the right to draw a line as to how old is 
too old. 

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the authors would like to express their gratitude.

