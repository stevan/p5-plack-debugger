package Plack::Middleware::Debugger::Collector;

use strict;
use warnings;

use Scalar::Util qw[ blessed weaken ];

use parent 'Plack::Middleware';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    die "You must pass a reference to a 'Plack::Debugger' instance"
        unless blessed $args{'debugger'} 
            && $args{'debugger'}->isa('Plack::Debugger');

    $class->SUPER::new( %args );
}

# accessors ...

sub debugger { (shift)->{'debugger'} } # a reference to the Plack::Debugger

# ...

sub call {
    my ($self, $env) = @_;

    # NOTE:
    # we needed to weaken the $env 
    # reference here since we are 
    # stuffing it into at least two 
    # closures here and it was leaking,
    # so be careful with this.
    weaken( $env );

    $self->setup_before_phase( $env );
    $self->setup_cleanup_phase( $env );

    $self->response_cb(
        $self->app->( $env ), 
        $self->setup_after_phase( $env )
    );
}

# init/finalize

sub initialize_request { (shift)->debugger->initialize_request( @_ ) }
sub finalize_request   { (shift)->debugger->finalize_request( @_ )   }

# before ...

sub setup_before_phase {
    my ($self, $env) = @_;
    $self->initialize_request( $env );
    $self->run_before_phase( $env );
}

sub run_before_phase { (shift)->debugger->run_before_phase( @_ ) }

# after ...

sub setup_after_phase {
    my ($self, $env) = @_;
    return sub { 
        my $resp = shift;
        $self->run_after_phase( $env, $resp );
    };
}

sub run_after_phase { 
    my ($self, $env, $resp) = @_;
    $self->debugger->run_after_phase( $env, $resp );
    # if cleanup is not supported 
    # then it is best to finalize
    # at this point
    $self->finalize_request( $env )
        unless $env->{'psgix.cleanup'};
}

# cleanup ...

sub setup_cleanup_phase {
    my ($self, $env) = @_;
    # if we have cleanup capabilities
    # then we should register that phase
    # and a callback to finalize the 
    # request as well
    push @{ $env->{'psgix.cleanup.handlers'} } => (
        sub { $self->run_cleanup_phase( $env ) },
    ) if $env->{'psgix.cleanup'};
}

sub run_cleanup_phase {
    my ($self, $env) = @_;
    $self->debugger->run_cleanup_phase( $env );
    $self->finalize_request( $env );
}

1;

__END__