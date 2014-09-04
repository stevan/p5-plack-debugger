package Plack::Middleware::Debugger::Collector;

use strict;
use warnings;

use Scalar::Util qw[ blessed ];

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

    $self->debugger->initialize_request( $env );
    $self->debugger->run_before_phase( $env );

    # if we have cleanup capabilities
    # then we should register that phase
    # and a callback to finalize the 
    # request as well
    push @{ $env->{'psgix.cleanup.handlers'} } => (
        sub { 
            $self->debugger->run_cleanup_phase( $env );
            $self->debugger->finalize_request( $env );
        },
    ) if $env->{'psgix.cleanup'};

    $self->response_cb(
        $self->app->( $env ), 
        sub { 
            my $resp = shift;
            $self->debugger->run_after_phase( $env, $resp );

            # if cleanup is not supported 
            # then it is best to finalize
            # at this point
            $self->debugger->finalize_request( $env )
                unless $env->{'psgix.cleanup'};
        }
    );
}

1;

__END__