package Plack::Debugger;

use strict;
use warnings;

use Scalar::Util qw[ blessed ];
use POSIX        qw[ strftime ];

use Plack::Request;
use Plack::Debugger::Panel;

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

    # stash the request UID
    $env->{'plack.debugger.request_uid'} = $self->uid_generator->();

    # stash the parent request UID (if available)
    $env->{'plack.debugger.parent_request_uid'} = $env->{'HTTP_X_PLACK_DEBUGGER_PARENT_REQUEST_UID'}
        if exists $env->{'HTTP_X_PLACK_DEBUGGER_PARENT_REQUEST_UID'};    
}

sub run_before_phase {
    my ($self, $env) = @_;
    foreach my $panel ( @{ $self->panels } ) {
        $panel->before->( $panel, $env ) if $panel->has_before;
    }
}

sub run_after_phase {
    my ($self, $env, $resp) = @_;
    foreach my $panel ( @{ $self->panels } ) {
        $panel->after->( $panel, $env, $resp ) if $panel->has_after;
    }
}

sub run_cleanup_phase {
    my ($self, $env) = @_;
    foreach my $panel ( @{ $self->panels } ) {
        $panel->cleanup->( $panel, $env ) if $panel->has_cleanup;
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
    $self->storage->load_all_subrequest_results( $request_uid );
}

1;

__END__